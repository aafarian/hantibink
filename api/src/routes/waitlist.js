const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { getPrismaClient } = require('../config/database');
const { waitlistLimiter } = require('../middleware/rateLimiters');
const { sendWaitlistEmail } = require('../services/emailService');

const prisma = getPrismaClient();
const router = express.Router();

const GENERIC_SUCCESS = {
  success: true,
  message: "You're on the list! We'll email you when Hantibink launches.",
};

/**
 * @route   POST /api/waitlist
 * @desc    Join the pre-launch waitlist
 * @access  Public (rate-limited, honeypot-protected)
 *
 * Anti-abuse: `website` is a honeypot field — humans never see it, bots fill
 * it. A tripped honeypot returns the generic success without writing.
 * Duplicate emails also return generic success (no enumeration).
 */
router.post(
  '/',
  waitlistLimiter,
  [
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail()
      .isLength({ max: 254 })
      .withMessage('Email too long'),
    body('name').optional({ values: 'falsy' }).isString().trim().isLength({ max: 100 }),
    body('source').optional({ values: 'falsy' }).isString().trim().isLength({ max: 50 }),
    body('website').optional({ values: 'falsy' }).isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: errors.array()[0].msg,
        });
      }

      const { email, name, source, website } = req.body;

      // Honeypot tripped: pretend success, write nothing
      if (website) {
        logger.logSecurity('Waitlist honeypot tripped', req.ip);
        return res.json(GENERIC_SUCCESS);
      }

      const existing = await prisma.waitlist.findUnique({ where: { email } });
      if (existing) {
        return res.json(GENERIC_SUCCESS);
      }

      try {
        await prisma.waitlist.create({
          data: {
            email,
            name: name || null,
            source: source || null,
          },
        });
      } catch (error) {
        // Concurrent duplicate: both requests passed findUnique, the unique
        // index rejected this insert. Stay idempotent like the existing path.
        if (error.code === 'P2002') {
          return res.json(GENERIC_SUCCESS);
        }
        throw error;
      }

      logger.info(`📬 Waitlist signup: ${email}${source ? ` (source: ${source})` : ''}`);

      // Confirmation email is best-effort
      sendWaitlistEmail(email, name).catch((err) =>
        logger.error('Waitlist confirmation email failed:', err),
      );

      return res.json(GENERIC_SUCCESS);
    } catch (error) {
      logger.error('Waitlist signup error:', error);
      return res.status(500).json({
        success: false,
        error: 'Signup failed',
        message: 'Please try again later',
      });
    }
  },
);

module.exports = router;
