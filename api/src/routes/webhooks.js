const express = require('express');
const logger = require('../utils/logger');
const { getPrismaClient } = require('../config/database');
const { activatePremium } = require('../services/premiumService');

const prisma = getPrismaClient();
const router = express.Router();

// Event types that mean "this user is entitled to premium right now".
// NON_RENEWING_PURCHASE included for future consumables/promotions.
const GRANTS_PREMIUM = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
]);

/**
 * @route   POST /api/webhooks/revenuecat
 * @desc    RevenueCat server notifications — the ONLY path that flips
 *          isPremium. The client never writes its own entitlement.
 * @access  Shared-secret header (configured identically in the RC dashboard)
 */
router.post('/revenuecat', async (req, res) => {
  try {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    const provided = req.get('Authorization') || '';
    // RC sends the configured value verbatim; accept with or without Bearer
    if (!secret || (provided !== secret && provided !== `Bearer ${secret}`)) {
      logger.warn('RevenueCat webhook rejected: bad or missing Authorization');
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const event = req.body?.event;
    if (!event || !event.type) {
      return res.status(400).json({ success: false, message: 'Missing event' });
    }

    // Test Store / sandbox purchases must never touch real entitlements.
    // RC stamps every event with its store environment; SANDBOX events are
    // honored only for allowlisted tester accounts (REVENUECAT_SANDBOX_USER_IDS,
    // comma-separated DB ids, set only while sandbox-testing the purchase
    // flow) — there is deliberately no "allow all sandbox" mode.
    if (event.environment === 'SANDBOX') {
      const testers = (process.env.REVENUECAT_SANDBOX_USER_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (!testers.includes(event.app_user_id)) {
        logger.info(
          `RevenueCat SANDBOX event ${event.type} ignored (app_user_id not an allowlisted tester)`,
        );
        return res.json({ received: true });
      }
    }

    // We call Purchases.logIn(<our user id>) on the client, so app_user_id
    // is our DB id. Anonymous ids (pre-login purchases) resolve via a later
    // TRANSFER/INITIAL_PURCHASE once logIn aliases them.
    const userId = event.app_user_id;
    if (!userId || userId.startsWith('$RCAnonymousID')) {
      logger.info(`RevenueCat event ${event.type} for anonymous user — ignored`);
      return res.json({ received: true });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isPremium: true },
    });
    if (!user) {
      // 200 so RC stops retrying an id we'll never know
      logger.warn(`RevenueCat event ${event.type} for unknown user ${userId}`);
      return res.json({ received: true });
    }

    // RC retries and redelivers, so arrival order isn't event order. Writes
    // below only apply when the event is strictly newer than the last one
    // recorded on the user (rcLastEventAt) — the condition lives in the
    // UPDATE itself, so stale/duplicate deliveries are atomic no-ops.
    const eventAtMs = Number(event.event_timestamp_ms);
    const eventAt = Number.isFinite(eventAtMs) && eventAtMs > 0 ? new Date(eventAtMs) : null;

    if (GRANTS_PREMIUM.has(event.type)) {
      // Atomic flag + accrual clock + day-one Super Like bank
      const applied = await activatePremium(userId, eventAt);
      if (applied) {
        logger.info(`💎 Premium activated for ${userId} (${event.type}, ${event.product_id})`);
      } else {
        logger.info(`RevenueCat ${event.type} for ${userId} is stale — ignored`);
      }
    } else if (event.type === 'EXPIRATION') {
      const { count } = await prisma.user.updateMany({
        where: {
          id: userId,
          ...(eventAt ? { OR: [{ rcLastEventAt: null }, { rcLastEventAt: { lt: eventAt } }] } : {}),
        },
        data: { isPremium: false, ...(eventAt ? { rcLastEventAt: eventAt } : {}) },
      });
      if (count > 0) {
        logger.info(`💎 Premium expired for ${userId} (${event.expiration_reason || 'unknown'})`);
      } else {
        logger.info(`RevenueCat EXPIRATION for ${userId} is stale — ignored`);
      }
    } else {
      // CANCELLATION (auto-renew off, still entitled), BILLING_ISSUE (grace
      // period), TRANSFER, TEST — acknowledge and log; entitlement only
      // changes on the events above
      logger.info(`RevenueCat event ${event.type} for ${userId} — acknowledged`);
    }

    return res.json({ received: true });
  } catch (error) {
    logger.error('RevenueCat webhook error:', error);
    // 500 so RevenueCat retries — their retry policy is our safety net
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

module.exports = router;
