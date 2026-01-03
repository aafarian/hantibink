/**
 * Hantibink API Server
 * Main entry point for the backend API
 */

// Only load .env file in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Initialize Sentry FIRST - before any other imports
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    beforeSend(event) {
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEBUG) {
        return null;
      }
      return event;
    },
  });
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Import configurations and middleware
const logger = require('./utils/logger');

// ===== DATABASE ENVIRONMENT VALIDATION =====
// Prevent accidental use of wrong database
(function validateDatabaseEnvironment() {
  const dbUrl = process.env.DATABASE_URL || '';
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Safety check: In production, ensure we're not using localhost
  if (nodeEnv === 'production') {
    if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
      logger.error('❌ NODE_ENV is "production" but DATABASE_URL points to localhost!');
      logger.error('❌ Production must use a remote database. Exiting.');
      process.exit(1);
    }
  }

  // Log which database we're connecting to (sanitized)
  const sanitizedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
  logger.info(`📊 Database environment: ${nodeEnv}`);
  logger.info(`📊 Database URL: ${sanitizedUrl.substring(0, 60)}...`);
})();

logger.info('Starting Hantibink API Server...');
const { errorHandler } = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const {
  connectDatabase,
  gracefulShutdown: dbGracefulShutdown,
  getPrismaClient,
} = require('./config/database');
const { initializeFirebase } = require('./config/firebase');
const { cleanup: cacheCleanup } = require('./middleware/cache');

// Import routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const discoveryRoutes = require('./routes/discovery');
const actionsRoutes = require('./routes/actions');
const matchesRoutes = require('./routes/matches');
const messagesRoutes = require('./routes/messages');
const moderationRoutes = require('./routes/moderation');

// Initialize Express app and HTTP server
const app = express();
const httpServer = createServer(app);

// Get configuration from environment
const PORT = process.env.PORT || 3000;
// Cloud Run requires binding to 0.0.0.0
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy for accurate IP addresses (important for rate limiting)
app.set('trust proxy', 1);

// ===== SECURITY MIDDLEWARE =====

// Helmet for security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// CORS configuration
const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : ['http://localhost:19006', 'exp://192.168.1.100:19000'];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Rate limiting - more relaxed for development
const isDevelopment = NODE_ENV === 'development';
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000), // 1 minute for dev, 15 minutes for prod
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isDevelopment ? 500 : 200), // 500 requests per window in dev, 200 in prod
  message: {
    error: 'Too many requests, please wait',
    retryAfter: Math.ceil(
      (parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000)) / 1000,
    ),
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    const skipPaths = ['/health', '/api/health'];
    
    // Use exact matching or startsWith for security
    if (skipPaths.some(path => req.path === path)) {
      return true;
    }
    
    // For auth endpoints in development, use startsWith for proper matching
    if (isDevelopment) {
      const authPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];
      return authPaths.some(path => req.path === path);
    }
    
    return false;
  },
});

// Only apply rate limiting if not explicitly disabled
if (process.env.ENABLE_RATE_LIMITING !== 'false') {
  app.use(limiter);
  logger.info(`Rate limiting enabled: ${isDevelopment ? 'Development' : 'Production'} mode - ${isDevelopment ? '500 req/min' : '200 req/15min'}`);
} else {
  logger.info('Rate limiting is disabled');
}

// ===== GENERAL MIDDLEWARE =====

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (process.env.ENABLE_REQUEST_LOGGING !== 'false') {
  const morganFormat = NODE_ENV === 'production' ? 'combined' : 'dev';
  app.use(
    morgan(morganFormat, {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    }),
  );
}

// ===== ROUTES =====

// Health check (no auth required)
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// API routes
const apiRouter = express.Router();

// Authentication routes
apiRouter.use('/auth', authRoutes);

// User routes (protected)
apiRouter.use('/users', userRoutes);

// Discovery routes (protected)
apiRouter.use('/discovery', discoveryRoutes);

// Action routes (protected)
apiRouter.use('/actions', actionsRoutes);

// Match routes (protected)
apiRouter.use('/matches', matchesRoutes);

// Message routes (protected)
apiRouter.use('/messages', messagesRoutes);

// Moderation routes (protected)
apiRouter.use('/moderation', moderationRoutes);

// Mount API router
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter); // Fallback for simpler paths

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Hantibink API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    documentation: NODE_ENV === 'development' ? '/api/docs' : undefined,
  });
});

// ===== ERROR HANDLING =====

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ===== SERVER STARTUP =====

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  const serverInstance = await server;

  serverInstance.close(async () => {
    logger.info('HTTP server closed.');

    try {
      // Clean up cache middleware
      cacheCleanup();
      
      // Close database connections
      await dbGracefulShutdown();

      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  // Force close after 30 seconds
  setTimeout(() => {
    logger.error(
      'Could not close connections in time, forcefully shutting down',
    );
    process.exit(1);
  }, 30000);
};

// Initialize database and start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize Firebase Admin SDK
    try {
      initializeFirebase();
    } catch (firebaseError) {
      logger.warn('⚠️ Firebase initialization failed:', firebaseError.message);
      logger.warn('🔧 Continuing without Firebase - JWT authentication only');
    }

    // Initialize Socket.IO
    const io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || [
          'http://localhost:8081',
          'exp://192.168.68.67:8081',
        ],
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    // Track socket -> user data for proper disconnect handling
    const socketUserMap = new Map();

    // Socket.IO connection handling
    io.on('connection', (socket) => {
      logger.info(`🔌 User connected: ${socket.id}`);
      logger.info(`🔌 Total connected sockets: ${io.engine.clientsCount}`);

      // Initialize socket tracking
      socketUserMap.set(socket.id, { userId: null, matchIds: new Set() });

      // Handle user joining their personal room
      socket.on('join-user-room', async (userId) => {
        socket.join(`user:${userId}`);
        // Track user ID for this socket
        const userData = socketUserMap.get(socket.id);
        if (userData) {
          userData.userId = userId;
        }
        logger.info(`👤 User ${userId} joined their room`);

        // Broadcast online status to all matches
        try {
          const prisma = getPrismaClient();

          // Get all active matches for this user
          const matches = await prisma.match.findMany({
            where: {
              OR: [{ user1Id: userId }, { user2Id: userId }],
              isActive: true,
            },
            select: { id: true, user1Id: true, user2Id: true },
          });

          // Update lastActive in database
          await prisma.user.update({
            where: { id: userId },
            data: { lastActive: new Date() },
          });

          // Broadcast online status to each match's other user
          matches.forEach(match => {
            const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;
            io.to(`user:${otherUserId}`).emit('user-online-status', {
              userId,
              isOnline: true,
              timestamp: new Date(),
            });
            // Also emit to match room
            io.to(`match:${match.id}`).emit('user-online-status', {
              userId,
              isOnline: true,
              timestamp: new Date(),
            });
            // Track match ID for disconnect handling
            if (userData) {
              userData.matchIds.add(match.id);
            }
          });

          logger.info(`🟢 User ${userId} came online - notified ${matches.length} matches`);
        } catch (error) {
          logger.warn('🟢 Could not broadcast online status:', error.message);
        }
      });

      // Handle joining match rooms for messaging
      socket.on('join-match-room', (matchId) => {
        socket.join(`match:${matchId}`);
        // Track match ID for this socket
        const userData = socketUserMap.get(socket.id);
        if (userData) {
          userData.matchIds.add(matchId);
        }
        logger.info(
          `💬 Socket ${socket.id} joined match room: match:${matchId}`,
        );
        logger.info(
          `💬 Room match:${matchId} now has ${io.sockets.adapter.rooms.get(`match:${matchId}`)?.size || 0} sockets`,
        );
      });

      // Handle leaving match rooms
      socket.on('leave-match-room', (matchId) => {
        socket.leave(`match:${matchId}`);
        // Remove match from tracking
        const userData = socketUserMap.get(socket.id);
        if (userData) {
          userData.matchIds.delete(matchId);
        }
        logger.info(`👋 Socket ${socket.id} left match room: ${matchId}`);
      });

      // Handle typing indicators
      socket.on('typing-start', async (data) => {
        const { matchId, userId, userName } = data;
        logger.info(
          `⌨️ Received typing-start from ${userId} in match ${matchId}`,
        );

        const typingData = {
          matchId,
          userId,
          userName,
          isTyping: true,
        };

        // Emit to match room (for users who have chat open)
        socket.to(`match:${matchId}`).emit('user-typing', typingData);

        // Also emit to both users' personal rooms (for threads list updates)
        // Need to get the other user in the match
        try {
          const prisma = getPrismaClient();
          const match = await prisma.match.findUnique({
            where: { id: matchId },
            select: { user1Id: true, user2Id: true },
          });
          if (match) {
            const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;
            io.to(`user:${otherUserId}`).emit('user-typing', typingData);
            logger.info(`⌨️ Typing event sent to user room: user:${otherUserId}`);
          }
        } catch (error) {
          logger.warn('⌨️ Could not send typing to user room:', error.message);
        }

        logger.info(
          `⌨️ User ${userId} started typing in match ${matchId} - event sent to room`,
        );
      });

      socket.on('typing-stop', async (data) => {
        const { matchId, userId } = data;

        const typingData = {
          matchId,
          userId,
          isTyping: false,
        };

        // Emit to match room
        socket.to(`match:${matchId}`).emit('user-typing', typingData);

        // Also emit to both users' personal rooms
        try {
          const prisma = getPrismaClient();
          const match = await prisma.match.findUnique({
            where: { id: matchId },
            select: { user1Id: true, user2Id: true },
          });
          if (match) {
            const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;
            io.to(`user:${otherUserId}`).emit('user-typing', typingData);
          }
        } catch (error) {
          logger.warn('⌨️ Could not send typing-stop to user room:', error.message);
        }

        logger.info(`⌨️ User ${userId} stopped typing in match ${matchId}`);
      });

      // Handle online status updates
      socket.on('update-online-status', async (data) => {
        const { userId, isOnline, matchIds } = data;

        // Only broadcast to specific match rooms if matchIds provided
        if (matchIds && Array.isArray(matchIds)) {
          // Broadcast only to user's match rooms
          matchIds.forEach(matchId => {
            socket.to(`match:${matchId}`).emit('user-online-status', {
              userId,
              isOnline,
              timestamp: new Date(),
            });
          });
          logger.info(`🟢 User ${userId} online status: ${isOnline} (sent to ${matchIds.length} matches)`);
        } else {
          // Fallback: broadcast to user's personal room only
          socket.to(`user:${userId}`).emit('user-online-status', {
            userId,
            isOnline,
            timestamp: new Date(),
          });
          logger.info(`🟢 User ${userId} online status: ${isOnline} (sent to user room only)`);
        }
      });

      // Handle heartbeat to keep lastActive updated
      socket.on('heartbeat', async (data) => {
        const { userId } = data;
        if (!userId) {
          return;
        }

        try {
          const prisma = getPrismaClient();
          await prisma.user.update({
            where: { id: userId },
            data: { lastActive: new Date() },
          });

          // Broadcast online status to all matches
          const userData = socketUserMap.get(socket.id);
          if (userData && userData.matchIds.size > 0) {
            const onlineData = {
              userId,
              isOnline: true,
              timestamp: new Date(),
            };
            userData.matchIds.forEach(matchId => {
              io.to(`match:${matchId}`).emit('user-online-status', onlineData);
            });
          }
        } catch (error) {
          // Silent fail for heartbeat - don't spam logs
        }
      });

      socket.on('disconnect', async () => {
        logger.info(`🔌 User disconnected: ${socket.id}`);

        // Get user data for this socket and broadcast offline status
        const userData = socketUserMap.get(socket.id);
        if (userData && userData.userId) {
          const { userId, matchIds } = userData;

          // Update lastActive in database (use updateMany to avoid errors if user was deleted)
          try {
            const prisma = getPrismaClient();
            const result = await prisma.user.updateMany({
              where: { id: userId },
              data: { lastActive: new Date() },
            });
            // If no records were updated, user was probably deleted
            if (result.count === 0) {
              logger.info(`🔴 User ${userId} already deleted, skipping lastActive update`);
            }
          } catch (error) {
            logger.warn('🔴 Could not update lastActive:', error.message);
          }

          // Broadcast offline status to all match rooms and personal rooms
          const offlineData = {
            userId,
            isOnline: false,
            timestamp: new Date(),
          };

          // Emit to match rooms
          matchIds.forEach(matchId => {
            io.to(`match:${matchId}`).emit('user-online-status', offlineData);
          });

          // Also emit to each matched user's personal room
          try {
            const prisma = getPrismaClient();
            const matches = await prisma.match.findMany({
              where: {
                OR: [{ user1Id: userId }, { user2Id: userId }],
                isActive: true,
              },
              select: { user1Id: true, user2Id: true },
            });
            matches.forEach(match => {
              const otherUserId = match.user1Id === userId ? match.user2Id : match.user1Id;
              io.to(`user:${otherUserId}`).emit('user-online-status', offlineData);
            });
          } catch (error) {
            logger.warn('🔴 Could not broadcast offline to user rooms:', error.message);
          }

          logger.info(`🔴 User ${userId} went offline (broadcast to ${matchIds.size} matches)`);
        }

        // Clean up tracking
        socketUserMap.delete(socket.id);
      });
    });

    // Make io available to routes
    app.set('io', io);

    // Start server - simplified for Cloud Run
    const server = httpServer.listen(PORT, HOST, () => {
      logger.info(`Server started on port ${PORT}`);
      logger.info('🚀 Hantibink API Server started');
      logger.info(`📍 Environment: ${NODE_ENV}`);
      logger.info(`🌐 Server running at http://0.0.0.0:${PORT}`);
      logger.info(`📊 Health check: http://0.0.0.0:${PORT}/health`);

      if (NODE_ENV === 'development') {
        logger.info(`📖 API Documentation: http://0.0.0.0:${PORT}/api/docs`);
      }
    });

    return server;
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
const server = startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
