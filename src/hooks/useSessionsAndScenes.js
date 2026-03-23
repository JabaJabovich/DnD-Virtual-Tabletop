// hooks/useSessionsAndScenes.js
import { useCallback } from 'react';
import { socket } from '../services/socket';
import { generateId, DELETE_FIELD } from '../utils/helpers';

export function useSessionsAndScenes(params) {
  const {
    // из контекста/хуков
    sessionData,
    updateSession,
    allScenes,
    activeSessionId,

    // auth / user
    currentUser,
    activeCharacter,
    loginHp,
    userRole,

    // сеттеры навигации/ролей
    setActiveSessionId,
    setAuthStep,
    setGmMode,
    setMyTokenId,
    setSelectedTokenId,

    // UI флаги
    setShowStatsWidget,
    setShowInvWidget,
    setShowAbilWidget,
    setShowAtkWidget,
    setCombatSelection,
    setIsTokenPanelOpen,

    // карта
    setScale,
    setPan,

    // ref
    hasCenteredRef,
  } = params;

  const handleLeaveSession = useCallback(() => {
    setActiveSessionId(null);
    setMyTokenId(null);
    setSelectedTokenId(null);
    setAuthStep('sessions');
    setGmMode(false);
    setShowStatsWidget(false);
    setShowInvWidget(false);
    setShowAbilWidget(false);
    setShowAtkWidget(false);
    setCombatSelection([]);
    setIsTokenPanelOpen(false);
    if (hasCenteredRef?.current != null) hasCenteredRef.current = false;
  }, [
    setActiveSessionId,
    setMyTokenId,
    setSelectedTokenId,
    setAuthStep,
    setGmMode,
    setShowStatsWidget,
    setShowInvWidget,
    setShowAbilWidget,
    setShowAtkWidget,
    setCombatSelection,
    setIsTokenPanelOpen,
    hasCenteredRef,
  ]);

  const handleDropToLobby = useCallback(() => {
    setMyTokenId(null);
    setSelectedTokenId(null);
    setAuthStep('lobby_wait');
    setShowStatsWidget(false);
    setShowInvWidget(false);
    setShowAbilWidget(false);
    setShowAtkWidget(false);
    setCombatSelection([]);
    setIsTokenPanelOpen(false);
    if (hasCenteredRef?.current != null) hasCenteredRef.current = false;
  }, [
    setMyTokenId,
    setSelectedTokenId,
    setAuthStep,
    setShowStatsWidget,
    setShowInvWidget,
    setShowAbilWidget,
    setShowAtkWidget,
    setCombatSelection,
    setIsTokenPanelOpen,
    hasCenteredRef,
  ]);

  const leaveLobby = useCallback(() => {
    if (userRole === 'player' && activeSessionId && currentUser?.id) {
      socket.emit('get_session', activeSessionId, dbSess => {
        const filtered = (dbSess?.readyPlayers || []).filter(
          p => !(p.accountId === currentUser.id && p.characterId === activeCharacter.id)
        );
        socket.emit('update_session', {
          sessionId: activeSessionId,
          updates: { readyPlayers: filtered },
        });
      });
    }
    handleLeaveSession();
  }, [
    userRole,
    activeSessionId,
    currentUser,
    activeCharacter,
    handleLeaveSession,
  ]);

  const createSession = useCallback(
    e => {
      e.preventDefault();
      const name = params.newSessionName?.trim();
      if (!name) return;

      const newSession = {
        id: generateId(),
        name,
        createdAt: Date.now(),
        isGameStarted: false,
        mapConfig: null,
        gridConfig: { enabled: false, size: 60, color: '#ffffff', opacity: 0.3 },
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

      socket.emit('create_session', newSession);
      params.setNewSessionName?.('');
    },
    [params.newSessionName, params.setNewSessionName]
  );

  const deleteSession = useCallback(id => {
    if (window.confirm('Вы уверены, что хотите удалить эту сессию?')) {
      socket.emit('delete_session', id);
    }
  }, []);

  const joinSession = useCallback(
    id => {
      socket.emit('get_session', id, currentSess => {
        if (!currentSess) return alert('Ошибка: Не удалось найти сессию.');

        if (userRole === 'player') {
          if (currentSess.isGameStarted) {
            const existingTokenKey = Object.keys(currentSess.tokens || {}).find(
              k =>
                currentSess.tokens[k].accountId === currentUser.id &&
                currentSess.tokens[k].characterId === activeCharacter.id
            );

            const sessionUpdates = {};
            Object.keys(currentSess.tokens || {}).forEach(k => {
              if (
                currentSess.tokens[k].accountId === currentUser.id &&
                currentSess.tokens[k].characterId !== activeCharacter.id
              ) {
                sessionUpdates[`tokens.${k}`] = DELETE_FIELD;
              }
            });

            let finalTokenId = null;

            if (existingTokenKey) {
              finalTokenId = existingTokenKey;
              sessionUpdates[`tokens.${finalTokenId}`] = {
                ...currentSess.tokens[existingTokenKey],
                name: activeCharacter.name || activeCharacter.username,
                color: activeCharacter.stats?.tokenColor || '#3b82f6',
                frame: activeCharacter.stats?.tokenFrame || 'solid',
                image: activeCharacter.image || null,
                ac: activeCharacter.ac || 10,
                stats: activeCharacter.stats,
              };
            } else {
              const mw = currentSess.mapConfig?.width
                ? Number(currentSess.mapConfig.width)
                : 800;
              const mh = currentSess.mapConfig?.height
                ? Number(currentSess.mapConfig.height)
                : 600;
              const startX = Number.isNaN(mw) ? 400 : mw / 2;
              const startY = Number.isNaN(mh) ? 300 : mh / 2;
              const safeHp = Number(loginHp) || 10;

              const newToken = {
                id: generateId(),
                accountId: currentUser.id,
                characterId: activeCharacter.id,
                name: activeCharacter.name || activeCharacter.username,
                type: 'player',
                color: activeCharacter.stats?.tokenColor || '#3b82f6',
                frame: activeCharacter.stats?.tokenFrame || 'solid',
                x: startX,
                y: startY,
                size: 60,
                vision: 300,
                hp: safeHp,
                maxHp: safeHp,
                ac: activeCharacter.ac || 10,
                image: activeCharacter.image || null,
                stats:
                  activeCharacter.stats || {
                    str: 0,
                    dex: 0,
                    con: 0,
                    int: 0,
                    wis: 0,
                    cha: 0,
                  },
                deathSaves: { successes: 0, failures: 0 },
                statuses: [],
              };
              finalTokenId = newToken.id;
              sessionUpdates[`tokens.${finalTokenId}`] = newToken;
            }

            updateSession(sessionUpdates, id);
            setActiveSessionId(id);
            setMyTokenId(finalTokenId);
            setGmMode(false);
            setAuthStep('in_game');
          } else {
            const playerInfo = {
              id: generateId(),
              accountId: currentUser.id,
              characterId: activeCharacter.id,
              name: activeCharacter.name || activeCharacter.username,
              role: 'player',
              hp: Number(loginHp),
              ac: activeCharacter.ac || 10,
              tokenColor: activeCharacter.stats?.tokenColor || '#3b82f6',
              frame: activeCharacter.stats?.tokenFrame || 'solid',
              image: activeCharacter.image || null,
              stats: activeCharacter.stats,
            };
            const filtered = (currentSess.readyPlayers || []).filter(
              p => !(p.accountId === currentUser.id)
            );
            updateSession({ readyPlayers: [...filtered, playerInfo] }, id);
            setActiveSessionId(id);
            setGmMode(false);
            setAuthStep('lobby_wait');
          }
        } else {
          setActiveSessionId(id);
          setGmMode(userRole === 'gm');
          setAuthStep(
            currentSess.isGameStarted ? 'in_game' : 'lobby_wait'
          );
        }
      });
    },
    [
      userRole,
      currentUser,
      activeCharacter,
      loginHp,
      updateSession,
      setActiveSessionId,
      setMyTokenId,
      setGmMode,
      setAuthStep,
    ]
  );

  const startGameAsGM = useCallback(() => {
    const mapW = sessionData.mapConfig?.width
      ? Number(sessionData.mapConfig.width)
      : 800;
    const mapH = sessionData.mapConfig?.height
      ? Number(sessionData.mapConfig.height)
      : 600;
    const mw = Number.isNaN(mapW) ? 800 : mapW;
    const mh = Number.isNaN(mapH) ? 600 : mapH;

    const newTokensMap = { ...sessionData.tokens };

    (sessionData.readyPlayers || []).forEach((rp, i) => {
      if (rp.role === 'player') {
        const alreadyExists = Object.values(newTokensMap).some(
          t => t.accountId === rp.accountId && t.characterId === rp.characterId
        );
        if (!alreadyExists) {
          newTokensMap[rp.id] = {
            id: rp.id,
            accountId: rp.accountId,
            characterId: rp.characterId,
            name: rp.name,
            type: 'player',
            color: rp.tokenColor || '#3b82f6',
            frame: rp.frame || 'solid',
            x: mw / 2 + ((i % 5) * 80 - 160),
            y: mh / 2 + Math.floor(i / 5) * 80,
            size: 60,
            vision: 300,
            hp: rp.hp || 10,
            maxHp: rp.hp || 10,
            ac: rp.ac || 10,
            image: rp.image || null,
            stats:
              rp.stats || {
                str: 0,
                dex: 0,
                con: 0,
                int: 0,
                wis: 0,
                cha: 0,
              },
            deathSaves: { successes: 0, failures: 0 },
            statuses: [],
          };
        }
      }
    });

    updateSession({
      isGameStarted: true,
      tokens: newTokensMap,
      readyPlayers: [],
    });
    setAuthStep('in_game');
  }, [sessionData, updateSession, setAuthStep]);

  const stopGameAsGM = useCallback(() => {
    if (
      window.confirm(
        'Вы уверены? Это вернет всех в лобби и ОЧИСТИТ текущую карту с токенами.'
      )
    ) {
      updateSession({
        isGameStarted: false,
        tokens: {},
        walls: [],
        mapConfig: null,
        diceLog: [],
        readyPlayers: [],
        chatMessages: [],
        pings: [],
        combatState: { isActive: false, order: [], currentTurnIndex: 0 },
        lighting: 'day',
      });
      handleDropToLobby();
    }
  }, [updateSession, handleDropToLobby]);

  const isFogEnabled = sessionData.fogEnabled ?? true;

  const saveScene = useCallback(() => {
    const name = window.prompt(
      'Название сцены (введите имя существующей для её перезаписи):'
    );
    if (!name) return;

    const existing = allScenes.find(
      s =>
        s.sessionId === activeSessionId &&
        s.name.toLowerCase() === name.trim().toLowerCase()
    );
    const sceneId = existing ? existing.id : generateId();

    const newScene = {
      id: sceneId,
      sessionId: activeSessionId,
      name: existing ? existing.name : name.trim(),
      mapConfig: sessionData.mapConfig || null,
      tokens: sessionData.tokens || {},
      walls: sessionData.walls || [],
      fogEnabled: isFogEnabled,
      lighting: sessionData.lighting || 'day',
      createdAt: existing ? existing.createdAt : Date.now(),
    };

    socket.emit('save_scene', newScene);
    alert(existing ? 'Сцена обновлена!' : 'Новая сцена сохранена!');
  }, [allScenes, activeSessionId, sessionData, isFogEnabled]);

  const loadScene = useCallback(
    scene => {
      if (!window.confirm(`Загрузить сцену "${scene.name}"?`)) return;

      const activePlayerTokens = Object.values(
        sessionData.tokens || {}
      ).filter(t => t.accountId);
      const sceneTokens = Object.values(scene.tokens || {}).filter(
        t => !t.accountId
      );

      const mapW = scene.mapConfig?.width
        ? Number(scene.mapConfig.width)
        : 800;
      const mapH = scene.mapConfig?.height
        ? Number(scene.mapConfig.height)
        : 600;

      activePlayerTokens.forEach((p, i) => {
        p.x = mapW / 2 + ((i % 5) * 80 - 160);
        p.y = mapH / 2 + Math.floor(i / 5) * 80;
      });

      const newTokensMap = {};
      activePlayerTokens.forEach(p => {
        newTokensMap[p.id] = p;
      });
      sceneTokens.forEach(t => {
        newTokensMap[t.id] = t;
      });

      updateSession({
        mapConfig: scene.mapConfig || null,
        tokens: newTokensMap,
        walls: scene.walls || [],
        fogEnabled: scene.fogEnabled ?? true,
        lighting: scene.lighting || 'day',
        combatState: { isActive: false, order: [], currentTurnIndex: 0 },
        pings: [],
      });
      setScale(1);
      setPan({ x: 0, y: 0 });
    },
    [sessionData, updateSession, setScale, setPan]
  );

  const deleteScene = useCallback(sceneId => {
    if (window.confirm('Удалить сцену навсегда?')) {
      socket.emit('delete_scene', sceneId);
    }
  }, []);

  // handleImageUpload можно тоже сюда вынести по тому же паттерну
  // (чтобы не расписывать ещё 100 строк здесь, логику ты уже перенёс 1:1)

  return {
    handleLeaveSession,
    handleDropToLobby,
    leaveLobby,
    createSession,
    deleteSession,
    joinSession,
    startGameAsGM,
    stopGameAsGM,
    saveScene,
    loadScene,
    deleteScene,
    // handleImageUpload: ...
  };
}
