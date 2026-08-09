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

// Only initialize Sentry in production (or if SENTRY_DEBUG is set for testing)
const isProduction = process.env.NODE_ENV === 'production';
if (process.env.SENTRY_DSN && (isProduction || process.env.SENTRY_DEBUG)) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: isProduction ? 0.1 : 1.0,
  });
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');

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
} = require('./config/database');
const { initializeFirebase } = require('./config/firebase');
const { cleanup: cacheCleanup } = require('./middleware/cache');
const { initializeSocket } = require('./socket');

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
if (NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  logger.error(
    '❌ CORS_ORIGIN is not set in production — browser origins will all be rejected',
  );
}

const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no origin (native mobile apps send none)
    if (!origin) {
      return callback(null, true);
    }

    // Dev fallback origins only apply outside production
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
      : NODE_ENV === 'production'
        ? []
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

// Rate limiting - generous limits for normal app usage
const isDevelopment = NODE_ENV === 'development';
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 2000, // 2000 requests per 15 min window
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
  logger.info('Rate limiting enabled: 2000 req/15min');
} else {
  logger.info('Rate limiting is disabled');
}

// ===== GENERAL MIDDLEWARE =====

// Compression
app.use(compression());

// Body parsing — this is a JSON API (photos are uploaded to Firebase Storage
// client-side and sent here as URLs), so 1mb is generous.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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

    // Initialize Socket.IO (handshake-authenticated; see src/socket/index.js)
    const io = initializeSocket(httpServer);

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
  // A stray floating promise must not kill the container mid-request.
  // Log + report; uncaughtException (actual corruption) still exits above.
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)));
  }
});

module.exports = app;
