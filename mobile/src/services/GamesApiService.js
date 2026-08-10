/**
 * In-chat games API client (kept out of the ~1000-line ApiDataService).
 * Server is authoritative; every response's `view` is already redacted for
 * the requesting user.
 */
import apiClient from './ApiClient';

const unwrap = response => (response?.success ? response.data : null);

const throwIfGated = response => {
  if (!response?.success) {
    const error = new Error(response?.message || 'Game action failed');
    error.code = response?.error;
    throw error;
  }
  return response.data;
};

const GamesApiService = {
  async getOffers(matchId, gameType) {
    // Query string built inline — apiClient.get's second arg is a fetch
    // init, NOT params (passing {gameType} there silently dropped it and
    // the server 400'd on the missing required query param)
    const response = await apiClient.get(
      `/games/${matchId}/offers?gameType=${encodeURIComponent(gameType)}`
    );
    return throwIfGated(response);
  },

  async getSession(matchId, sessionId) {
    return unwrap(await apiClient.get(`/games/${matchId}/sessions/${sessionId}`));
  },

  async getAvailability(matchId) {
    return unwrap(await apiClient.get(`/games/${matchId}/availability`));
  },

  async setMatchGamesMuted(matchId, muted) {
    const response = await apiClient.put(`/games/${matchId}/mute`, { muted });
    return throwIfGated(response);
  },

  async getSettings() {
    return unwrap(await apiClient.get('/games/settings'));
  },

  async setGamesEnabled(enabled) {
    const response = await apiClient.put('/games/settings', { enabled });
    return throwIfGated(response);
  },

  async createSession(matchId, gameType, payload = null) {
    const response = await apiClient.post(`/games/${matchId}/sessions`, {
      gameType,
      ...(payload ? { payload } : {}),
    });
    return throwIfGated(response);
  },

  async getActiveSession(matchId) {
    return unwrap(await apiClient.get(`/games/${matchId}/sessions/active`));
  },

  async submitMove(matchId, sessionId, move) {
    const response = await apiClient.post(`/games/${matchId}/sessions/${sessionId}/moves`, move);
    return throwIfGated(response);
  },

  async decline(matchId, sessionId) {
    const response = await apiClient.post(`/games/${matchId}/sessions/${sessionId}/decline`);
    return throwIfGated(response);
  },

  async forfeit(matchId, sessionId) {
    const response = await apiClient.post(`/games/${matchId}/sessions/${sessionId}/forfeit`);
    return throwIfGated(response);
  },
};

export default GamesApiService;
