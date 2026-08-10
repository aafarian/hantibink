const { AppError } = require('./errorHandler');
const { isAdminEmail } = require('../config/adminAllowlist');
const logger = require('../utils/logger');

/**
 * Admin gate for /api/admin/*.
 *
 * Non-admins (including unauthenticated callers) receive a response
 * byte-identical to hitting a route that does not exist — the admin surface
 * is not discoverable by probing. The one honest endpoint is
 * GET /admin/check, which returns {isAdmin} to authenticated users.
 */
const adminOrNotFound = (req, res, next) => {
  if (!req.user || !isAdminEmail(req.user.email)) {
    if (req.user) {
      logger.logSecurity('Admin surface probe denied', req.ip, req.user.id, {
        path: req.originalUrl,
      });
    }
    return next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
  }
  return next();
};

module.exports = { adminOrNotFound };
