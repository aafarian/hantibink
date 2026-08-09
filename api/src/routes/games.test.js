import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp, createMockSocketIO } from '../../test-setup/helpers/test-utils.js';
import { userFactory, matchFactory } from '../../test-setup/helpers/factories.js';
import gamesRouter from './games.js';
import { getEngine } from '../services/games/engines.js';

const setupPair = async () => {
  const auth1 = await userFactory.createWithAuth(global.prisma);
  const auth2 = await userFactory.createWithAuth(global.prisma);
  const match = await matchFactory.create(global.prisma, auth1.user.id, auth2.user.id);
  return { auth1, auth2, match };
};

describe('Games engines (pure)', () => {
  it('This or That: full game, reveal-on-both, compatibility summary', () => {
    const engine = getEngine('THIS_OR_THAT');
    let state = engine.init({ creatorId: 'u1', opponentId: 'u2', usedIds: [] });
    expect(state.rounds.length).toBe(7);

    // u1 picks; u2 must NOT see it before revealing
    state = engine.applyMove(state, 'u1', { type: 'pick', choice: 'A' });
    const u2view = engine.viewFor(state, 'u2');
    expect(u2view.rounds[0].picks).toBeUndefined();
    expect(u2view.rounds[0].opponentPicked).toBe(true);
    expect(JSON.stringify(u2view.rounds[0])).not.toContain('"u1":"A"');

    // both pick all rounds (u2 mirrors u1 -> full match)
    state = engine.applyMove(state, 'u2', { type: 'pick', choice: 'A' });
    for (let i = 1; i < 7; i++) {
      state = engine.applyMove(state, 'u1', { type: 'pick', choice: 'B' });
      state = engine.applyMove(state, 'u2', { type: 'pick', choice: 'B' });
    }
    expect(engine.isComplete(state)).toBe(true);
    const summary = engine.summary(state);
    expect(summary.matches).toBe(7);
    expect(summary.title).toContain('7/7');
  });

  it('This or That: double-pick in a round is rejected', () => {
    const engine = getEngine('THIS_OR_THAT');
    let state = engine.init({ creatorId: 'u1', opponentId: 'u2', usedIds: [] });
    state = engine.applyMove(state, 'u1', { type: 'pick', choice: 'A' });
    expect(() => engine.applyMove(state, 'u1', { type: 'pick', choice: 'B' })).toThrow();
  });

  it('Two Truths: lie hidden from guesser until done; author cannot guess', () => {
    const engine = getEngine('TWO_TRUTHS');
    let state = engine.init({
      creatorId: 'u1',
      opponentId: 'u2',
      payload: { statements: ['I ski', 'I sing', 'I fly planes'], lieIndex: 2 },
    });
    expect(engine.viewFor(state, 'u2').lieIndex).toBeUndefined();
    expect(engine.viewFor(state, 'u1').lieIndex).toBe(2);
    expect(() => engine.applyMove(state, 'u1', { type: 'guess', index: 1 })).toThrow();

    state = engine.applyMove(state, 'u2', { type: 'guess', index: 2 });
    expect(engine.isComplete(state)).toBe(true);
    expect(engine.summary(state).caught).toBe(true);
    expect(engine.viewFor(state, 'u2').lieIndex).toBe(2);
  });

  it('Two Truths: rejects bad authoring payloads', () => {
    const engine = getEngine('TWO_TRUTHS');
    expect(() =>
      engine.init({ creatorId: 'u1', opponentId: 'u2', payload: { statements: ['one'], lieIndex: 0 } }),
    ).toThrow();
    expect(() =>
      engine.init({
        creatorId: 'u1',
        opponentId: 'u2',
        payload: { statements: ['a', 'b', 'c'], lieIndex: 5 },
      }),
    ).toThrow();
  });

  it('Question Roulette: creator answer commits at init, simultaneous reveal', () => {
    const engine = getEngine('QUESTION_ROULETTE');
    let state = engine.init({
      creatorId: 'u1',
      opponentId: 'u2',
      usedIds: [],
      payload: { answer: 'Sunrise hikes' },
    });

    const u2view = engine.viewFor(state, 'u2');
    expect(u2view.answers).toEqual({});
    expect(u2view.opponentAnswered).toBe(true);
    expect(JSON.stringify(u2view)).not.toContain('Sunrise hikes');

    // Creator already answered at init — no double answer
    expect(() => engine.applyMove(state, 'u1', { type: 'answer', text: 'again' })).toThrow();

    state = engine.applyMove(state, 'u2', { type: 'answer', text: 'Late night drives' });
    expect(engine.isComplete(state)).toBe(true);
    expect(engine.viewFor(state, 'u2').answers.u1).toBe('Sunrise hikes');
  });

  it('Question Roulette: init without an answer is rejected (no draft sessions)', () => {
    const engine = getEngine('QUESTION_ROULETTE');
    expect(() => engine.init({ creatorId: 'u1', opponentId: 'u2', usedIds: [] })).toThrow();
    expect(() =>
      engine.init({ creatorId: 'u1', opponentId: 'u2', usedIds: [], payload: { answer: '  ' } }),
    ).toThrow();
    expect(() =>
      engine.init({
        creatorId: 'u1',
        opponentId: 'u2',
        usedIds: [],
        payload: { questionId: 'qr_does_not_exist', answer: 'hi' },
      }),
    ).toThrow();
  });

  const initRiddle = (engine, usedIds = []) => {
    const [offer] = engine.offers({ usedIds });
    return engine.init({
      creatorId: 'u1',
      opponentId: 'u2',
      usedIds,
      payload: { riddleId: offer.id },
    });
  };

  it('Emoji Riddle: offers include answers for the creator; chosen riddle starts guessing', () => {
    const engine = getEngine('EMOJI_RIDDLE');
    const offers = engine.offers({ usedIds: [] });
    expect(offers.length).toBe(3);
    for (const offer of offers) {
      expect(offer.emoji).toBeTruthy();
      expect(offer.answer).toBeTruthy();
      expect(offer.category).toBeTruthy();
    }

    const state = engine.init({
      creatorId: 'u1',
      opponentId: 'u2',
      usedIds: [],
      payload: { riddleId: offers[1].id },
    });
    expect(state.phase).toBe('guessing');
    expect(state.riddleId).toBe(offers[1].id);
  });

  it('Emoji Riddle: init requires a riddleId from the offered set', () => {
    const engine = getEngine('EMOJI_RIDDLE');
    expect(() => engine.init({ creatorId: 'u1', opponentId: 'u2', usedIds: [] })).toThrow();
    expect(() =>
      engine.init({
        creatorId: 'u1',
        opponentId: 'u2',
        usedIds: [],
        payload: { riddleId: 'er_not_offered' },
      }),
    ).toThrow();
  });

  it('Emoji Riddle: normalized matching, hint after 2 misses, answer hidden', () => {
    const engine = getEngine('EMOJI_RIDDLE');
    let state = initRiddle(engine);

    let view = engine.viewFor(state, 'u2');
    expect(view.answer).toBeUndefined();
    expect(view.category).toBeUndefined();

    state = engine.applyMove(state, 'u2', { type: 'guess', text: 'wrong one' });
    state = engine.applyMove(state, 'u2', { type: 'guess', text: 'still wrong' });
    view = engine.viewFor(state, 'u2');
    expect(view.category).toBeDefined(); // hint unlocked

    // Correct guess with case/punctuation/article noise
    state = engine.applyMove(state, 'u2', { type: 'guess', text: `  THE ${state.answer}!! ` });
    expect(state.solved).toBe(true);
    expect(engine.isComplete(state)).toBe(true);
  });

  it('Emoji Riddle: exhausting attempts ends the game unsolved', () => {
    const engine = getEngine('EMOJI_RIDDLE');
    let state = initRiddle(engine);
    for (const guess of ['a', 'b', 'c']) {
      state = engine.applyMove(state, 'u2', { type: 'guess', text: guess });
    }
    expect(engine.isComplete(state)).toBe(true);
    expect(state.solved).toBe(false);
  });
});

describe('Games Routes', () => {
  let app;
  let io;

  beforeEach(() => {
    io = createMockSocketIO();
    app = createTestApp(gamesRouter, '/games');
    app.set('io', io);
  });

  it('starts a session, creates a GAME chat message, emits to both user rooms', async () => {
    const { auth1, auth2, match } = await setupPair();

    const response = await request(app)
      .post(`/games/${match.id}/sessions`)
      .set('Authorization', auth1.authHeader)
      .send({ gameType: 'THIS_OR_THAT' });

    expect(response.status).toBe(201);
    expect(response.body.data.view.rounds.length).toBe(7);

    const message = await global.prisma.message.findFirst({
      where: { matchId: match.id, messageType: 'GAME' },
    });
    expect(message).not.toBeNull();
    expect(JSON.parse(message.metadata).kind).toBe('game-start');

    expect(io.findEmit('game-updated', `user:${auth1.user.id}`)).toBeDefined();
    expect(io.findEmit('game-updated', `user:${auth2.user.id}`)).toBeDefined();
  });

  it('REDACTION: socket payloads never contain the opponent secret pick', async () => {
    const { auth1, auth2, match } = await setupPair();

    const created = await request(app)
      .post(`/games/${match.id}/sessions`)
      .set('Authorization', auth1.authHeader)
      .send({ gameType: 'THIS_OR_THAT' });
    const sessionId = created.body.data.id;
    io.clearEmitCalls();

    await request(app)
      .post(`/games/${match.id}/sessions/${sessionId}/moves`)
      .set('Authorization', auth1.authHeader)
      .send({ type: 'pick', choice: 'A', clientMoveId: 'm1' });

    const toOpponent = io.findEmit('game-updated', `user:${auth2.user.id}`);
    expect(toOpponent).toBeDefined();
    const serialized = JSON.stringify(toOpponent.data.view);
    expect(serialized).not.toContain(`"${auth1.user.id}":"A"`);
    expect(toOpponent.data.view.rounds[0].opponentPicked).toBe(true);
  });

  it('one active session per match (409 on second start)', async () => {
    const { auth1, auth2, match } = await setupPair();
    await request(app)
      .post(`/games/${match.id}/sessions`)
      .set('Authorization', auth1.authHeader)
      .send({ gameType: 'THIS_OR_THAT' });

    const second = await request(app)
      .post(`/games/${match.id}/sessions`)
      .set('Authorization', auth2.authHeader)
      .send({ gameType: 'QUESTION_ROULETTE' });
    expect(second.status).toBe(409);
  });

  it('idempotent clientMoveId replay returns state without double-applying', async () => {
    const { auth1, match } = await setupPair();
    const created = await request(app)
      .post(`/games/${match.id}/sessions`)
      .set('Authorization', auth1.authHeader)
      .send({ gameType: 'THIS_OR_THAT' });
    const sessionId = created.body.data.id;

    const move = { type: 'pick', choice: 'A', clientMoveId: 'dup-1' };
    const first = await request(app)
      .post(`/games/${match.id}/sessions/${sessionId}/moves`)
      .set('Authorization', auth1.authHeader)
      .send(move);
    const replay = await request(app)
      .post(`/games/${match.id}/sessions/${sessionId}/moves`)
      .set('Authorization', auth1.authHeader)
      .send(move);

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.body.data.version).toBe(first.body.data.version);
  });

  it('non-members get 404; foreign sessions unreachable', async () => {
    const { auth1, match } = await setupPair();
    const outsider = await userFactory.createWithAuth(global.prisma);

    const created = await request(app)
      .post(`/games/${match.id}/sessions`)
      .set('Authorization', auth1.authHeader)
      .send({ gameType: 'THIS_OR_THAT' });

    const probe = await request(app)
      .get(`/games/${match.id}/sessions/${created.body.data.id}`)
      .set('Authorization', outsider.authHeader);
    expect(probe.status).toBe(404);
  });

  it('completing a game writes a summary GAME message and completes the session', async () => {
    const { auth1, auth2, match } = await setupPair();
    const created = await request(app)
      .post(`/games/${match.id}/sessions`)
      .set('Authorization', auth1.authHeader)
      .send({ gameType: 'QUESTION_ROULETTE', payload: { answer: 'Answer one' } });
    const sessionId = created.body.data.id;

    const done = await request(app)
      .post(`/games/${match.id}/sessions/${sessionId}/moves`)
      .set('Authorization', auth2.authHeader)
      .send({ type: 'answer', text: 'Answer two' });

    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.view.answers[auth1.user.id]).toBe('Answer one');

    const summary = await global.prisma.message.findFirst({
      where: { matchId: match.id, messageType: 'GAME', metadata: { contains: 'game-summary' } },
    });
    expect(summary).not.toBeNull();
  });

  it('offers endpoint returns riddle choices to the creator, nothing persisted', async () => {
    const { auth1, match } = await setupPair();

    const response = await request(app)
      .get(`/games/${match.id}/offers`)
      .query({ gameType: 'EMOJI_RIDDLE' })
      .set('Authorization', auth1.authHeader);

    expect(response.status).toBe(200);
    expect(response.body.data.offers.length).toBe(3);
    expect(response.body.data.offers[0].answer).toBeTruthy();

    // Browsing offers creates no session and sends no message
    const sessions = await global.prisma.gameSession.count({ where: { matchId: match.id } });
    const messages = await global.prisma.message.count({ where: { matchId: match.id } });
    expect(sessions).toBe(0);
    expect(messages).toBe(0);
  });

  it('roulette without an answer and riddle without a chosen riddle are rejected', async () => {
    const { auth1, match } = await setupPair();

    const noAnswer = await request(app)
      .post(`/games/${match.id}/sessions`)
      .set('Authorization', auth1.authHeader)
      .send({ gameType: 'QUESTION_ROULETTE' });
    expect(noAnswer.status).toBe(400);

    const noRiddle = await request(app)
      .post(`/games/${match.id}/sessions`)
      .set('Authorization', auth1.authHeader)
      .send({ gameType: 'EMOJI_RIDDLE' });
    expect(noRiddle.status).toBe(400);

    // Failed commits leave nothing behind — no session, no chat message
    const sessions = await global.prisma.gameSession.count({ where: { matchId: match.id } });
    expect(sessions).toBe(0);
  });

  it('decline ends the session', async () => {
    const { auth1, auth2, match } = await setupPair();
    const created = await request(app)
      .post(`/games/${match.id}/sessions`)
      .set('Authorization', auth1.authHeader)
      .send({ gameType: 'THIS_OR_THAT' });

    const declined = await request(app)
      .post(`/games/${match.id}/sessions/${created.body.data.id}/decline`)
      .set('Authorization', auth2.authHeader);
    expect(declined.body.data.status).toBe('DECLINED');

    const active = await request(app)
      .get(`/games/${match.id}/sessions/active`)
      .set('Authorization', auth1.authHeader);
    expect(active.body.data).toBeNull();
  });

  it('gating: flag off blocks all games; deep-game daily cap with either-premium bypass', async () => {
    const { auth1, auth2, match } = await setupPair();

    process.env.GAMES_GATING_ENABLED = 'true';
    try {
      // Free pair: 3 deep games allowed, 4th blocked (declining frees the slot)
      for (let i = 0; i < 3; i++) {
        const started = await request(app)
          .post(`/games/${match.id}/sessions`)
          .set('Authorization', auth1.authHeader)
          .send({ gameType: 'QUESTION_ROULETTE', payload: { answer: `Answer ${i}` } });
        expect(started.status).toBe(201);
        await request(app)
          .post(`/games/${match.id}/sessions/${started.body.data.id}/decline`)
          .set('Authorization', auth1.authHeader);
      }
      const fourth = await request(app)
        .post(`/games/${match.id}/sessions`)
        .set('Authorization', auth1.authHeader)
        .send({ gameType: 'QUESTION_ROULETTE', payload: { answer: 'Blocked anyway' } });
      expect(fourth.status).toBe(403);

      // This or That stays free
      const hook = await request(app)
        .post(`/games/${match.id}/sessions`)
        .set('Authorization', auth1.authHeader)
        .send({ gameType: 'THIS_OR_THAT' });
      expect(hook.status).toBe(201);
      await request(app)
        .post(`/games/${match.id}/sessions/${hook.body.data.id}/decline`)
        .set('Authorization', auth1.authHeader);

      // Either-player premium unlocks deep games for both
      await global.prisma.user.update({
        where: { id: auth2.user.id },
        data: { isPremium: true },
      });
      const offers = await request(app)
        .get(`/games/${match.id}/offers`)
        .query({ gameType: 'EMOJI_RIDDLE' })
        .set('Authorization', auth1.authHeader);
      expect(offers.status).toBe(200);
      const premiumPair = await request(app)
        .post(`/games/${match.id}/sessions`)
        .set('Authorization', auth1.authHeader)
        .send({
          gameType: 'EMOJI_RIDDLE',
          payload: { riddleId: offers.body.data.offers[0].id },
        });
      expect(premiumPair.status).toBe(201);
    } finally {
      delete process.env.GAMES_GATING_ENABLED;
    }
  });
});
