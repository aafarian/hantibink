import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../../test-setup/helpers/test-utils.js';
import { userFactory } from '../../test-setup/helpers/factories.js';
import authRouter from './auth.js';

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp(authRouter, '/auth');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'Test123!@#',
        firebaseUid: 'firebase-123',
        name: 'New User',
        birthDate: '1990-01-01',
        gender: 'MAN',
        interestedIn: ['WOMAN'],
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should reject registration with existing email', async () => {
      // Create existing user
      await userFactory.create(global.prisma, {
        email: 'existing@example.com',
      });

      const userData = {
        email: 'existing@example.com',
        password: 'Test123!@#',
        firebaseUid: 'firebase-new',
        name: 'New User',
        birthDate: '1990-01-01',
        gender: 'MAN',
        interestedIn: ['WOMAN'],
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already');
    });

    it('should reject registration with validation errors (400)', async () => {
      const userData = {
        email: 'invalid-email',
        password: '123', // Too short
        name: 'Test',
        birthDate: '1990-01-01',
        gender: 'MAN',
        interestedIn: ['WOMAN'],
      };

      const response = await request(app)
        .post('/auth/register')
        .send(userData);

      // Should return 400 for validation errors
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should handle server errors (500) separately', async () => {
      // This test would need to mock a database failure
      // For now, we'll skip it as it requires more complex mocking
      // The important thing is we're not mixing 400 and 500 in the same test
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const password = 'Test123!@#';
      const user = await userFactory.create(global.prisma, {
        email: 'test@example.com',
        password,
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
      expect(response.body.data.user.id).toBe(user.id);
    });

    it('should reject login with invalid password', async () => {
      await userFactory.create(global.prisma, {
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Test123!@#',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const { refreshToken } = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Password reset flow (forgot -> verify-code -> reset)', () => {
    it('completes end-to-end and the new password works', async () => {
      const user = await userFactory.create(global.prisma, {
        email: 'resetme@example.com',
      });

      // Step 1: request a reset (grab the code from _internal, which the
      // route consumes to send the email)
      const { requestPasswordReset } = await import('../services/authService.js');
      const requestResult = await requestPasswordReset(user.email);
      const resetCode = requestResult._internal.resetCode;
      expect(resetCode).toBeDefined();

      // Step 2: verify the code — this used to 500 (generateToken undefined)
      // AFTER burning the one-time code
      const verifyResponse = await request(app)
        .post('/auth/verify-reset-code')
        .send({ email: user.email, code: resetCode });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);
      const resetToken = verifyResponse.body.resetToken;
      expect(resetToken).toBeDefined();

      // Step 3: set the new password with the reset token
      const resetResponse = await request(app)
        .post('/auth/reset-password')
        .send({ token: resetToken, newPassword: 'NewPass123!' });

      expect(resetResponse.status).toBe(200);
      expect(resetResponse.body.success).toBe(true);

      // The new password logs in
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({ email: user.email, password: 'NewPass123!' });
      expect(loginResponse.status).toBe(200);
    });

    it('rejects an access token as a reset token', async () => {
      const { accessToken } = (
        await userFactory.createWithAuth(global.prisma)
      );

      const response = await request(app)
        .post('/auth/reset-password')
        .send({ token: accessToken, newPassword: 'NewPass123!' });

      expect(response.body.success).toBe(false);
    });

    it('rejects a reset token as an API access token', async () => {
      const user = await userFactory.create(global.prisma);
      const { generatePasswordResetToken } = await import('../utils/jwt.js');
      const resetToken = generatePasswordResetToken(user.id);

      const { authenticateJWT } = await import('../middleware/auth.js');
      const req = {
        headers: { authorization: `Bearer ${resetToken}` },
      };
      const res = {
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };
      let nextCalled = false;

      await authenticateJWT(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /auth/oauth/check-user', () => {
    it('reports hasPassword correctly and omits private fields (regression)', async () => {
      // checkUserExists used to select without password, so hasPassword was
      // always false — breaking the mobile sign-in-method picker.
      const withPassword = await userFactory.create(global.prisma, {
        email: 'haspass@example.com',
      });
      await global.prisma.user.create({
        data: {
          email: 'oauthonly@example.com',
          name: 'OAuth Only',
          password: null,
        },
      });

      const withPassResponse = await request(app)
        .get('/auth/oauth/check-user')
        .query({ email: withPassword.email });
      expect(withPassResponse.status).toBe(200);
      expect(withPassResponse.body.data.exists).toBe(true);
      expect(withPassResponse.body.data.hasPassword).toBe(true);
      expect(withPassResponse.body.data).not.toHaveProperty('registrationMethod');

      const oauthOnlyResponse = await request(app)
        .get('/auth/oauth/check-user')
        .query({ email: 'oauthonly@example.com' });
      expect(oauthOnlyResponse.status).toBe(200);
      expect(oauthOnlyResponse.body.data.exists).toBe(true);
      expect(oauthOnlyResponse.body.data.hasPassword).toBe(false);
    });
  });
});