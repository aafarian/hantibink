import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  userFactory,
  photoFactory,
  matchFactory,
  messageFactory,
} from '@test-helpers/factories.js';

// Import all services for integration testing
const { likeUser, passUser, undoLastAction, getWhoLikedMe } = require('./actionsService');
const { getUsersForDiscovery } = require('./discoveryService');
const { getUserMatches, getMatchDetails } = require('./matchesService');
const { getMessages, sendMessage } = require('./messagesService');
const { blockUser, isUserBlocked } = require('./moderationService');

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Match Flow', () => {
    it('User A likes User B -> User B appears in getWhoLikedMe', async () => {
      const userA = await createDiscoverableUser('MAN', ['WOMAN']);
      const userB = await createDiscoverableUser('WOMAN', ['MAN']);

      // User A likes User B
      await likeUser(userA.id, userB.id, 'LIKE');

      // User B checks who liked them
      const result = await getWhoLikedMe(userB.id);

      expect(result.users.length).toBe(1);
      expect(result.users[0].user.id).toBe(userA.id);
    });

    it('User B likes User A -> Match created, both see in getUserMatches', async () => {
      const userA = await createDiscoverableUser('MAN', ['WOMAN']);
      const userB = await createDiscoverableUser('WOMAN', ['MAN']);

      // Mutual likes
      await likeUser(userA.id, userB.id, 'LIKE');
      const result = await likeUser(userB.id, userA.id, 'LIKE');

      expect(result.isMatch).toBe(true);

      // Both should see the match
      const userAMatches = await getUserMatches(userA.id);
      const userBMatches = await getUserMatches(userB.id);

      expect(userAMatches.length).toBe(1);
      expect(userBMatches.length).toBe(1);
      expect(userAMatches[0].otherUser.id).toBe(userB.id);
      expect(userBMatches[0].otherUser.id).toBe(userA.id);
    });

    it('Users exchange messages -> both see in getMessages', async () => {
      const userA = await createDiscoverableUser('MAN', ['WOMAN']);
      const userB = await createDiscoverableUser('WOMAN', ['MAN']);

      // Create match
      await likeUser(userA.id, userB.id, 'LIKE');
      const matchResult = await likeUser(userB.id, userA.id, 'LIKE');
      const matchId = matchResult.match.id;

      // Exchange messages
      await sendMessage(matchId, userA.id, { content: 'Hello!' });
      await sendMessage(matchId, userB.id, { content: 'Hi there!' });
      await sendMessage(matchId, userA.id, { content: 'How are you?' });

      // Both should see all messages
      const userAMessages = await getMessages(matchId, userA.id);
      const userBMessages = await getMessages(matchId, userB.id);

      expect(userAMessages.length).toBe(3);
      expect(userBMessages.length).toBe(3);
    });

    it('User A blocks User B -> match deactivated, actions removed', async () => {
      const userA = await createDiscoverableUser('MAN', ['WOMAN']);
      const userB = await createDiscoverableUser('WOMAN', ['MAN']);

      // Create match
      await likeUser(userA.id, userB.id, 'LIKE');
      await likeUser(userB.id, userA.id, 'LIKE');

      // Verify match exists
      let userAMatches = await getUserMatches(userA.id);
      expect(userAMatches.length).toBe(1);

      // User A blocks User B
      await blockUser(userA.id, userB.id);

      // Match should be deactivated (not returned)
      userAMatches = await getUserMatches(userA.id);
      expect(userAMatches.length).toBe(0);

      // Actions should be removed
      const actions = await global.prisma.userAction.findMany({
        where: {
          OR: [
            { senderId: userA.id, receiverId: userB.id },
            { senderId: userB.id, receiverId: userA.id },
          ],
        },
      });
      expect(actions.length).toBe(0);
    });
  });

  describe('Discovery and Actions Integration', () => {
    it('User appears in discovery -> User acts -> User no longer in discovery', async () => {
      const userA = await createDiscoverableUser('MAN', ['WOMAN']);
      const userB = await createDiscoverableUser('WOMAN', ['MAN']);

      // User B should appear in User A's discovery
      let discoveryResults = await getUsersForDiscovery(userA.id);
      expect(discoveryResults.some((u) => u.id === userB.id)).toBe(true);

      // User A likes User B
      await likeUser(userA.id, userB.id, 'LIKE');

      // User B should no longer appear in discovery
      discoveryResults = await getUsersForDiscovery(userA.id);
      expect(discoveryResults.some((u) => u.id === userB.id)).toBe(false);
    });

    it('Matched users do not appear in discovery', async () => {
      const userA = await createDiscoverableUser('MAN', ['WOMAN']);
      const userB = await createDiscoverableUser('WOMAN', ['MAN']);

      // Create match
      await likeUser(userA.id, userB.id, 'LIKE');
      await likeUser(userB.id, userA.id, 'LIKE');

      // Neither should appear in each other's discovery
      const userADiscovery = await getUsersForDiscovery(userA.id);
      const userBDiscovery = await getUsersForDiscovery(userB.id);

      expect(userADiscovery.some((u) => u.id === userB.id)).toBe(false);
      expect(userBDiscovery.some((u) => u.id === userA.id)).toBe(false);
    });

    it('Blocked users do not appear in discovery when excluded', async () => {
      const userA = await createDiscoverableUser('MAN', ['WOMAN']);
      const userB = await createDiscoverableUser('WOMAN', ['MAN']);

      // User A blocks User B
      await blockUser(userA.id, userB.id);

      // Get blocked user IDs (this is what routes would call)
      const { getBlockedUserIds } = require('./moderationService');
      const blockedIds = await getBlockedUserIds(userA.id);

      // User B should not appear when blocked IDs are excluded
      const discovery = await getUsersForDiscovery(userA.id, {
        excludeIds: blockedIds,
      });
      expect(discovery.some((u) => u.id === userB.id)).toBe(false);

      // Verify block was detected correctly
      expect(blockedIds).toContain(userB.id);
    });
  });

  describe('Undo Flow', () => {
    it('Like creates match -> Undo removes match and restores counters', async () => {
      const userA = await userFactory.create(global.prisma, { totalMatches: 0 });
      const userB = await userFactory.create(global.prisma, { totalMatches: 0, totalLikes: 0 });

      // User B likes User A first
      await likeUser(userB.id, userA.id, 'LIKE');

      // User A likes User B - creates match
      const result = await likeUser(userA.id, userB.id, 'LIKE');
      expect(result.isMatch).toBe(true);

      // Verify match and counters
      let userAData = await global.prisma.user.findUnique({ where: { id: userA.id } });
      let userBData = await global.prisma.user.findUnique({ where: { id: userB.id } });
      expect(userAData.totalMatches).toBe(1);
      expect(userBData.totalMatches).toBe(1);
      expect(userBData.totalLikes).toBe(1); // From userA's like

      // User A undoes their like
      await undoLastAction(userA.id);

      // Match should be deactivated
      const matches = await getUserMatches(userA.id);
      expect(matches.length).toBe(0);

      // Counters should be restored
      userAData = await global.prisma.user.findUnique({ where: { id: userA.id } });
      userBData = await global.prisma.user.findUnique({ where: { id: userB.id } });
      expect(userAData.totalMatches).toBe(0);
      expect(userBData.totalMatches).toBe(0);
      expect(userBData.totalLikes).toBe(0);
    });

    it('Pass user -> Undo allows user to reappear in discovery', async () => {
      const userA = await createDiscoverableUser('MAN', ['WOMAN']);
      const userB = await createDiscoverableUser('WOMAN', ['MAN']);

      // Verify User B appears in discovery
      let discovery = await getUsersForDiscovery(userA.id);
      expect(discovery.some((u) => u.id === userB.id)).toBe(true);

      // User A passes on User B
      await passUser(userA.id, userB.id);

      // User B should not appear
      discovery = await getUsersForDiscovery(userA.id);
      expect(discovery.some((u) => u.id === userB.id)).toBe(false);

      // Undo the pass
      await undoLastAction(userA.id);

      // User B should reappear
      discovery = await getUsersForDiscovery(userA.id);
      expect(discovery.some((u) => u.id === userB.id)).toBe(true);
    });
  });

  describe('Block Cascading Effects', () => {
    it('Blocking removes from who liked me list', async () => {
      const userA = await createDiscoverableUser('MAN', ['WOMAN']);
      const userB = await createDiscoverableUser('WOMAN', ['MAN']);

      // User B likes User A
      await likeUser(userB.id, userA.id, 'LIKE');

      // User B appears in who liked User A
      let whoLikedMe = await getWhoLikedMe(userA.id);
      expect(whoLikedMe.users.some((u) => u.user.id === userB.id)).toBe(true);

      // User A blocks User B
      await blockUser(userA.id, userB.id);

      // User B should no longer appear (action was deleted)
      whoLikedMe = await getWhoLikedMe(userA.id);
      expect(whoLikedMe.users.some((u) => u.user.id === userB.id)).toBe(false);
    });

    it('Blocked user cannot access match details after block', async () => {
      const userA = await createDiscoverableUser('MAN', ['WOMAN']);
      const userB = await createDiscoverableUser('WOMAN', ['MAN']);

      // Create match
      await likeUser(userA.id, userB.id, 'LIKE');
      const matchResult = await likeUser(userB.id, userA.id, 'LIKE');
      const matchId = matchResult.match.id;

      // Both can access match details
      await expect(getMatchDetails(matchId, userA.id)).resolves.toBeDefined();
      await expect(getMatchDetails(matchId, userB.id)).resolves.toBeDefined();

      // User A blocks User B
      await blockUser(userA.id, userB.id);

      // Match is deactivated, so both get error
      await expect(getMatchDetails(matchId, userA.id)).rejects.toThrow('no longer active');
      await expect(getMatchDetails(matchId, userB.id)).rejects.toThrow('no longer active');
    });
  });
});

// Helper function to create a user eligible for discovery
async function createDiscoverableUser(gender, interestedIn, overrides = {}) {
  const userData = {
    gender,
    interestedIn,
    location: 'New York',
    latitude: 40.7128 + Math.random() * 0.1,
    longitude: -74.006 + Math.random() * 0.1,
    isActive: true,
    ...overrides,
  };

  const user = await userFactory.create(global.prisma, userData);
  await photoFactory.create(global.prisma, user.id, { isMain: true });

  return user;
}
