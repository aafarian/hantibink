import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from 'http';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { initializeSocket } from './index.js';
import { generateTokenPair } from '../utils/jwt.js';
import { userFactory, matchFactory } from '../../test-setup/helpers/factories.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';

let httpServer;
let io;
let serverUrl;
const clients = [];

const connectClient = (auth) =>
  ioClient(serverUrl, {
    transports: ['websocket'],
    reconnection: false,
    auth,
  });

const trackedClient = (auth) => {
  const client = connectClient(auth);
  clients.push(client);
  return client;
};

const waitForEvent = (socket, event, timeoutMs = 2000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for "${event}"`)),
      timeoutMs,
    );
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const expectNoEvent = (socket, event, waitMs = 300) =>
  new Promise((resolve, reject) => {
    const onEvent = (payload) =>
      reject(new Error(`Unexpected "${event}": ${JSON.stringify(payload)}`));
    socket.once(event, onEvent);
    setTimeout(() => {
      socket.off(event, onEvent);
      resolve();
    }, waitMs);
  });

beforeAll(async () => {
  httpServer = createServer();
  io = initializeSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  serverUrl = `http://localhost:${httpServer.address().port}`;
});

afterAll(async () => {
  io.close();
  await new Promise((resolve) => httpServer.close(resolve));
});

beforeEach(() => {
  while (clients.length) {
    const client = clients.pop();
    if (client.connected) {
      client.disconnect();
    }
    client.close();
  }
});

describe('Socket handshake authentication', () => {
  it('rejects a connection with no token', async () => {
    const client = trackedClient({});
    const error = await waitForEvent(client, 'connect_error');
    expect(error.message).toBe('unauthorized');
    expect(client.connected).toBe(false);
  });

  it('rejects a garbage token', async () => {
    const client = trackedClient({ token: 'not-a-jwt' });
    const error = await waitForEvent(client, 'connect_error');
    expect(error.message).toBe('unauthorized');
  });

  it('rejects a refresh token', async () => {
    const user = await userFactory.create(global.prisma);
    const { refreshToken } = generateTokenPair({ userId: user.id, email: user.email });
    const client = trackedClient({ token: refreshToken });
    const error = await waitForEvent(client, 'connect_error');
    expect(error.message).toBe('unauthorized');
  });

  it('rejects a valid token for an inactive user', async () => {
    const user = await userFactory.create(global.prisma, { isActive: false });
    const { accessToken } = generateTokenPair({ userId: user.id, email: user.email });
    const client = trackedClient({ token: accessToken });
    const error = await waitForEvent(client, 'connect_error');
    expect(error.message).toBe('unauthorized');
  });

  it('rejects a forged token signed with the wrong secret', async () => {
    const user = await userFactory.create(global.prisma);
    const forged = jwt.sign({ userId: user.id, type: 'access' }, 'wrong-secret', {
      issuer: 'hantibink-api',
      audience: 'hantibink-app',
    });
    const client = trackedClient({ token: forged });
    const error = await waitForEvent(client, 'connect_error');
    expect(error.message).toBe('unauthorized');
  });

  it('accepts a valid access token', async () => {
    const user = await userFactory.create(global.prisma);
    const { accessToken } = generateTokenPair({ userId: user.id, email: user.email });
    const client = trackedClient({ token: accessToken });
    await waitForEvent(client, 'connect');
    expect(client.connected).toBe(true);
  });

  it('accepts a legacy access token without a type claim', async () => {
    const user = await userFactory.create(global.prisma);
    const legacy = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: '1h',
      issuer: 'hantibink-api',
      audience: 'hantibink-app',
    });
    const client = trackedClient({ token: legacy });
    await waitForEvent(client, 'connect');
    expect(client.connected).toBe(true);
  });
});

describe('Room authorization', () => {
  it('auto-joins the personal room server-side (ignoring client identity claims)', async () => {
    const user = await userFactory.create(global.prisma);
    const { accessToken } = generateTokenPair({ userId: user.id, email: user.email });
    const client = trackedClient({ token: accessToken });
    await waitForEvent(client, 'connect');

    const received = waitForEvent(client, 'personal-ping');
    io.to(`user:${user.id}`).emit('personal-ping', { ok: true });
    await expect(received).resolves.toEqual({ ok: true });
  });

  it('lets a match member join the match room and receive room events', async () => {
    const [user1, user2] = await userFactory.createMany(global.prisma, 2);
    const match = await matchFactory.create(global.prisma, user1.id, user2.id);
    const { accessToken } = generateTokenPair({ userId: user1.id, email: user1.email });

    const client = trackedClient({ token: accessToken });
    await waitForEvent(client, 'connect');

    client.emit('join-match-room', match.id);
    // join is async server-side (membership query); poll the room until joined
    await new Promise((resolve) => setTimeout(resolve, 300));

    const received = waitForEvent(client, 'room-ping');
    io.to(`match:${match.id}`).emit('room-ping', { matchId: match.id });
    await expect(received).resolves.toEqual({ matchId: match.id });
  });

  it('refuses join-match-room for a non-member and emits socket-error', async () => {
    const [user1, user2, outsider] = await userFactory.createMany(global.prisma, 3);
    const match = await matchFactory.create(global.prisma, user1.id, user2.id);
    const { accessToken } = generateTokenPair({
      userId: outsider.id,
      email: outsider.email,
    });

    const client = trackedClient({ token: accessToken });
    await waitForEvent(client, 'connect');

    const errorEvent = waitForEvent(client, 'socket-error');
    client.emit('join-match-room', match.id);
    const payload = await errorEvent;
    expect(payload.error).toBe('FORBIDDEN');

    // And the room must not deliver events to the outsider
    const silence = expectNoEvent(client, 'room-ping');
    io.to(`match:${match.id}`).emit('room-ping', { secret: true });
    await silence;
  });

  it('does not relay typing events for matches the sender is not in', async () => {
    const [user1, user2, outsider] = await userFactory.createMany(global.prisma, 3);
    const match = await matchFactory.create(global.prisma, user1.id, user2.id);

    const memberToken = generateTokenPair({ userId: user1.id, email: user1.email });
    const outsiderToken = generateTokenPair({
      userId: outsider.id,
      email: outsider.email,
    });

    const memberClient = trackedClient({ token: memberToken.accessToken });
    const outsiderClient = trackedClient({ token: outsiderToken.accessToken });
    await waitForEvent(memberClient, 'connect');
    await waitForEvent(outsiderClient, 'connect');

    // Outsider tries to fake typing into someone else's match: nothing arrives
    // at the member's personal room.
    const silence = expectNoEvent(memberClient, 'user-typing');
    outsiderClient.emit('typing-start', { matchId: match.id, userName: 'Mallory' });
    await silence;

    // A real member's typing does reach the other member's personal room.
    const user2Token = generateTokenPair({ userId: user2.id, email: user2.email });
    const user2Client = trackedClient({ token: user2Token.accessToken });
    await waitForEvent(user2Client, 'connect');

    const typing = waitForEvent(user2Client, 'user-typing');
    memberClient.emit('typing-start', { matchId: match.id, userName: user1.name });
    const typingPayload = await typing;
    expect(typingPayload.userId).toBe(user1.id);
    expect(typingPayload.isTyping).toBe(true);
  });
});
