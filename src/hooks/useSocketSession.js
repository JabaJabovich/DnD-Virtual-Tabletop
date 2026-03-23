// hooks/useSocketSession.js
import { useEffect } from 'react';
import { socket } from '../services/socket';
import { DELETE_FIELD } from '../utils/helpers';

export function useSocketSession({
  activeSessionId,
  activeCharId,
  sessionTokens,       // sessionData.tokens
  stateRefs,
  recentBroadcastsRef,
  setSessionData,
  setLocalTokens,
  localTokens,
  setMyTokenId,
  setAuthStep,
  handleDropToLobby,
}) {

  // Подписки на сокет
  useEffect(() => {
    if (!activeSessionId) return;
    socket.emit('join_session', activeSessionId);

    socket.on('session_full_state', (data) => {
      if (!data) return;

      setSessionData(prev => ({
        ...prev, ...data,
        tokens:       data.tokens       || {},
        walls:        data.walls        || [],
        chatMessages: data.chatMessages || [],
        templates:    data.templates    || [],
        pings:        data.pings        || [],
        diceLog:      data.diceLog      || [],
      }));

      const serverTokensArr = data.tokens ? Object.values(data.tokens) : [];
      const {
        authStep: currentAuthStep,
        userRole: currentRole,
        currentUser: currUser,
      } = stateRefs.current;

      setLocalTokens(serverTokensArr);

      if (currentAuthStep === 'lobby_wait' && data.isGameStarted) {
        if (currentRole === 'player') {
          const myT = serverTokensArr.find(
            t => t.accountId === currUser?.id && t.characterId === activeCharId
          );
          if (myT) setMyTokenId(myT.id);
        }
        setAuthStep('in_game');
      }
      if (currentAuthStep === 'in_game' && !data.isGameStarted) {
        handleDropToLobby();
      }
    });

    socket.on('session_update', (payload) => {
      setSessionData(prev => {
        let nextState = { ...prev };
        for (const key in payload) {
          const val = payload[key];
          if (key.includes('.')) {
            const parts = key.split('.');
            let currentLevel = nextState;
            for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              currentLevel[part] = { ...currentLevel[part] };
              currentLevel = currentLevel[part];
            }
            if (val === DELETE_FIELD) delete currentLevel[parts[parts.length - 1]];
            else currentLevel[parts[parts.length - 1]] = val;
          } else {
            if (val === DELETE_FIELD) delete nextState[key];
            else nextState[key] = val;
          }
        }
        return nextState;
      });

      if (
        payload.isGameStarted === true &&
        stateRefs.current.authStep === 'lobby_wait'
      ) {
        if (stateRefs.current.userRole === 'player' && payload.tokens) {
          const myT = Object.values(payload.tokens).find(
            t =>
              t.accountId === stateRefs.current.currentUser?.id &&
              t.characterId === activeCharId
          );
          if (myT) setMyTokenId(myT.id);
        }
        setAuthStep('in_game');
      } else if (
        payload.isGameStarted === false &&
        stateRefs.current.authStep === 'in_game'
      ) {
        handleDropToLobby();
      }
    });

    socket.on('broadcast', ({ event, payload }) => {
      if (event === 'token_move') {
        const { id, x, y, fovPolygon } = payload;
        recentBroadcastsRef.current[id] = Date.now();
        if (id !== stateRefs.current.draggingTokenId) {
          setLocalTokens(prev =>
            prev.map(t => (t.id === id ? { ...t, x, y, fovPolygon } : t))
          );
        }
      }
      if (event === 'ping') {
        setSessionData(prev => {
          const recentPings = (prev.pings || []).filter(
            p => Date.now() - p.time < 3000
          );
          if (recentPings.some(p => p.id === payload.id)) return prev;
          return { ...prev, pings: [...recentPings, payload] };
        });
      }
    });

    return () => {
      socket.off('session_full_state');
      socket.off('session_update');
      socket.off('broadcast');
    };
  }, [activeSessionId, activeCharId]);

  // Синхронизация localTokens с sessionData.tokens
  useEffect(() => {
    if (!sessionTokens || Object.keys(sessionTokens).length === 0) {
      if (localTokens.length > 0) setLocalTokens([]);
      return;
    }

    setLocalTokens(prevLocal => {
      const serverTokensArr = Object.values(sessionTokens);
      const draggingId = stateRefs.current.draggingTokenId;

      if (serverTokensArr.length !== prevLocal.length) return serverTokensArr;

      let hasChanges = false;
      const newLocal = serverTokensArr.map(serverToken => {
        if (serverToken.id === draggingId) {
          return prevLocal.find(t => t.id === serverToken.id) || serverToken;
        }
        const local = prevLocal.find(t => t.id === serverToken.id);
        if (
          !local ||
          local.x        !== serverToken.x        ||
          local.y        !== serverToken.y        ||
          local.hp       !== serverToken.hp       ||
          local.tempHp   !== serverToken.tempHp   ||
          local.vision   !== serverToken.vision   ||
          local.size     !== serverToken.size     ||
          local.isHidden !== serverToken.isHidden ||
          local.ac       !== serverToken.ac       ||
          JSON.stringify(local.statuses) !== JSON.stringify(serverToken.statuses)
        ) {
          hasChanges = true;
          return serverToken;
        }
        return local;
      });

      return hasChanges ? newLocal : prevLocal;
    });
  }, [sessionTokens]);
}
