import { useState, useEffect, useCallback, useRef } from 'react';
import GamesApiService from '../services/GamesApiService';
import SocketService from '../services/SocketService';
import Logger from '../utils/logger';

/**
 * Owns the active game session for a chat: fetch-on-mount, socket deltas
 * (version-checked so stale snapshots never regress state), and refetch on
 * reconnect. Moves are posted via GamesApiService with client-generated
 * idempotency IDs by the callers.
 */
const useGameSession = matchId => {
  const [session, setSession] = useState(null);
  const versionRef = useRef(-1);

  const refresh = useCallback(async () => {
    if (!matchId) {
      return;
    }
    try {
      const active = await GamesApiService.getActiveSession(matchId);
      versionRef.current = active?.version ?? -1;
      setSession(active);
    } catch (error) {
      Logger.warn('Game session refresh failed:', error);
    }
  }, [matchId]);

  // Authoritative REST snapshots (create/move/decline responses) go through
  // the same version gate as socket deltas, so a successful write updates
  // the UI even when the corresponding socket event never arrives.
  const applySnapshot = useCallback(
    snapshot => {
      if (!snapshot || snapshot.matchId !== matchId) {
        return;
      }
      if (typeof snapshot.version === 'number' && snapshot.version < versionRef.current) {
        return;
      }
      versionRef.current = snapshot.version ?? versionRef.current;
      setSession(snapshot);
    },
    [matchId]
  );

  useEffect(() => {
    refresh();

    const unsubscribeGame = SocketService.onGame((event, data) => {
      if (data?.matchId !== matchId) {
        return;
      }
      // Ignore snapshots older than what we already render
      if (typeof data.version === 'number' && data.version < versionRef.current) {
        return;
      }
      versionRef.current = data.version ?? versionRef.current;
      if (data.status && data.status !== 'ACTIVE') {
        // Completed/declined/forfeited: keep the final snapshot briefly so
        // cards can render the ending, but the "active" bar hides
        setSession({
          id: data.sessionId,
          matchId: data.matchId,
          gameType: data.gameType,
          status: data.status,
          version: data.version,
          view: data.view,
        });
      } else {
        setSession(previous => ({
          ...(previous || {}),
          id: data.sessionId,
          matchId: data.matchId,
          gameType: data.gameType,
          status: data.status,
          version: data.version,
          view: data.view,
        }));
      }
    });

    // Resync after reconnects (missed deltas)
    const unsubscribeConnection = SocketService.onConnection
      ? SocketService.onConnection(connected => {
          if (connected) {
            refresh();
          }
        })
      : null;

    return () => {
      unsubscribeGame();
      if (unsubscribeConnection) {
        unsubscribeConnection();
      }
    };
  }, [matchId, refresh]);

  return { session, setSession, refresh, applySnapshot };
};

export default useGameSession;
