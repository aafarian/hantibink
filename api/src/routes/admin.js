const express = require('express');
const rateLimit = require('express-rate-limit');
const { param, query, body } = require('express-validator');
const { authenticateJWT } = require('../middleware/auth');
const { adminOrNotFound } = require('../middleware/adminAuth');
const { handleValidationErrors } = require('../middleware/validation');
const { catchAsync } = require('../middleware/errorHandler');
const { isAdminEmail } = require('../config/adminAllowlist');
const admin = require('../services/adminService');

const router = express.Router();

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.ENABLE_RATE_LIMITING === 'false' || process.env.NODE_ENV === 'test',
});

const ID_PARAM = [
  param('id').notEmpty().isString().isLength({ max: 64 }),
  handleValidationErrors,
];

/**
 * @route   GET /api/admin/check
 * @desc    The one honest admin endpoint: tells an authenticated user
 *          whether the admin entry point should render. Everything else
 *          under /admin 404s for non-admins.
 * @access  Private
 */
router.get(
  '/check',
  adminLimiter,
  authenticateJWT,
  catchAsync(async (req, res) => {
    res.json({ success: true, data: { isAdmin: isAdminEmail(req.user.email) } });
  }),
);

// Everything below: authenticated admin or a byte-identical 404
router.use(adminLimiter, authenticateJWT, adminOrNotFound);

/**
 * @route   GET /api/admin/overview
 */
router.get(
  '/overview',
  catchAsync(async (req, res) => {
    const data = await admin.getOverview();
    res.json({ success: true, data });
  }),
);

/**
 * @route   GET /api/admin/users?q=&cursor=&limit=
 */
router.get(
  '/users',
  [query('limit').optional().isInt({ min: 1, max: 50 }), handleValidationErrors],
  catchAsync(async (req, res) => {
    const data = await admin.listUsers({
      q: (req.query.q || '').slice(0, 100),
      cursor: req.query.cursor || null,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  }),
);

/**
 * @route   GET /api/admin/users/:id
 */
router.get(
  '/users/:id',
  ID_PARAM,
  catchAsync(async (req, res) => {
    const data = await admin.getUserDetail(req.params.id);
    res.json({ success: true, data });
  }),
);

/**
 * @route   POST /api/admin/users/:id/ban  |  /unban
 */
router.post(
  '/users/:id/ban',
  ID_PARAM,
  catchAsync(async (req, res) => {
    const data = await admin.setUserActive(
      req.params.id,
      false,
      req.user.email,
      req.app.get('io'),
    );
    res.json({ success: true, message: 'User banned', data });
  }),
);

router.post(
  '/users/:id/unban',
  ID_PARAM,
  catchAsync(async (req, res) => {
    const data = await admin.setUserActive(req.params.id, true, req.user.email);
    res.json({ success: true, message: 'User unbanned', data });
  }),
);

/**
 * @route   POST /api/admin/users/:id/premium  {isPremium}
 */
router.post(
  '/users/:id/premium',
  [...ID_PARAM.slice(0, 1), body('isPremium').isBoolean({ strict: true }), handleValidationErrors],
  catchAsync(async (req, res) => {
    const data = await admin.setUserPremium(req.params.id, req.body.isPremium, req.user.email);
    res.json({ success: true, message: 'Premium updated', data });
  }),
);

/**
 * @route   POST /api/admin/users/:id/verify-email
 */
router.post(
  '/users/:id/verify-email',
  ID_PARAM,
  catchAsync(async (req, res) => {
    const data = await admin.verifyUserEmail(req.params.id, req.user.email);
    res.json({ success: true, message: 'Email verified', data });
  }),
);

/**
 * @route   DELETE /api/admin/users/:id
 */
router.delete(
  '/users/:id',
  ID_PARAM,
  catchAsync(async (req, res) => {
    const data = await admin.deleteUser(req.params.id, req.user.email);
    res.json({ success: true, message: 'User deleted', data });
  }),
);

/**
 * @route   GET /api/admin/reports?status=&cursor=&limit=
 */
router.get(
  '/reports',
  [
    query('status').optional().isIn(['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']),
    handleValidationErrors,
  ],
  catchAsync(async (req, res) => {
    const data = await admin.listReports({
      status: req.query.status || null,
      cursor: req.query.cursor || null,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  }),
);

/**
 * @route   POST /api/admin/reports/:id/resolve  {action: NONE|BAN, adminNotes}
 */
router.post(
  '/reports/:id/resolve',
  [
    ...ID_PARAM.slice(0, 1),
    body('action').optional().isIn(['NONE', 'BAN']),
    body('adminNotes').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }),
    handleValidationErrors,
  ],
  catchAsync(async (req, res) => {
    const data = await admin.reviewReport(
      req.params.id,
      { outcome: 'RESOLVED', action: req.body.action || 'NONE', adminNotes: req.body.adminNotes },
      req.user.email,
      req.app.get('io'),
    );
    res.json({ success: true, message: 'Report resolved', data });
  }),
);

/**
 * @route   POST /api/admin/reports/:id/dismiss  {adminNotes}
 */
router.post(
  '/reports/:id/dismiss',
  [
    ...ID_PARAM.slice(0, 1),
    body('adminNotes').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }),
    handleValidationErrors,
  ],
  catchAsync(async (req, res) => {
    const data = await admin.reviewReport(
      req.params.id,
      { outcome: 'DISMISSED', adminNotes: req.body.adminNotes },
      req.user.email,
    );
    res.json({ success: true, message: 'Report dismissed', data });
  }),
);

/**
 * @route   GET /api/admin/waitlist   +   /waitlist/export (CSV)
 */
router.get(
  '/waitlist',
  catchAsync(async (req, res) => {
    const data = await admin.listWaitlist({
      cursor: req.query.cursor || null,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  }),
);

router.get(
  '/waitlist/export',
  catchAsync(async (req, res) => {
    const { csv, capped, count } = await admin.exportWaitlistCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('X-Row-Count', String(count));
    if (capped) {
      res.setHeader('X-Capped', 'true');
    }
    res.send(csv);
  }),
);

/**
 * @route   GET|PUT /api/admin/config/app-version
 */
router.get(
  '/config/app-version',
  catchAsync(async (req, res) => {
    const data = await admin.getAppVersionConfig();
    res.json({ success: true, data });
  }),
);

router.put(
  '/config/app-version',
  [
    body('minVersion').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
    body('latestVersion').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
    body('forceUpdate').optional().isBoolean(),
    body('updateMessage').optional({ values: 'null' }).isString().isLength({ max: 200 }),
    body('platforms').optional().isObject(),
    body('platforms.*.minVersion').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
    body('platforms.*.latestVersion')
      .optional({ values: 'falsy' })
      .isString()
      .isLength({ max: 20 }),
    body('platforms.*.forceUpdate').optional().isBoolean(),
    body('platforms.*.updateMessage').optional({ values: 'null' }).isString().isLength({ max: 200 }),
    handleValidationErrors,
  ],
  catchAsync(async (req, res) => {
    const data = await admin.updateAppVersionConfig(req.body, req.user.email);
    res.json({ success: true, message: 'App version config published', data });
  }),
);

/**
 * @route   GET|PUT /api/admin/config/flags
 */
router.get(
  '/config/flags',
  catchAsync(async (req, res) => {
    const data = await admin.getFlags();
    res.json({ success: true, data });
  }),
);

router.put(
  '/config/flags',
  [
    body().custom((flags) => {
      if (!flags || typeof flags !== 'object' || Array.isArray(flags)) {
        throw new Error('Flags must be an object of key -> boolean');
      }
      for (const [key, value] of Object.entries(flags)) {
        if (key.length > 64) {
          throw new Error('Flag keys must be 64 characters or fewer');
        }
        if (typeof value !== 'boolean') {
          throw new Error(`Flag "${key}" must be a boolean`);
        }
      }
      return true;
    }),
    handleValidationErrors,
  ],
  catchAsync(async (req, res) => {
    const data = await admin.updateFlags(req.body, req.user.email);
    res.json({ success: true, message: 'Flags updated', data });
  }),
);

/**
 * @route   GET /api/admin/audit
 */
router.get(
  '/audit',
  catchAsync(async (req, res) => {
    const data = await admin.listAudit({
      cursor: req.query.cursor || null,
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  }),
);

module.exports = router;
