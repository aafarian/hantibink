import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp, createMockSocketIO } from '@test-helpers/test-utils.js';
import { userFactory, photoFactory } from '@test-helpers/factories.js';
import actionsRouter from './actions.js';

describe('Actions Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp(actionsRouter, '/api/actions');
    // Set up mock Socket.IO
    app.set('io', createMockSocketIO());
    vi.clearAllMocks();
  });

  describe('GET /api/actions', () => {
    it('should return available endpoints', async () => {
      const response = await request(app).get('/api/actions');

      expect(response.status).toBe(200);
      expect(response.body.availableEndpoints).toBeDefined();
      expect(response.body.availableEndpoints.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/actions/quotas', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/actions/quotas');

      expect(response.status).toBe(401);
    });

    it('should return quotas for authenticated user', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .get('/api/actions/quotas')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('likes');
      expect(response.body.data).toHaveProperty('superLikes');
      expect(response.body.data).toHaveProperty('isPremium');
    });

    it('should return premium quotas for premium user', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma, { isPremium: true });

      const response = await request(app)
        .get('/api/actions/quotas')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isPremium).toBe(true);
      expect(response.body.data.canUndo).toBe(true);
    });
  });

  describe('POST /api/actions/like', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/actions/like')
        .send({ targetUserId: 'some-id' });

      expect(response.status).toBe(401);
    });

    it('should like a user successfully', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma);
      const targetUser = await userFactory.create(global.prisma);

      const response = await request(app)
        .post('/api/actions/like')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ targetUserId: targetUser.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.action).toBeDefined();
    });

    it('should return 400 when targetUserId is missing', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .post('/api/actions/like')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return match data when mutual like', async () => {
      const { user: user1, accessToken: accessToken1 } = await userFactory.createWithAuth(global.prisma);
      const { user: user2, accessToken: accessToken2 } = await userFactory.createWithAuth(global.prisma);
      await photoFactory.create(global.prisma, user1.id, { isMain: true });
      await photoFactory.create(global.prisma, user2.id, { isMain: true });

      // User2 likes user1 first
      await request(app)
        .post('/api/actions/like')
        .set('Authorization', `Bearer ${accessToken2}`)
        .send({ targetUserId: user1.id });

      // User1 likes user2 back
      const response = await request(app)
        .post('/api/actions/like')
        .set('Authorization', `Bearer ${accessToken1}`)
        .send({ targetUserId: user2.id });

      expect(response.status).toBe(200);
      expect(response.body.data.isMatch).toBe(true);
      expect(response.body.message).toContain('match');
    });
  });

  describe('POST /api/actions/pass', () => {
    it('should pass on a user successfully', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma);
      const targetUser = await userFactory.create(global.prisma);

      const response = await request(app)
        .post('/api/actions/pass')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ targetUserId: targetUser.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.action.action).toBe('PASS');
    });
  });

  describe('POST /api/actions/super-like', () => {
    it('should return 403 for non-premium user', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma, { isPremium: false });
      const targetUser = await userFactory.create(global.prisma);

      const response = await request(app)
        .post('/api/actions/super-like')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ targetUserId: targetUser.id });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('PREMIUM_REQUIRED');
    });

    it('should super-like successfully for premium user', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma, { isPremium: true });
      const targetUser = await userFactory.create(global.prisma);

      const response = await request(app)
        .post('/api/actions/super-like')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ targetUserId: targetUser.id });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.action.action).toBe('SUPER_LIKE');
    });
  });

  describe('POST /api/actions/undo', () => {
    it('should return 403 for non-premium user', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma, { isPremium: false });

      const response = await request(app)
        .post('/api/actions/undo')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('PREMIUM_REQUIRED');
    });

    it('should return 400 when no action to undo', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma, { isPremium: true });

      const response = await request(app)
        .post('/api/actions/undo')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('No action to undo');
    });

    it('should undo last action for premium user', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma, { isPremium: true });
      const targetUser = await userFactory.create(global.prisma);

      // First like someone
      await request(app)
        .post('/api/actions/like')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ targetUserId: targetUser.id });

      // Then undo
      const response = await request(app)
        .post('/api/actions/undo')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.undoneAction).toBeDefined();
    });
  });

  describe('GET /api/actions/history', () => {
    it('should return action history', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma);
      const targetUser = await userFactory.create(global.prisma);

      // Create some actions
      await request(app)
        .post('/api/actions/like')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ targetUserId: targetUser.id });

      const response = await request(app)
        .get('/api/actions/history')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/actions/who-liked-me', () => {
    it('should return users who liked current user', async () => {
      const { user: user1, accessToken: accessToken1 } = await userFactory.createWithAuth(global.prisma);
      const { user: user2, accessToken: accessToken2 } = await userFactory.createWithAuth(global.prisma);
      await photoFactory.create(global.prisma, user2.id, { isMain: true });

      // User2 likes User1
      await request(app)
        .post('/api/actions/like')
        .set('Authorization', `Bearer ${accessToken2}`)
        .send({ targetUserId: user1.id });

      // User1 checks who liked them
      const response = await request(app)
        .get('/api/actions/who-liked-me')
        .set('Authorization', `Bearer ${accessToken1}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should include premium info in response', async () => {
      const { accessToken } = await userFactory.createWithAuth(global.prisma, { isPremium: true });

      const response = await request(app)
        .get('/api/actions/who-liked-me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isPremium');
      expect(response.body).toHaveProperty('totalCount');
    });
  });
});
