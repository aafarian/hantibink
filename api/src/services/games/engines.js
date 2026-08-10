/**
 * Server-authoritative game engines. Pure modules over plain state objects:
 *   init({creatorId, opponentId, usedIds, payload}) -> state
 *   applyMove(state, userId, move) -> newState   (throws AppError on invalid)
 *   viewFor(state, viewerId) -> redacted view    (NEVER leaks secret picks)
 *   isComplete(state) -> boolean
 *   summary(state, names) -> {title, line}       (copy for the summary card)
 *   offers({usedIds}) -> creator-side prompt choices (only where the game
 *     has content to preview before committing; answers included by design)
 *
 * Sessions exist only once the creator has committed their part (answered
 * the roulette question, chosen the riddle, authored the statements) — the
 * "draft" lives client-side, so the opponent never sees or gets notified
 * about a game that wasn't actually sent.
 *
 * The service layer owns persistence, membership, idempotency, sockets.
 */

const { AppError } = require('../../middleware/errorHandler');
const {
  CONTENT_VERSION,
  THIS_OR_THAT,
  QUESTION_ROULETTE,
  EMOJI_RIDDLES,
} = require('../../content/games/content');

const TOT_ROUNDS = 7;
const RIDDLE_ATTEMPTS = 3;

const pickUnused = (bank, usedIds, count) => {
  const used = new Set(usedIds || []);
  let fresh = bank.filter((item) => !used.has(item.id));
  if (fresh.length < count) {
    fresh = bank; // bank exhausted for this match: reset rotation
  }
  // Deterministic-ish rotation: stable order, offset by how many were used
  const offset = (usedIds?.length || 0) % bank.length;
  const rotated = [...fresh.slice(offset % fresh.length), ...fresh.slice(0, offset % fresh.length)];
  return rotated.slice(0, count);
};

const normalizeGuess = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(the|a|an)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/* ---------------------------- This or That ---------------------------- */

const thisOrThat = {
  init: ({ creatorId, opponentId, usedIds }) => {
    const prompts = pickUnused(THIS_OR_THAT, usedIds, TOT_ROUNDS);
    return {
      contentVersion: CONTENT_VERSION,
      players: { creatorId, opponentId },
      rounds: prompts.map((p) => ({ promptId: p.id, a: p.a, b: p.b, picks: {} })),
      currentRound: 0,
      usedPromptIds: prompts.map((p) => p.id),
    };
  },

  applyMove: (state, userId, move) => {
    if (move.type !== 'pick' || !['A', 'B'].includes(move.choice)) {
      throw new AppError('Invalid move', 400);
    }
    const round = state.rounds[state.currentRound];
    if (!round) {
      throw new AppError('Game already finished', 409);
    }
    if (round.picks[userId]) {
      throw new AppError('You already picked this round', 409);
    }
    const next = structuredClone(state);
    const nextRound = next.rounds[next.currentRound];
    nextRound.picks[userId] = move.choice;

    // Round reveals when both picked; advance
    if (Object.keys(nextRound.picks).length === 2) {
      next.currentRound += 1;
    }
    return next;
  },

  viewFor: (state, viewerId) => {
    const view = structuredClone(state);
    view.rounds = view.rounds.map((round, index) => {
      const revealed = index < view.currentRound;
      const myPick = round.picks[viewerId] || null;
      return {
        promptId: round.promptId,
        a: round.a,
        b: round.b,
        revealed,
        myPick,
        // Opponent's pick ONLY after the round reveals
        picks: revealed ? round.picks : undefined,
        opponentPicked: Object.keys(round.picks).some((id) => id !== viewerId),
        isMatch: revealed
          ? Object.values(round.picks).every((c) => c === Object.values(round.picks)[0])
          : undefined,
      };
    });
    view.totalRounds = state.rounds.length;
    return view;
  },

  isComplete: (state) => state.currentRound >= state.rounds.length,

  summary: (state) => {
    const total = state.rounds.length;
    const matches = state.rounds.filter((round) => {
      const picks = Object.values(round.picks);
      return picks.length === 2 && picks[0] === picks[1];
    }).length;
    const pct = Math.round((matches / total) * 100);
    const line =
      matches === total
        ? 'Did you two share a brain?!'
        : pct >= 70
          ? 'Dangerously compatible'
          : pct >= 40
            ? 'Opposites attract, right?'
            : 'Well… you know what they say about opposites';
    return { title: `${matches}/${total} matched (${pct}%)`, line, matches, total };
  },
};

/* ------------------------- Two Truths and a Lie ------------------------ */

const twoTruths = {
  init: ({ creatorId, opponentId, payload }) => {
    const statements = payload?.statements;
    const lieIndex = payload?.lieIndex;
    if (
      !Array.isArray(statements) ||
      statements.length !== 3 ||
      statements.some((s) => typeof s !== 'string' || !s.trim() || s.length > 140)
    ) {
      throw new AppError('Provide exactly 3 statements of up to 140 characters', 400);
    }
    if (![0, 1, 2].includes(lieIndex)) {
      throw new AppError('lieIndex must be 0, 1, or 2', 400);
    }
    return {
      contentVersion: CONTENT_VERSION,
      players: { creatorId, opponentId },
      phase: 'guessing', // authored at creation, opponent guesses
      statements: statements.map((s) => s.trim()),
      lieIndex,
      guessIndex: null,
    };
  },

  applyMove: (state, userId, move) => {
    if (state.phase !== 'guessing') {
      throw new AppError('Game already finished', 409);
    }
    if (userId === state.players.creatorId) {
      throw new AppError('The author cannot guess their own lie', 403);
    }
    if (move.type !== 'guess' || ![0, 1, 2].includes(move.index)) {
      throw new AppError('Invalid move', 400);
    }
    const next = structuredClone(state);
    next.guessIndex = move.index;
    next.phase = 'done';
    return next;
  },

  viewFor: (state, viewerId) => {
    const view = structuredClone(state);
    // The lie is secret from the guesser until the game is done
    if (state.phase !== 'done' && viewerId !== state.players.creatorId) {
      delete view.lieIndex;
    }
    return view;
  },

  isComplete: (state) => state.phase === 'done',

  summary: (state) => {
    const caught = state.guessIndex === state.lieIndex;
    return {
      title: caught ? 'Lie detected!' : 'Fooled them',
      line: caught
        ? 'The guesser saw right through it.'
        : `The lie was: "${state.statements[state.lieIndex]}"`,
      caught,
    };
  },
};

/* --------------------------- Question Roulette ------------------------- */

const questionRoulette = {
  offers: ({ usedIds }) =>
    pickUnused(QUESTION_ROULETTE, usedIds, 1).map(({ id, question }) => ({ id, question })),

  init: ({ creatorId, opponentId, usedIds, payload }) => {
    const offered = pickUnused(QUESTION_ROULETTE, usedIds, 1);
    let question = offered[0];
    if (payload?.questionId) {
      question = offered.find((q) => q.id === payload.questionId);
      if (!question) {
        throw new AppError('questionId must be the offered question', 400);
      }
    }
    // Creating IS the commit: the creator answers the question they were
    // shown, so the opponent is only ever notified about a playable game
    const answer = String(payload?.answer ?? '').trim();
    if (!answer || answer.length > 280) {
      throw new AppError('Answer must be 1-280 characters', 400);
    }
    return {
      contentVersion: CONTENT_VERSION,
      players: { creatorId, opponentId },
      questionId: question.id,
      question: question.question,
      answers: { [creatorId]: answer },
      usedPromptIds: [question.id],
    };
  },

  applyMove: (state, userId, move) => {
    if (move.type !== 'answer' || typeof move.text !== 'string') {
      throw new AppError('Invalid move', 400);
    }
    const text = move.text.trim();
    if (!text || text.length > 280) {
      throw new AppError('Answer must be 1-280 characters', 400);
    }
    if (state.answers[userId]) {
      throw new AppError('You already answered', 409);
    }
    const next = structuredClone(state);
    next.answers[userId] = text;
    return next;
  },

  viewFor: (state, viewerId) => {
    const view = structuredClone(state);
    const bothAnswered = Object.keys(state.answers).length === 2;
    if (!bothAnswered) {
      // Simultaneous reveal: nobody reads the other's answer early
      view.answers = state.answers[viewerId] ? { [viewerId]: state.answers[viewerId] } : {};
      view.opponentAnswered = Object.keys(state.answers).some((id) => id !== viewerId);
    }
    view.revealed = bothAnswered;
    return view;
  },

  isComplete: (state) => Object.keys(state.answers).length === 2,

  summary: () => ({
    title: 'Both answered!',
    line: 'Answers revealed — keep the conversation going.',
  }),
};

/* ----------------------------- Emoji Riddle ---------------------------- */

const emojiRiddle = {
  // Creator-side picker: answers are included on purpose — the creator
  // chooses which riddle to send knowing what it is
  offers: ({ usedIds }) =>
    pickUnused(EMOJI_RIDDLES, usedIds, 3).map(({ id, emoji, answer, category }) => ({
      id,
      emoji,
      answer,
      category,
    })),

  init: ({ creatorId, opponentId, usedIds, payload }) => {
    const offered = pickUnused(EMOJI_RIDDLES, usedIds, 3);
    // Choosing the riddle IS the commit — no server-side picking phase, so
    // the riddleId is required and must come from the offered set
    const riddle = offered.find((r) => r.id === payload?.riddleId);
    if (!riddle) {
      throw new AppError('riddleId must be one of the offered riddles', 400);
    }
    return {
      contentVersion: CONTENT_VERSION,
      players: { creatorId, opponentId },
      phase: 'guessing',
      riddleId: riddle.id,
      emoji: riddle.emoji,
      answer: riddle.answer,
      altAnswers: riddle.altAnswers,
      category: riddle.category,
      attempts: [],
      maxAttempts: RIDDLE_ATTEMPTS,
      solved: false,
      usedPromptIds: [riddle.id],
    };
  },

  applyMove: (state, userId, move) => {
    if (move.type !== 'guess') {
      throw new AppError('Invalid move', 400);
    }
    if (state.phase !== 'guessing') {
      throw new AppError('Riddle is not ready for guesses', 409);
    }
    if (userId === state.players.creatorId) {
      throw new AppError('The sender cannot guess their own riddle', 403);
    }
    const text = String(move.text || '').trim();
    if (!text || text.length > 100) {
      throw new AppError('Guess must be 1-100 characters', 400);
    }
    const normalized = normalizeGuess(text);
    const correct =
      normalized === normalizeGuess(state.answer) ||
      state.altAnswers.some((alt) => normalizeGuess(alt) === normalized);

    const next = structuredClone(state);
    next.attempts = [...state.attempts, { text, correct }];
    if (correct) {
      next.solved = true;
      next.phase = 'done';
    } else if (next.attempts.length >= state.maxAttempts) {
      next.phase = 'done';
    }
    return next;
  },

  viewFor: (state, viewerId) => {
    const view = structuredClone(state);
    const isCreator = viewerId === state.players.creatorId;
    if (!isCreator && state.phase !== 'done') {
      // Guesser never sees the answer (or alt answers) early; the category
      // hint unlocks after the second miss
      delete view.answer;
      delete view.altAnswers;
      if (state.attempts.length < 2) {
        delete view.category;
      }
    }
    return view;
  },

  isComplete: (state) => state.phase === 'done',

  summary: (state) => ({
    title: state.solved
      ? `Solved in ${state.attempts.length} ${state.attempts.length === 1 ? 'try' : 'tries'}!`
      : 'Stumped!',
    // The emoji here is the riddle itself, not decoration
    line: state.solved
      ? `${state.emoji} = ${state.answer}`
      : `It was "${state.answer}" (${state.emoji})`,
    solved: state.solved,
  }),
};

const ENGINES = {
  THIS_OR_THAT: thisOrThat,
  TWO_TRUTHS: twoTruths,
  QUESTION_ROULETTE: questionRoulette,
  EMOJI_RIDDLE: emojiRiddle,
};

const getEngine = (gameType) => {
  const engine = ENGINES[gameType];
  if (!engine) {
    throw new AppError('Unknown game type', 400);
  }
  return engine;
};

module.exports = { ENGINES, getEngine, normalizeGuess };
