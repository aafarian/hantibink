import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  userFactory,
  photoFactory,
} from '@test-helpers/factories.js';
import { createMockSocketIO, wait } from '@test-helpers/test-utils.js';

const { likeUser, passUser, getUserActions, undoLastAction, getWhoLikedMe } = require('./actionsService');

describe('Actions Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('likeUser', () => {
    it('should create a LIKE action successfully', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const result = await likeUser(user1.id, user2.id, 'LIKE');

      expect(result.success).toBe(true);
      expect(result.action).toBeDefined();
      expect(result.action.senderId).toBe(user1.id);
      expect(result.action.receiverId).toBe(user2.id);
      expect(result.action.action).toBe('LIKE');
      expect(result.isMatch).toBe(false);
    });

    it('should create a SUPER_LIKE action successfully', async () => {
      const user1 = await userFactory.create(global.prisma, { isPremium: true });
      const user2 = await userFactory.create(global.prisma);

      const result = await likeUser(user1.id, user2.id, 'SUPER_LIKE');

      expect(result.success).toBe(true);
      expect(result.action.action).toBe('SUPER_LIKE');
      expect(result.isMatch).toBe(false);
    });

    it('should throw error when action already exists', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      // First like
      await likeUser(user1.id, user2.id, 'LIKE');

      // Second like should fail
      await expect(likeUser(user1.id, user2.id, 'LIKE')).rejects.toThrow(
        'You have already acted on this user'
      );
    });

    it('should increment totalLikes for receiver on LIKE', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma, { totalLikes: 0 });

      await likeUser(user1.id, user2.id, 'LIKE');

      const updatedUser2 = await global.prisma.user.findUnique({
        where: { id: user2.id },
      });
      expect(updatedUser2.totalLikes).toBe(1);
    });

    it('should create match when reverse LIKE exists', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      // User2 likes User1 first
      await likeUser(user2.id, user1.id, 'LIKE');

      // User1 likes User2 back - should create match
      const result = await likeUser(user1.id, user2.id, 'LIKE');

      expect(result.isMatch).toBe(true);
      expect(result.match).toBeDefined();
      expect(result.match.isActive).toBe(true);
    });

    it('should create match when reverse SUPER_LIKE exists', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma, { isPremium: true });

      // User2 super-likes User1
      await likeUser(user2.id, user1.id, 'SUPER_LIKE');

      // User1 likes User2 back
      const result = await likeUser(user1.id, user2.id, 'LIKE');

      expect(result.isMatch).toBe(true);
      expect(result.match).toBeDefined();
    });

    it('should NOT create match when reverse PASS exists', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      // User2 passed on User1
      await passUser(user2.id, user1.id);

      // User1 likes User2 - should NOT create match
      const result = await likeUser(user1.id, user2.id, 'LIKE');

      expect(result.isMatch).toBe(false);
      expect(result.match).toBeNull();
    });

    it('should order user IDs correctly in match (smaller ID first)', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      // Create mutual likes
      await likeUser(user2.id, user1.id, 'LIKE');
      const result = await likeUser(user1.id, user2.id, 'LIKE');

      const match = result.match;
      // user1Id should be the smaller ID
      if (user1.id < user2.id) {
        expect(match.user1Id).toBe(user1.id);
        expect(match.user2Id).toBe(user2.id);
      } else {
        expect(match.user1Id).toBe(user2.id);
        expect(match.user2Id).toBe(user1.id);
      }
    });

    it('should increment totalMatches for both users on match', async () => {
      const user1 = await userFactory.create(global.prisma, { totalMatches: 0 });
      const user2 = await userFactory.create(global.prisma, { totalMatches: 0 });

      await likeUser(user2.id, user1.id, 'LIKE');
      await likeUser(user1.id, user2.id, 'LIKE');

      const updatedUser1 = await global.prisma.user.findUnique({ where: { id: user1.id } });
      const updatedUser2 = await global.prisma.user.findUnique({ where: { id: user2.id } });

      expect(updatedUser1.totalMatches).toBe(1);
      expect(updatedUser2.totalMatches).toBe(1);
    });

    it('should emit new-match to both users via Socket.IO on match', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user1.id, { isMain: true });
      await photoFactory.create(global.prisma, user2.id, { isMain: true });

      const mockIO = createMockSocketIO();

      await likeUser(user2.id, user1.id, 'LIKE');
      await likeUser(user1.id, user2.id, 'LIKE', mockIO);

      const emitCalls = mockIO.getEmitCalls();

      // Should have 3 emits: new-match to user1, new-match to user2, liked-you-update
      expect(emitCalls.length).toBeGreaterThanOrEqual(2);

      const matchEmits = emitCalls.filter((call) => call.event === 'new-match');
      expect(matchEmits.length).toBe(2);
    });

    it('should emit liked-you-update on match', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user1.id, { isMain: true });
      await photoFactory.create(global.prisma, user2.id, { isMain: true });

      const mockIO = createMockSocketIO();

      await likeUser(user2.id, user1.id, 'LIKE');
      await likeUser(user1.id, user2.id, 'LIKE', mockIO);

      const likedYouUpdate = mockIO.findEmit('liked-you-update');
      expect(likedYouUpdate).toBeDefined();
      expect(likedYouUpdate.data.action).toBe('remove');
      expect(likedYouUpdate.data.reason).toBe('matched');
    });

    it('should NOT emit events when io is null', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      await likeUser(user2.id, user1.id, 'LIKE');
      // This should not throw, even without io
      const result = await likeUser(user1.id, user2.id, 'LIKE', null);

      expect(result.isMatch).toBe(true);
    });
  });

  describe('passUser', () => {
    it('should create a PASS action successfully', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const result = await passUser(user1.id, user2.id);

      expect(result.success).toBe(true);
      expect(result.action).toBeDefined();
      expect(result.action.action).toBe('PASS');
      expect(result.isMatch).toBe(false);
    });

    it('should throw error when action already exists', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      await passUser(user1.id, user2.id);

      await expect(passUser(user1.id, user2.id)).rejects.toThrow(
        'You have already acted on this user'
      );
    });

    it('should emit liked-you-update when io is provided', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const mockIO = createMockSocketIO();

      await passUser(user1.id, user2.id, mockIO);

      const likedYouUpdate = mockIO.findEmit('liked-you-update');
      expect(likedYouUpdate).toBeDefined();
      expect(likedYouUpdate.data.action).toBe('remove');
      expect(likedYouUpdate.data.reason).toBe('passed');
    });

    it('should NOT increment any counters', async () => {
      const user1 = await userFactory.create(global.prisma, { totalLikes: 5 });
      const user2 = await userFactory.create(global.prisma, { totalLikes: 10 });

      await passUser(user1.id, user2.id);

      const updatedUser2 = await global.prisma.user.findUnique({ where: { id: user2.id } });
      expect(updatedUser2.totalLikes).toBe(10); // Unchanged
    });
  });

  describe('getUserActions', () => {
    it('should return user action history', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);

      await likeUser(user1.id, user2.id, 'LIKE');
      await passUser(user1.id, user3.id);

      const actions = await getUserActions(user1.id);

      expect(actions.length).toBe(2);
    });

    it('should include receiver details in response', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma, { name: 'Test User' });
      await photoFactory.create(global.prisma, user2.id, { isMain: true });

      await likeUser(user1.id, user2.id, 'LIKE');

      const actions = await getUserActions(user1.id);

      expect(actions[0].receiver).toBeDefined();
      expect(actions[0].receiver.name).toBe('Test User');
    });

    it('should respect limit and offset', async () => {
      const user1 = await userFactory.create(global.prisma);

      // Create 5 users and actions
      for (let i = 0; i < 5; i++) {
        const user = await userFactory.create(global.prisma);
        await likeUser(user1.id, user.id, 'LIKE');
      }

      const actions = await getUserActions(user1.id, { limit: 2, offset: 1 });

      expect(actions.length).toBe(2);
    });

    it('should order by createdAt descending', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);

      await likeUser(user1.id, user2.id, 'LIKE');
      await wait(10); // Small delay to ensure different timestamps
      await passUser(user1.id, user3.id);

      const actions = await getUserActions(user1.id);

      // Most recent action should be first
      expect(actions[0].receiverId).toBe(user3.id);
    });
  });

  describe('undoLastAction', () => {
    it('should throw error when no action to undo', async () => {
      const user1 = await userFactory.create(global.prisma, { isPremium: true });

      await expect(undoLastAction(user1.id)).rejects.toThrow('No action to undo');
    });

    it('should throw error when action is older than 5 minutes', async () => {
      const user1 = await userFactory.create(global.prisma, { isPremium: true });
      const user2 = await userFactory.create(global.prisma);

      // Create action with old timestamp
      await global.prisma.userAction.create({
        data: {
          senderId: user1.id,
          receiverId: user2.id,
          action: 'LIKE',
          createdAt: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes ago
        },
      });

      await expect(undoLastAction(user1.id)).rejects.toThrow('Too late to undo');
    });

    it('should delete the last action successfully', async () => {
      const user1 = await userFactory.create(global.prisma, { isPremium: true });
      const user2 = await userFactory.create(global.prisma);

      await likeUser(user1.id, user2.id, 'LIKE');

      const result = await undoLastAction(user1.id);

      expect(result.success).toBe(true);
      expect(result.undoneAction).toBeDefined();
      expect(result.undoneAction.action).toBe('LIKE');

      // Verify action was deleted
      const actions = await global.prisma.userAction.findMany({
        where: { senderId: user1.id },
      });
      expect(actions.length).toBe(0);
    });

    it('should decrement totalLikes when undoing LIKE', async () => {
      const user1 = await userFactory.create(global.prisma, { isPremium: true });
      const user2 = await userFactory.create(global.prisma, { totalLikes: 0 });

      await likeUser(user1.id, user2.id, 'LIKE');

      // Verify like incremented count
      let updatedUser2 = await global.prisma.user.findUnique({ where: { id: user2.id } });
      expect(updatedUser2.totalLikes).toBe(1);

      // Undo
      await undoLastAction(user1.id);

      updatedUser2 = await global.prisma.user.findUnique({ where: { id: user2.id } });
      expect(updatedUser2.totalLikes).toBe(0);
    });

    it('should deactivate match when undoing LIKE that created it', async () => {
      const user1 = await userFactory.create(global.prisma, { isPremium: true });
      const user2 = await userFactory.create(global.prisma);

      // Create mutual likes (creates match)
      await likeUser(user2.id, user1.id, 'LIKE');
      await likeUser(user1.id, user2.id, 'LIKE');

      // Verify match exists and is active
      let match = await global.prisma.match.findFirst({
        where: {
          OR: [
            { user1Id: user1.id, user2Id: user2.id },
            { user1Id: user2.id, user2Id: user1.id },
          ],
        },
      });
      expect(match.isActive).toBe(true);

      // Undo user1's like
      await undoLastAction(user1.id);

      // Match should be deactivated
      match = await global.prisma.match.findFirst({
        where: { id: match.id },
      });
      expect(match.isActive).toBe(false);
    });

    it('should decrement totalMatches for both users when deactivating match', async () => {
      const user1 = await userFactory.create(global.prisma, { isPremium: true, totalMatches: 0 });
      const user2 = await userFactory.create(global.prisma, { totalMatches: 0 });

      // Create mutual likes
      await likeUser(user2.id, user1.id, 'LIKE');
      await likeUser(user1.id, user2.id, 'LIKE');

      // Verify match counts
      let updatedUser1 = await global.prisma.user.findUnique({ where: { id: user1.id } });
      let updatedUser2 = await global.prisma.user.findUnique({ where: { id: user2.id } });
      expect(updatedUser1.totalMatches).toBe(1);
      expect(updatedUser2.totalMatches).toBe(1);

      // Undo
      await undoLastAction(user1.id);

      updatedUser1 = await global.prisma.user.findUnique({ where: { id: user1.id } });
      updatedUser2 = await global.prisma.user.findUnique({ where: { id: user2.id } });
      expect(updatedUser1.totalMatches).toBe(0);
      expect(updatedUser2.totalMatches).toBe(0);
    });

    it('should NOT deactivate match if reverse action was PASS', async () => {
      const user1 = await userFactory.create(global.prisma, { isPremium: true });
      const user2 = await userFactory.create(global.prisma);

      // User2 passed, then user1 liked
      await passUser(user2.id, user1.id);
      await likeUser(user1.id, user2.id, 'LIKE');

      // No match should exist
      const match = await global.prisma.match.findFirst({
        where: {
          OR: [
            { user1Id: user1.id, user2Id: user2.id },
            { user1Id: user2.id, user2Id: user1.id },
          ],
        },
      });
      expect(match).toBeNull();

      // Undo should still work without match logic
      const result = await undoLastAction(user1.id);
      expect(result.success).toBe(true);
    });

    it('should return the undone action details', async () => {
      const user1 = await userFactory.create(global.prisma, { isPremium: true });
      const user2 = await userFactory.create(global.prisma);

      await likeUser(user1.id, user2.id, 'LIKE');

      const result = await undoLastAction(user1.id);

      expect(result.undoneAction.senderId).toBe(user1.id);
      expect(result.undoneAction.receiverId).toBe(user2.id);
      expect(result.undoneAction.action).toBe('LIKE');
    });
  });

  describe('getWhoLikedMe', () => {
    it('should return users who liked the current user', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user2.id, { isMain: true });

      // User2 likes User1
      await likeUser(user2.id, user1.id, 'LIKE');

      const result = await getWhoLikedMe(user1.id);

      expect(result.users.length).toBe(1);
      expect(result.users[0].user.id).toBe(user2.id);
    });

    it('should exclude users already acted on', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user2.id, { isMain: true });
      await photoFactory.create(global.prisma, user3.id, { isMain: true });

      // Both like user1
      await likeUser(user2.id, user1.id, 'LIKE');
      await likeUser(user3.id, user1.id, 'LIKE');

      // User1 likes user2 back
      await likeUser(user1.id, user2.id, 'LIKE');

      const result = await getWhoLikedMe(user1.id);

      // Only user3 should appear (user2 was acted on)
      expect(result.users.length).toBe(1);
      expect(result.users[0].user.id).toBe(user3.id);
    });

    it('should include action type (LIKE vs SUPER_LIKE)', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma, { isPremium: true });
      await photoFactory.create(global.prisma, user2.id, { isMain: true });

      await likeUser(user2.id, user1.id, 'SUPER_LIKE');

      const result = await getWhoLikedMe(user1.id);

      expect(result.users[0].actionType).toBe('SUPER_LIKE');
    });

    it('should respect limit and offset', async () => {
      const user1 = await userFactory.create(global.prisma);

      // Create 5 users who like user1
      for (let i = 0; i < 5; i++) {
        const user = await userFactory.create(global.prisma);
        await photoFactory.create(global.prisma, user.id, { isMain: true });
        await likeUser(user.id, user1.id, 'LIKE');
      }

      const result = await getWhoLikedMe(user1.id, { limit: 2, offset: 1 });

      expect(result.users.length).toBe(2);
    });

    it('should return totalCount and totalLikesCount', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user2.id, { isMain: true });
      await photoFactory.create(global.prisma, user3.id, { isMain: true });

      // Both like user1
      await likeUser(user2.id, user1.id, 'LIKE');
      await likeUser(user3.id, user1.id, 'LIKE');

      // User1 acts on user2
      await likeUser(user1.id, user2.id, 'LIKE');

      const result = await getWhoLikedMe(user1.id);

      expect(result.totalCount).toBe(1); // Unacted likes
      expect(result.totalLikesCount).toBe(2); // Total likes
    });

    it('should calculate age correctly from birthDate', async () => {
      const user1 = await userFactory.create(global.prisma);

      const birthDate = new Date();
      birthDate.setFullYear(birthDate.getFullYear() - 30);

      const user2 = await userFactory.create(global.prisma, { birthDate });
      await photoFactory.create(global.prisma, user2.id, { isMain: true });

      await likeUser(user2.id, user1.id, 'LIKE');

      const result = await getWhoLikedMe(user1.id);

      expect(result.users[0].user.age).toBe(30);
    });

    it('should include photos in user details', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user2.id, { isMain: true, url: 'https://example.com/photo.jpg' });

      await likeUser(user2.id, user1.id, 'LIKE');

      const result = await getWhoLikedMe(user1.id);

      expect(result.users[0].user.photos).toBeDefined();
      expect(result.users[0].user.photos.length).toBeGreaterThan(0);
    });

    it('should include likedAt timestamp', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user2.id, { isMain: true });

      await likeUser(user2.id, user1.id, 'LIKE');

      const result = await getWhoLikedMe(user1.id);

      expect(result.users[0].likedAt).toBeDefined();
      expect(result.users[0].likedAt instanceof Date).toBe(true);
    });
  });
});
