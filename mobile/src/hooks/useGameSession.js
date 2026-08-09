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
  // Versions are PER SESSION (each new game restarts at 0), so the gate
  // tracks {sessionId, version}: a snapshot is stale only when it's an
  // older version of the SAME session. A different session id always
  // replaces — otherwise a finished game's version would swallow the next
  // game's snapshots until a remount.
  const lastRef = useRef({ id: null, version: -1 });

  const isStale = (id, version) =>
    id != null &&
    id === lastRef.current.id &&
    typeof version === 'number' &&
    version < lastRef.current.version;

  const track = (id, version) => {
    lastRef.current = {
      id: id ?? null,
      version: typeof version === 'number' ? version : -1,
    };
  };

  const refresh = useCallback(async () => {
    if (!matchId) {
      return;
    }
    try {
      const active = await GamesApiService.getActiveSession(matchId);
      track(active?.id, active?.version);
      setSession(active);
    } catch (error) {
      Logger.warn('Game session refresh failed:', error);
    }
  }, [matchId]);

  // Authoritative REST snapshots (create/move/decline responses) go through
  // the same gate as socket deltas, so a successful write updates the UI
  // even when the corresponding socket event never arrives.
  const applySnapshot = useCallback(
    snapshot => {
      if (!snapshot || snapshot.matchId !== matchId) {
        return;
      }
      if (isStale(snapshot.id, snapshot.version)) {
        return;
      }
      track(snapshot.id, snapshot.version);
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
      if (isStale(data.sessionId, data.version)) {
        return;
      }
      track(data.sessionId, data.version);
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
          // Merge only within the same session — fields like createdBy come
          // from REST snapshots and must not leak across games
          ...(previous && previous.id === data.sessionId ? previous : {}),
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
