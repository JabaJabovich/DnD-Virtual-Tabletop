// src/providers/SessionProvider.jsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { socket } from '../services/socket';
import { DELETE_FIELD } from '../utils/helpers';

const SessionContext = createContext(null);

const INITIAL_SESSION = {
  isGameStarted: false,
  mapConfig: null,
  gridConfig: {},
  tokens: {},
  walls: [],
  templates: [],
  diceLog: [],
  chatMessages: [],
  chatReadStates: {},
  pings: [],
  readyPlayers: [],
  fogEnabled: true,
  combatState: { isActive: false, order: [], currentTurnIndex: 0 },
  bgMusic: { videoId: null, isPlaying: false },
  lighting: 'day',
};

export function SessionProvider({ children }) {
  const [dbStatus, setDbStatus] = useState('connecting');
  const [sessionsList, setSessionsList] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(INITIAL_SESSION);
  const [allScenes, setAllScenes] = useState([]);

  // Глобальный апдейтер сессии (перенесён из App)
  const updateSession = useCallback((updates, overrideSessionId = null) => {
    const targetId = overrideSessionId || activeSessionId;
    if (!targetId) return;

    setSessionData(prev => {
      const nextState = { ...prev };

      for (const key in updates) {
        const val = updates[key];

        if (key.includes('.')) {
          const parts = key.split('.');
          let curr = nextState;

          for (let i = 0; i < parts.length - 1; i++) {
            curr[parts[i]] = { ...(curr[parts[i]] || {}) };
            curr = curr[parts[i]];
          }

          const lastKey = parts[parts.length - 1];
          if (val === DELETE_FIELD) delete curr[lastKey];
          else curr[lastKey] = val;
        } else {
          if (val === DELETE_FIELD) delete nextState[key];
          else nextState[key] = val;
        }
      }

      socket.emit('update_session', { sessionId: targetId, updates });
      return nextState;
    });
  }, [activeSessionId]);

  // Подписки на сокет (состояние БД, список сессий, сцены)
  useEffect(() => {
    const handleConnect = () => setDbStatus('connected');
    const handleConnectError = () => setDbStatus('error');
    const handleSessionsUpdated = data => setSessionsList(data);
    const handleScenesUpdated = data => setAllScenes(data);

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('sessions_updated', handleSessionsUpdated);
    socket.on('scenes_updated', handleScenesUpdated);

    socket.emit('get_sessions', data => setSessionsList(data));
    socket.emit('get_scenes', data => setAllScenes(data));

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('sessions_updated', handleSessionsUpdated);
      socket.off('scenes_updated', handleScenesUpdated);
    };
  }, []);

  const value = {
    dbStatus,
    sessionsList,
    activeSessionId,
    setActiveSessionId,
    sessionData,
    setSessionData,
    updateSession,
    allScenes,
    setAllScenes,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return ctx;
}
