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

  it('ignores SANDBOX events unless REVENUECAT_ALLOW_SANDBOX is set', async () => {
    const user = await userFactory.create(global.prisma, { isPremium: false });
    const sandboxPurchase = rcEvent({ app_user_id: user.id, environment: 'SANDBOX' });

    const blocked = await request(app)
      .post('/webhooks/revenuecat')
      .set('Authorization', SECRET)
      .send(sandboxPurchase);
    expect(blocked.status).toBe(200);
    let fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh.isPremium).toBe(false);

    process.env.REVENUECAT_ALLOW_SANDBOX = 'true';
    try {
      const allowed = await request(app)
        .post('/webhooks/revenuecat')
        .set('Authorization', SECRET)
        .send(sandboxPurchase);
      expect(allowed.status).toBe(200);
      fresh = await global.prisma.user.findUnique({ where: { id: user.id } });
      expect(fresh.isPremium).toBe(true);
    } finally {
      delete process.env.REVENUECAT_ALLOW_SANDBOX;
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
