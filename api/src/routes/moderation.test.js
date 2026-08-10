import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, expectSuccess } from '../../test-setup/helpers/test-utils.js';
import { userFactory, matchFactory } from '../../test-setup/helpers/factories.js';
import moderationRouter from './moderation.js';

describe('Moderation Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp(moderationRouter, '/moderation');
  });

  describe('mute flow', () => {
    it('mutes, reports status, and unmutes a match', async () => {
      const auth1 = await userFactory.createWithAuth(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const match = await matchFactory.create(global.prisma, auth1.user.id, user2.id);

      expectSuccess(
        await request(app)
          .post(`/moderation/mute/${match.id}`)
          .set('Authorization', auth1.authHeader),
      );

      const status = await request(app)
        .get(`/moderation/mute/${match.id}/status`)
        .set('Authorization', auth1.authHeader);
      expect(expectSuccess(status).isMuted).toBe(true);

      expectSuccess(
        await request(app)
          .delete(`/moderation/mute/${match.id}`)
          .set('Authorization', auth1.authHeader),
      );
    });

    it('rejects malformed match IDs at the validator', async () => {
      const auth1 = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .post('/moderation/mute/not-a-real-id')
        .set('Authorization', auth1.authHeader);

      expect(response.status).toBe(400);
    });

    it('404s when muting a match the user is not in', async () => {
      const auth1 = await userFactory.createWithAuth(global.prisma);
      const [user2, user3] = await userFactory.createMany(global.prisma, 2);
      const foreignMatch = await matchFactory.create(global.prisma, user2.id, user3.id);

      const response = await request(app)
        .post(`/moderation/mute/${foreignMatch.id}`)
        .set('Authorization', auth1.authHeader);

      expect(response.status).toBe(404);
    });
  });

  describe('block flow', () => {
    it('blocks, lists, and unblocks a user', async () => {
      const auth1 = await userFactory.createWithAuth(global.prisma);
      const target = await userFactory.create(global.prisma);

      expectSuccess(
        await request(app)
          .post(`/moderation/block/${target.id}`)
          .set('Authorization', auth1.authHeader),
      );

      const list = await request(app)
        .get('/moderation/blocked')
        .set('Authorization', auth1.authHeader);
      const blocked = expectSuccess(list);
      expect(blocked.some((b) => b.id === target.id)).toBe(true);

      expectSuccess(
        await request(app)
          .delete(`/moderation/block/${target.id}`)
          .set('Authorization', auth1.authHeader),
      );
    });

    it('rejects blocking yourself with a 400', async () => {
      const auth1 = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .post(`/moderation/block/${auth1.user.id}`)
        .set('Authorization', auth1.authHeader);

      expect(response.status).toBe(400);
    });
  });

  describe('report flow', () => {
    it('accepts a valid report and stores it as PENDING', async () => {
      const auth1 = await userFactory.createWithAuth(global.prisma);
      const target = await userFactory.create(global.prisma);

      const response = await request(app)
        .post('/moderation/report')
        .set('Authorization', auth1.authHeader)
        .send({ reportedId: target.id, reason: 'SPAM', description: 'Sent me a crypto link' });

      expectSuccess(response);

      const report = await global.prisma.report.findFirst({
        where: { reportedId: target.id },
      });
      expect(report.status).toBe('PENDING');
      expect(report.reporterId).toBe(auth1.user.id);
    });

    it('rejects invalid reasons at the validator', async () => {
      const auth1 = await userFactory.createWithAuth(global.prisma);
      const target = await userFactory.create(global.prisma);

      const response = await request(app)
        .post('/moderation/report')
        .set('Authorization', auth1.authHeader)
        .send({ reportedId: target.id, reason: 'BAD_VIBES' });

      expect(response.status).toBe(400);
    });
  });

  describe('unmatch flow', () => {
    it('deactivates the match for a member', async () => {
      const auth1 = await userFactory.createWithAuth(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const match = await matchFactory.create(global.prisma, auth1.user.id, user2.id);

      expectSuccess(
        await request(app)
          .post(`/moderation/unmatch/${match.id}`)
          .set('Authorization', auth1.authHeader),
      );

      const dbMatch = await global.prisma.match.findUnique({ where: { id: match.id } });
      expect(dbMatch.isActive).toBe(false);
    });
  });
});
