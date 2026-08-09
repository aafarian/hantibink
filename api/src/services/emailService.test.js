import { describe, it, expect } from 'vitest';
import { userFactory } from '../../test-setup/helpers/factories.js';
import {
  createEmailVerification,
  verifyEmailWithToken,
  sendVerificationEmail,
  sendWaitlistEmail,
} from './emailService.js';

describe('Email Service', () => {
  describe('verification token lifecycle', () => {
    it('creates a token and verifies it exactly once', async () => {
      const user = await userFactory.create(global.prisma, {
        emailVerified: false,
        onboardingStage: 'SETUP_COMPLETE',
      });

      const token = await createEmailVerification(user.id);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThanOrEqual(64);

      const verified = await verifyEmailWithToken(token);
      expect(verified.id).toBe(user.id);

      const dbUser = await global.prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser.emailVerified).toBe(true);
      expect(dbUser.emailVerificationToken).toBeNull();

      // Second use of the same token fails (one-time use)
      await expect(verifyEmailWithToken(token)).rejects.toThrow(/Invalid or expired/);
    });

    it('rejects unknown tokens', async () => {
      await expect(verifyEmailWithToken('does-not-exist')).rejects.toThrow(
        /Invalid or expired/,
      );
    });
  });

  describe('send fallbacks (no provider configured in tests)', () => {
    it('sendVerificationEmail resolves true via console fallback', async () => {
      await expect(
        sendVerificationEmail('someone@example.com', 'Someone', 'token123'),
      ).resolves.toBe(true);
    });

    it('sendWaitlistEmail resolves true via console fallback', async () => {
      await expect(sendWaitlistEmail('someone@example.com', 'Someone')).resolves.toBe(true);
    });
  });
});
