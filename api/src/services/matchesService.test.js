import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  userFactory,
  photoFactory,
  matchFactory,
  messageFactory,
  userInterestFactory,
} from '@test-helpers/factories.js';

const { getUserMatches, getMatchDetails, deactivateMatch } = require('./matchesService');

describe('Matches Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserMatches', () => {
    it('should return all active matches for a user', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);

      await matchFactory.create(global.prisma, user1.id, user2.id);
      await matchFactory.create(global.prisma, user1.id, user3.id);

      const matches = await getUserMatches(user1.id);

      expect(matches.length).toBe(2);
    });

    it('should include other user details (not current user)', async () => {
      const user1 = await userFactory.create(global.prisma, { name: 'User One' });
      const user2 = await userFactory.create(global.prisma, { name: 'User Two' });
      await photoFactory.create(global.prisma, user2.id, { isMain: true });

      await matchFactory.create(global.prisma, user1.id, user2.id);

      const matches = await getUserMatches(user1.id);

      expect(matches[0].otherUser.name).toBe('User Two');
      expect(matches[0].otherUser.id).toBe(user2.id);
    });

    it('should include last message preview', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      // Create messages
      await messageFactory.create(global.prisma, match.id, user1.id, user2.id, {
        content: 'First message',
      });
      await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        content: 'Last message',
      });

      const matches = await getUserMatches(user1.id);

      expect(matches[0].lastMessage).toBeDefined();
      expect(matches[0].lastMessage.content).toBe('Last message');
    });

    it('should calculate unread count correctly', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      // Create unread messages from user2 to user1
      await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        isRead: false,
      });
      await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        isRead: false,
      });
      // Read message
      await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        isRead: true,
      });
      // User1's own message (shouldn't count)
      await messageFactory.create(global.prisma, match.id, user1.id, user2.id, {
        isRead: false,
      });

      const matches = await getUserMatches(user1.id);

      expect(matches[0].unreadCount).toBe(2);
    });

    it('should calculate age from birthDate', async () => {
      const user1 = await userFactory.create(global.prisma);

      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 28);

      const user2 = await userFactory.create(global.prisma, { birthDate });

      await matchFactory.create(global.prisma, user1.id, user2.id);

      const matches = await getUserMatches(user1.id);

      expect(matches[0].otherUser.age).toBe(28);
    });

    it('should exclude inactive matches', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);

      await matchFactory.create(global.prisma, user1.id, user2.id);

      // Create inactive match
      await global.prisma.match.create({
        data: {
          user1Id: user1.id,
          user2Id: user3.id,
          isActive: false,
        },
      });

      const matches = await getUserMatches(user1.id);

      expect(matches.length).toBe(1);
      expect(matches[0].otherUser.id).toBe(user2.id);
    });

    it('should respect limit and offset', async () => {
      const user1 = await userFactory.create(global.prisma);

      // Create 5 matches
      for (let i = 0; i < 5; i++) {
        const user = await userFactory.create(global.prisma);
        await matchFactory.create(global.prisma, user1.id, user.id);
      }

      const matches = await getUserMatches(user1.id, { limit: 2, offset: 1 });

      expect(matches.length).toBe(2);
    });

    it('should order by createdAt descending', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma, { name: 'First Match' });
      const user3 = await userFactory.create(global.prisma, { name: 'Second Match' });

      // Create first match (older)
      await global.prisma.match.create({
        data: {
          user1Id: user1.id,
          user2Id: user2.id,
          isActive: true,
          createdAt: new Date(Date.now() - 60000), // 1 minute ago
        },
      });

      // Create second match (newer)
      await matchFactory.create(global.prisma, user1.id, user3.id);

      const matches = await getUserMatches(user1.id);

      // Newest match should be first
      expect(matches[0].otherUser.name).toBe('Second Match');
    });

    it('should include photos in other user', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user2.id, { isMain: true, url: 'https://example.com/photo.jpg' });

      await matchFactory.create(global.prisma, user1.id, user2.id);

      const matches = await getUserMatches(user1.id);

      expect(matches[0].otherUser.photos).toBeDefined();
      expect(matches[0].otherUser.photos.length).toBeGreaterThan(0);
    });
  });

  describe('getMatchDetails', () => {
    it('should return full match details with other user', async () => {
      const user1 = await userFactory.create(global.prisma, { name: 'User One' });
      const user2 = await userFactory.create(global.prisma, { name: 'User Two' });
      await photoFactory.create(global.prisma, user2.id, { isMain: true });

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const details = await getMatchDetails(match.id, user1.id);

      expect(details.id).toBe(match.id);
      expect(details.otherUser.name).toBe('User Two');
    });

    it('never exposes credentials or private fields of the other user', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma, {
        latitude: 40.1772,
        longitude: 44.5035,
      });
      await photoFactory.create(global.prisma, user2.id, { isMain: true });
      await global.prisma.user.update({
        where: { id: user2.id },
        data: {
          emailVerificationToken: 'super-secret-verify-token',
          passwordResetToken: 'super-secret-reset-token',
          pushToken: 'ExponentPushToken[secret]',
        },
      });

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);
      const details = await getMatchDetails(match.id, user1.id);

      const forbiddenKeys = [
        'password',
        'email',
        'firebaseUid',
        'emailVerificationToken',
        'passwordResetToken',
        'pushToken',
        'latitude',
        'longitude',
        'birthDate',
        'notifyMessages',
        'dailyLikesUsed',
      ];
      forbiddenKeys.forEach((key) => {
        expect(details.otherUser).not.toHaveProperty(key);
      });

      // Belt and braces: the serialized payload must not contain the secrets
      const serialized = JSON.stringify(details);
      expect(serialized).not.toContain('super-secret-verify-token');
      expect(serialized).not.toContain('super-secret-reset-token');
      expect(serialized).not.toContain(user2.email);

      // But legitimate public profile data still flows
      expect(details.otherUser.age).not.toBeNull();
      expect(details.otherUser.photos.length).toBeGreaterThan(0);
    });

    it('should throw error for non-existent match', async () => {
      const user1 = await userFactory.create(global.prisma);

      await expect(getMatchDetails('non-existent-id', user1.id)).rejects.toThrow(
        'Match not found'
      );
    });

    it('should throw Unauthorized for user not in match', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await expect(getMatchDetails(match.id, user3.id)).rejects.toThrow(
        'Unauthorized'
      );
    });

    it('should throw error for inactive match', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await global.prisma.match.create({
        data: {
          user1Id: user1.id,
          user2Id: user2.id,
          isActive: false,
        },
      });

      await expect(getMatchDetails(match.id, user1.id)).rejects.toThrow(
        'no longer active'
      );
    });

    it('should include user photos and interests', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user2.id, { isMain: true });
      await userInterestFactory.addInterestsToUser(global.prisma, user2.id, ['Travel', 'Music']);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const details = await getMatchDetails(match.id, user1.id);

      expect(details.otherUser.photos).toBeDefined();
      expect(details.otherUser.interests).toBeDefined();
      expect(details.otherUser.interests.length).toBe(2);
    });

    it('should calculate age correctly', async () => {
      const user1 = await userFactory.create(global.prisma);

      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 35);

      const user2 = await userFactory.create(global.prisma, { birthDate });

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const details = await getMatchDetails(match.id, user1.id);

      expect(details.otherUser.age).toBe(35);
    });
  });

  describe('deactivateMatch', () => {
    it('should set isActive to false', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const result = await deactivateMatch(match.id, user1.id);

      expect(result.success).toBe(true);
      expect(result.match.isActive).toBe(false);
    });

    it('should throw error for non-existent match', async () => {
      const user1 = await userFactory.create(global.prisma);

      await expect(deactivateMatch('non-existent-id', user1.id)).rejects.toThrow(
        'Match not found'
      );
    });

    it('should throw Unauthorized for user not in match', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await expect(deactivateMatch(match.id, user3.id)).rejects.toThrow(
        'Unauthorized'
      );
    });

    it('should return updated match', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const result = await deactivateMatch(match.id, user1.id);

      expect(result.match.id).toBe(match.id);
      expect(result.match.isActive).toBe(false);
    });

    it('should not affect other matches', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);

      const match1 = await matchFactory.create(global.prisma, user1.id, user2.id);
      const match2 = await matchFactory.create(global.prisma, user1.id, user3.id);

      await deactivateMatch(match1.id, user1.id);

      const unaffectedMatch = await global.prisma.match.findUnique({
        where: { id: match2.id },
      });

      expect(unaffectedMatch.isActive).toBe(true);
    });
  });
});
