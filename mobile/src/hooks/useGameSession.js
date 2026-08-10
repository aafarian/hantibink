import { useState, useEffect, useCallback, useRef } from 'react';
import GamesApiService from '../services/GamesApiService';
import SocketService from '../services/SocketService';
import Logger from '../utils/logger';

const toTime = value => {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

/**
 * Owns the active game session for a chat: fetch-on-mount, socket deltas
 * (version-checked so stale snapshots never regress state), and refetch on
 * reconnect. Moves are posted via GamesApiService with client-generated
 * idempotency IDs by the callers.
 */
const useGameSession = matchId => {
  const [session, setSession] = useState(null);
  // Versions are PER SESSION (each new game restarts at 0), so the gate
  // tracks {sessionId, version, createdAt}: same-session snapshots are
  // ordered by version, DIFFERENT sessions by createdAt — so a delayed
  // snapshot from a finished game can't replace a newer game, and a
  // finished game's version can't swallow the next game's snapshots.
  // Missing timestamps fail open (replace) rather than freeze the UI.
  const lastRef = useRef({ id: null, version: -1, createdAt: 0 });

  const isStale = (id, version, createdAt) => {
    if (id == null) {
      return false;
    }
    if (id === lastRef.current.id) {
      return typeof version === 'number' && version < lastRef.current.version;
    }
    const incoming = toTime(createdAt);
    return incoming > 0 && lastRef.current.createdAt > 0 && incoming < lastRef.current.createdAt;
  };

  const track = (id, version, createdAt) => {
    const time = toTime(createdAt);
    lastRef.current = {
      id: id ?? null,
      version: typeof version === 'number' ? version : -1,
      // A same-session update without a timestamp keeps the known one
      createdAt: time || (id === lastRef.current.id ? lastRef.current.createdAt : 0),
    };
  };

  const refresh = useCallback(async () => {
    if (!matchId) {
      return;
    }
    // track() replaces lastRef.current wholesale, so object identity tells
    // us whether ANY snapshot landed while this request was in flight
    const before = lastRef.current;
    try {
      const active = await GamesApiService.getActiveSession(matchId);
      if (active) {
        // Same gate as sockets/REST snapshots: a delayed refresh for an
        // older session must not replace a newer game
        if (isStale(active.id, active.version, active.createdAt)) {
          return;
        }
        track(active.id, active.version, active.createdAt);
        setSession(active);
      } else if (lastRef.current === before) {
        // "No active game" is only trustworthy if nothing newer arrived
        // during the fetch. Keep lastRef as-is: it still holds the newest
        // ordering info we know, which keeps rejecting stale snapshots.
        setSession(null);
      }
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
      if (isStale(snapshot.id, snapshot.version, snapshot.createdAt)) {
        return;
      }
      track(snapshot.id, snapshot.version, snapshot.createdAt);
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
      if (isStale(data.sessionId, data.version, data.createdAt)) {
        return;
      }
      track(data.sessionId, data.version, data.createdAt);
      if (data.status && data.status !== 'ACTIVE') {
        // Completed/declined/forfeited: keep the final snapshot briefly so
        // cards can render the ending, but the "active" bar hides
        setSession({
          id: data.sessionId,
          matchId: data.matchId,
          gameType: data.gameType,
          status: data.status,
          version: data.version,
          createdAt: data.createdAt,
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
          createdAt: data.createdAt,
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
