import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { userFactory } from '../../test-setup/helpers/factories.js';
import { createMockSocketIO } from '../../test-setup/helpers/test-utils.js';
import adminRouter from './admin.js';
import { hasPremiumAccess, grantLaunchTrial } from '../services/premiumService.js';
import { submitVerification } from '../services/verificationService.js';
import { errorHandler } from '../middleware/errorHandler.js';
import notFoundHandler from '../middleware/notFoundHandler.js';

const ADMIN_EMAIL = 'testadmin@example.com';

// Full app shape (routes + notFound + errorHandler) so the "admin routes
// 404 like nonexistent routes" parity assertion is meaningful.
const buildApp = (io = null) => {
  const app = express();
  app.use(express.json());
  if (io) {
    app.set('io', io);
  }
  app.use('/admin', adminRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

const createAdmin = () =>
  userFactory.createWithAuth(global.prisma, { email: ADMIN_EMAIL });

describe('Admin Routes', () => {
  let app;
  let io;
  const originalAdminEmails = process.env.ADMIN_EMAILS;

  beforeAll(() => {
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
  });

  afterAll(() => {
    if (originalAdminEmails === undefined) {
      delete process.env.ADMIN_EMAILS;
    } else {
      process.env.ADMIN_EMAILS = originalAdminEmails;
    }
  });

  beforeEach(() => {
    io = createMockSocketIO();
    io.in = () => ({ disconnectSockets: () => {} });
    app = buildApp(io);
  });

  describe('gating', () => {
    it('admin routes are byte-identical to nonexistent routes for non-admins', async () => {
      const outsider = await userFactory.createWithAuth(global.prisma, {
        email: 'normal@example.com',
      });

      const adminResponse = await request(app)
        .get('/admin/overview')
        .set('Authorization', outsider.authHeader);
      const ghostResponse = await request(app)
        .get('/admin-does-not-exist')
        .set('Authorization', outsider.authHeader);

      expect(adminResponse.status).toBe(404);
      expect(ghostResponse.status).toBe(404);
      // Same JSON shape and message pattern — the surface is not discoverable
      expect(Object.keys(adminResponse.body).sort()).toEqual(
        Object.keys(ghostResponse.body).sort(),
      );
      expect(adminResponse.body.message).toMatch(/Can't find .* on this server!/);
    });

    it('unauthenticated requests get 401 from auth, not an admin hint', async () => {
      const response = await request(app).get('/admin/overview');
      expect(response.status).toBe(401);
    });

    it('GET /admin/check reports false honestly for normal users', async () => {
      const outsider = await userFactory.createWithAuth(global.prisma, {
        email: 'normal2@example.com',
      });
      const response = await request(app)
        .get('/admin/check')
        .set('Authorization', outsider.authHeader);
      expect(response.status).toBe(200);
      expect(response.body.data.isAdmin).toBe(false);
    });

    it('GET /admin/check reports true for allowlisted admins', async () => {
      const adminUser = await createAdmin();
      const response = await request(app)
        .get('/admin/check')
        .set('Authorization', adminUser.authHeader);
      expect(response.body.data.isAdmin).toBe(true);
    });
  });

  describe('overview', () => {
    it('returns totals, rollups, and zero-filled 14-day series', async () => {
      const adminUser = await createAdmin();
      await userFactory.createMany(global.prisma, 3);

      const response = await request(app)
        .get('/admin/overview')
        .set('Authorization', adminUser.authHeader);

      expect(response.status).toBe(200);
      const { totals, rollups, series } = response.body.data;
      expect(totals.users).toBe(4); // 3 + admin
      expect(rollups.today.signups).toBe(4);
      expect(series.signups).toHaveLength(14);
      expect(series.activeUsers).toHaveLength(14);
      expect(series.signups[13].count).toBe(4); // today’s bucket
    });
  });

  describe('user management', () => {
    it('lists and searches users with caps metadata', async () => {
      const adminUser = await createAdmin();
      await userFactory.create(global.prisma, { name: 'Findable Person' });

      const response = await request(app)
        .get('/admin/users')
        .query({ q: 'findable' })
        .set('Authorization', adminUser.authHeader);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBe(1);
      expect(response.body.data.items[0].name).toBe('Findable Person');
      expect(response.body.data).toHaveProperty('capped');
      expect(response.body.data).toHaveProperty('total');
    });

    it('bans a user: isActive false, audit row, force-logout emitted', async () => {
      const adminUser = await createAdmin();
      const target = await userFactory.create(global.prisma);

      const response = await request(app)
        .post(`/admin/users/${target.id}/ban`)
        .set('Authorization', adminUser.authHeader);

      expect(response.status).toBe(200);

      const dbUser = await global.prisma.user.findUnique({ where: { id: target.id } });
      expect(dbUser.isActive).toBe(false);

      const audit = await global.prisma.adminAuditLog.findFirst({
        where: { action: 'user.ban', targetId: target.id },
      });
      expect(audit).not.toBeNull();
      expect(audit.adminEmail).toBe(ADMIN_EMAIL);

      expect(io.findEmit('force-logout', `user:${target.id}`)).toBeDefined();
    });

    it('banned users are rejected by authenticateJWT on their next request', async () => {
      const adminUser = await createAdmin();
      const target = await userFactory.createWithAuth(global.prisma, {
        email: 'banme@example.com',
      });

      await request(app)
        .post(`/admin/users/${target.user.id}/ban`)
        .set('Authorization', adminUser.authHeader);

      // Banned user's still-valid JWT no longer passes auth
      const response = await request(app)
        .get('/admin/check')
        .set('Authorization', target.authHeader);
      expect(response.status).toBe(401);
    });

    it('grants and revokes premium with audit', async () => {
      const adminUser = await createAdmin();
      const target = await userFactory.create(global.prisma);

      await request(app)
        .post(`/admin/users/${target.id}/premium`)
        .set('Authorization', adminUser.authHeader)
        .send({ isPremium: true });

      const dbUser = await global.prisma.user.findUnique({ where: { id: target.id } });
      expect(dbUser.isPremium).toBe(true);

      const audit = await global.prisma.adminAuditLog.findFirst({
        where: { action: 'user.premium.grant', targetId: target.id },
      });
      expect(audit).not.toBeNull();
    });

    it('upgrading seeds the Super Like bank with 2, not back-accrued free days', async () => {
      const adminUser = await createAdmin();
      const tenDaysAgo = new Date(Date.now() - 10 * 86400000);
      const target = await userFactory.create(global.prisma, {
        superLikeAccruedAt: tenDaysAgo,
      });

      await request(app)
        .post(`/admin/users/${target.id}/premium`)
        .set('Authorization', adminUser.authHeader)
        .send({ isPremium: true });

      const { getUserQuotas } = await import('../services/premiumService.js');
      const quotas = await getUserQuotas(target.id);
      expect(quotas.superLikes.remaining).toBe(2);
    });
  });

  describe('reports queue', () => {
    const createReport = async (reporter, reported) =>
      global.prisma.report.create({
        data: {
          reporterId: reporter.id,
          reportedId: reported.id,
          reason: 'SPAM',
          description: 'spammy',
        },
      });

    it('lists pending reports with participants', async () => {
      const adminUser = await createAdmin();
      const [reporter, reported] = await userFactory.createMany(global.prisma, 2);
      await createReport(reporter, reported);

      const response = await request(app)
        .get('/admin/reports')
        .query({ status: 'PENDING' })
        .set('Authorization', adminUser.authHeader);

      expect(response.body.data.items.length).toBe(1);
      expect(response.body.data.items[0].reportedUser.id).toBe(reported.id);
    });

    it('resolve with BAN chains the ban flow', async () => {
      const adminUser = await createAdmin();
      const [reporter, reported] = await userFactory.createMany(global.prisma, 2);
      const report = await createReport(reporter, reported);

      const response = await request(app)
        .post(`/admin/reports/${report.id}/resolve`)
        .set('Authorization', adminUser.authHeader)
        .send({ action: 'BAN', adminNotes: 'Confirmed spam account' });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('RESOLVED');
      expect(response.body.data.reviewedBy).toBe(ADMIN_EMAIL);

      const dbUser = await global.prisma.user.findUnique({ where: { id: reported.id } });
      expect(dbUser.isActive).toBe(false);
    });

    it('rejects double review with 409', async () => {
      const adminUser = await createAdmin();
      const [reporter, reported] = await userFactory.createMany(global.prisma, 2);
      const report = await createReport(reporter, reported);

      await request(app)
        .post(`/admin/reports/${report.id}/dismiss`)
        .set('Authorization', adminUser.authHeader)
        .send({});

      const second = await request(app)
        .post(`/admin/reports/${report.id}/resolve`)
        .set('Authorization', adminUser.authHeader)
        .send({});
      expect(second.status).toBe(409);
    });
  });

  describe('app-version publisher', () => {
    it('publishes and refuses downgrades', async () => {
      const adminUser = await createAdmin();

      const publish = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({ minVersion: '1.1.0', latestVersion: '1.2.0' });
      expect(publish.status).toBe(200);

      const downgrade = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({ latestVersion: '1.1.5' });
      expect(downgrade.status).toBe(400);
      expect(downgrade.body.message).toMatch(/downgrade/i);

      const junk = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({ latestVersion: 'not-a-version' });
      expect(junk.status).toBe(400);
    });

    it('partial publishes preserve omitted force-update fields', async () => {
      const adminUser = await createAdmin();

      await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({
          minVersion: '1.1.0',
          latestVersion: '1.2.0',
          forceUpdate: true,
          updateMessage: 'Please update',
        });

      const partial = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({ latestVersion: '1.3.0' });
      expect(partial.status).toBe(200);
      expect(partial.body.data.forceUpdate).toBe(true);
      expect(partial.body.data.updateMessage).toBe('Please update');
      expect(partial.body.data.minVersion).toBe('1.1.0');
      expect(partial.body.data.latestVersion).toBe('1.3.0');

      const cleared = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({ forceUpdate: false, updateMessage: null });
      expect(cleared.status).toBe(200);
      expect(cleared.body.data.forceUpdate).toBe(false);
      expect(cleared.body.data.updateMessage).toBeNull();
      expect(cleared.body.data.latestVersion).toBe('1.3.0');
    });

    it('publishes, guards, and clears per-platform overrides', async () => {
      const adminUser = await createAdmin();

      // Android-only release: only the android block carries the new version
      const publish = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({
          latestVersion: '1.0.0',
          platforms: { android: { latestVersion: '1.0.1' } },
        });
      expect(publish.status).toBe(200);
      expect(publish.body.data.platforms.android.latestVersion).toBe('1.0.1');
      expect(publish.body.data.platforms.ios).toBeUndefined();
      expect(publish.body.data.latestVersion).toBe('1.0.0');

      // A later ios-only publish must not disturb the android block
      const iosPublish = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({ platforms: { ios: { latestVersion: '1.0.2' } } });
      expect(iosPublish.status).toBe(200);
      expect(iosPublish.body.data.platforms.android.latestVersion).toBe('1.0.1');
      expect(iosPublish.body.data.platforms.ios.latestVersion).toBe('1.0.2');

      const downgrade = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({ platforms: { android: { latestVersion: '1.0.0' } } });
      expect(downgrade.status).toBe(400);
      expect(downgrade.body.message).toMatch(/downgrade/i);

      const junkVersion = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({ platforms: { android: { latestVersion: 'not-a-version' } } });
      expect(junkVersion.status).toBe(400);

      const junkPlatform = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({ platforms: { windows: { latestVersion: '1.0.0' } } });
      expect(junkPlatform.status).toBe(400);

      // Publishes merge field-by-field into the current block, so a
      // latestVersion-only publish can't revert a concurrent forceUpdate
      const fieldMerge = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({ platforms: { android: { forceUpdate: true } } });
      expect(fieldMerge.status).toBe(200);
      expect(fieldMerge.body.data.platforms.android.forceUpdate).toBe(true);
      expect(fieldMerge.body.data.platforms.android.latestVersion).toBe('1.0.1');

      // null clears an override (allowed even though the version goes away)
      const cleared = await request(app)
        .put('/admin/config/app-version')
        .set('Authorization', adminUser.authHeader)
        .send({ platforms: { android: null } });
      expect(cleared.status).toBe(200);
      expect(cleared.body.data.platforms.android).toBeUndefined();
      expect(cleared.body.data.platforms.ios.latestVersion).toBe('1.0.2');
    });
  });

  describe('verification queue', () => {
    const SELFIE = 'https://firebasestorage.googleapis.com/v0/b/hantibink/o/selfie.jpg';

    it('submit -> list -> approve grants the badge exactly once', async () => {
      const adminUser = await createAdmin();
      const subject = await userFactory.createWithAuth(global.prisma, {
        email: 'verifyme@example.com',
      });

      const submitted = await submitVerification(subject.user.id, SELFIE);
      expect(submitted.verificationStatus).toBe('PENDING');

      // Resubmission while pending is refused
      await expect(submitVerification(subject.user.id, SELFIE)).rejects.toThrow(/already in review/i);

      const list = await request(app)
        .get('/admin/verifications')
        .set('Authorization', adminUser.authHeader);
      expect(list.status).toBe(200);
      expect(list.body.data.items.some(u => u.id === subject.user.id)).toBe(true);

      const approve = await request(app)
        .post(`/admin/verifications/${subject.user.id}`)
        .set('Authorization', adminUser.authHeader)
        .send({ action: 'APPROVE' });
      expect(approve.status).toBe(200);

      const fresh = await global.prisma.user.findUnique({
        where: { id: subject.user.id },
        select: { isVerified: true, verificationStatus: true },
      });
      expect(fresh.isVerified).toBe(true);
      expect(fresh.verificationStatus).toBe('APPROVED');

      // Double review races to a 409, and verified users can't resubmit
      const again = await request(app)
        .post(`/admin/verifications/${subject.user.id}`)
        .set('Authorization', adminUser.authHeader)
        .send({ action: 'REJECT' });
      expect(again.status).toBe(409);
      await expect(submitVerification(subject.user.id, SELFIE)).rejects.toThrow(/already verified/i);
    });

    it('reject leaves the user unverified and able to retry', async () => {
      const adminUser = await createAdmin();
      const subject = await userFactory.createWithAuth(global.prisma, {
        email: 'rejectme@example.com',
      });
      await submitVerification(subject.user.id, SELFIE);

      const reject = await request(app)
        .post(`/admin/verifications/${subject.user.id}`)
        .set('Authorization', adminUser.authHeader)
        .send({ action: 'REJECT' });
      expect(reject.status).toBe(200);

      const fresh = await global.prisma.user.findUnique({
        where: { id: subject.user.id },
        select: { isVerified: true, verificationStatus: true },
      });
      expect(fresh.isVerified).toBe(false);
      expect(fresh.verificationStatus).toBe('REJECTED');

      const retry = await submitVerification(subject.user.id, SELFIE);
      expect(retry.verificationStatus).toBe('PENDING');
    });
  });

  describe('launch levers', () => {
    it('publishes quota and promo config with validation', async () => {
      const adminUser = await createAdmin();

      const quotas = await request(app)
        .put('/admin/config/quotas')
        .set('Authorization', adminUser.authHeader)
        .send({ freeLikesPerWindow: 25 });
      expect(quotas.status).toBe(200);
      expect(quotas.body.data.freeLikesPerWindow).toBe(25);

      const badQuota = await request(app)
        .put('/admin/config/quotas')
        .set('Authorization', adminUser.authHeader)
        .send({ freeLikesPerWindow: 0 });
      expect(badQuota.status).toBe(400);

      const promo = await request(app)
        .put('/admin/config/launch-promo')
        .set('Authorization', adminUser.authHeader)
        .send({ enabled: true, trialDays: 3, waitlistOnly: true });
      expect(promo.status).toBe(200);
      expect(promo.body.data).toEqual({ enabled: true, trialDays: 3, waitlistOnly: true });

      const badPromo = await request(app)
        .put('/admin/config/launch-promo')
        .set('Authorization', adminUser.authHeader)
        .send({ enabled: true, trialDays: 90 });
      expect(badPromo.status).toBe(400);
    });

    it('grants the trial to waitlisted signups only (waitlistOnly promo)', async () => {
      const adminUser = await createAdmin();
      await request(app)
        .put('/admin/config/launch-promo')
        .set('Authorization', adminUser.authHeader)
        .send({ enabled: true, trialDays: 3, waitlistOnly: true });

      await global.prisma.waitlist.create({
        data: { email: 'onlist@example.com' },
      });
      const onList = await userFactory.createWithAuth(global.prisma, {
        email: 'onlist@example.com',
      });
      const offList = await userFactory.createWithAuth(global.prisma, {
        email: 'offlist@example.com',
      });

      const granted = await grantLaunchTrial(onList.user.id, 'onlist@example.com');
      expect(granted).toBeInstanceOf(Date);
      expect(granted.getTime()).toBeGreaterThan(Date.now());

      const denied = await grantLaunchTrial(offList.user.id, 'offlist@example.com');
      expect(denied).toBeNull();

      // Trial confers effective premium until it lapses
      expect(hasPremiumAccess({ isPremium: false, trialEndsAt: granted })).toBe(true);
      expect(
        hasPremiumAccess({ isPremium: false, trialEndsAt: new Date(Date.now() - 1000) }),
      ).toBe(false);
      expect(hasPremiumAccess({ isPremium: true, trialEndsAt: null })).toBe(true);
    });
  });

  describe('flags', () => {
    it('round-trips boolean flags and rejects non-boolean values', async () => {
      const adminUser = await createAdmin();

      const put = await request(app)
        .put('/admin/config/flags')
        .set('Authorization', adminUser.authHeader)
        .send({ games_enabled: true, games_gating_enabled: false });
      expect(put.status).toBe(200);

      const get = await request(app)
        .get('/admin/config/flags')
        .set('Authorization', adminUser.authHeader);
      expect(get.body.data).toEqual({ games_enabled: true, games_gating_enabled: false });

      const bad = await request(app)
        .put('/admin/config/flags')
        .set('Authorization', adminUser.authHeader)
        .send({ games_enabled: 'yes' });
      expect(bad.status).toBe(400);
    });
  });

  describe('waitlist', () => {
    it('lists signups and exports CSV', async () => {
      const adminUser = await createAdmin();
      await global.prisma.waitlist.create({
        data: { email: 'fan@example.com', name: 'Big, "Fan"', source: 'tiktok' },
      });

      const list = await request(app)
        .get('/admin/waitlist')
        .set('Authorization', adminUser.authHeader);
      expect(list.body.data.items.length).toBe(1);

      const csv = await request(app)
        .get('/admin/waitlist/export')
        .set('Authorization', adminUser.authHeader);
      expect(csv.status).toBe(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.text).toContain('fan@example.com');
      expect(csv.text).toContain('"Big, ""Fan"""'); // CSV escaping
    });
  });

  describe('audit trail', () => {
    it('lists mutations newest-first', async () => {
      const adminUser = await createAdmin();
      const target = await userFactory.create(global.prisma);

      await request(app)
        .post(`/admin/users/${target.id}/premium`)
        .set('Authorization', adminUser.authHeader)
        .send({ isPremium: true });

      const response = await request(app)
        .get('/admin/audit')
        .set('Authorization', adminUser.authHeader);

      expect(response.status).toBe(200);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      expect(response.body.data.items[0].action).toBe('user.premium.grant');
    });
  });
});
