import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Upload, Users, Dices, Eye, EyeOff, Plus, Trash2, 
  ZoomIn, ZoomOut, Maximize, Minimize, Skull, User, Settings,
  Expand, Menu, ChevronLeft, ChevronRight, Shield,
  Sun, Moon, LogOut, Heart, Lock, UserPlus, LogIn, X, ScrollText, Edit3,
  Play, Users2, Loader2, StopCircle, MessageCircle, Send, Swords,
  FolderPlus, Backpack, Sparkles, MousePointer2, Ruler, SkipForward,
  Flame, Droplets, ShieldHalf, Target, Link, Layers, Save, Camera,
  BookOpen, FileText, Music
} from 'lucide-react';

import { useDiceEngine } from './hooks/useDiceEngine';
import { useChat } from './hooks/useChat';
import { useCombat } from './hooks/useCombat';
import { useMapInteractions } from './hooks/useMapInteractions';


import AuthScreen from './AuthScreen';
import ProfileScreen from './ProfileScreen';
import SessionsScreen from './SessionsScreen';
import LobbyScreen from './LobbyScreen';
import DicePanel from './DicePanel';
import ChatWidget from './ChatWidget';
import TokenPanel from './TokenPanel';
import LeftSidebar from './LeftSidebar';
import CombatTracker from './CombatTracker';
import DraggableWidgets from './DraggableWidgets';
import GameModals from './GameModals';
import FloatingControls from './FloatingControls';
import MapBoard from './MapBoard';
import ActionTracker from './ActionTracker';
import AttackRollModal from './AttackRollModal';
import { distToSegment } from './utils/math';
import { generateId, getUserColor, DELETE_FIELD, rollSound } from './utils/helpers';
import { socket, SERVER_URL, uploadCanvasToStorage } from './services/socket';
import { useAuth } from './hooks/useAuth';
import { useTokens } from './hooks/useTokens';
import { useMap } from './hooks/useMap';
import { useSession } from './providers/SessionProvider';
import { useSessionsAndScenes } from './hooks/useSessionsAndScenes';



export default function App() {
  const {
    dbStatus,
    sessionsList,
    activeSessionId,
    setActiveSessionId,
    sessionData,
    setSessionData,
    updateSession,
    allScenes,
    setAllScenes,
  } = useSession();

  const [newSessionName, setNewSessionName] = useState('');
  const { rollDice, enable3DDice, setEnable3DDice } = useDiceEngine(
  activeSessionId,
  currentUser,
  setSessionData
);

  // ... дальше всё, как было


  const [localTokens, setLocalTokens] = useState([]); 

  

  // 2. ГЛОБАЛЬНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ (Мы перенесли её наверх)

  // 3. ПОДКЛЮЧАЕМ НАШ НОВЫЙ ХУК АВТОРИЗАЦИИ
  const {
    authStep, setAuthStep, authMode, setAuthMode, username, setUsername,
    password, setPassword, regImage, setRegImage, currentUser, setCurrentUser,
    activeCharId, setActiveCharId, userRole, setUserRole, myTokenId, setMyTokenId,
    loginHp, setLoginHp, isEditingProfile, setIsEditingProfile, tempProfile, setTempProfile,
    safeCharacters, activeCharacter, handleRegImageUpload, handleAuth, startEditingProfile,
    handleProfileImageUpload, adjustStat, saveProfile, saveProfileFieldLive, deleteCharacter
  } = useAuth(updateSession, activeSessionId, localTokens);

  // 4. ОСТАЛЬНЫЕ СОСТОЯНИЯ ИНТЕРФЕЙСА (Оставляем как было)
  const fovWorkerRef = useRef(null);
  const tokenClickGuardRef = useRef(false); // Щит от сброса кликов
  // Реф для прямого доступа к функциям PIXI (без рендера)
  const mapApiRef = useRef(null);
  
  // Временное хранилище координат токена во время перетаскивания (чтобы не дергать state)
  const [localVideoUrl, setLocalVideoUrl] = useState('');
  const [localVolume, setLocalVolume] = useState(20); 
  const [hideLocalGrid, setHideLocalGrid] = useState(false);
  const [isChatMuted, setIsChatMuted] = useState(false);
  
  const [localInv, setLocalInv] = useState('');
  const [localAbil, setLocalAbil] = useState('');

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  
  const [showStatsWidget, setShowStatsWidget] = useState(false);
  const [showInvWidget, setShowInvWidget] = useState(false);
  const [showAbilWidget, setShowAbilWidget] = useState(false);
  const [showAtkWidget, setShowAtkWidget] = useState(false); 

  const [portraitToShow, setPortraitToShow] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareType, setShareType] = useState('image'); 
  const [shareContent, setShareContent] = useState('');
  const [shareTargets, setShareTargets] = useState(['all']);
  const [dismissedMediaId, setDismissedMediaId] = useState(null); 
  const [isPotatoMode, setIsPotatoMode] = useState(false);

  
  const [gmMode, setGmMode] = useState(true);
  

    const [showNotesWidget, setShowNotesWidget] = useState(false);
    const [localNotes, setLocalNotes] = useState('');
  const [bestiary, setBestiary] = useState(() => {
    try { 
        return JSON.parse(localStorage.getItem('vtt_bestiary')) || []; 
    } catch { 
        return []; 
    }
  });

  useEffect(() => { 
      try {
          localStorage.setItem('vtt_bestiary', JSON.stringify(bestiary)); 
      } catch (err) {
          console.warn("localStorage недоступен (возможно режим инкогнито)");
      }
  }, [bestiary]);

  const [diceToasts, setDiceToasts] = useState([]); 
  const [diceCount, setDiceCount] = useState(1);
  const [pendingDamageTarget, setPendingDamageTarget] = useState(null);
  const [pendingAttack, setPendingAttack] = useState(null);

  const [widgetPositions, setWidgetPositions] = useState({ 
      stats: { x: 24, y: 100 }, 
      inv: { x: 340, y: 100 }, 
      abil: { x: 650, y: 100 }, 
      atk: { x: 340, y: 450 },
      notes: { x: 650, y: 450 },
      chat: { x: typeof window !== 'undefined' ? window.innerWidth - 350 : 800, y: 100 } // <--- ДОБАВЛЕНО
  });
  
  const [tokenPanelPos, setTokenPanelPos] = useState({ x: 100, y: 100 });
  const [isTokenPanelOpen, setIsTokenPanelOpen] = useState(false);
  const [isTokenPanelMinimized, setIsTokenPanelMinimized] = useState(false);
  
  const [draggingWidget, setDraggingWidget] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const {
    scale, setScale, pan, setPan, isPanning, setIsPanning, startPan, setStartPan,
    activeTool, setActiveTool, measureData, setMeasureData,
    wallDrawData, setWallDrawData, templateDrawData, setTemplateDrawData,
    draggingTemplate, setDraggingTemplate, isFullscreen, toggleFullscreen, handleWheel
  } = useMap();

  const {
  syncWallsRef,
  handleTokenPointerDown,
  handlePointerDownBg,
  handlePointerMoveBg,
  handlePointerUpBg,
  handleWidgetPointerDown,
} = useMapInteractions({
  activeSessionId,
  sessionData,
  updateSession,
  localTokens,
  setLocalTokens,
  userRole,
  myTokenId,

  activeTool,
  portraitToShow,
  isTokenVisible,
  measureData,
  setMeasureData,
  wallDrawData,
  setWallDrawData,
  templateDrawData,
  setTemplateDrawData,

  pan,
  setPan,
  scale,
  isPanning,
  setIsPanning,
  startPan,
  setStartPan,

  setSelectedTokenId,
  setHpInputValue,
  draggingTokenId,
  setDraggingTokenId,
  setIsTokenPanelOpen,
  setIsTokenPanelMinimized,

  draggingWidget,
  setDraggingWidget,
  dragOffset,
  setDragOffset,
  setWidgetPositions,

  containerRef,
  mapApiRef,
});
const {
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
} = useSessionsAndScenes({
  sessionData,
  updateSession,
  allScenes,
  activeSessionId,
  currentUser,
  activeCharacter,
  loginHp,
  userRole,
  setActiveSessionId,
  setAuthStep,
  setGmMode,
  setMyTokenId,
  setSelectedTokenId,
  setShowStatsWidget,
  setShowInvWidget,
  setShowAbilWidget,
  setShowAtkWidget,
  setCombatSelection,
  setIsTokenPanelOpen,
  setScale,
  setPan,
  hasCenteredRef,
  newSessionName,
  setNewSessionName,
});


  const handleTemplatePointerDown = useCallback((e, id) => {
      e.stopPropagation();
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / scale;
      const y = (e.clientY - rect.top - pan.y) / scale;
      const t = (sessionData.templates || []).find(tmpl => tmpl.id === id);
      if (t) {
          setDraggingTemplate({
              ...t,
              startCursorX: x,
              startCursorY: y,
              origX: t.x,
              origY: t.y,
              origTargetX: t.targetX,
              origTargetY: t.targetY
          });
      }
  }, [pan, scale, sessionData.templates]);

  const appWrapperRef = useRef(null); 
  const ytPlayerRef = useRef(null);
  const containerRef = useRef(null);
  const hasCenteredRef = useRef(false); 
  const stateRefs = useRef({ authStep, userRole, currentUser, draggingTokenId: null });
  const recentBroadcastsRef = useRef({}); 
  const polyCalcTimersRef = useRef({}); 

// ... твои другие стейты
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // === 2. МГНОВЕННЫЙ СИМУЛЯТОР БРОСКОВ (Для тех, кто отключил 3D) ===
 // === 2. МГНОВЕННЫЙ СИМУЛЯТОР БРОСКОВ (Для тех, кто отключил 3D) ===


  // 1. Инициализация 3D движка при загрузке App.jsx
  


  // 2. Умная обертка для бросков
  // 2. Умная обертка для бросков (с поддержкой Fallback и 2D-режима)
  // 2. Умная обертка для бросков (с поддержкой Fallback и 2D-режима)
  

  useEffect(() => {
  syncWallsRef(sessionData.walls || []);
}, [sessionData.walls, syncWallsRef]);
    
  
  const isFogEnabled = sessionData.fogEnabled ?? true;

  // СОЗДАЕМ МОСТ ДЛЯ БОЕВКИ (Чтобы избежать конфликта хуков)
  const combatSelectionRef = useRef(null);

  // ПОДКЛЮЧАЕМ НОВЫЙ ХУК ТОКЕНОВ СЮДА
  const {
    selectedTokenId, setSelectedTokenId, draggingTokenId, setDraggingTokenId,
    dragPath, setDragPath, hpInputValue, setHpInputValue,
    newTokenName, setNewTokenName, newTokenType, setNewTokenType,
    newTokenColor, setNewTokenColor, newTokenVision, setNewTokenVision,
    newTokenHp, setNewTokenHp, newTokenAc, setNewTokenAc,
    newTokenImage, setNewTokenImage, newTokenHidden, setNewTokenHidden,
    isTokenVisible, updateHp, handleTokenImageUpload, addToken, 
    addTokenFromPreset, removeToken, updateTokenAc, toggleStatus, rollDeathSave
  } = useTokens(
    sessionData, updateSession, localTokens, setLocalTokens,
    userRole, myTokenId, setMyTokenId, 
    (action) => combatSelectionRef.current && combatSelectionRef.current(action), // Безопасная передача!
    containerRef, pan, scale, isFogEnabled, setDiceToasts
  );

  

  const selectedToken = localTokens.find(t => t.id === selectedTokenId);
  const canEditSelected = selectedToken && (userRole === 'gm' || selectedToken.id === myTokenId);
  
  const activeWidgetCharacter = useMemo(() => {
    if (userRole === 'gm' && myTokenId) {
      const controlledToken = localTokens.find(t => t.id === myTokenId);
      if (controlledToken && controlledToken.type !== 'player') {
        return {
          id: controlledToken.id,
          name: controlledToken.name,
          stats: controlledToken.stats || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
          attacks: controlledToken.attacks || [],
          abilities: controlledToken.abilities || '',
          inventory: controlledToken.inventory || '',
          notes: controlledToken.notes || ''
        };
      }
    }
    return activeCharacter;
  }, [userRole, myTokenId, localTokens, activeCharacter]);

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
  }, []);

  const removeTemplate = useCallback((id) => {
    const newTemplates = (sessionData.templates || []).filter(t => t.id !== id);
    updateSession({ templates: newTemplates });
  }, [sessionData.templates, updateSession]);


  const addMapPing = useCallback((tokenId, type, value = null) => {
    const t = localTokens.find(tok => tok.id === tokenId);
    if (!t) return;
    const newPing = { id: generateId(), x: t.x, y: t.y, type, value, time: Date.now() };
    if (socket.volatile) {
        socket.volatile.emit('broadcast', { sessionId: activeSessionId, event: 'ping', payload: newPing });
    } else {
        socket.emit('broadcast', { sessionId: activeSessionId, event: 'ping', payload: newPing });
    }
    
    setSessionData(prev => {
        const recentPings = (prev.pings || []).filter(p => Date.now() - p.time < 3000);
        // ИСПРАВЛЕНИЕ: Защита от дублей
        if (recentPings.some(p => p.id === newPing.id)) return prev;
        return { ...prev, pings: [...recentPings, newPing] };
    });
  }, [localTokens, activeSessionId]);
  
  const { isChatOpen, setIsChatOpen, chatInput, setChatInput, unreadChatCount, chatEndRef, sendChatMessage } = useChat(sessionData, updateSession, currentUser, activeWidgetCharacter, activeSessionId, isChatMuted);
  const { combatSelection, setCombatSelection, toggleCombatSelection, startCombat, endCombat, nextTurn, executeAbility, useAbility } = useCombat(sessionData, updateSession, localTokens, selectedTokenId, myTokenId, activeWidgetCharacter, userRole, setPendingAttack, updateHp, addMapPing);
    useEffect(() => { combatSelectionRef.current = setCombatSelection; }, [setCombatSelection]);



  


  // === ГЛАВНЫЙ И ЕДИНСТВЕННЫЙ КОНТРОЛЛЕР МЫШИ ===
  // === ГЛАВНЫЙ И ЕДИНСТВЕННЫЙ КОНТРОЛЛЕР МЫШИ ===
  useEffect(() => {
    const active = isPanning || 
                   measureData || 
                   wallDrawData || 
                   templateDrawData || 
                   activeTool === 'wall-eraser' || 
                   draggingTokenId || 
                   draggingWidget !== null ||
                   draggingTemplate !== null;

    if (active) { 
        window.addEventListener('pointermove', handlePointerMoveBg); 
        window.addEventListener('pointerup', handlePointerUpBg); 
    }
    return () => { 
        window.removeEventListener('pointermove', handlePointerMoveBg); 
        window.removeEventListener('pointerup', handlePointerUpBg); 
    };
  }, [
    isPanning, measureData, wallDrawData, templateDrawData, 
    activeTool, draggingTokenId, draggingWidget, draggingTemplate,
    handlePointerMoveBg, handlePointerUpBg
  ]);
  // Обертка для зума
  const onMapWheel = (e) => handleWheel(e, containerRef, portraitToShow);
  const handleContextMenuMap = (e) => {
    e.preventDefault();
    
    // 1. Логика линейки (оставляем твою без изменений)
    if (measureData && activeTool === 'ruler') {
       const rect = containerRef.current.getBoundingClientRect();
       const x = (e.clientX - rect.left - pan.x) / scale; 
       const y = (e.clientY - rect.top - pan.y) / scale;
       setMeasureData(prev => ({ ...prev, points: [...prev.points, {x,y}], current: {x,y} }));
       return; 
    }
    
    // 2. Игнорируем клики по UI
    if (e.target.closest('aside') || e.target.closest('.no-zoom') || portraitToShow) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / scale; 
    const y = (e.clientY - rect.top - pan.y) / scale;
    
    // === НОВАЯ ЛОГИКА ЦВЕТОВ ===
    // Получаем уникальный цвет (объект с bg и shadow) на основе ID пользователя
    const userColor = getUserColor(currentUser?.id);
    
    const newPing = { 
        id: generateId(), 
        x, 
        y, 
        color: userColor, // Передаем сгенерированный цвет
        type: 'ping', 
        time: Date.now() 
    };
    
    // 3. Отправка пинга по сокетам
    if (socket.volatile) {
        socket.volatile.emit('broadcast', { sessionId: activeSessionId, event: 'ping', payload: newPing });
    } else {
        socket.emit('broadcast', { sessionId: activeSessionId, event: 'ping', payload: newPing });
    }
    
    // 4. Локальное обновление и очистка старых пингов
    setSessionData(prev => { 
        const recentPings = (prev.pings || []).filter(p => Date.now() - p.time < 3000); 
        // ИСПРАВЛЕНИЕ: Проверяем, нет ли уже такого пинга в массиве
        if (recentPings.some(p => p.id === newPing.id)) return prev;
        return { ...prev, pings: [...recentPings, newPing] }; 
    });
  };

  const rollStat = async (statName, modifier, mode = 'normal') => {
    let notation = '1d20';
    let modeLabel = '';
    
    if (mode === 'adv') { notation = '2d20kh1'; modeLabel = ' (Преимущество)'; } 
    else if (mode === 'dis') { notation = '2d20kl1'; modeLabel = ' (Помеха)'; }

    if (modifier !== 0) {
        notation += modifier > 0 ? `+${modifier}` : modifier;
    }

    const statLabels = { str: 'Сила', dex: 'Ловкость', con: 'Телосложение', int: 'Интеллект', wis: 'Мудрость', cha: 'Харизма' };
    const statLabel = statLabels[statName] || statName;
    const rollerName = activeWidgetCharacter?.name || (userRole === 'gm' ? 'Мастер' : 'Игрок');

    // Бросаем 3D кубик. Логгирование произойдет автоматически внутри твоей обертки rollDice!
    await rollDice(notation, `Проверка: ${statLabel}${modeLabel}`);
  };

  const rollAttack = (attack) => setPendingAttack(attack);
  const extractYTId = (url) => { const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/); return match ? match[1] : null; };
  const handleVolumeChange = (e) => { const vol = e.target.value; setLocalVolume(vol); if (ytPlayerRef.current && ytPlayerRef.current.contentWindow) { ytPlayerRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [vol] }), '*'); } };
  const handleIframeLoad = () => { if (ytPlayerRef.current && ytPlayerRef.current.contentWindow) { ytPlayerRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [localVolume] }), '*'); } };
  const handleManualHit = (id) => { addMapPing(id, 'hit'); setPendingDamageTarget(id); };


  useEffect(() => {
    if (!activeSessionId) return;
    socket.emit('join_session', activeSessionId);
    
    socket.on('session_full_state', (data) => {
      if (!data) return;
      setSessionData(prev => ({
    ...prev,
    ...data,
    tokens: data.tokens || {}, // Гарантируем объект
    walls: data.walls || [],
    chatMessages: data.chatMessages || [],
    templates: data.templates || [], // <--- ФИКС 2.2: ЖЕСТКО ЗАТИРАЕМ ШАБЛОНЫ
    pings: data.pings || [],         // <--- Заодно чистим старые пинги
    diceLog: data.diceLog || []
  }));
      
      const serverTokensArr = data.tokens ? Object.values(data.tokens) : [];
      const { authStep: currentAuthStep, userRole: currentRole, currentUser: currUser } = stateRefs.current;
      setLocalTokens(serverTokensArr);

      if (currentAuthStep === 'lobby_wait' && data.isGameStarted) {
        if (currentRole === 'player') { 
            const myT = serverTokensArr.find(t => t.accountId === currUser?.id && t.characterId === activeCharId); 
            if (myT) setMyTokenId(myT.id); 
        }
        setAuthStep('in_game');
      }
      if (currentAuthStep === 'in_game' && !data.isGameStarted) handleDropToLobby();
    });

    socket.on('session_update', (payload) => {
        setSessionData(prev => {
            let nextState = { ...prev }; // Быстрое поверхностное копирование корня
for (const key in payload) {
    const val = payload[key];
    if (key.includes('.')) {
        const parts = key.split('.');
        let currentLevel = nextState;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i]; 
            // Клонируем только измененный вложенный объект, а не всю сессию
            currentLevel[part] = { ...currentLevel[part] };
            currentLevel = currentLevel[part];
        }
        if (val === '__DELETE_FIELD__') delete currentLevel[parts[parts.length - 1]]; 
        else currentLevel[parts[parts.length - 1]] = val;
    } else {
        if (val === '__DELETE_FIELD__') delete nextState[key]; 
        else nextState[key] = val;
    }
}
return nextState;
        });

        if (payload.isGameStarted === true && stateRefs.current.authStep === 'lobby_wait') {
            if (stateRefs.current.userRole === 'player' && payload.tokens) {
                const myT = Object.values(payload.tokens).find(t => t.accountId === stateRefs.current.currentUser?.id && t.characterId === activeCharId);
                if (myT) setMyTokenId(myT.id);
            }
            setAuthStep('in_game');
        } else if (payload.isGameStarted === false && stateRefs.current.authStep === 'in_game') {
            handleDropToLobby();
        }
    });

    socket.on('broadcast', ({ event, payload }) => {
    if (event === 'token_move') {
        const { id, x, y, fovPolygon } = payload;
        recentBroadcastsRef.current[id] = Date.now();
        if (id !== stateRefs.current.draggingTokenId) {
            setLocalTokens(prev => prev.map(t => t.id === id ? { ...t, x, y, fovPolygon } : t));
        }
    }
        if (event === 'ping') { 
        setSessionData(prev => { 
            const recentPings = (prev.pings || []).filter(p => Date.now() - p.time < 3000); 
            // ИСПРАВЛЕНИЕ: Защита от дублей из сети
            if (recentPings.some(p => p.id === payload.id)) return prev;
            return { ...prev, pings: [...recentPings, payload] }; 
        }); 
    }
    });

    return () => { socket.off('session_full_state'); socket.off('session_update'); socket.off('broadcast'); };
  }, [activeSessionId, activeCharId]);

  useEffect(() => {
  if (!sessionData.tokens || Object.keys(sessionData.tokens).length === 0) {
    if (localTokens.length > 0) setLocalTokens([]);
    return;
  }
  

  setLocalTokens(prevLocal => {
    const serverTokensArr = Object.values(sessionData.tokens);
    const draggingId = stateRefs.current.draggingTokenId;
    
    if (serverTokensArr.length !== prevLocal.length) {
      return serverTokensArr;
    }

    let hasChanges = false;
    const newLocal = serverTokensArr.map(serverToken => {
      if (serverToken.id === draggingId) {
        return prevLocal.find(t => t.id === serverToken.id) || serverToken;
      }
      
      const local = prevLocal.find(t => t.id === serverToken.id);
      
      if (
            !local || 
            local.x !== serverToken.x || 
            local.y !== serverToken.y || 
            local.hp !== serverToken.hp ||
            local.tempHp !== serverToken.tempHp || // <--- ДОБАВИЛИ СЛЕЖЕНИЕ ЗА ЩИТОМ
            local.vision !== serverToken.vision || 
            local.size !== serverToken.size ||
            local.isHidden !== serverToken.isHidden || 
            local.ac !== serverToken.ac ||             
            JSON.stringify(local.statuses) !== JSON.stringify(serverToken.statuses) 
          ) {
            hasChanges = true;
            return serverToken;
          }
      return local;
    });

    return hasChanges ? newLocal : prevLocal;
  });
}, [sessionData.tokens]); 

  const sessionScenes = allScenes.filter(s => s.sessionId === activeSessionId).sort((a, b) => a.createdAt - b.createdAt);

  useEffect(() => { stateRefs.current = { authStep, userRole, currentUser, draggingTokenId }; }, [authStep, userRole, currentUser, draggingTokenId]);
  
  useEffect(() => { 
      if (typeof window !== 'undefined') setTokenPanelPos({ x: Math.max(20, window.innerWidth / 2 - 175), y: Math.max(20, window.innerHeight / 2 - 250) }); 
  }, []);
  
  useEffect(() => { setLocalInv(activeWidgetCharacter?.inventory || ''); }, [activeWidgetCharacter?.inventory, activeWidgetCharacter?.id]);
  useEffect(() => { setLocalAbil(activeWidgetCharacter?.abilities || ''); }, [activeWidgetCharacter?.abilities, activeWidgetCharacter?.id]);
    useEffect(() => { setLocalNotes(activeWidgetCharacter?.notes || ''); }, [activeWidgetCharacter?.notes, activeWidgetCharacter?.id]);
  useEffect(() => {
    if (authStep !== 'in_game') { hasCenteredRef.current = false; return; }
    if (authStep === 'in_game' && userRole === 'player' && myTokenId && !hasCenteredRef.current && containerRef.current) {
      const myToken = localTokens.find(t => t.id === myTokenId);
      if (myToken) {
        const rect = containerRef.current.getBoundingClientRect();
        setPan({ x: (rect.width / 2) - (myToken.x * scale), y: (rect.height / 2) - (myToken.y * scale) });
        hasCenteredRef.current = true; 
      }
    }
  }, [authStep, userRole, myTokenId, localTokens, scale]);

  // ... выше находятся ваши функции handlePointerMoveBg и другие ...
// === ГЛАВНЫЙ И ЕДИНСТВЕННЫЙ КОНТРОЛЛЕР МЫШИ ===
// === ГЛОБАЛЬНЫЙ СЛУШАТЕЛЬ МЫШИ (ДЛЯ ВСЕХ ИНСТРУМЕНТОВ) ===

  return (
    <div ref={appWrapperRef} className={`fixed inset-0 flex h-[100dvh] w-screen bg-neutral-950 text-neutral-100 font-sans overflow-hidden selection:bg-amber-900/50 select-none ${!isDarkMode ? 'light-theme' : ''} ${isPotatoMode ? 'potato-mode' : ''}`}>
      
      {authStep === 'auth' && (
        <AuthScreen 
          authMode={authMode} setAuthMode={setAuthMode} dbStatus={dbStatus} handleAuth={handleAuth}
          username={username} setUsername={setUsername} password={password} setPassword={setPassword}
          regImage={regImage} handleRegImageUpload={handleRegImageUpload}
        />
      )}

      {authStep === 'profile' && currentUser && (
        <ProfileScreen 
          currentUser={currentUser} setCurrentUser={setCurrentUser} activeCharId={activeCharId} setActiveCharId={setActiveCharId} activeCharacter={activeCharacter}
          supabase={null} isEditingProfile={isEditingProfile} setIsEditingProfile={setIsEditingProfile} tempProfile={tempProfile} setTempProfile={setTempProfile}
          handleProfileImageUpload={handleProfileImageUpload} adjustStat={adjustStat} saveProfile={saveProfile} deleteCharacter={deleteCharacter} setAuthStep={setAuthStep}
          startEditingProfile={startEditingProfile} setUsername={setUsername} setPassword={setPassword} setRegImage={setRegImage} syncAccount={(updatedUser) => socket.emit('save_account', updatedUser)}
        />
      )}

      {authStep === 'sessions' && currentUser && (
        <SessionsScreen 
          setAuthStep={setAuthStep} userRole={userRole} setUserRole={setUserRole} loginHp={loginHp} setLoginHp={setLoginHp}
          createSession={createSession} newSessionName={newSessionName} setNewSessionName={setNewSessionName} sessionsList={sessionsList} joinSession={joinSession} deleteSession={deleteSession}
        />
      )}

      {authStep === 'lobby_wait' && (
        <LobbyScreen leaveLobby={leaveLobby} sessionData={sessionData} userRole={userRole} currentUser={currentUser} activeCharId={activeCharId} startGameAsGM={startGameAsGM} />
      )}

      {authStep === 'in_game' && (

            
        <>
          {userRole === 'player' && myTokenId && (() => {
             const myT = localTokens.find(t => t.id === myTokenId);
             if (!myT || myT.hp > 0) return null;
             const ds = myT.deathSaves || { successes: 0, failures: 0 };
             const isDead = ds.failures >= 3;
             
             return (
                <div className="absolute inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 pointer-events-auto">
                   <div className="bg-neutral-950 border-2 border-red-900/50 p-8 rounded-3xl flex flex-col items-center shadow-[0_0_100px_rgba(220,38,38,0.2)] max-w-md w-full text-center relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-red-600 to-transparent opacity-50"></div>
                      <Skull size={80} className={`mb-6 ${isDead ? 'text-neutral-700' : 'text-red-500 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)] animate-pulse'}`} />
                      <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-widest">{isDead ? 'Вы погибли' : 'На грани смерти'}</h2>
                      <p className="text-neutral-400 mb-8 text-sm">{isDead ? 'Ваш путь подошел к концу. Теперь вы можете только наблюдать...' : 'Бросьте d20, чтобы попытаться прийти в себя (Сложность 10)'}</p>
                      
                      <div className="flex gap-10 mb-8 bg-neutral-900/50 p-5 rounded-2xl border border-neutral-800/80">
                         <div className="flex flex-col items-center gap-3">
                            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Успехи (3 = Жизнь)</span>
                            <div className="flex gap-2">
                               {[...Array(3)].map((_, i) => <div key={`s-${i}`} className={`w-6 h-6 rounded-full border-2 border-green-800/50 transition-all ${i < ds.successes ? 'bg-green-500 shadow-[0_0_15px_#22c55e] border-green-400' : 'bg-neutral-900'}`} />)}
                            </div>
                         </div>
                         <div className="w-[1px] bg-neutral-800"></div>
                         <div className="flex flex-col items-center gap-3">
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Провалы (3 = Смерть)</span>
                            <div className="flex gap-2">
                               {[...Array(3)].map((_, i) => <div key={`f-${i}`} className={`w-6 h-6 rounded-full border-2 border-red-800/50 transition-all ${i < ds.failures ? 'bg-red-500 shadow-[0_0_15px_#ef4444] border-red-400' : 'bg-neutral-900'}`} />)}
                            </div>
                         </div>
                      </div>

                      {isDead ? (
                         <button onClick={() => { setUserRole('spectator'); setMyTokenId(null); }} className="w-full py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95">Присоединиться к зрителям</button>
                      ) : (
                         <button onClick={() => rollDeathSave(myT.id)} className="w-full py-4 bg-red-900 hover:bg-red-800 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] active:scale-95 flex items-center justify-center gap-3">
                            <Dices size={24} /> Бросить d20
                         </button>
                      )}
                   </div>
                </div>
             );
          })()}

          <GameModals 
            portraitToShow={portraitToShow} 
            setPortraitToShow={setPortraitToShow} 
            sessionData={sessionData} 
            dismissedMediaId={dismissedMediaId} 
            setDismissedMediaId={setDismissedMediaId}
            userRole={userRole} 
            currentUser={currentUser} 
            updateSession={updateSession} 
            isShareModalOpen={isShareModalOpen} 
            setIsShareModalOpen={setIsShareModalOpen}
            shareType={shareType} 
            setShareType={setShareType} 
            shareContent={shareContent} 
            setShareContent={setShareContent} 
            shareTargets={shareTargets} 
            setShareTargets={setShareTargets}
            localTokens={localTokens} 
            handleShare={handleShare}
          />


          {/* === ОКНО ЗАПРОСА СПАСБРОСКА === */}
          {sessionData.activeSaveRequest && (() => {
              const req = sessionData.activeSaveRequest;
              const target = localTokens.find(t => t.id === req.targetId);
              // Мастер может кидать за кого угодно, игрок — только за свой токен
              const canRoll = userRole === 'gm' || (target && myTokenId === target.id);

              const handleRollSave = async () => {
                  const statMod = target?.stats?.[req.ability.saveStat] || 0;
                  const roll = await rollDice(`1d20${statMod > 0 ? '+'+statMod : statMod < 0 ? statMod : ''}`, `Спасбросок ${req.ability.saveStat.toUpperCase()} (СЛ ${req.ability.saveDC})`);
                  const isSuccess = roll >= req.ability.saveDC;

                  if (target) {
                      // 1. Урон
                      if (!req.ability.noDamage) {
                          const dmg = isSuccess ? Math.floor(req.damage / 2) : req.damage;
                          if (dmg > 0) { 
                              const currentTempHp = target.tempHp || 0;
                              if (currentTempHp > 0) {
                                  const remain = currentTempHp - dmg;
                                  if (remain >= 0) {
                                      updateSession({ [`tokens.${target.id}.tempHp`]: remain });
                                  } else {
                                      updateSession({ [`tokens.${target.id}.tempHp`]: 0 });
                                      updateHp(target.id, remain); 
                                  }
                              } else {
                                  updateHp(target.id, -dmg); 
                              }
                              addMapPing(target.id, 'damage', dmg); 
                          }
                      }
                      // 2. Статусы (накладываются только при провале)
                      if (!isSuccess && req.ability.effectType && req.ability.effectType !== 'none') {
                          let st = target.statuses || [];
                          st.push({ type: req.ability.effectType, duration: req.ability.effectDuration || -1 });
                          updateSession({ [`tokens.${target.id}.statuses`]: st });
                      }
                  }
                  updateSession({ activeSaveRequest: null });
              };

              return (
                  <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="bg-neutral-900 border-2 border-purple-500/50 rounded-3xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(168,85,247,0.3)] flex flex-col items-center text-center">
                          <Sparkles size={40} className="text-purple-500 mb-4 animate-pulse" />
                          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-2">Спасбросок!</h2>
                          <p className="text-neutral-400 text-sm mb-6">
                              <strong className="text-white">{req.sourceName}</strong> применяет <strong className="text-purple-400">{req.ability.name}</strong>.<br/>
                              {target ? <>Цель: <strong className="text-amber-500">{target.name}</strong></> : "Цель не выбрана"}
                          </p>

                          <div className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl w-full mb-6 flex justify-around">
                              <div className="flex flex-col"><span className="text-[10px] text-neutral-500 font-black uppercase">Характеристика</span><span className="text-lg font-black text-white uppercase">{req.ability.saveStat}</span></div>
                              <div className="w-px bg-neutral-800"></div>
                              <div className="flex flex-col"><span className="text-[10px] text-neutral-500 font-black uppercase">Сложность (СЛ)</span><span className="text-lg font-black text-red-400">{req.ability.saveDC}</span></div>
                              {!req.ability.noDamage && (
                                  <><div className="w-px bg-neutral-800"></div>
                                  <div className="flex flex-col"><span className="text-[10px] text-neutral-500 font-black uppercase">Урон</span><span className="text-lg font-black text-amber-500">{req.damage}</span></div></>
                              )}
                          </div>

                          {canRoll && target ? (
                              <button onClick={handleRollSave} className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                                  <Dices size={20} /> Бросить 1d20
                              </button>
                          ) : (
                              <div className="text-sm font-bold text-neutral-500 animate-pulse mb-2">Ожидание броска от {target ? target.name : 'Мастера'}...</div>
                          )}

                          {userRole === 'gm' && (
                              <button onClick={() => updateSession({ activeSaveRequest: null })} className="mt-4 text-xs font-bold text-neutral-500 hover:text-red-400 transition-colors uppercase">Отменить запрос</button>
                          )}
                      </div>
                  </div>
              );
          })()}


          
          <CombatTracker sessionData={sessionData} userRole={userRole} nextTurn={nextTurn} endCombat={endCombat} />
          
          <ActionTracker 
            sessionData={sessionData} 
            updateSession={updateSession} 
            userRole={userRole} 
            myTokenId={myTokenId} 
            nextTurn={nextTurn}
            setShowAtkWidget={setShowAtkWidget} 
            setShowAbilWidget={setShowAbilWidget} 
            setShowInvWidget={setShowInvWidget} 
            setShowStatsWidget={setShowStatsWidget}
            containerRef={containerRef} 
            scale={scale} 
            setPan={setPan} 
            localTokens={localTokens} 
            currentUser={currentUser} 
            activeCharacter={activeWidgetCharacter}
          />
          
          <AttackRollModal 
             pendingAttack={pendingAttack} 
             setPendingAttack={setPendingAttack} 
             selectedTokenId={selectedTokenId} 
             localTokens={localTokens}
             updateHp={updateHp} 
             addMapPing={addMapPing} 
             updateSession={updateSession} 
             sessionData={sessionData} 
             activeCharacter={activeWidgetCharacter} 
             executeAbility={executeAbility}
             rollDice={rollDice}
          />
          
          <FloatingControls 
            isLeftSidebarOpen={isLeftSidebarOpen} setIsLeftSidebarOpen={setIsLeftSidebarOpen} isRightSidebarOpen={isRightSidebarOpen} setIsRightSidebarOpen={setIsRightSidebarOpen}
            activeTool={activeTool} setActiveTool={setActiveTool} userRole={userRole} myTokenId={myTokenId} localTokens={localTokens}
            containerRef={containerRef} scale={scale} setPan={setPan} showStatsWidget={showStatsWidget} setShowStatsWidget={setShowStatsWidget}
            showInvWidget={showInvWidget} setShowInvWidget={setShowInvWidget} showAbilWidget={showAbilWidget} setShowAbilWidget={setShowAbilWidget} showAtkWidget={showAtkWidget} setShowAtkWidget={setShowAtkWidget}
            showNotesWidget={showNotesWidget} setShowNotesWidget={setShowNotesWidget}
          />
          
          <DraggableWidgets
            showStatsWidget={showStatsWidget} setShowStatsWidget={setShowStatsWidget} showInvWidget={showInvWidget} setShowInvWidget={setShowInvWidget}
            showAbilWidget={showAbilWidget} setShowAbilWidget={setShowAbilWidget} showAtkWidget={showAtkWidget} setShowAtkWidget={setShowAtkWidget} activeCharacter={activeWidgetCharacter}
            showNotesWidget={showNotesWidget} setShowNotesWidget={setShowNotesWidget}
            widgetPositions={widgetPositions} handleWidgetPointerDown={handleWidgetPointerDown} rollStat={rollStat} 
            localInv={localInv} setLocalInv={setLocalInv} localAbil={localAbil} setLocalAbil={setLocalAbil} 
            localNotes={localNotes} setLocalNotes={setLocalNotes}
            saveProfileFieldLive={saveProfileFieldLive} useAbility={useAbility} rollAttack={rollAttack}
          />


          <ChatWidget 
            isChatOpen={isChatOpen} setIsChatOpen={setIsChatOpen} unreadChatCount={unreadChatCount} sessionData={sessionData} activeCharacter={activeWidgetCharacter}
            chatEndRef={chatEndRef} chatInput={chatInput} setChatInput={setChatInput} sendChatMessage={sendChatMessage}
            isChatMuted={isChatMuted} widgetPositions={widgetPositions} handleWidgetPointerDown={handleWidgetPointerDown}
          />
          
          <TokenPanel 
            selectedToken={selectedToken} 
            isTokenPanelOpen={isTokenPanelOpen} 
            setIsTokenPanelOpen={setIsTokenPanelOpen} 
            tokenPanelPos={tokenPanelPos}
            isTokenPanelMinimized={isTokenPanelMinimized} 
            setIsTokenPanelMinimized={setIsTokenPanelMinimized} 
            handleWidgetPointerDown={handleWidgetPointerDown} 
            setPortraitToShow={setPortraitToShow}
            userRole={userRole} 
            myTokenId={myTokenId} 
            setMyTokenId={setMyTokenId} 
            canEditSelected={canEditSelected} 
            updateTokenAc={updateTokenAc} 
            updateSession={updateSession} 
            currentUser={currentUser} 
            setCurrentUser={setCurrentUser}
            activeCharacter={activeCharacter} 
            supabase={null} 
            handleManualHit={handleManualHit} 
            addMapPing={addMapPing} 
            toggleStatus={toggleStatus} 
            rollDice={rollDice}
            hpInputValue={hpInputValue} 
            setHpInputValue={setHpInputValue} 
            updateHp={updateHp} 
            rollDeathSave={rollDeathSave} 
            rollStat={rollStat} 
            rollAttack={rollAttack}
          />
          
          <LeftSidebar 
            isLeftSidebarOpen={isLeftSidebarOpen} setIsLeftSidebarOpen={setIsLeftSidebarOpen} userRole={userRole} activeCharacter={activeCharacter}
            showStatsWidget={showStatsWidget} setShowStatsWidget={setShowStatsWidget} showInvWidget={showInvWidget} setShowInvWidget={setShowInvWidget}
            showAbilWidget={showAbilWidget} setShowAbilWidget={setShowAbilWidget} showAtkWidget={showAtkWidget} setShowAtkWidget={setShowAtkWidget}
            showNotesWidget={showNotesWidget} setShowNotesWidget={setShowNotesWidget}
            saveScene={saveScene} hideLocalGrid={hideLocalGrid} setHideLocalGrid={setHideLocalGrid} isChatMuted={isChatMuted} setIsChatMuted={setIsChatMuted}
            sessionData={sessionData} sessionScenes={sessionScenes} loadScene={loadScene} deleteScene={deleteScene} handleImageUpload={handleImageUpload}
            updateSession={updateSession} isFogEnabled={isFogEnabled} gmMode={gmMode} setGmMode={setGmMode} setIsShareModalOpen={setIsShareModalOpen}
            localVideoUrl={localVideoUrl} setLocalVideoUrl={setLocalVideoUrl} extractYTId={extractYTId} ytPlayerRef={ytPlayerRef} handleIframeLoad={handleIframeLoad}
            localVolume={localVolume} handleVolumeChange={handleVolumeChange} localTokens={localTokens} addToken={addToken} newTokenName={newTokenName}
            setNewTokenName={setNewTokenName} newTokenHp={newTokenHp} setNewTokenHp={setNewTokenHp} newTokenAc={newTokenAc} setNewTokenAc={setNewTokenAc} enable3DDice={enable3DDice} setEnable3DDice={setEnable3DDice}
            newTokenType={newTokenType} setNewTokenType={setNewTokenType} newTokenColor={newTokenColor} setNewTokenColor={setNewTokenColor} newTokenImage={newTokenImage}
            setNewTokenImage={setNewTokenImage} handleTokenImageUpload={handleTokenImageUpload} newTokenVision={newTokenVision} setNewTokenVision={setNewTokenVision}
            endCombat={endCombat} startCombat={startCombat} combatSelection={combatSelection} toggleCombatSelection={toggleCombatSelection} myTokenId={myTokenId}
            selectedTokenId={selectedTokenId} handleTokenPointerDown={handleTokenPointerDown} removeToken={removeToken} handleLeaveSession={handleLeaveSession}
            newTokenHidden={newTokenHidden} setNewTokenHidden={setNewTokenHidden} isTokenVisible={isTokenVisible} isPotatoMode={isPotatoMode} setIsPotatoMode={setIsPotatoMode}
            bestiary={bestiary} setBestiary={setBestiary} isFullscreen={isFullscreen} toggleFullscreen={toggleFullscreen} addTokenFromPreset={addTokenFromPreset} SERVER_URL={SERVER_URL}
          />
          
          
          
          <DicePanel 
            isRightSidebarOpen={isRightSidebarOpen} setIsRightSidebarOpen={setIsRightSidebarOpen} updateSession={updateSession} pendingDamageTarget={pendingDamageTarget}
            setPendingDamageTarget={setPendingDamageTarget} localTokens={localTokens} diceCount={diceCount} setDiceCount={setDiceCount} rollDice={rollDice} sessionData={sessionData}
          />
          <MapBoard 
            mapApiRef={mapApiRef} containerRef={containerRef} hideLocalGrid={hideLocalGrid} activeTool={activeTool} isPanning={isPanning} handleWheel={onMapWheel} handlePointerDownBg={handlePointerDownBg} handleContextMenuMap={handleContextMenuMap}
            measureData={measureData} setMeasureData={setMeasureData} sessionData={sessionData} pan={pan} scale={scale} setScale={setScale} setPan={setPan} updateSession={updateSession}
            localTokens={localTokens} isTokenVisible={isTokenVisible} userRole={userRole} templateDrawData={templateDrawData} removeTemplate={removeTemplate}
            myTokenId={myTokenId} selectedTokenId={selectedTokenId} draggingTokenId={draggingTokenId} handleTokenPointerDown={handleTokenPointerDown} dragPath={dragPath}
            wallDrawData={wallDrawData} isFogEnabled={isFogEnabled} gmMode={gmMode} isPotatoMode={isPotatoMode}
            draggingTemplate={draggingTemplate} handleTemplatePointerDown={handleTemplatePointerDown}
          />
          

        </>
      )}
      {/* === ХОЛСТ ДЛЯ КУБИКОВ НА ВЕСЬ ЭКРАН === */}
      <div id="dice-box-container" className="fixed top-0 left-0 w-screen h-screen z-[500] pointer-events-none overflow-hidden" />
      
      {/* ДОБАВЛЯЕМ СТИЛИ СЮДА */}
      <style dangerouslySetInnerHTML={{__html: `
        
        /* Жестко фиксируем контейнер */
        #dice-box-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 9999 !important;
            pointer-events: none !important;
            overflow: hidden !important;
        }

        /* Жестко растягиваем сам 3D-холст внутри контейнера */
        #dice-box-container canvas {
            width: 100vw !important;
            height: 100vh !important;
            display: block !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
        }
      
        @keyframes slideIn { from { opacity: 0; transform: translateY(-10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes slideDown { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes ping-animation { 0% { transform: scale(0.2); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes floatUp { 0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; } 20% { transform: translate(-50%, -150%) scale(1.2); opacity: 1; } 80% { transform: translate(-50%, -200%) scale(1); opacity: 1; } 100% { transform: translate(-50%, -250%) scale(0.8); opacity: 0; } }
        .animate-map-ping { animation: ping-animation 1.5s ease-out infinite; }
        .hide-arrows::-webkit-outer-spin-button, .hide-arrows::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .hide-arrows { -moz-appearance: textfield; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #3f3f46; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #52525b; }
        .light-theme { background-color: #f3f4f6 !important; color: #171717 !important; }
        .light-theme .bg-neutral-950 { background-color: #f3f4f6 !important; }
        .light-theme .bg-neutral-900 { background-color: #ffffff !important; }
        .light-theme .bg-neutral-800 { background-color: #f9fafb !important; border-color: #e5e7eb !important; }
        .light-theme .bg-neutral-700 { background-color: #e5e7eb !important; }
        .light-theme .hover\\:bg-neutral-700:hover { background-color: #e5e7eb !important; }
        .light-theme .hover\\:bg-neutral-800:hover { background-color: #f3f4f6 !important; }
        .light-theme .bg-black\\/80 { background-color: rgba(255, 255, 255, 0.85) !important; }
        .light-theme .bg-black\\/90 { background-color: rgba(255, 255, 255, 0.95) !important; color: #171717 !important; border-color: #d4d4d4 !important; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important; }
        .light-theme .bg-\\[\\#0a0a0a\\] { background-color: #e5e7eb !important; }
        .light-theme .text-neutral-100 { color: #171717 !important; }
        .light-theme .text-neutral-200 { color: #262626 !important; }
        .light-theme .text-neutral-300 { color: #404040 !important; }
        .light-theme .text-neutral-400 { color: #525252 !important; }
        .light-theme .text-neutral-500 { color: #737373 !important; }
        .light-theme .border-neutral-800, .light-theme .border-neutral-800\\/50 { border-color: #e5e7eb !important; }
        .light-theme .border-neutral-700 { border-color: #d4d4d4 !important; }
        /* === РЕЖИМ КАРТОШКИ ДЛЯ ИНТЕРФЕЙСА === */
        /* ИСПРАВЛЕНИЕ: Убрали звездочку (*), чтобы не вешать процессор. Бьем только по нужным классам. */
        .potato-mode [class*="backdrop-blur"] {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
        }
        
        .potato-mode [class*="shadow"] {
            box-shadow: none !important;
        }

        /* Останавливаем бесконечные анимации */
        .potato-mode .animate-pulse, 
        .potato-mode .animate-ping, 
        .potato-mode .animate-map-ping {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
        }

        .potato-mode .bg-black\/90 { background-color: rgba(0, 0, 0, 0.98) !important; }
        .potato-mode .bg-neutral-900\/50 { background-color: rgba(23, 23, 23, 0.95) !important; }
      

        /* === ОПТИМИЗИРОВАННАЯ ПОГОДА (БЕЗ ЛАГОВ, КОСОЙ ДОЖДЬ, ПЛОТНЫЙ СНЕГ) === */
        .weather-overlay {
            position: absolute;
            inset: -50%; 
            pointer-events: none;
            z-index: 50; 
            transition: opacity 1.5s ease;
            will-change: background-position;
        }
        
        /* 1. ДОЖДЬ (Сильный косой ливень, угол -30 градусов) */
        .weather-rain {
            background-image: 
                linear-gradient(-30deg, transparent 49%, rgba(200, 220, 255, 0.45) 50%, transparent 51%),
                linear-gradient(-30deg, transparent 49.5%, rgba(200, 220, 255, 0.25) 50%, transparent 50.5%),
                linear-gradient(-30deg, transparent 49.8%, rgba(200, 220, 255, 0.15) 50%, transparent 50.2%);
            /* Плотная сетка для частого дождя */
            background-size: 40px 100px, 80px 160px, 120px 220px;
            animation: weatherRainSlanted 0.4s linear infinite;
        }
        
        /* 2. СНЕГ (Очень плотный, 5 слоев разного размера) */
        .weather-snow {
            background-image: 
                radial-gradient(circle at 20% 30%, rgba(255,255,255,0.95) 0%, transparent 3px),
                radial-gradient(circle at 70% 80%, rgba(255,255,255,0.8) 0%, transparent 4px),
                radial-gradient(circle at 40% 60%, rgba(255,255,255,0.6) 0%, transparent 3px),
                radial-gradient(circle at 90% 20%, rgba(255,255,255,0.4) 0%, transparent 2px),
                radial-gradient(circle at 10% 50%, rgba(255,255,255,0.3) 0%, transparent 2px);
            /* Уменьшенный background-size делает снег в 3 раза гуще */
            background-size: 80px 80px, 130px 130px, 180px 180px, 220px 220px, 280px 280px;
            animation: weatherSnowDense 8s linear infinite;
        }
        
        /* 3. ТУМАН (Облегченный, без фильтра blur = никаких лагов) */
        .weather-fog {
            background-image: 
                radial-gradient(ellipse at 30% 40%, rgba(200, 220, 240, 0.15) 0%, transparent 60%),
                radial-gradient(ellipse at 70% 60%, rgba(200, 220, 240, 0.12) 0%, transparent 60%),
                radial-gradient(ellipse at 50% 80%, rgba(200, 220, 240, 0.1) 0%, transparent 55%);
            background-size: 200% 200%, 150% 150%, 250% 250%;
            animation: weatherFogSimple 25s ease-in-out infinite alternate;
            mix-blend-mode: screen;
        }
        
        /* 4. ЛИСТОПАД (Маленькие листики, аккуратный размер) */
        .weather-leaves {
            background-image: 
                url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48cGF0aCBkPSdNMjAsMTAgQzMwLDI1IDQwLDIwIDUwLDEwIEM0NSwyNSA2MCwzMCA0MCw1MCBDMjAsMzAgMzUsMjUgMzAsMTAgWicgZmlsbD0nI2Q5NzcwNicgdHJhbnNmb3JtPSdyb3RhdGUoMjUgMzAgMzApIHNjYWxlKDAuNiknLz48L3N2Zz4="),
                url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNTAnIGhlaWdodD0nMTUwJz48cGF0aCBkPSdNNTAsMjAgUTcwLDUwIDgwLDgwIFE1MCw5MCAzMCw2MCBRMjAsMzAgNTAsMjAgWicgZmlsbD0nI2I0NTMwOScgdHJhbnNmb3JtPSdyb3RhdGUoNzUgNTAgNTApIHNjYWxlKDAuNSknLz48L3N2Zz4="),
                url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMDAnIGhlaWdodD0nMjAwJz48cGF0aCBkPSdNMTAwLDMwIEMxMzAsNTAgMTUwLDgwIDEwMCwxMzAgQzUwLDgwIDcwLDUwIDEwMCwzMCBaJyBmaWxsPScjZWFiMzA4JyB0cmFuc2Zvcm09J3JvdGF0ZSgtMzAgMTAwIDgwKSBzY2FsZSgwLjQpJy8+PC9zdmc+");
            /* Сильно уменьшили размер контейнеров листьев */
            background-size: 70px 70px, 120px 120px, 160px 160px;
            animation: weatherLeavesSmall 10s linear infinite;
        }

        /* === АНИМАЦИИ (Высчитаны для максимальной плавности) === */
        @keyframes weatherRainSlanted { 
            0% { background-position: 0px 0px, 0px 0px, 0px 0px; } 
            /* Смещение по X (влево) равно ~57% от смещения по Y (вниз), что идеально совпадает с углом -30 градусов */
            100% { background-position: -57px 100px, -91px 160px, -125px 220px; } 
        }
        @keyframes weatherSnowDense { 
            0% { background-position: 0px 0px, 0px 0px, 0px 0px, 0px 0px, 0px 0px; } 
            100% { background-position: 80px 240px, -130px 390px, 180px 540px, -220px 660px, 280px 840px; } 
        }
        @keyframes weatherFogSimple { 
            0% { background-position: 0% 0%, 0% 0%, 0% 0%; } 
            100% { background-position: 100% 100%, -30% 50%, 50% -30%; } 
        }
        @keyframes weatherLeavesSmall {
            0% { background-position: 0px 0px, 0px 0px, 0px 0px; }
            100% { background-position: 100px 280px, -150px 360px, 200px 480px; }
        }

      `}} />
      
    </div>
  );
}