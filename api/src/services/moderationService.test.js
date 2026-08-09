import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  userFactory,
  matchFactory,
  userActionFactory,
  blockedUserFactory,
  mutedMatchFactory,
} from '@test-helpers/factories.js';

const {
  muteMatch,
  unmuteMatch,
  isMatchMuted,
  blockUser,
  unblockUser,
  getBlockedUsers,
  isUserBlocked,
  unmatch,
  reportUser,
  getBlockedUserIds,
} = require('./moderationService');

describe('Moderation Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('blockUser', () => {
    it('should create blocked user record', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const result = await blockUser(user1.id, user2.id);

      expect(result.blockedId).toBe(user2.id);
      expect(result.blockedAt).toBeDefined();

      const blockedRecord = await global.prisma.blockedUser.findFirst({
        where: { blockerId: user1.id, blockedId: user2.id },
      });
      expect(blockedRecord).toBeDefined();
    });

    it('should throw error when blocking self', async () => {
      const user1 = await userFactory.create(global.prisma);

      await expect(blockUser(user1.id, user1.id)).rejects.toThrow('Cannot block yourself');
    });

    it('should handle idempotent blocking (upsert)', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      // Block twice
      await blockUser(user1.id, user2.id);
      const result = await blockUser(user1.id, user2.id);

      expect(result.blockedId).toBe(user2.id);

      // Should only have one record
      const blockedRecords = await global.prisma.blockedUser.findMany({
        where: { blockerId: user1.id, blockedId: user2.id },
      });
      expect(blockedRecords.length).toBe(1);
    });

    it('should deactivate all matches between users', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await blockUser(user1.id, user2.id);

      const updatedMatch = await global.prisma.match.findUnique({
        where: { id: match.id },
      });

      expect(updatedMatch.isActive).toBe(false);
      expect(updatedMatch.unmatchedBy).toBe(user1.id);
      expect(updatedMatch.unmatchedAt).toBeDefined();
    });

    it('should set unmatchedBy and unmatchedAt', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);
      const beforeBlock = new Date();

      await blockUser(user1.id, user2.id);

      const updatedMatch = await global.prisma.match.findUnique({
        where: { id: match.id },
      });

      expect(updatedMatch.unmatchedBy).toBe(user1.id);
      expect(new Date(updatedMatch.unmatchedAt) >= beforeBlock).toBe(true);
    });

    it('should keep UserActions between users (so blocked users never re-enter discovery)', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      // Create actions in both directions
      await userActionFactory.createLike(global.prisma, user1.id, user2.id);
      await userActionFactory.createLike(global.prisma, user2.id, user1.id);

      await blockUser(user1.id, user2.id);

      // Deleting these rows used to resurface blocked users in each other's
      // discovery decks (discovery excludes already-acted-on users).
      const actions = await global.prisma.userAction.findMany({
        where: {
          OR: [
            { senderId: user1.id, receiverId: user2.id },
            { senderId: user2.id, receiverId: user1.id },
          ],
        },
      });

      expect(actions.length).toBe(2);
    });

    it('should work when no existing matches', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      // No match exists
      const result = await blockUser(user1.id, user2.id);

      expect(result.blockedId).toBe(user2.id);
    });

    it('should work when no existing actions', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      // No actions exist
      const result = await blockUser(user1.id, user2.id);

      expect(result.blockedId).toBe(user2.id);
    });

    it('should work bidirectionally (block in either direction)', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      // user1 blocks user2
      await blockUser(user1.id, user2.id);

      // user2 blocks user1 (separate record)
      await blockUser(user2.id, user1.id);

      const blocks = await global.prisma.blockedUser.findMany({
        where: {
          OR: [
            { blockerId: user1.id, blockedId: user2.id },
            { blockerId: user2.id, blockedId: user1.id },
          ],
        },
      });

      expect(blocks.length).toBe(2);
    });
  });

  describe('isUserBlocked', () => {
    it('should return true when user1 blocked user2', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      await blockedUserFactory.create(global.prisma, user1.id, user2.id);

      const result = await isUserBlocked(user1.id, user2.id);

      expect(result).toBe(true);
    });

    it('should return true when user2 blocked user1', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      await blockedUserFactory.create(global.prisma, user2.id, user1.id);

      const result = await isUserBlocked(user1.id, user2.id);

      expect(result).toBe(true);
    });

    it('should return false when neither blocked', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const result = await isUserBlocked(user1.id, user2.id);

      expect(result).toBe(false);
    });

    it('should be symmetric (order of params does not matter)', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      await blockedUserFactory.create(global.prisma, user1.id, user2.id);

      const result1 = await isUserBlocked(user1.id, user2.id);
      const result2 = await isUserBlocked(user2.id, user1.id);

      expect(result1).toBe(result2);
    });
  });

  describe('reportUser', () => {
    it('should create report with valid reason', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const result = await reportUser(user1.id, user2.id, 'SPAM');

      expect(result.reportId).toBeDefined();

      const report = await global.prisma.report.findUnique({
        where: { id: result.reportId },
      });
      expect(report.reason).toBe('SPAM');
    });

    it('should throw error when reporting self', async () => {
      const user1 = await userFactory.create(global.prisma);

      await expect(reportUser(user1.id, user1.id, 'SPAM')).rejects.toThrow(
        'Cannot report yourself'
      );
    });

    it('should set status to PENDING', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const result = await reportUser(user1.id, user2.id, 'HARASSMENT');

      const report = await global.prisma.report.findUnique({
        where: { id: result.reportId },
      });
      expect(report.status).toBe('PENDING');
    });

    it('should include description when provided', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const result = await reportUser(
        user1.id,
        user2.id,
        'OTHER',
        'This is a detailed description of the issue.'
      );

      const report = await global.prisma.report.findUnique({
        where: { id: result.reportId },
      });
      expect(report.description).toBe('This is a detailed description of the issue.');
    });

    it('should return reportId', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const result = await reportUser(user1.id, user2.id, 'FAKE_PROFILE');

      expect(typeof result.reportId).toBe('string');
      expect(result.reportId.length).toBeGreaterThan(0);
    });
  });

  describe('unmatch', () => {
    it('should set isActive to false', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const result = await unmatch(user1.id, match.id);

      expect(result.matchId).toBe(match.id);

      const updatedMatch = await global.prisma.match.findUnique({
        where: { id: match.id },
      });
      expect(updatedMatch.isActive).toBe(false);
    });

    it('should set unmatchedBy to current user', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await unmatch(user1.id, match.id);

      const updatedMatch = await global.prisma.match.findUnique({
        where: { id: match.id },
      });
      expect(updatedMatch.unmatchedBy).toBe(user1.id);
    });

    it('should set unmatchedAt timestamp', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);
      const beforeUnmatch = new Date();

      await unmatch(user1.id, match.id);

      const updatedMatch = await global.prisma.match.findUnique({
        where: { id: match.id },
      });
      expect(updatedMatch.unmatchedAt).toBeDefined();
      expect(new Date(updatedMatch.unmatchedAt) >= beforeUnmatch).toBe(true);
    });

    it('should throw error for non-existent match', async () => {
      const user1 = await userFactory.create(global.prisma);

      await expect(unmatch(user1.id, 'non-existent-id')).rejects.toThrow('Match not found');
    });

    it('should throw error for user not in match', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await expect(unmatch(user3.id, match.id)).rejects.toThrow('not part of this match');
    });
  });

  describe('muteMatch', () => {
    it('should create muted match record', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const result = await muteMatch(user1.id, match.id);

      expect(result.matchId).toBe(match.id);
      expect(result.mutedAt).toBeDefined();
    });

    it('should handle idempotent muting', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      // Mute twice
      await muteMatch(user1.id, match.id);
      await muteMatch(user1.id, match.id);

      const mutedRecords = await global.prisma.mutedMatch.findMany({
        where: { userId: user1.id, matchId: match.id },
      });
      expect(mutedRecords.length).toBe(1);
    });

    it('should throw error for non-existent match', async () => {
      const user1 = await userFactory.create(global.prisma);

      await expect(muteMatch(user1.id, 'non-existent-id')).rejects.toThrow('Match not found');
    });

    it('should throw error for user not in match', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await expect(muteMatch(user3.id, match.id)).rejects.toThrow('not part of this match');
    });
  });

  describe('unmuteMatch', () => {
    it('should remove muted record on unmute', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await mutedMatchFactory.create(global.prisma, user1.id, match.id);

      const result = await unmuteMatch(user1.id, match.id);

      expect(result.matchId).toBe(match.id);

      const mutedRecord = await global.prisma.mutedMatch.findUnique({
        where: { userId_matchId: { userId: user1.id, matchId: match.id } },
      });
      expect(mutedRecord).toBeNull();
    });

    it('should not throw if not muted', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      // Should not throw
      const result = await unmuteMatch(user1.id, match.id);
      expect(result.matchId).toBe(match.id);
    });
  });

  describe('isMatchMuted', () => {
    it('should return true when match is muted', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);
      await mutedMatchFactory.create(global.prisma, user1.id, match.id);

      const result = await isMatchMuted(user1.id, match.id);

      expect(result).toBe(true);
    });

    it('should return false when match is not muted', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const result = await isMatchMuted(user1.id, match.id);

      expect(result).toBe(false);
    });
  });

  describe('unblockUser', () => {
    it('should remove blocked user record', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      await blockedUserFactory.create(global.prisma, user1.id, user2.id);

      const result = await unblockUser(user1.id, user2.id);

      expect(result.blockedId).toBe(user2.id);

      const blockedRecord = await global.prisma.blockedUser.findFirst({
        where: { blockerId: user1.id, blockedId: user2.id },
      });
      expect(blockedRecord).toBeNull();
    });
  });

  describe('getBlockedUsers', () => {
    it('should return list of blocked users', async () => {
      const user1 = await userFactory.create(global.prisma, { name: 'Blocker' });
      const user2 = await userFactory.create(global.prisma, { name: 'Blocked User' });

      await blockedUserFactory.create(global.prisma, user1.id, user2.id);

      const result = await getBlockedUsers(user1.id);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(user2.id);
      expect(result[0].name).toBe('Blocked User');
    });

    it('should return empty array when no blocked users', async () => {
      const user1 = await userFactory.create(global.prisma);

      const result = await getBlockedUsers(user1.id);

      expect(result).toEqual([]);
    });
  });

  describe('getBlockedUserIds', () => {
    it('should return IDs of users blocked by current user', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      await blockedUserFactory.create(global.prisma, user1.id, user2.id);

      const result = await getBlockedUserIds(user1.id);

      expect(result).toContain(user2.id);
    });

    it('should return IDs of users who blocked current user', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      // user2 blocked user1
      await blockedUserFactory.create(global.prisma, user2.id, user1.id);

      const result = await getBlockedUserIds(user1.id);

      expect(result).toContain(user2.id);
    });

    it('should return empty array when no blocks', async () => {
      const user1 = await userFactory.create(global.prisma);

      const result = await getBlockedUserIds(user1.id);

      expect(result).toEqual([]);
    });
  });
});
