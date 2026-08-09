/**
 * Game session service: persistence, membership, idempotency, gating, and
 * realtime emission. Engines (./engines) own the rules; this layer is the
 * only writer of GameSession rows.
 *
 * Realtime protocol: REST writes, then ONE 'game-updated' event per player
 * emitted to their user room with a per-viewer redacted snapshot — secret
 * picks never transit a shared match room.
 */

const { getPrismaClient } = require('../../config/database');
const logger = require('../../utils/logger');
const { AppError } = require('../../middleware/errorHandler');
const { getEngine } = require('./engines');
const { sendMessage } = require('../messagesService');

const prisma = getPrismaClient();

const SESSION_TTL_MS = 48 * 60 * 60 * 1000; // bumped on every move
const FREE_DEEP_GAMES_PER_DAY = 3;
const DEEP_GAMES = ['TWO_TRUTHS', 'QUESTION_ROULETTE', 'EMOJI_RIDDLE'];

const GAME_LABELS = {
  THIS_OR_THAT: 'This or That',
  TWO_TRUTHS: 'Two Truths and a Lie',
  QUESTION_ROULETTE: 'Question Roulette',
  EMOJI_RIDDLE: 'Emoji Riddle',
};

/**
 * Feature flags from AppConfig with env fallback (admin dashboard writes
 * them; before it has, GAMES_ENABLED / GAMES_GATING_ENABLED env apply).
 */
const getGameFlags = async () => {
  let flags = {};
  try {
    const row = await prisma.appConfig.findUnique({ where: { key: 'feature_flags' } });
    flags = row?.value || {};
  } catch (error) {
    // fall through to env defaults
  }
  return {
    gamesEnabled: flags.games_enabled ?? process.env.GAMES_ENABLED !== 'false',
    gatingEnabled: flags.games_gating_enabled ?? process.env.GAMES_GATING_ENABLED === 'true',
  };
};

const assertMembership = async (matchId, userId) => {
  const match = await prisma.match.findFirst({
    where: { id: matchId, isActive: true, OR: [{ user1Id: userId }, { user2Id: userId }] },
  });
  if (!match) {
    throw new AppError('Match not found', 404);
  }
  return match;
};

/** Prompt IDs already seen by this match for a game type (rotation). */
const getUsedPromptIds = async (matchId, gameType) => {
  const sessions = await prisma.gameSession.findMany({
    where: { matchId, gameType },
    select: { state: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return sessions.flatMap((s) => s.state?.usedPromptIds || []);
};

/**
 * Launch posture: everything free while gating is off. When gating is on,
 * This or That stays free unlimited (the hook); deep games get
 * 3/day combined unless EITHER player is premium — one subscription
 * visibly benefits the pair.
 */
const canStartGame = async (userId, match, gameType) => {
  const { gamesEnabled, gatingEnabled } = await getGameFlags();
  if (!gamesEnabled) {
    return { allowed: false, error: 'GAMES_DISABLED', message: 'Games are not available right now' };
  }

  // Games are opt-in per user and require BOTH members opted in — the
  // client hides the icon, but the server is the authority
  const members = await prisma.user.findMany({
    where: { id: { in: [match.user1Id, match.user2Id] } },
    select: { id: true, isPremium: true, gamesEnabled: true },
  });
  if (members.length < 2 || members.some((member) => !member.gamesEnabled)) {
    return { allowed: false, error: 'GAMES_DISABLED', message: 'Games are turned off for this chat' };
  }

  // Either member can mute games with this specific person
  const mutes = await prisma.gameMute.count({ where: { matchId: match.id } });
  if (mutes > 0) {
    return { allowed: false, error: 'GAMES_DISABLED', message: 'Games are turned off for this chat' };
  }

  if (!gatingEnabled || !DEEP_GAMES.includes(gameType)) {
    return { allowed: true };
  }

  if (members.some((member) => member.isPremium)) {
    return { allowed: true };
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const startedToday = await prisma.gameSession.count({
    where: {
      createdBy: userId,
      gameType: { in: DEEP_GAMES },
      createdAt: { gte: startOfDay },
    },
  });
  if (startedToday >= FREE_DEEP_GAMES_PER_DAY) {
    return {
      allowed: false,
      error: 'DAILY_LIMIT_REACHED',
      message: `Free players can start ${FREE_DEEP_GAMES_PER_DAY} of these games per day — Premium unlocks unlimited play for both of you!`,
    };
  }
  return { allowed: true };
};

/** Lazy expiry: any read/move path first retires overdue sessions. */
const expireIfOverdue = async (session) => {
  if (session.status === 'ACTIVE' && session.expiresAt < new Date()) {
    // Same optimistic lock as moves and terminal writes: if a concurrent
    // request completed/declined/forfeited (or moved) since we loaded this
    // snapshot, the expiry write loses and the fresh row wins — a stale
    // expiry must never overwrite a terminal state
    await prisma.gameSession.updateMany({
      where: { id: session.id, status: 'ACTIVE', version: session.version },
      data: { status: 'EXPIRED', version: session.version + 1 },
    });
    return prisma.gameSession.findUnique({ where: { id: session.id } });
  }
  return session;
};

const emitGameUpdate = (io, session, event, actorId) => {
  if (!io) {
    return;
  }
  const engine = getEngine(session.gameType);
  const { creatorId, opponentId } = session.state.players;
  for (const viewerId of [creatorId, opponentId]) {
    io.to(`user:${viewerId}`).emit('game-updated', {
      matchId: session.matchId,
      sessionId: session.id,
      gameType: session.gameType,
      status: session.status,
      version: session.version,
      // Versions restart per session, so clients need createdAt to order
      // snapshots ACROSS sessions (a delayed delta from a finished game
      // must not replace a newer one)
      createdAt: session.createdAt,
      event,
      actorId,
      view: engine.viewFor(session.state, viewerId),
    });
  }
};

const redactedSession = (session, viewerId) => ({
  id: session.id,
  matchId: session.matchId,
  gameType: session.gameType,
  status: session.status,
  version: session.version,
  createdBy: session.createdBy,
  createdAt: session.createdAt,
  view: getEngine(session.gameType).viewFor(session.state, viewerId),
});

/**
 * Whether the games entry point should render in this chat: global flag
 * on, and BOTH members opted in.
 */
const getGamesAvailability = async (matchId, userId) => {
  const match = await assertMembership(matchId, userId);
  const { gamesEnabled } = await getGameFlags();
  const [members, mutes] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: [match.user1Id, match.user2Id] } },
      select: { id: true, gamesEnabled: true },
    }),
    prisma.gameMute.findMany({ where: { matchId }, select: { userId: true } }),
  ]);
  return {
    enabled:
      gamesEnabled &&
      members.length === 2 &&
      members.every((member) => member.gamesEnabled) &&
      mutes.length === 0,
    myGlobalEnabled: members.find((member) => member.id === userId)?.gamesEnabled ?? true,
    mutedByMe: mutes.some((mute) => mute.userId === userId),
  };
};

const getGamesSettings = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gamesEnabled: true },
  });
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return { gamesEnabled: user.gamesEnabled };
};

/**
 * Opting out ends every game the user is currently in — silently (no
 * chat message), version-safely, with both players notified live. Their
 * past game cards stay in the chats; they just can't be played.
 */
const endAllActiveGamesForUser = async (userId, io = null) =>
  endActiveSessions({ match: { OR: [{ user1Id: userId }, { user2Id: userId }] } }, userId, io);

/**
 * Mute or unmute games with this specific person. Muting also ends any
 * game currently running in the match.
 */
const setMatchGamesMuted = async (matchId, userId, muted, io = null) => {
  await assertMembership(matchId, userId);
  if (muted) {
    await prisma.gameMute.upsert({
      where: { userId_matchId: { userId, matchId } },
      update: {},
      create: { userId, matchId },
    });
    await endActiveSessions({ matchId }, userId, io);
  } else {
    await prisma.gameMute.deleteMany({ where: { userId, matchId } });
  }
  return { mutedByMe: muted };
};

const endActiveSessions = async (where, userId, io = null) => {
  const sessions = await prisma.gameSession.findMany({
    where: { status: 'ACTIVE', ...where },
  });

  let ended = 0;
  for (const session of sessions) {
    // Unlike moves and expiry there is NO version predicate: the opt-out
    // must win against a concurrent move, not lose the optimistic race and
    // leave the game playable. The status check alone is enough to keep a
    // terminal state from being overwritten twice.
    const updated = await prisma.gameSession.updateMany({
      where: { id: session.id, status: 'ACTIVE' },
      data: { status: 'FORFEITED', completedAt: new Date(), version: { increment: 1 } },
    });
    if (updated.count > 0) {
      ended += 1;
      const fresh = await prisma.gameSession.findUnique({ where: { id: session.id } });
      await postEndSummaryMessage(fresh.matchId, userId, fresh, io);
      emitGameUpdate(io, fresh, 'forfeited', userId);
    }
  }
  return { ended };
};

const setGamesEnabled = async (userId, enabled, io = null) => {
  await prisma.user.update({
    where: { id: userId },
    data: { gamesEnabled: enabled },
    select: { id: true },
  });
  if (!enabled) {
    await endAllActiveGamesForUser(userId, io);
  }
  logger.info(`🎮 Games ${enabled ? 'enabled' : 'disabled'} for user ${userId}`);
  return { gamesEnabled: enabled };
};

/**
 * Creator-side prompt offers for games with server content (roulette
 * question, riddle choices). The client renders these in the pre-commit
 * composer; nothing is persisted and the opponent sees nothing.
 */
const getGameOffers = async (matchId, userId, gameType) => {
  const match = await assertMembership(matchId, userId);
  const engine = getEngine(gameType);
  if (typeof engine.offers !== 'function') {
    throw new AppError('This game has no prompt offers', 400);
  }
  const gate = await canStartGame(userId, match, gameType);
  if (!gate.allowed) {
    const error = new AppError(gate.message, 403);
    error.code = gate.error;
    throw error;
  }
  const usedIds = await getUsedPromptIds(matchId, gameType);
  return { gameType, offers: engine.offers({ usedIds }) };
};

const createSession = async (matchId, userId, gameType, payload, io = null) => {
  const match = await assertMembership(matchId, userId);
  const opponentId = match.user1Id === userId ? match.user2Id : match.user1Id;

  const gate = await canStartGame(userId, match, gameType);
  if (!gate.allowed) {
    const error = new AppError(gate.message, 403);
    error.code = gate.error;
    throw error;
  }

  // Retire any overdue active session first (lazy expiry)
  const active = await prisma.gameSession.findFirst({ where: { matchId, status: 'ACTIVE' } });
  if (active) {
    const still = await expireIfOverdue(active);
    if (still.status === 'ACTIVE') {
      throw new AppError('A game is already in progress in this chat', 409);
    }
  }

  const engine = getEngine(gameType);
  const usedIds = await getUsedPromptIds(matchId, gameType);
  const state = engine.init({ creatorId: userId, opponentId, usedIds, payload });
  state.moveIds = [];

  let session;
  try {
    session = await prisma.gameSession.create({
      data: {
        matchId,
        gameType,
        createdBy: userId,
        state,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      throw new AppError('A game is already in progress in this chat', 409);
    }
    throw error;
  }

  // The start card is a real chat message (survives in history, reuses
  // the existing new-message socket + preview pipeline)
  try {
    await sendMessage(
      matchId,
      userId,
      {
        content: GAME_LABELS[gameType],
        messageType: 'GAME',
        metadata: JSON.stringify({ kind: 'game-start', sessionId: session.id, gameType }),
      },
      io,
    );
  } catch (error) {
    logger.warn('Game start message failed (session still created):', error.message);
  }

  emitGameUpdate(io, session, 'started', userId);
  logger.info(`🎮 ${gameType} session ${session.id} started in match ${matchId}`);
  return redactedSession(session, userId);
};

const getActiveSession = async (matchId, userId) => {
  await assertMembership(matchId, userId);
  let session = await prisma.gameSession.findFirst({ where: { matchId, status: 'ACTIVE' } });
  if (!session) {
    return null;
  }
  session = await expireIfOverdue(session);
  return session.status === 'ACTIVE' ? redactedSession(session, userId) : null;
};

const loadSessionForMember = async (matchId, sessionId, userId) => {
  await assertMembership(matchId, userId);
  const session = await prisma.gameSession.findFirst({ where: { id: sessionId, matchId } });
  if (!session) {
    throw new AppError('Game not found', 404);
  }
  return session;
};

const getSession = async (matchId, sessionId, userId) => {
  const session = await loadSessionForMember(matchId, sessionId, userId);
  return redactedSession(await expireIfOverdue(session), userId);
};

const submitMove = async (matchId, sessionId, userId, move, io = null) => {
  let session = await loadSessionForMember(matchId, sessionId, userId);
  session = await expireIfOverdue(session);
  if (session.status !== 'ACTIVE') {
    throw new AppError('This game has ended', 409);
  }

  // Idempotent retries: a replayed clientMoveId returns current state
  if (move.clientMoveId && session.state.moveIds?.includes(move.clientMoveId)) {
    return redactedSession(session, userId);
  }

  const engine = getEngine(session.gameType);
  const newState = engine.applyMove(session.state, userId, move);
  newState.moveIds = [...(session.state.moveIds || []), move.clientMoveId].filter(Boolean).slice(-50);

  const complete = engine.isComplete(newState);

  // Optimistic lock: version must not have moved under us, and a
  // concurrent decline/forfeit must not be overwritten
  const updated = await prisma.gameSession.updateMany({
    where: { id: sessionId, status: 'ACTIVE', version: session.version },
    data: {
      state: newState,
      version: session.version + 1,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ...(complete ? { status: 'COMPLETED', completedAt: new Date() } : {}),
    },
  });
  if (updated.count === 0) {
    throw new AppError('Game state changed — refresh and try again', 409);
  }

  const fresh = await prisma.gameSession.findUnique({ where: { id: sessionId } });

  if (complete) {
    const summary = engine.summary(fresh.state);
    try {
      const message = await sendMessage(
        matchId,
        userId,
        {
          content: `${GAME_LABELS[fresh.gameType]}: ${summary.title}`,
          messageType: 'GAME',
          metadata: JSON.stringify({
            kind: 'game-summary',
            sessionId,
            gameType: fresh.gameType,
            summary,
          }),
        },
        io,
      );
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: { summaryMessageId: message?.id || null },
      });
    } catch (error) {
      logger.warn('Game summary message failed:', error.message);
    }
    emitGameUpdate(io, fresh, 'completed', userId);
  } else {
    emitGameUpdate(io, fresh, 'move', userId);
  }

  return redactedSession(fresh, userId);
};

/** Copy for a game that ended before completion. */
const endSummary = (session) => {
  const state = session.state;
  let line = 'Ended early';
  if (session.gameType === 'THIS_OR_THAT') {
    line = `Played ${state.currentRound} of ${state.rounds.length} rounds`;
  } else if (session.gameType === 'QUESTION_ROULETTE') {
    line = 'Ended before both answers were in';
  } else if (session.gameType === 'TWO_TRUTHS') {
    line = 'Ended before the guess';
  } else if (session.gameType === 'EMOJI_RIDDLE') {
    const attempts = state.attempts?.length || 0;
    line = attempts
      ? `Ended unsolved after ${attempts} ${attempts === 1 ? 'guess' : 'guesses'}`
      : 'Ended before any guesses';
  }
  return { title: 'Game ended', line };
};

/**
 * The thread shows nothing while a game is live (play happens in the
 * docked panel) — the post-game card IS this summary message. Every
 * ended game posts one, except a This or That withdrawn before any pick
 * (version 1 = only the terminal write), which stays silent.
 */
const postEndSummaryMessage = async (matchId, userId, session, io) => {
  if (session.gameType === 'THIS_OR_THAT' && session.version <= 1) {
    return;
  }
  const summary = endSummary(session);
  try {
    const message = await sendMessage(
      matchId,
      userId,
      {
        content: `${GAME_LABELS[session.gameType]}: ${summary.title}`,
        messageType: 'GAME',
        metadata: JSON.stringify({
          kind: 'game-summary',
          sessionId: session.id,
          gameType: session.gameType,
          summary,
        }),
      },
      io,
    );
    await prisma.gameSession.update({
      where: { id: session.id },
      data: { summaryMessageId: message?.id || null },
    });
  } catch (error) {
    logger.warn('Game end message failed:', error.message);
  }
};

const endSession = async (matchId, sessionId, userId, status, io = null) => {
  let session = await loadSessionForMember(matchId, sessionId, userId);
  session = await expireIfOverdue(session);
  if (session.status !== 'ACTIVE') {
    throw new AppError('This game has ended', 409);
  }
  // Same optimistic lock as moves: a terminal write that raced a move (or
  // another terminal request) loses instead of clobbering the newer state
  const updated = await prisma.gameSession.updateMany({
    where: { id: sessionId, status: 'ACTIVE', version: session.version },
    data: { status, completedAt: new Date(), version: session.version + 1 },
  });
  if (updated.count === 0) {
    throw new AppError('Game state changed — refresh and try again', 409);
  }
  const fresh = await prisma.gameSession.findUnique({ where: { id: sessionId } });
  await postEndSummaryMessage(matchId, userId, fresh, io);
  emitGameUpdate(io, fresh, status.toLowerCase(), userId);
  return redactedSession(fresh, userId);
};

module.exports = {
  getGamesAvailability,
  getGamesSettings,
  setGamesEnabled,
  setMatchGamesMuted,
  endAllActiveGamesForUser,
  getGameOffers,
  createSession,
  getActiveSession,
  getSession,
  submitMove,
  declineSession: (matchId, sessionId, userId, io) =>
    endSession(matchId, sessionId, userId, 'DECLINED', io),
  forfeitSession: (matchId, sessionId, userId, io) =>
    endSession(matchId, sessionId, userId, 'FORFEITED', io),
  canStartGame,
  getGameFlags,
  GAME_LABELS,
};
