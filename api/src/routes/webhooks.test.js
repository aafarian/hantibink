import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../test-setup/helpers/test-utils.js';
import { userFactory } from '../../test-setup/helpers/factories.js';
import webhooksRouter from './webhooks.js';

const SECRET = 'test-webhook-secret';

const rcEvent = (overrides = {}) => ({
  event: {
    type: 'INITIAL_PURCHASE',
    app_user_id: 'nobody',
    product_id: 'hantibink_premium_monthly',
    ...overrides,
  },
});

describe('RevenueCat webhook', () => {
  let app;
  let prevSecret;

  beforeAll(() => {
    prevSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
    process.env.REVENUECAT_WEBHOOK_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.REVENUECAT_WEBHOOK_SECRET = prevSecret;
  });

  beforeEach(() => {
    app = createTestApp(webhooksRouter, '/webhooks');
  });

  it('rejects a missing or wrong Authorization header', async () => {
    const noAuth = await request(app).post('/webhooks/revenuecat').send(rcEvent());
    expect(noAuth.status).toBe(401);

    const badAuth = await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', 'wrong')
      .send(rcEvent());
    expect(badAuth.status).toBe(401);
  });

  it('activates premium and seeds the Super Like bank on INITIAL_PURCHASE', async () => {
    const user = await userFactory.create(global.prisma, { isPremium: false });

    const response = await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(rcEvent({ app_user_id: user.id }));

    expect(response.status).toBe(200);
    const fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.isPremium).toBe(true);
    expect(fresh.superLikeBalance).toBeGreaterThanOrEqual(2);
  });

  it('revokes premium on EXPIRATION but keeps the banked balance', async () => {
    const user = await userFactory.create(global.prisma, {
      isPremium: true,
      superLikeBalance: 4,
    });

    const response = await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', `Bearer ${SECRET}`)
      .send(rcEvent({ type: 'EXPIRATION', app_user_id: user.id }));

    expect(response.status).toBe(200);
    const fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.isPremium).toBe(false);
    expect(fresh.superLikeBalance).toBe(4);
  });

  it('acknowledges unknown users and anonymous ids without erroring', async () => {
    const unknown = await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(rcEvent({ app_user_id: 'cm_does_not_exist' }));
    expect(unknown.status).toBe(200);

    const anon = await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(rcEvent({ app_user_id: '$RCAnonymousID:abc123' }));
    expect(anon.status).toBe(200);
  });

  it('honors SANDBOX events only for allowlisted tester accounts', async () => {
    const tester = await userFactory.create(global.prisma, { isPremium: false });
    const civilian = await userFactory.create(global.prisma, { isPremium: false });
    const sandboxPurchase = (userId) =>
      rcEvent({ app_user_id: userId, environment: 'SANDBOX' });

    // No allowlist configured → every sandbox event is ignored
    const blocked = await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(sandboxPurchase(tester.id));
    expect(blocked.status).toBe(200);
    let freshTester = await global.prisma.user.findUnique({ where: { id: tester.id } });
    expect(freshTester.isPremium).toBe(false);

    process.env.REVENUECAT_SANDBOX_USER_IDS = ` ${tester.id} , some-other-tester `;
    try {
      // Allowlisted tester is processed
      const allowed = await request(app)
        .post('/webhooks/revenuecat')
        .set('Authorization', SECRET)
        .send(sandboxPurchase(tester.id));
      expect(allowed.status).toBe(200);
      freshTester = await global.prisma.user.findUnique({ where: { id: tester.id } });
      expect(freshTester.isPremium).toBe(true);

      // Any other production account stays untouched even while testing is on
      const stillBlocked = await request(app)
        .post('/webhooks/revenuecat')
        .set('Authorization', SECRET)
        .send(sandboxPurchase(civilian.id));
      expect(stillBlocked.status).toBe(200);
      const freshCivilian = await global.prisma.user.findUnique({
        where: { id: civilian.id },
      });
      expect(freshCivilian.isPremium).toBe(false);
    } finally {
      delete process.env.REVENUECAT_SANDBOX_USER_IDS;
    }
  });

  it('ignores a stale RENEWAL delivered after a newer EXPIRATION', async () => {
    const user = await userFactory.create(global.prisma, { isPremium: true });
    const renewedAt = Date.parse('2026-08-01T00:00:00Z');
    const expiredAt = Date.parse('2026-08-02T00:00:00Z');

    await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(rcEvent({ type: 'EXPIRATION', app_user_id: user.id, event_timestamp_ms: expiredAt }));
    await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(rcEvent({ type: 'RENEWAL', app_user_id: user.id, event_timestamp_ms: renewedAt }));

    const fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.isPremium).toBe(false);
  });

  it('ignores a stale EXPIRATION delivered after a newer purchase', async () => {
    const user = await userFactory.create(global.prisma, { isPremium: false });
    const expiredAt = Date.parse('2026-08-01T00:00:00Z');
    const repurchasedAt = Date.parse('2026-08-02T00:00:00Z');

    await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(rcEvent({ app_user_id: user.id, event_timestamp_ms: repurchasedAt }));
    await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(rcEvent({ type: 'EXPIRATION', app_user_id: user.id, event_timestamp_ms: expiredAt }));

    const fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.isPremium).toBe(true);
  });

  it('treats a duplicate delivery of the same event as a no-op', async () => {
    const user = await userFactory.create(global.prisma, { isPremium: false });
    const purchase = rcEvent({
      id: 'evt-duplicate-purchase',
      app_user_id: user.id,
      event_timestamp_ms: Date.parse('2026-08-01T00:00:00Z'),
    });

    await request(app).post('/webhooks/revenuecat').set('Authorization', SECRET).send(purchase);
    const afterFirst = await global.prisma.user.findUnique({ where: { id: user.id } });

    const redelivery = await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(purchase);
    expect(redelivery.status).toBe(200);

    const afterSecond = await global.prisma.user.findUnique({ where: { id: user.id } });
    expect(afterSecond.isPremium).toBe(true);
    // The duplicate must not re-run the grant (accrual clock would reset)
    expect(afterSecond.superLikeAccruedAt).toEqual(afterFirst.superLikeAccruedAt);
    expect(afterSecond.rcLastEventAt).toEqual(afterFirst.rcLastEventAt);
  });

  it('lets the grant win an equal-timestamp tie regardless of arrival order', async () => {
    // Renewal boundary: old period's EXPIRATION and the new grant can share
    // a millisecond. Whichever arrives second, premium must survive.
    const user = await userFactory.create(global.prisma, { isPremium: false });
    const at = Date.parse('2026-08-01T00:00:00Z');
    const futureExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

    await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(
        rcEvent({
          id: 'evt-grant',
          app_user_id: user.id,
          event_timestamp_ms: at,
          expiration_at_ms: futureExpiry,
        }),
      );
    let fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.isPremium).toBe(true);

    // Same millisecond, different id, arriving AFTER the grant — refused
    await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(
        rcEvent({
          id: 'evt-expire',
          type: 'EXPIRATION',
          app_user_id: user.id,
          event_timestamp_ms: at,
        }),
      );
    fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.isPremium).toBe(true);
  });

  it('applies a distinct grant that shares a timestamp with the prior EXPIRATION', async () => {
    const user = await userFactory.create(global.prisma, { isPremium: true });
    const at = Date.parse('2026-08-01T00:00:00Z');

    await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(
        rcEvent({
          id: 'evt-expire',
          type: 'EXPIRATION',
          app_user_id: user.id,
          event_timestamp_ms: at,
        }),
      );
    let fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.isPremium).toBe(false);

    await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(rcEvent({ id: 'evt-repurchase', app_user_id: user.id, event_timestamp_ms: at }));
    fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.isPremium).toBe(true);
  });

  it('refuses a grant whose entitlement window has already closed', async () => {
    // A redelivered stale purchase — even one that looks "newest" by
    // timestamp — must never re-open unpaid access once its own
    // expiration has passed.
    const user = await userFactory.create(global.prisma, { isPremium: false });

    const response = await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(
        rcEvent({
          id: 'evt-stale-grant',
          app_user_id: user.id,
          event_timestamp_ms: Date.now(),
          expiration_at_ms: Date.parse('2026-08-01T00:00:00Z'),
        }),
      );

    expect(response.status).toBe(200);
    const fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.isPremium).toBe(false);
  });

  it('ignores non-entitlement events like CANCELLATION', async () => {
    const user = await userFactory.create(global.prisma, { isPremium: true });

    const response = await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(rcEvent({ type: 'CANCELLATION', app_user_id: user.id }));

    expect(response.status).toBe(200);
    const fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
    // Cancelling auto-renew keeps entitlement until EXPIRATION
    expect(fresh.isPremium).toBe(true);
  });
});
