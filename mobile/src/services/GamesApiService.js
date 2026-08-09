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
    const response = await apiClient.get(`/games/${matchId}/offers`, { gameType });
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
    return unwrap(await apiClient.post(`/games/${matchId}/sessions/${sessionId}/decline`));
  },

  async forfeit(matchId, sessionId) {
    return unwrap(await apiClient.post(`/games/${matchId}/sessions/${sessionId}/forfeit`));
  },
};

export default GamesApiService;
