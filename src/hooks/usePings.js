// hooks/usePings.js
import { useEffect, useCallback } from 'react';
import { socket } from '../services/socket';
import { generateId } from '../utils/helpers';

export function usePings(localTokens, activeSessionId, setSessionData) {

  // Чистка устаревших пингов каждую секунду
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionData(prev => {
        if (!prev.pings || prev.pings.length === 0) return prev;
        const now = Date.now();
        const filtered = prev.pings.filter(p => now - p.time < 3000);
        if (filtered.length === prev.pings.length) return prev;
        return { ...prev, pings: filtered };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [setSessionData]);

  const addMapPing = useCallback(
    (tokenId, type, value = null) => {
      const t = localTokens.find(tok => tok.id === tokenId);
      if (!t) return;

      const newPing = {
        id: generateId(),
        x: t.x,
        y: t.y,
        type,
        value,
        time: Date.now(),
      };

      if (socket.volatile) {
        socket.volatile.emit('broadcast', {
          sessionId: activeSessionId,
          event: 'ping',
          payload: newPing,
        });
      } else {
        socket.emit('broadcast', {
          sessionId: activeSessionId,
          event: 'ping',
          payload: newPing,
        });
      }

      setSessionData(prev => {
        const recentPings = prev.pings.filter(p => Date.now() - p.time < 3000);
        if (recentPings.some(p => p.id === newPing.id)) return prev;
        return { ...prev, pings: [...recentPings, newPing] };
      });
    },
    [localTokens, activeSessionId, setSessionData]
  );

  return { addMapPing };
}
