import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, expectSuccess, expectError } from '../../test-setup/helpers/test-utils.js';
import { userFactory, photoFactory } from '../../test-setup/helpers/factories.js';
import usersRouter from './users.js';

describe('Users Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp(usersRouter, '/users');
  });

  describe('GET /users/profile', () => {
    it('returns the authenticated profile without credentials', async () => {
      const { authHeader, user } = await userFactory.createWithAuth(global.prisma);

      const response = await request(app).get('/users/profile').set('Authorization', authHeader);

      const data = expectSuccess(response);
      const profile = data.user || data;
      expect(profile.id).toBe(user.id);
      expect(profile).not.toHaveProperty('password');
    });

    it('rejects unauthenticated requests', async () => {
      const response = await request(app).get('/users/profile');
      expect(response.status).toBe(401);
    });
  });

  describe('POST /users/photos', () => {
    const storageUrl = (userId, folder = 'profile-photos') =>
      `https://firebasestorage.googleapis.com/v0/b/hantibink.firebasestorage.app/o/${encodeURIComponent(`${folder}/${userId}_1.jpg`)}?alt=media`;

    it('accepts a photo the user uploaded to our bucket', async () => {
      const { authHeader, user } = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .post('/users/photos')
        .set('Authorization', authHeader)
        .send({ photoUrl: storageUrl(user.id), isMain: true });

      expectSuccess(response);
    });

    it("rejects another user's object in our bucket (ownership)", async () => {
      const { authHeader } = await userFactory.createWithAuth(global.prisma);
      const other = await userFactory.createWithAuth(global.prisma, {
        email: 'other-owner@example.com',
      });

      const response = await request(app)
        .post('/users/photos')
        .set('Authorization', authHeader)
        .send({ photoUrl: storageUrl(other.user.id) });

      expectError(response, 400);
    });

    it('rejects https URLs outside our storage host', async () => {
      const { authHeader } = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .post('/users/photos')
        .set('Authorization', authHeader)
        .send({ photoUrl: 'https://evil.example.com/hotlinked.jpg' });

      expectError(response, 400);
    });

    it('rejects non-https photo URLs', async () => {
      const { authHeader } = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .post('/users/photos')
        .set('Authorization', authHeader)
        .send({ photoUrl: 'http://insecure.example.com/photo.jpg' });

      expectError(response, 400);
    });

    it('rejects garbage photo URLs', async () => {
      const { authHeader } = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .post('/users/photos')
        .set('Authorization', authHeader)
        .send({ photoUrl: 'javascript:alert(1)' });

      expectError(response, 400);
    });
  });

  describe('PUT /users/preferences', () => {
    it('updates preferences within bounds', async () => {
      const { authHeader } = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .put('/users/preferences')
        .set('Authorization', authHeader)
        .send({ ageRange: { min: 21, max: 35 }, distance: 40 });

      const data = expectSuccess(response);
      expect(data.ageRange).toEqual({ min: 21, max: 35 });
      expect(data.distance).toBe(40);
    });

    it('rejects out-of-bounds ages and distance', async () => {
      const { authHeader } = await userFactory.createWithAuth(global.prisma);

      expectError(
        await request(app)
          .put('/users/preferences')
          .set('Authorization', authHeader)
          .send({ ageRange: { min: 12, max: 30 } }),
        400,
      );
      expectError(
        await request(app)
          .put('/users/preferences')
          .set('Authorization', authHeader)
          .send({ ageRange: { min: 30, max: 20 } }),
        400,
      );
      expectError(
        await request(app)
          .put('/users/preferences')
          .set('Authorization', authHeader)
          .send({ distance: 9999 }),
        400,
      );
    });
  });

  describe('PUT /users/notification-settings', () => {
    it('updates with strict booleans and rejects non-booleans', async () => {
      const { authHeader } = await userFactory.createWithAuth(global.prisma);

      const ok = await request(app)
        .put('/users/notification-settings')
        .set('Authorization', authHeader)
        .send({ messages: false, likes: true });
      const data = expectSuccess(ok);
      expect(data.messages).toBe(false);
      expect(data.likes).toBe(true);

      const bad = await request(app)
        .put('/users/notification-settings')
        .set('Authorization', authHeader)
        .send({ messages: 'yes' });
      expectError(bad, 400);
    });
  });

  describe('POST /users/push-token/clear', () => {
    it('requires authentication (regression: was public)', async () => {
      const response = await request(app)
        .post('/users/push-token/clear')
        .send({ pushToken: 'ExponentPushToken[abc]' });

      expect(response.status).toBe(401);
    });

    it('clears the token across accounts when authenticated', async () => {
      const token = 'ExponentPushToken[shared-device]';
      const { authHeader } = await userFactory.createWithAuth(global.prisma, {
        pushToken: token,
      });
      const otherAccount = await userFactory.create(global.prisma, { pushToken: token });

      const response = await request(app)
        .post('/users/push-token/clear')
        .set('Authorization', authHeader)
        .send({ pushToken: token });

      expect(response.status).toBe(200);

      const other = await global.prisma.user.findUnique({ where: { id: otherAccount.id } });
      expect(other.pushToken).toBeNull();
    });
  });

  describe('profile pause/resume', () => {
    it('pauses and resumes discovery visibility', async () => {
      const { authHeader, user } = await userFactory.createWithAuth(global.prisma);
      await photoFactory.create(global.prisma, user.id, { isMain: true });

      const pause = await request(app)
        .put('/users/profile/pause')
        .set('Authorization', authHeader);
      expect(pause.status).toBe(200);

      let dbUser = await global.prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser.isProfilePaused).toBe(true);

      const resume = await request(app)
        .put('/users/profile/resume')
        .set('Authorization', authHeader);
      expect(resume.status).toBe(200);

      dbUser = await global.prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser.isProfilePaused).toBe(false);
    });
  });
});
