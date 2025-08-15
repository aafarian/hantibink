/**
 * 404 Not Found handler middleware
 */

const { AppError } = require('./errorHandler');

const notFoundHandler = (req, res, next) => {
  const message = `Can't find ${req.originalUrl} on this server!`;
  next(new AppError(message, 404));
};

module.exports = notFoundHandler;
