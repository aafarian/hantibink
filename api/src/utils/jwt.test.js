import { describe, it, expect, beforeEach, vi } from 'vitest';

// Don't mock jsonwebtoken - test the real implementation
const { generateTokenPair, verifyAccessToken, verifyRefreshToken } = require('./jwt.js');

describe('JWT Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const result = generateTokenPair(payload);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('should handle with default JWT_SECRET', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      const payload = { userId: '123' };
      
      // Should use default secret, not throw
      const result = generateTokenPair(payload);
      expect(result).toHaveProperty('accessToken');
      
      process.env.JWT_SECRET = originalSecret;
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const { accessToken } = generateTokenPair(payload);
      
      const result = verifyAccessToken(accessToken);

      expect(result.userId).toBe(payload.userId);
      expect(result.email).toBe(payload.email);
    });

    it('should throw error for invalid token', () => {
      const token = 'invalid-token';
      
      expect(() => verifyAccessToken(token)).toThrow();
    });

    it('should throw error for malformed token', () => {
      const token = 'malformed.token';
      
      expect(() => verifyAccessToken(token)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const { refreshToken } = generateTokenPair(payload);
      
      const result = verifyRefreshToken(refreshToken);

      expect(result.userId).toBe(payload.userId);
    });

    it('should throw error for invalid refresh token', () => {
      const token = 'invalid-token';
      
      expect(() => verifyRefreshToken(token)).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty payload', () => {
      const result = generateTokenPair({});

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should handle null token in verification', () => {
      expect(() => verifyAccessToken(null)).toThrow();
      expect(() => verifyRefreshToken(null)).toThrow();
    });

    it('should handle undefined token in verification', () => {
      expect(() => verifyAccessToken(undefined)).toThrow();
      expect(() => verifyRefreshToken(undefined)).toThrow();
    });

    it('should handle malformed token', () => {
      expect(() => verifyAccessToken('malformed')).toThrow();
    });
  });
});