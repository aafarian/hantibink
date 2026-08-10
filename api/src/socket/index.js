/**
 * Socket.IO server: handshake authentication, room authorization, and presence.
 *
 * Every connection must present a valid access token in `handshake.auth.token`.
 * Identity is always derived server-side (`socket.data.userId`) — client-sent
 * user IDs are ignored. Match rooms can only be joined after a membership check.
 */

const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const { getPrismaClient } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Verify the handshake token and attach the authenticated user ID.
 * Rejections are always the opaque 'unauthorized' error — no detail leaks.
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('unauthorized'));
    }

    const decoded = verifyToken(token);

    // Only access tokens may open sockets (refresh/reset tokens are rejected).
    // Legacy access tokens carry no type claim and remain valid.
    if (decoded.type && decoded.type !== 'access') {
      return next(new Error('unauthorized'));
    }

    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return next(new Error('unauthorized'));
    }

    socket.data.userId = user.id;
    return next();
  } catch (error) {
    logger.logSecurity('Socket handshake rejected', socket.handshake.address);
    return next(new Error('unauthorized'));
  }
};

/**
 * Broadcast online status for the connected user to all of their active
 * matches, update lastActive, and record match IDs for disconnect handling.
 */
const announceOnline = async (io, socket, userData) => {
  const userId = socket.data.userId;

  try {
    const prisma = getPrismaClient();

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        isActive: true,
      },
      select: { id: true, user1Id: true, user2Id: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { lastActive: new Date() },
    });

    matches.forEach((match) => {
      const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;
      const onlineData = {
        userId,
        isOnline: true,
        timestamp: new Date(),
      };
      io.to(`user:${otherUserId}`).emit('user-online-status', onlineData);
      io.to(`match:${match.id}`).emit('user-online-status', onlineData);
      userData.matchIds.add(match.id);
    });

    logger.info(`🟢 User ${userId} came online - notified ${matches.length} matches`);
  } catch (error) {
    logger.warn('🟢 Could not broadcast online status:', error.message);
  }
};

/**
 * Load a match and return it only if the given user is one of its members.
 */
const findMatchForMember = async (matchId, userId) => {
  if (!matchId || typeof matchId !== 'string') {
    return null;
  }
  const prisma = getPrismaClient();
  return prisma.match.findFirst({
    where: {
      id: matchId,
      isActive: true,
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    select: { id: true, user1Id: true, user2Id: true, isActive: true },
  });
};

/**
 * Initialize Socket.IO on the given HTTP server.
 * Returns the io instance (also expected to be stored via app.set('io', io)).
 */
const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()) || [
        'http://localhost:8081',
        'exp://192.168.68.67:8081',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(authenticateSocket);

  // Track socket -> user data for proper disconnect handling
  const socketUserMap = new Map();

  // Server-side room revocation: when a match is deactivated (block,
  // unmatch), evict every socket from its room and drop the cached
  // membership so presence, heartbeat, and disconnect broadcasts stop
  // reaching former participants immediately — not just on reconnect.
  io.evictMatchRoom = (matchId) => {
    if (!matchId) {
      return;
    }
    for (const userData of socketUserMap.values()) {
      userData.matchIds.delete(matchId);
    }
    io.in(`match:${matchId}`).socketsLeave(`match:${matchId}`);
  };

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    logger.info(`🔌 User ${userId} connected: ${socket.id}`);
    logger.info(`🔌 Total connected sockets: ${io.engine.clientsCount}`);

    const userData = { userId, matchIds: new Set() };
    socketUserMap.set(socket.id, userData);

    // Personal room membership is automatic and server-derived.
    socket.join(`user:${userId}`);
    announceOnline(io, socket, userData);

    // Legacy alias: older clients emit this with a userId payload.
    // The payload is ignored; re-announcing is harmless and idempotent.
    socket.on('join-user-room', () => {
      socket.join(`user:${userId}`);
      announceOnline(io, socket, userData);
    });

    socket.on('join-match-room', async (matchId) => {
      try {
        const match = await findMatchForMember(matchId, userId);
        if (!match) {
          logger.logSecurity('Rejected join-match-room for non-member', null, userId, {
            matchId,
          });
          socket.emit('socket-error', {
            success: false,
            error: 'FORBIDDEN',
            message: 'Not a member of this match',
          });
          return;
        }

        socket.join(`match:${matchId}`);
        userData.matchIds.add(matchId);
        logger.info(`💬 User ${userId} joined match room: match:${matchId}`);
      } catch (error) {
        logger.warn('💬 join-match-room failed:', error.message);
      }
    });

    socket.on('leave-match-room', (matchId) => {
      socket.leave(`match:${matchId}`);
      userData.matchIds.delete(matchId);
      logger.info(`👋 User ${userId} left match room: ${matchId}`);
    });

    const relayTyping = async (matchId, isTyping, userName) => {
      const match = await findMatchForMember(matchId, userId);
      if (!match) {
        return;
      }

      const typingData = {
        matchId,
        userId,
        userName,
        isTyping,
      };

      // Match room (users with the chat open) + the other user's personal
      // room (threads-list indicators).
      socket.to(`match:${matchId}`).emit('user-typing', typingData);
      const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;
      io.to(`user:${otherUserId}`).emit('user-typing', typingData);
    };

    socket.on('typing-start', async (data) => {
      try {
        await relayTyping(data?.matchId, true, data?.userName);
      } catch (error) {
        logger.warn('⌨️ Could not relay typing-start:', error.message);
      }
    });

    socket.on('typing-stop', async (data) => {
      try {
        await relayTyping(data?.matchId, false, data?.userName);
      } catch (error) {
        logger.warn('⌨️ Could not relay typing-stop:', error.message);
      }
    });

    socket.on('update-online-status', (data) => {
      const isOnline = !!data?.isOnline;
      const statusData = {
        userId,
        isOnline,
        timestamp: new Date(),
      };

      // Only rooms this socket actually joined (membership-verified) are
      // notified — client-sent match ID lists are ignored.
      userData.matchIds.forEach((matchId) => {
        socket.to(`match:${matchId}`).emit('user-online-status', statusData);
      });
      logger.info(
        `🟢 User ${userId} online status: ${isOnline} (sent to ${userData.matchIds.size} matches)`,
      );
    });

    socket.on('heartbeat', async () => {
      try {
        const prisma = getPrismaClient();
        await prisma.user.update({
          where: { id: userId },
          data: { lastActive: new Date() },
        });

        if (userData.matchIds.size > 0) {
          const onlineData = {
            userId,
            isOnline: true,
            timestamp: new Date(),
          };
          userData.matchIds.forEach((matchId) => {
            io.to(`match:${matchId}`).emit('user-online-status', onlineData);
          });
        }
      } catch (error) {
        // Silent fail for heartbeat - don't spam logs
      }
    });

    socket.on('disconnect', async () => {
      logger.info(`🔌 User ${userId} disconnected: ${socket.id}`);

      const offlineData = {
        userId,
        isOnline: false,
        timestamp: new Date(),
      };

      // Update lastActive (updateMany avoids errors if user was deleted)
      try {
        const prisma = getPrismaClient();
        const result = await prisma.user.updateMany({
          where: { id: userId },
          data: { lastActive: new Date() },
        });
        if (result.count === 0) {
          logger.info(`🔴 User ${userId} already deleted, skipping lastActive update`);
        }
      } catch (error) {
        logger.warn('🔴 Could not update lastActive:', error.message);
      }

      userData.matchIds.forEach((matchId) => {
        io.to(`match:${matchId}`).emit('user-online-status', offlineData);
      });

      try {
        const prisma = getPrismaClient();
        const matches = await prisma.match.findMany({
          where: {
            OR: [{ user1Id: userId }, { user2Id: userId }],
            isActive: true,
          },
          select: { user1Id: true, user2Id: true },
        });
        matches.forEach((match) => {
          const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;
          io.to(`user:${otherUserId}`).emit('user-online-status', offlineData);
        });
      } catch (error) {
        logger.warn('🔴 Could not broadcast offline to user rooms:', error.message);
      }

      logger.info(`🔴 User ${userId} went offline (broadcast to ${userData.matchIds.size} matches)`);
      socketUserMap.delete(socket.id);
    });
  });

  return io;
};

module.exports = { initializeSocket, authenticateSocket };
