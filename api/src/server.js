/**
 * Hantibink API Server
 * Main entry point for the backend API
 */

// Only load .env file in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
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

logger.info('Starting Hantibink API Server...');
const { errorHandler } = require('./middleware/errorHandler');
const notFoundHandler = require('./middleware/notFoundHandler');
const {
  connectDatabase,
  gracefulShutdown: dbGracefulShutdown,
} = require('./config/database');
const { initializeFirebase } = require('./config/firebase');

// Import routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const discoveryRoutes = require('./routes/discovery');
const actionsRoutes = require('./routes/actions');
const matchesRoutes = require('./routes/matches');
const messagesRoutes = require('./routes/messages');

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

    // Socket.IO connection handling
    io.on('connection', (socket) => {
      logger.info(`🔌 User connected: ${socket.id}`);
      logger.info(`🔌 Total connected sockets: ${io.engine.clientsCount}`);

      // Handle user joining their personal room
      socket.on('join-user-room', (userId) => {
        socket.join(`user:${userId}`);
        logger.info(`👤 User ${userId} joined their room`);
      });

      // Handle joining match rooms for messaging
      socket.on('join-match-room', (matchId) => {
        socket.join(`match:${matchId}`);
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
        logger.info(`👋 Socket ${socket.id} left match room: ${matchId}`);
      });

      // Handle typing indicators
      socket.on('typing-start', (data) => {
        const { matchId, userId, userName } = data;
        logger.info(
          `⌨️ Received typing-start from ${userId} in match ${matchId}`,
        );
        socket.to(`match:${matchId}`).emit('user-typing', {
          matchId,
          userId,
          userName,
          isTyping: true,
        });
        logger.info(
          `⌨️ User ${userId} started typing in match ${matchId} - event sent to room`,
        );
      });

      socket.on('typing-stop', (data) => {
        const { matchId, userId } = data;
        socket.to(`match:${matchId}`).emit('user-typing', {
          matchId,
          userId,
          isTyping: false,
        });
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

      socket.on('disconnect', () => {
        logger.info(`🔌 User disconnected: ${socket.id}`);
        // Note: Client should handle sending offline status before disconnect
        // Server cannot determine which user this socket belonged to without additional tracking
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
