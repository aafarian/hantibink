/**
 * Global error handling middleware for Hantibink API
 */

const Sentry = require('@sentry/node');
const logger = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
const errorHandler = (err, req, res, _next) => {
  let error = { ...err };
  error.message = err.message;

  // Normalize known error families BEFORE logging and Sentry, so an
  // expired JWT is treated as the 401 it is — not an unstatused error
  // defaulting to 500 and paging as a production incident

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again!';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Your token has expired! Please log in again.';
    error = new AppError(message, 401);
  }

  // Firebase errors
  if (err.code && err.code.startsWith('auth/')) {
    let message = 'Authentication failed';

    switch (err.code) {
      case 'auth/user-not-found':
        message = 'User not found';
        break;
      case 'auth/wrong-password':
        message = 'Incorrect password';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please try again later.';
        break;
      case 'auth/user-disabled':
        message = 'User account has been disabled';
        break;
      default:
        message = 'Authentication failed';
    }

    error = new AppError(message, 401);
  }

  // Prisma errors
  if (err.code && err.code.startsWith('P')) {
    let message = 'Database error';
    let statusCode = 500;

    switch (err.code) {
      case 'P2002':
        message = 'A record with this information already exists';
        statusCode = 409;
        break;
      case 'P2025':
        message = 'Record not found';
        statusCode = 404;
        break;
      case 'P2003':
        message = 'Invalid reference to related record';
        statusCode = 400;
        break;
      default:
        message = 'Database operation failed';
    }

    error = new AppError(message, statusCode);
  }

  // Expected client errors (4xx) log as warnings — logger.error forwards
  // to Sentry via its wrapper, and auth/404 noise would page as incidents
  const statusCode = error.statusCode || 500;
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel](`Error ${statusCode}: ${err.message}`, {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || null,
  });

  // Only genuine server faults reach Sentry
  if (statusCode >= 500) {
    Sentry.withScope((scope) => {
      scope.setUser({ id: req.user?.id });
      scope.setExtra('url', req.originalUrl);
      scope.setExtra('method', req.method);
      scope.setExtra('ip', req.ip);
      scope.setTag('statusCode', statusCode);
      Sentry.captureException(err);
    });
  }

  // Send error response
  sendErrorResponse(error, req, res);
};

// Send error response
const sendErrorResponse = (err, req, res) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';

  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(statusCode).json({
      success: false,
      error: status,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
      }),
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('Programming Error:', err);

    res.status(500).json({
      success: false,
      error: 'error',
      message: 'Something went wrong!',
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
      }),
    });
  }
};

// Async error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  AppError,
  errorHandler,
  catchAsync,
};
