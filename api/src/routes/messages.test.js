import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, expectSuccess, expectError } from '../../test-setup/helpers/test-utils.js';
import { userFactory, matchFactory } from '../../test-setup/helpers/factories.js';
import messagesRouter from './messages.js';

const setupMatchedPair = async () => {
  const auth1 = await userFactory.createWithAuth(global.prisma);
  const auth2 = await userFactory.createWithAuth(global.prisma);
  const match = await matchFactory.create(global.prisma, auth1.user.id, auth2.user.id);
  return { auth1, auth2, match };
};

describe('Messages Routes', () => {
  let app;

  beforeEach(() => {
    app = createTestApp(messagesRouter, '/messages');
  });

  describe('POST /messages/:matchId', () => {
    it('sends a message between matched users', async () => {
      const { auth1, match } = await setupMatchedPair();

      const response = await request(app)
        .post(`/messages/${match.id}`)
        .set('Authorization', auth1.authHeader)
        .send({ content: 'Barev!' });

      const data = expectSuccess(response, 200);
      expect(data.content ?? data.message?.content).toBe('Barev!');
    });

    it('rejects a non-member sender', async () => {
      const { match } = await setupMatchedPair();
      const outsider = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .post(`/messages/${match.id}`)
        .set('Authorization', outsider.authHeader)
        .send({ content: 'let me in' });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('rejects oversized metadata', async () => {
      const { auth1, match } = await setupMatchedPair();

      const response = await request(app)
        .post(`/messages/${match.id}`)
        .set('Authorization', auth1.authHeader)
        .send({
          content: 'hi',
          metadata: JSON.stringify({ blob: 'x'.repeat(3000) }),
        });

      expectError(response, 400);
    });

    it('rejects invalid metadata JSON', async () => {
      const { auth1, match } = await setupMatchedPair();

      const response = await request(app)
        .post(`/messages/${match.id}`)
        .set('Authorization', auth1.authHeader)
        .send({ content: 'hi', metadata: 'not-json{' });

      expectError(response, 400);
    });

    it('rejects non-https media URLs', async () => {
      const { auth1, match } = await setupMatchedPair();

      const response = await request(app)
        .post(`/messages/${match.id}`)
        .set('Authorization', auth1.authHeader)
        .send({ content: 'gif', messageType: 'GIF', mediaUrl: 'http://x.example/g.gif' });

      expectError(response, 400);
    });
  });

  describe('GET /messages/:matchId', () => {
    it('returns messages for a member', async () => {
      const { auth1, match } = await setupMatchedPair();

      await request(app)
        .post(`/messages/${match.id}`)
        .set('Authorization', auth1.authHeader)
        .send({ content: 'first' });

      const response = await request(app)
        .get(`/messages/${match.id}`)
        .set('Authorization', auth1.authHeader);

      const data = expectSuccess(response);
      const messages = data.messages || data;
      expect(messages.length).toBe(1);
    });

    it('refuses a non-member reader', async () => {
      const { match } = await setupMatchedPair();
      const outsider = await userFactory.createWithAuth(global.prisma);

      const response = await request(app)
        .get(`/messages/${match.id}`)
        .set('Authorization', outsider.authHeader);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('PUT /messages/:matchId/read', () => {
    it('marks incoming messages as read', async () => {
      const { auth1, auth2, match } = await setupMatchedPair();

      await request(app)
        .post(`/messages/${match.id}`)
        .set('Authorization', auth1.authHeader)
        .send({ content: 'unread one' });

      const response = await request(app)
        .put(`/messages/${match.id}/read`)
        .set('Authorization', auth2.authHeader);

      expect(response.status).toBe(200);

      const unread = await global.prisma.message.count({
        where: { matchId: match.id, receiverId: auth2.user.id, isRead: false },
      });
      expect(unread).toBe(0);
    });
  });

  describe('reactions', () => {
    it('adds and removes a reaction', async () => {
      const { auth1, auth2, match } = await setupMatchedPair();

      const sent = await request(app)
        .post(`/messages/${match.id}`)
        .set('Authorization', auth1.authHeader)
        .send({ content: 'react to me' });
      const sentData = sent.body.data;
      const messageId = sentData.id ?? sentData.message?.id;

      const add = await request(app)
        .post(`/messages/${match.id}/${messageId}/reaction`)
        .set('Authorization', auth2.authHeader)
        .send({ emoji: '❤️' });
      expect(add.status).toBe(200);

      const remove = await request(app)
        .delete(`/messages/${match.id}/${messageId}/reaction`)
        .set('Authorization', auth2.authHeader)
        .send({ emoji: '❤️' });
      expect(remove.status).toBe(200);

      const reactions = await global.prisma.messageReaction.count({
        where: { messageId },
      });
      expect(reactions).toBe(0);
    });
  });
});
