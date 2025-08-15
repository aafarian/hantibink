/**
 * Centralized logging utility for Hantibink API
 * Uses Winston for structured logging
 */

const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define log format for console (with colors)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define log format for files (without colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
  }),

  // File transport for errors
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: fileFormat,
  }),

  // File transport for all logs
  new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    format: fileFormat,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: consoleFormat,
  transports,
  exitOnError: false,
});

// Add request logging helper
logger.logRequest = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });

  next();
};

// Add structured logging methods
logger.logAuth = (message, userId = null, extra = {}) => {
  logger.info(`[AUTH] ${message}`, {
    userId,
    ...extra,
  });
};

logger.logMatch = (message, userId = null, targetUserId = null, extra = {}) => {
  logger.info(`[MATCH] ${message}`, {
    userId,
    targetUserId,
    ...extra,
  });
};

logger.logMessage = (
  message,
  senderId = null,
  receiverId = null,
  extra = {},
) => {
  logger.info(`[MESSAGE] ${message}`, {
    senderId,
    receiverId,
    ...extra,
  });
};

logger.logPayment = (message, userId = null, amount = null, extra = {}) => {
  logger.info(`[PAYMENT] ${message}`, {
    userId,
    amount,
    ...extra,
  });
};

logger.logSecurity = (message, ip = null, userId = null, extra = {}) => {
  logger.warn(`[SECURITY] ${message}`, {
    ip,
    userId,
    ...extra,
  });
};

// Add performance logging
logger.logPerformance = (operation, duration, extra = {}) => {
  const level = duration > 1000 ? 'warn' : 'info';
  logger[level](`[PERFORMANCE] ${operation} took ${duration}ms`, {
    operation,
    duration,
    ...extra,
  });
};

// Add database logging
logger.logDatabase = (query, duration = null, extra = {}) => {
  logger.debug(`[DATABASE] ${query}`, {
    query,
    duration,
    ...extra,
  });
};

module.exports = logger;
