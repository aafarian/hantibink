const express = require('express');
const { param, body, query } = require('express-validator');
const { authenticateJWT } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { writeBurstLimiter } = require('../middleware/rateLimiters');
const { catchAsync } = require('../middleware/errorHandler');
const games = require('../services/games/gamesService');

const router = express.Router();

const ID = (name) => param(name).notEmpty().isString().isLength({ max: 64 });
const io = (req) => req.app.get('io');

/**
 * @route   GET /api/games/:matchId/offers?gameType=…
 * @desc    Creator-side prompt offers (roulette question, riddle choices)
 *          rendered in the pre-commit composer. Nothing is persisted.
 */
router.get(
  '/:matchId/offers',
  authenticateJWT,
  [
    ID('matchId'),
    query('gameType').isIn(['QUESTION_ROULETTE', 'EMOJI_RIDDLE']),
    handleValidationErrors,
  ],
  catchAsync(async (req, res) => {
    const data = await games.getGameOffers(req.params.matchId, req.user.id, req.query.gameType);
    res.json({ success: true, data });
  }),
);

/**
 * @route   POST /api/games/:matchId/sessions   {gameType, payload?}
 */
router.post(
  '/:matchId/sessions',
  authenticateJWT,
  writeBurstLimiter,
  [
    ID('matchId'),
    body('gameType').isIn(['THIS_OR_THAT', 'TWO_TRUTHS', 'QUESTION_ROULETTE', 'EMOJI_RIDDLE']),
    body('payload').optional().isObject(),
    handleValidationErrors,
  ],
  catchAsync(async (req, res) => {
    const data = await games.createSession(
      req.params.matchId,
      req.user.id,
      req.body.gameType,
      req.body.payload || null,
      io(req),
    );
    res.status(201).json({ success: true, message: 'Game started', data });
  }),
);

/**
 * @route   GET /api/games/:matchId/sessions/active
 */
router.get(
  '/:matchId/sessions/active',
  authenticateJWT,
  [ID('matchId'), handleValidationErrors],
  catchAsync(async (req, res) => {
    const data = await games.getActiveSession(req.params.matchId, req.user.id);
    res.json({ success: true, data });
  }),
);

/**
 * @route   GET /api/games/:matchId/sessions/:sessionId
 */
router.get(
  '/:matchId/sessions/:sessionId',
  authenticateJWT,
  [ID('matchId'), ID('sessionId'), handleValidationErrors],
  catchAsync(async (req, res) => {
    const data = await games.getSession(req.params.matchId, req.params.sessionId, req.user.id);
    res.json({ success: true, data });
  }),
);

/**
 * @route   POST /api/games/:matchId/sessions/:sessionId/moves
 *          {type, clientMoveId, ...move fields}
 */
router.post(
  '/:matchId/sessions/:sessionId/moves',
  authenticateJWT,
  writeBurstLimiter,
  [
    ID('matchId'),
    ID('sessionId'),
    body('type').isIn(['pick', 'guess', 'answer']),
    body('clientMoveId').optional().isString().isLength({ max: 64 }),
    body('choice').optional().isIn(['A', 'B']),
    body('index').optional().isInt({ min: 0, max: 2 }),
    body('text').optional().isString().isLength({ max: 280 }),
    handleValidationErrors,
  ],
  catchAsync(async (req, res) => {
    const { type, clientMoveId, choice, index, text } = req.body;
    const data = await games.submitMove(
      req.params.matchId,
      req.params.sessionId,
      req.user.id,
      { type, clientMoveId, choice, index, text },
      io(req),
    );
    res.json({ success: true, data });
  }),
);

/**
 * @route   POST /api/games/:matchId/sessions/:sessionId/decline | /forfeit
 */
router.post(
  '/:matchId/sessions/:sessionId/decline',
  authenticateJWT,
  [ID('matchId'), ID('sessionId'), handleValidationErrors],
  catchAsync(async (req, res) => {
    const data = await games.declineSession(
      req.params.matchId,
      req.params.sessionId,
      req.user.id,
      io(req),
    );
    res.json({ success: true, message: 'Game declined', data });
  }),
);

router.post(
  '/:matchId/sessions/:sessionId/forfeit',
  authenticateJWT,
  [ID('matchId'), ID('sessionId'), handleValidationErrors],
  catchAsync(async (req, res) => {
    const data = await games.forfeitSession(
      req.params.matchId,
      req.params.sessionId,
      req.user.id,
      io(req),
    );
    res.json({ success: true, message: 'Game forfeited', data });
  }),
);

module.exports = router;
