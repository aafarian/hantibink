import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  userFactory,
  photoFactory,
  matchFactory,
  messageFactory,
} from '@test-helpers/factories.js';
import { createMockSocketIO } from '@test-helpers/test-utils.js';

const { getMessages, sendMessage, markMessagesAsRead, deleteMessage } = require('./messagesService');

describe('Messages Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMessages', () => {
    it('should return messages for a valid match', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await messageFactory.create(global.prisma, match.id, user1.id, user2.id, {
        content: 'Hello!',
      });
      await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        content: 'Hi there!',
      });

      const messages = await getMessages(match.id, user1.id);

      expect(messages.length).toBe(2);
    });

    it('should throw error for non-existent match', async () => {
      const user1 = await userFactory.create(global.prisma);

      await expect(getMessages('non-existent-id', user1.id)).rejects.toThrow(
        'Match not found'
      );
    });

    it('should throw Unauthorized for user not in match', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await expect(getMessages(match.id, user3.id)).rejects.toThrow('Unauthorized');
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

      await expect(getMessages(match.id, user1.id)).rejects.toThrow('no longer active');
    });

    it('should return messages in chronological order', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      // Create messages with specific order
      await global.prisma.message.create({
        data: {
          matchId: match.id,
          senderId: user1.id,
          receiverId: user2.id,
          content: 'First',
          createdAt: new Date(Date.now() - 2000),
        },
      });
      await global.prisma.message.create({
        data: {
          matchId: match.id,
          senderId: user2.id,
          receiverId: user1.id,
          content: 'Second',
          createdAt: new Date(Date.now() - 1000),
        },
      });
      await global.prisma.message.create({
        data: {
          matchId: match.id,
          senderId: user1.id,
          receiverId: user2.id,
          content: 'Third',
          createdAt: new Date(),
        },
      });

      const messages = await getMessages(match.id, user1.id);

      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
      expect(messages[2].content).toBe('Third');
    });

    it('should include replyTo details', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const originalMessage = await messageFactory.create(global.prisma, match.id, user1.id, user2.id, {
        content: 'Original message',
      });

      await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        content: 'Reply to original',
        replyToId: originalMessage.id,
      });

      const messages = await getMessages(match.id, user1.id);

      const reply = messages.find((m) => m.content === 'Reply to original');
      expect(reply.replyTo).toBeDefined();
      expect(reply.replyTo.content).toBe('Original message');
    });

    it('should respect limit and offset', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      // Create 10 messages
      for (let i = 0; i < 10; i++) {
        await messageFactory.create(global.prisma, match.id, user1.id, user2.id);
      }

      const messages = await getMessages(match.id, user1.id, { limit: 5, offset: 2 });

      expect(messages.length).toBe(5);
    });

    it('should include isFromMe flag correctly', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await messageFactory.create(global.prisma, match.id, user1.id, user2.id, {
        content: 'From user1',
      });
      await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        content: 'From user2',
      });

      const messages = await getMessages(match.id, user1.id);

      const fromMe = messages.find((m) => m.content === 'From user1');
      const fromOther = messages.find((m) => m.content === 'From user2');

      expect(fromMe.isFromMe).toBe(true);
      expect(fromOther.isFromMe).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('should create TEXT message successfully', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const message = await sendMessage(match.id, user1.id, {
        content: 'Hello!',
        messageType: 'TEXT',
      });

      expect(message.content).toBe('Hello!');
      expect(message.messageType).toBe('TEXT');
      expect(message.senderId).toBe(user1.id);
    });

    it('should create GIF message with [GIF] preview', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await sendMessage(match.id, user1.id, {
        content: 'https://giphy.com/test.gif',
        messageType: 'GIF',
        mediaUrl: 'https://giphy.com/test.gif',
      });

      const updatedMatch = await global.prisma.match.findUnique({
        where: { id: match.id },
      });

      expect(updatedMatch.lastMessage).toBe('[GIF]');
    });

    it('should create IMAGE message with [Image] preview', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await sendMessage(match.id, user1.id, {
        content: 'https://example.com/image.jpg',
        messageType: 'IMAGE',
        mediaUrl: 'https://example.com/image.jpg',
      });

      const updatedMatch = await global.prisma.match.findUnique({
        where: { id: match.id },
      });

      expect(updatedMatch.lastMessage).toBe('[Image]');
    });

    it('should throw error for non-existent match', async () => {
      const user1 = await userFactory.create(global.prisma);

      await expect(
        sendMessage('non-existent-id', user1.id, { content: 'Hello' })
      ).rejects.toThrow('Match not found');
    });

    it('should throw Unauthorized for user not in match', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      const user3 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await expect(
        sendMessage(match.id, user3.id, { content: 'Hello' })
      ).rejects.toThrow('Unauthorized');
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

      await expect(
        sendMessage(match.id, user1.id, { content: 'Hello' })
      ).rejects.toThrow('inactive match');
    });

    it('should create message with replyToId', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const original = await sendMessage(match.id, user1.id, {
        content: 'Original message',
      });

      const reply = await sendMessage(match.id, user2.id, {
        content: 'This is a reply',
        replyToId: original.id,
      });

      expect(reply.replyTo).toBeDefined();
      expect(reply.replyTo.content).toBe('Original message');
    });

    it('should update match.lastMessage', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await sendMessage(match.id, user1.id, {
        content: 'Latest message',
      });

      const updatedMatch = await global.prisma.match.findUnique({
        where: { id: match.id },
      });

      expect(updatedMatch.lastMessage).toBe('Latest message');
    });

    it('should update match.lastMessageTime', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);
      const beforeSend = new Date();

      await sendMessage(match.id, user1.id, {
        content: 'Test message',
      });

      const updatedMatch = await global.prisma.match.findUnique({
        where: { id: match.id },
      });

      expect(updatedMatch.lastMessageTime).toBeDefined();
      expect(new Date(updatedMatch.lastMessageTime) >= beforeSend).toBe(true);
    });

    it('should emit new-message to match room via Socket.IO', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user1.id, { isMain: true });

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);
      const mockIO = createMockSocketIO();

      await sendMessage(match.id, user1.id, { content: 'Test' }, mockIO);

      const newMessageEmit = mockIO.findEmit('new-message', `match:${match.id}`);
      expect(newMessageEmit).toBeDefined();
    });

    it('should emit new-message to receiver user room', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user1.id, { isMain: true });

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);
      const mockIO = createMockSocketIO();

      await sendMessage(match.id, user1.id, { content: 'Test' }, mockIO);

      const userRoomEmit = mockIO.findEmit('new-message', `user:${user2.id}`);
      expect(userRoomEmit).toBeDefined();
    });

    it('should emit message-notification to receiver', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);
      await photoFactory.create(global.prisma, user1.id, { isMain: true });

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);
      const mockIO = createMockSocketIO();

      await sendMessage(match.id, user1.id, { content: 'Test' }, mockIO);

      const notificationEmit = mockIO.findEmit('message-notification', `user:${user2.id}`);
      expect(notificationEmit).toBeDefined();
    });
  });

  describe('markMessagesAsRead', () => {
    it('should mark messages from other user as read', async () => {
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

      const result = await markMessagesAsRead(match.id, user1.id);

      expect(result.success).toBe(true);
      expect(result.markedCount).toBe(2);

      // Verify messages are now read
      const messages = await global.prisma.message.findMany({
        where: { matchId: match.id },
      });
      expect(messages.every((m) => m.isRead === true)).toBe(true);
    });

    it('should NOT mark own messages as read', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      // Create unread message from user1
      await messageFactory.create(global.prisma, match.id, user1.id, user2.id, {
        isRead: false,
      });

      const result = await markMessagesAsRead(match.id, user1.id);

      // Should not mark own message as read
      expect(result.markedCount).toBe(0);
    });

    it('should set readAt timestamp', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        isRead: false,
        readAt: null,
      });

      await markMessagesAsRead(match.id, user1.id);

      const messages = await global.prisma.message.findMany({
        where: { matchId: match.id },
      });

      expect(messages[0].readAt).toBeDefined();
    });

    it('should respect messageIds filter', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const msg1 = await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        isRead: false,
      });
      await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        isRead: false,
      });

      // Only mark first message as read
      const result = await markMessagesAsRead(match.id, user1.id, [msg1.id]);

      expect(result.markedCount).toBe(1);
    });

    it('should emit messages-read via Socket.IO', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        isRead: false,
      });

      const mockIO = createMockSocketIO();

      await markMessagesAsRead(match.id, user1.id, [], mockIO);

      const readEmit = mockIO.findEmit('messages-read');
      expect(readEmit).toBeDefined();
    });

    it('should emit read-receipt to sender', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      await messageFactory.create(global.prisma, match.id, user2.id, user1.id, {
        isRead: false,
      });

      const mockIO = createMockSocketIO();

      await markMessagesAsRead(match.id, user1.id, [], mockIO);

      const receiptEmit = mockIO.findEmit('read-receipt', `user:${user2.id}`);
      expect(receiptEmit).toBeDefined();
    });
  });

  describe('deleteMessage', () => {
    it('should delete own message successfully', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const message = await messageFactory.create(global.prisma, match.id, user1.id, user2.id);

      const result = await deleteMessage(message.id, user1.id);

      expect(result.success).toBe(true);
      expect(result.deletedMessage.id).toBe(message.id);

      // Verify message is deleted
      const deletedMessage = await global.prisma.message.findUnique({
        where: { id: message.id },
      });
      expect(deletedMessage).toBeNull();
    });

    it('should throw error for non-existent message', async () => {
      const user1 = await userFactory.create(global.prisma);

      await expect(deleteMessage('non-existent-id', user1.id)).rejects.toThrow(
        'Message not found'
      );
    });

    it('should throw error when deleting other users message', async () => {
      const user1 = await userFactory.create(global.prisma);
      const user2 = await userFactory.create(global.prisma);

      const match = await matchFactory.create(global.prisma, user1.id, user2.id);

      const message = await messageFactory.create(global.prisma, match.id, user2.id, user1.id);

      await expect(deleteMessage(message.id, user1.id)).rejects.toThrow(
        'only delete your own'
      );
    });
  });
});
