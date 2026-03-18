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


import DiceBox from '@3d-dice/dice-box';
import { useChat } from './hooks/useChat';
import { useCombat } from './hooks/useCombat';

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


export default function App() {
  // 1. БАЗОВЫЕ СОСТОЯНИЯ СЕССИИ
  const [dbStatus, setDbStatus] = useState('connecting');
  const [sessionsList, setSessionsList] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [newSessionName, setNewSessionName] = useState('');
  
  const [sessionData, setSessionData] = useState({
    isGameStarted: false, mapConfig: null, gridConfig: {}, tokens: {}, walls: [], diceLog: [], 
    chatMessages: [], chatReadStates: {}, pings: [], readyPlayers: [], fogEnabled: true, 
    combatState: { isActive: false, order: [], currentTurnIndex: 0 },
    bgMusic: { videoId: null, isPlaying: false }, lighting: 'day'
  });

  const [localTokens, setLocalTokens] = useState([]); 

  // 2. ГЛОБАЛЬНАЯ ФУНКЦИЯ ОБНОВЛЕНИЯ (Мы перенесли её наверх)
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
            curr[parts[i]] = { ...curr[parts[i]] };
            curr = curr[parts[i]];
          }
          if (val === DELETE_FIELD) delete curr[parts[parts.length - 1]];
          else curr[parts[parts.length - 1]] = val;
        } else {
          if (val === DELETE_FIELD) delete nextState[key];
          else nextState[key] = val;
        }
      }
      socket.emit('update_session', { sessionId: targetId, updates: updates });
      return nextState;
    });
  }, [activeSessionId]);

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
  const draggedTokenPosRef = useRef(null);

  const [allScenes, setAllScenes] = useState([]);
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

  const [activeTool, setActiveTool] = useState('pointer'); 
  const [measureData, setMeasureData] = useState(null);
  const [wallDrawData, setWallDrawData] = useState(null);
  const [templateDrawData, setTemplateDrawData] = useState(null); 
  const [isPotatoMode, setIsPotatoMode] = useState(false);
  // === НОВОЕ: ПОЛНОЭКРАННЫЙ РЕЖИМ ===
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
      const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
      } else {
          if (document.exitFullscreen) document.exitFullscreen();
      }
  };

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  
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
  const [draggingTemplate, setDraggingTemplate] = useState(null);

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
  const lastTapRef = useRef({ id: null, time: 0 });
  const hasCenteredRef = useRef(false);
  const lastSyncRef = useRef(0); 
  const stateRefs = useRef({ authStep, userRole, currentUser, draggingTokenId: null });
  const dragStartPosRef = useRef(null);
  const lastValidPosRef = useRef(null); 
  const recentBroadcastsRef = useRef({}); 
  const wallsRef = useRef([]);
  const moveRequestRef = useRef(null);
  const polyCalcTimersRef = useRef({}); 

// ... твои другие стейты
  const diceBoxRef = useRef(null);
  const diceClearTimeoutRef = useRef(null); // <--- ДОБАВИТЬ ЭТУ СТРОКУ
  const [enable3DDice, setEnable3DDice] = useState(() => localStorage.getItem('disable3D') !== 'true');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const enable3DDiceRef = useRef(enable3DDice);
  useEffect(() => {
      enable3DDiceRef.current = enable3DDice;
  }, [enable3DDice]);
  // === 2. МГНОВЕННЫЙ СИМУЛЯТОР БРОСКОВ (Для тех, кто отключил 3D) ===
 // === 2. МГНОВЕННЫЙ СИМУЛЯТОР БРОСКОВ (Для тех, кто отключил 3D) ===
  const simulateFallbackRoll = (notation) => {
      let total = 0;
      let rawRolls = []; // Собираем сырые броски
      let parsedNotation = notation.toLowerCase().replace(/\s/g, '');

      // Считаем преимущество / помеху
      if (parsedNotation.includes('2d20kh1')) {
          const r1 = Math.floor(Math.random() * 20) + 1;
          const r2 = Math.floor(Math.random() * 20) + 1;
          total += Math.max(r1, r2);
          rawRolls = [r1, r2];
          parsedNotation = parsedNotation.replace('2d20kh1', '');
      } else if (parsedNotation.includes('2d20kl1')) {
          const r1 = Math.floor(Math.random() * 20) + 1;
          const r2 = Math.floor(Math.random() * 20) + 1;
          total += Math.min(r1, r2);
          rawRolls = [r1, r2];
          parsedNotation = parsedNotation.replace('2d20kl1', '');
      } else {
          // Считаем обычные кубики (например, 2d6, 1d8)
          const diceRegex = /(\d+)d(\d+)/g;
          let match;
          while ((match = diceRegex.exec(parsedNotation)) !== null) {
              const count = parseInt(match[1]);
              const sides = parseInt(match[2]);
              for (let i = 0; i < count; i++) {
                  const roll = Math.floor(Math.random() * sides) + 1;
                  total += roll;
                  rawRolls.push(roll);
              }
          }
          parsedNotation = parsedNotation.replace(/\d+d\d+/g, '');
      }

      // Добавляем модификаторы (+5, -2)
      const modRegex = /([+-]\d+)/g;
      let matchMod;
      while ((matchMod = modRegex.exec(parsedNotation)) !== null) {
          total += parseInt(matchMod[1]);
      }

      return { total, rawRolls };
  };


  // 1. Инициализация 3D движка при загрузке App.jsx
  useEffect(() => {
    const initDice = async () => {
      // === ИСПРАВЛЕНИЕ: Новый синтаксис для версии 1.1.0+ ===
      const diceBox = new DiceBox({
        container: "#dice-box-container", // <--- Теперь ID пишется здесь
        assetPath: '/assets/dice-box/', 
        theme: 'default',
        themeColor: '#da1147',
        scale: 8,           // Оптимальный размер (чтобы 20d6 не перекрыли весь обзор)
        spinForce: 8,        // Кубики сильнее закручиваются при броске
        tossForce: 10,       // Сила броска (они пролетят через весь экран)
        gravity: 2,          // Чуть более тяжелые, реалистичнее падают
        startingHeight: 15,  // Бросаются "из-за спины" (с большей высоты)
        shadows: true
      });
      await diceBox.init();
      diceBoxRef.current = diceBox;
      setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
      }, 500);
    };
    initDice();
  }, []);


  // 2. Умная обертка для бросков
  // 2. Умная обертка для бросков (с поддержкой Fallback и 2D-режима)
  // 2. Умная обертка для бросков (с поддержкой Fallback и 2D-режима)
  const rollDice = async (notation, reason = '', returnObj = false) => {
    if (diceClearTimeoutRef.current) {
      clearTimeout(diceClearTimeoutRef.current);
    }

    if (rollSound) {
      rollSound.currentTime = 0;
      rollSound.volume = 0.5;
      rollSound.playbackRate = 0.9 + Math.random() * 0.2;
      rollSound.play().catch(() => console.warn('Звук броска заблокирован браузером'));
    }

    let total = 0;
    let rawRolls = [];

    if (enable3DDiceRef.current && diceBoxRef.current) {
      try {
        const results = await diceBoxRef.current.roll(notation);
        if (results && results.length > 0) {
            total = results.reduce((acc, group) => acc + group.value, 0);
            // Вытаскиваем только броски кубиков (игнорируя плоские модификаторы типа +5)
            results.forEach(group => {
                if (group.rolls) {
                    group.rolls.forEach(die => rawRolls.push(die.value));
                }
            });
        } else {
            total = results.reduce((acc, die) => acc + die.value, 0);
            rawRolls = results.map(die => die.value);
        }
        
        diceClearTimeoutRef.current = setTimeout(() => {
          if (diceBoxRef.current) {
            diceBoxRef.current.clear();
          }
        }, 1500);
      } catch (err) {
        console.error('Ошибка 3D-движка кубиков, переключаемся на 2D-бросок:', err);
        const sim = simulateFallbackRoll(notation);
        total = sim.total;
        rawRolls = sim.rawRolls;
      }
    } else {
      const sim = simulateFallbackRoll(notation);
      total = sim.total;
      rawRolls = sim.rawRolls;
    }
    
    const logEntry = { 
      id: generateId(), 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
      roller: currentUser?.username || 'Игрок', 
      notation: reason ? reason : 'Бросок кубиков', 
      rolls: notation,
      total: total 
    };

    setSessionData(prev => {
      const updatedLog = [logEntry, ...(prev.diceLog || [])].slice(0, 50);
      if (activeSessionId) {
        socket.emit('update_session', { sessionId: activeSessionId, updates: { diceLog: updatedLog } });
      }
      return { ...prev, diceLog: updatedLog };
    });

    // Возвращаем объект со всеми кубиками, ТОЛЬКО если нас об этом попросили
    if (returnObj) {
        return { total, rawRolls };
    }
    return total; 
  };
  

  useEffect(() => { 
      wallsRef.current = sessionData.walls || []; 
  }, [sessionData.walls]);      
  
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
    socket.on('connect', () => setDbStatus('connected'));
    socket.on('connect_error', () => setDbStatus('error'));
    socket.emit('get_sessions', (data) => setSessionsList(data));
    socket.emit('get_scenes', (data) => setAllScenes(data));

    socket.on('sessions_updated', (data) => setSessionsList(data));
    socket.on('scenes_updated', (data) => setAllScenes(data));

    return () => {
        socket.off('connect');
        socket.off('connect_error');
        socket.off('sessions_updated');
        socket.off('scenes_updated');
    };
  }, []);

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



  const handleLeaveSession = () => {
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
    hasCenteredRef.current = false;
  };

  const handleDropToLobby = () => {
    setMyTokenId(null); 
    setSelectedTokenId(null); 
    setAuthStep('lobby_wait');
    setShowStatsWidget(false); 
    setShowInvWidget(false); 
    setShowAbilWidget(false); 
    setShowAtkWidget(false); 
    setCombatSelection([]); 
    setIsTokenPanelOpen(false); 
    hasCenteredRef.current = false;
  };

  const leaveLobby = () => {
      if (userRole === 'player' && activeSessionId) {
          socket.emit('get_session', activeSessionId, (dbSess) => {
             const filtered = (dbSess.readyPlayers || []).filter(p => !(p.accountId === currentUser.id && p.characterId === activeCharId));
             socket.emit('update_session', { sessionId: activeSessionId, updates: { readyPlayers: filtered } });
          });
      }
      handleLeaveSession();
  };


 const createSession = (e) => {
    e.preventDefault();
    if (!newSessionName.trim()) return;
    
    const newSession = {
      id: generateId(),
      name: newSessionName,
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
      lighting: 'day'
    };
    
    socket.emit('create_session', newSession);
    setNewSessionName('');
  };

  const deleteSession = (id) => { 
      if(window.confirm('Вы уверены, что хотите удалить эту сессию?')) {
          socket.emit('delete_session', id); 
      }
  };

  const joinSession = (id) => {
    socket.emit('get_session', id, (currentSess) => {
        if (!currentSess) return alert("Ошибка: Не удалось найти сессию.");

        if (userRole === 'player') {
          if (currentSess.isGameStarted) {
             const existingTokenKey = Object.keys(currentSess.tokens || {}).find(k => currentSess.tokens[k].accountId === currentUser.id && currentSess.tokens[k].characterId === activeCharacter.id);
             
             const sessionUpdates = {};
             Object.keys(currentSess.tokens || {}).forEach(k => { 
                if (currentSess.tokens[k].accountId === currentUser.id && currentSess.tokens[k].characterId !== activeCharacter.id) { 
                    sessionUpdates[`tokens.${k}`] = DELETE_FIELD; 
                } 
             });

             let finalTokenId = null;
             
             if (existingTokenKey) {
                 finalTokenId = existingTokenKey;
                 sessionUpdates[`tokens.${finalTokenId}`] = { ...currentSess.tokens[existingTokenKey], name: activeCharacter.name || activeCharacter.username, color: activeCharacter.stats?.tokenColor || '#3b82f6', frame: activeCharacter.stats?.tokenFrame || 'solid', image: activeCharacter.image || null, ac: activeCharacter.ac || 10, stats: activeCharacter.stats };
             } else {
                 // Защита от пустой карты и undefined значений
                 const mw = currentSess.mapConfig?.width ? Number(currentSess.mapConfig.width) : 800;
                 const mh = currentSess.mapConfig?.height ? Number(currentSess.mapConfig.height) : 600;
                 const startX = isNaN(mw) ? 400 : mw / 2; const startY = isNaN(mh) ? 300 : mh / 2;
                 const safeHp = Number(loginHp) || 10;

                 const newToken = { 
                     id: generateId(), accountId: currentUser.id, characterId: activeCharacter.id, name: activeCharacter.name || activeCharacter.username, type: 'player', 
                     color: activeCharacter.stats?.tokenColor || '#3b82f6', frame: activeCharacter.stats?.tokenFrame || 'solid', 
                     x: startX, y: startY, size: 60, vision: 300, hp: safeHp, maxHp: safeHp, ac: activeCharacter.ac || 10, 
                     image: activeCharacter.image || null, 
                     stats: activeCharacter.stats || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, 
                     deathSaves: { successes: 0, failures: 0 }, statuses: [] 
                 };
                 finalTokenId = newToken.id; sessionUpdates[`tokens.${finalTokenId}`] = newToken;
             }
             
             updateSession(sessionUpdates, id); 
             setActiveSessionId(id); 
             setMyTokenId(finalTokenId); 
             setGmMode(false); 
             setAuthStep('in_game');
          } else {
             const playerInfo = { id: generateId(), accountId: currentUser.id, characterId: activeCharacter.id, name: activeCharacter.name || activeCharacter.username, role: 'player', hp: Number(loginHp), ac: activeCharacter.ac || 10, tokenColor: activeCharacter.stats?.tokenColor || '#3b82f6', frame: activeCharacter.stats?.tokenFrame || 'solid', image: activeCharacter.image || null, stats: activeCharacter.stats };
             const filtered = (currentSess.readyPlayers || []).filter(p => !(p.accountId === currentUser.id));
             updateSession({ readyPlayers: [...filtered, playerInfo] }, id); 
             setActiveSessionId(id); 
             setGmMode(false); 
             setAuthStep('lobby_wait');
          }
        } else {
          setActiveSessionId(id); 
          setGmMode(userRole === 'gm'); 
          setAuthStep(currentSess.isGameStarted ? 'in_game' : 'lobby_wait');
        }
    });
  };

  const startGameAsGM = () => {
    const mapW = sessionData.mapConfig?.width ? Number(sessionData.mapConfig.width) : 800; 
    const mapH = sessionData.mapConfig?.height ? Number(sessionData.mapConfig.height) : 600;
    const mw = isNaN(mapW) ? 800 : mapW;
    const mh = isNaN(mapH) ? 600 : mapH;

    const newTokensMap = { ...sessionData.tokens };
    
    (sessionData.readyPlayers || []).forEach((rp, i) => {
       if (rp.role === 'player') {
           const alreadyExists = Object.values(newTokensMap).some(t => t.accountId === rp.accountId && t.characterId === rp.characterId);
           if (!alreadyExists) {
               newTokensMap[rp.id] = { 
                   id: rp.id, accountId: rp.accountId, characterId: rp.characterId, name: rp.name, type: 'player', color: rp.tokenColor || '#3b82f6', frame: rp.frame || 'solid', 
                   x: (mw / 2) + ((i % 5) * 80) - 160, y: (mh / 2) + Math.floor(i / 5) * 80, size: 60, vision: 300, 
                   hp: rp.hp || 10, maxHp: rp.hp || 10, ac: rp.ac || 10, 
                   image: rp.image || null, 
                   stats: rp.stats || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, 
                   deathSaves: { successes: 0, failures: 0 }, statuses: [] 
               };
           }
       }
    });
    
    updateSession({ isGameStarted: true, tokens: newTokensMap, readyPlayers: [] });
    setAuthStep('in_game');
  };

  const stopGameAsGM = () => {
    if (window.confirm("Вы уверены? Это вернет всех в лобби и ОЧИСТИТ текущую карту с токенами.")) {
       updateSession({ isGameStarted: false, tokens: {}, walls: [], mapConfig: null, diceLog: [], readyPlayers: [], chatMessages: [], pings: [], combatState: { isActive: false, order: [], currentTurnIndex: 0 }, lighting: 'day' });
       handleDropToLobby();
    }
  };

  const saveScene = useCallback(() => {
    const name = window.prompt("Название сцены (введите имя существующей для её перезаписи):");
    if (!name) return;
    
    const existing = allScenes.find(s => s.sessionId === activeSessionId && s.name.toLowerCase() === name.trim().toLowerCase());
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
        createdAt: existing ? existing.createdAt : Date.now() 
    };
    
    socket.emit('save_scene', newScene);
    alert(existing ? "Сцена обновлена!" : "Новая сцена сохранена!");
  }, [allScenes, activeSessionId, sessionData, isFogEnabled]);

  const loadScene = (scene) => {
    if (window.confirm(`Загрузить сцену "${scene.name}"?`)) {
       const activePlayerTokens = Object.values(sessionData.tokens || {}).filter(t => t.accountId);
       const sceneTokens = Object.values(scene.tokens || {}).filter(t => !t.accountId);
       
       // === ФИКС СПАВНА: Телепортируем игроков в центр загружаемой сцены ===
       const mapW = scene.mapConfig?.width ? Number(scene.mapConfig.width) : 800;
       const mapH = scene.mapConfig?.height ? Number(scene.mapConfig.height) : 600;
       
       activePlayerTokens.forEach((p, i) => {
           p.x = (mapW / 2) + ((i % 5) * 80) - 160;
           p.y = (mapH / 2) + Math.floor(i / 5) * 80;
       });

       const newTokensMap = {};
       activePlayerTokens.forEach(p => newTokensMap[p.id] = p);
       sceneTokens.forEach(t => newTokensMap[t.id] = t);
       
       updateSession({ mapConfig: scene.mapConfig || null, tokens: newTokensMap, walls: scene.walls || [], fogEnabled: scene.fogEnabled ?? true, lighting: scene.lighting || 'day', combatState: { isActive: false, order: [], currentTurnIndex: 0 }, pings: [] });
       setScale(1); 
       setPan({x:0, y:0});
    }
  };

  // === ВСТАВЬ ЭТОТ БЛОК СРАЗУ ПОСЛЕ loadScene ===
  const deleteScene = (sceneId) => { 
      if (window.confirm("Удалить сцену навсегда?")) {
          socket.emit('delete_scene', sceneId); 
      }
  };

  const handleShare = () => {
     updateSession({ sharedMedia: { id: Date.now(), type: shareType, content: shareContent, visibleTo: shareTargets.includes('all') ? 'all' : shareTargets } });
     setIsShareModalOpen(false); 
     setShareContent('');
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const playersOnly = {};
    Object.values(sessionData.tokens || {}).forEach(t => {
        if (t.accountId) {
            playersOnly[t.id] = t; 
        }
    });

    if (file.name.toLowerCase().endsWith('.dd2vtt')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target.result);
                const ppi = data.resolution?.pixels_per_grid || 70;
                const img = new Image();
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width; let h = img.height;
                    // === ОПТИМИЗАЦИЯ ТЕКСТУРЫ (Безопасный лимит WebGL 2048) ===
                    const max = 2048; let ratio = 1;
                    if (w > max || h > max) { 
                        ratio = Math.min(max/w, max/h); 
                        w = Math.floor(w * ratio); 
                        h = Math.floor(h * ratio); 
                    }
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d'); 
                    ctx.drawImage(img, 0, 0, w, h);
                    const imageUrl = await uploadCanvasToStorage(canvas, 'maps');
                    
                    // === ФИКС СПАВНА: Собираем игроков в центре новой карты ===
                    let playerIndex = 0;
                    Object.values(playersOnly).forEach(p => {
                        p.x = (w / 2) + ((playerIndex % 5) * 80) - 160;
                        p.y = (h / 2) + Math.floor(playerIndex / 5) * 80;
                        playerIndex++;
                    });

                    let newWalls = [];
                    if (data.line_of_sight) {
                        data.line_of_sight.forEach(path => {
                            for (let i = 0; i < path.length - 1; i++) {
                                newWalls.push({ id: generateId(), x1: path[i].x * ppi * ratio, y1: path[i].y * ppi * ratio, x2: path[i+1].x * ppi * ratio, y2: path[i+1].y * ppi * ratio });
                            }
                        });
                    }
                    if (data.portals) {
                        data.portals.forEach(portal => {
                            if (portal.closed && portal.bounds && portal.bounds.length > 1) {
                                const path = portal.bounds;
                                for (let i = 0; i < path.length - 1; i++) {
                                    newWalls.push({ id: generateId(), x1: path[i].x * ppi * ratio, y1: path[i].y * ppi * ratio, x2: path[i+1].x * ppi * ratio, y2: path[i+1].y * ppi * ratio });
                                }
                            }
                        });
                    }
                    newWalls.push(
                        { id: generateId(), x1: 0, y1: 0, x2: w, y2: 0 }, { id: generateId(), x1: w, y1: 0, x2: w, y2: h }, 
                        { id: generateId(), x1: w, y1: h, x2: 0, y2: h }, { id: generateId(), x1: 0, y1: h, x2: 0, y2: 0 }
                    );

                    const currentGrid = sessionData.gridConfig || {};
                    updateSession({ 
                        mapConfig: { src: imageUrl, width: w, height: h }, 
                        walls: newWalls, tokens: playersOnly, 
                        gridConfig: { enabled: true, size: Math.round(ppi * ratio), color: currentGrid.color || '#ffffff', opacity: currentGrid.opacity || 0.4, offsetX: 0, offsetY: 0 } 
                    });
                    setScale(1); setPan({ x: 0, y: 0 });
                };
                img.src = "data:image/png;base64," + data.image;
            } catch (err) { alert("Не удалось загрузить файл dd2vtt."); }
        };
        reader.readAsText(file);
    } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = async () => {
             const canvas = document.createElement('canvas');
             let w = img.width; let h = img.height;
             const max = 2048; let ratio = 1; // Оптимизация текстуры
             if (w > max || h > max) { ratio = Math.min(max/w, max/h); w = Math.floor(w * ratio); h = Math.floor(h * ratio); }
             canvas.width = w; canvas.height = h;
             const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
             const imageUrl = await uploadCanvasToStorage(canvas, 'maps');
             
             // ФИКС СПАВНА
             let playerIndex = 0;
             Object.values(playersOnly).forEach(p => {
                 p.x = (w / 2) + ((playerIndex % 5) * 80) - 160;
                 p.y = (h / 2) + Math.floor(playerIndex / 5) * 80;
                 playerIndex++;
             });

             const boundaryWalls = [ 
                 { id: generateId(), x1: 0, y1: 0, x2: w, y2: 0 }, { id: generateId(), x1: w, y1: 0, x2: w, y2: h }, 
                 { id: generateId(), x1: w, y1: h, x2: 0, y2: h }, { id: generateId(), x1: 0, y1: h, x2: 0, y2: 0 } 
             ];
             updateSession({ mapConfig: { src: imageUrl, width: w, height: h }, walls: boundaryWalls, tokens: playersOnly });
             setScale(1); setPan({ x: 0, y: 0 });
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
    e.target.value = null;
  };

  const handleWidgetPointerDown = (e, widget) => {
    e.stopPropagation();
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    setDraggingWidget(widget);
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

// === 1. ЭТА ФУНКЦИЯ ДОЛЖНА ИДТИ ПЕРВОЙ ===
  // === 1. ОБРАБОТЧИК ТОКЕНОВ ===
  const handleTokenPointerDown = useCallback((e, id) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    
    const now = Date.now(); 
    // Безопасное чтение lastTap
    const lastTap = lastTapRef.current || {};
    const isDoubleTap = lastTap.id === id && (now - (lastTap.time || 0)) < 400;
    
    lastTapRef.current = { id, time: now };
    setSelectedTokenId(id); 
    setHpInputValue(''); 
    
    if (isDoubleTap) { setIsTokenPanelOpen(true); setIsTokenPanelMinimized(false); }
    if (activeTool !== 'pointer') return; 
    if (userRole === 'spectator') return; 
    if (userRole === 'player' && id !== myTokenId) return; 
    
    const t = localTokens.find(tok => tok.id === id);
    if (t) { 
        dragStartPosRef.current = { x: t.x, y: t.y }; 
        lastValidPosRef.current = { x: t.x, y: t.y }; 
        setDragPath([{ x: t.x, y: t.y }]); 
    }
    setDraggingTokenId(id);
  }, [activeTool, userRole, myTokenId, localTokens]);


  // === 1. НАЖАТИЕ МЫШИ (СТАРТ) ===
   // === 1. НАЖАТИЕ МЫШИ (СТАРТ) ===
  const handlePointerDownBg = useCallback((e) => {
    if (e.button === 2 || portraitToShow) return; 
    if (!containerRef.current) return;
    
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / scale; 
    const y = (e.clientY - rect.top - pan.y) / scale;
    
    // === НОВОЕ: СТАРТ РИСОВАНИЯ ШАБЛОНА ===
    // === СТАРТ РИСОВАНИЯ ШАБЛОНА ===
    if (activeTool.startsWith('template-')) {
        setTemplateDrawData({ 
            type: activeTool.replace('template-', ''), 
            startX: x, startY: y, 
            currentX: x, currentY: y 
        });
        return;
    }
    
    // Рисование стен (Только для ГМ)
    if (userRole === 'gm') {
        if (activeTool === 'wall-line' || activeTool === 'wall-brush') {
            setWallDrawData({ points: [{x, y}] }); 
            return;
        }
    }

    if (activeTool === 'ruler') { 
        setMeasureData({ points: [{x, y}], current: {x, y} }); 
        return; 
    }
    
    // Выбор токена
    if (activeTool === 'pointer') {
        const tokens = Array.isArray(localTokens) ? localTokens : [];
        const clickedToken = [...tokens].reverse().find(t => {
            if (!isTokenVisible(t)) return false;
            const hitRadius = (Number(t.size) || 60) / 2 + (20 / scale); 
            return Math.hypot(t.x - x, t.y - y) <= hitRadius;
        });
        
        if (clickedToken) { 
            const now = Date.now(); 
            const lastTap = lastTapRef.current || {};
            const isDoubleTap = lastTap.id === clickedToken.id && (now - (lastTap.time || 0)) < 400;
            lastTapRef.current = { id: clickedToken.id, time: now };
            
            setSelectedTokenId(clickedToken.id); 
            
            if (userRole === 'player' && clickedToken.id !== myTokenId) return;
            
            dragStartPosRef.current = { 
                tokenX: clickedToken.x, 
                tokenY: clickedToken.y, 
                cursorX: x, 
                cursorY: y 
            }; 
            draggedTokenPosRef.current = { x: clickedToken.x, y: clickedToken.y };
            setDraggingTokenId(clickedToken.id);
            
            if (isDoubleTap) { setIsTokenPanelOpen(true); setIsTokenPanelMinimized(false); }
            return; 
        }
    }
    
    // Если кликнули в пустоту — двигаем карту
    if (activeTool !== 'wall-eraser') {
        setSelectedTokenId(null); 
        setIsTokenPanelOpen(false); 
        setIsPanning(true); 
        setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y }); 
    }
  }, [pan, scale, activeTool, portraitToShow, userRole, localTokens, myTokenId, isTokenVisible]);

 const handlePointerMoveBg = useCallback((e) => { 
    // === 1. ИДЕАЛЬНО ПЛАВНОЕ ДВИЖЕНИЕ ВИДЖЕТОВ (Синхронизация с монитором) ===
    if (draggingWidget) {
        // Если браузер еще не успел нарисовать прошлый кадр — отменяем его, чтобы не создавать "пробку"
        if (moveRequestRef.current) cancelAnimationFrame(moveRequestRef.current);
        
        // Запрашиваем отрисовку строго в момент обновления экрана
        moveRequestRef.current = requestAnimationFrame(() => {
            setWidgetPositions(prev => ({
                ...prev,
                [draggingWidget]: { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y }
            }));
        });
        return;
    }
    if (draggingTemplate) {
        const deltaX = x - draggingTemplate.startCursorX;
        const deltaY = y - draggingTemplate.startCursorY;
        setDraggingTemplate(prev => ({
            ...prev,
            x: prev.origX + deltaX,
            y: prev.origY + deltaY,
            targetX: prev.origTargetX + deltaX,
            targetY: prev.origTargetY + deltaY
        }));
        return;
    }
    
   if (!isPanning && !draggingTokenId && !measureData && !wallDrawData && !templateDrawData && activeTool !== 'wall-eraser') return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / scale; 
    const y = (e.clientY - rect.top - pan.y) / scale;

    

    // === НОВОЕ: РАСТЯГИВАНИЕ ШАБЛОНА ===
    if (templateDrawData) {
        setTemplateDrawData(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
        return;
    }

    // Перемещение токена
    // Перемещение токена
    if (draggingTokenId) {
        const start = dragStartPosRef.current;
        if (!start) return;

        let targetX = start.tokenX + (x - start.cursorX);
        let targetY = start.tokenY + (y - start.cursorY);
        
        // === 1. ЖЕЛЕЗОБЕТОННАЯ ЗАЩИТА ОТ ВЫЛЕТА ===
        if (isNaN(targetX) || isNaN(targetY)) return;

        // Определяем границы карты и размер токена
        const mapW = sessionData?.mapConfig?.width ? Number(sessionData.mapConfig.width) : 2000;
        const mapH = sessionData?.mapConfig?.height ? Number(sessionData.mapConfig.height) : 2000;
        const tokenRadius = (localTokens.find(t => t.id === draggingTokenId)?.size || 60) / 2;

        // ГМ ходит сквозь стены, игроки врезаются
        if (userRole !== 'gm') {
            const walls = wallsRef.current || [];
            
            let currentX = draggedTokenPosRef.current ? draggedTokenPosRef.current.x : start.tokenX;
            let currentY = draggedTokenPosRef.current ? draggedTokenPosRef.current.y : start.tokenY;

            let dx = targetX - currentX;
            let dy = targetY - currentY;
            let dist = Math.hypot(dx, dy);

            // Физика столкновений
            if (dist > 0) {
                // Защита от зависания при гигантском рывке мышью: максимум 100 шагов физики
                let steps = Math.min(100, Math.ceil(dist / (tokenRadius * 0.5))); 
                let stepX = dx / steps;
                let stepY = dy / steps;

                let simX = currentX;
                let simY = currentY;

                const collisionBuffer = tokenRadius + 50; 
                
                const minBoxX = Math.min(currentX, targetX) - collisionBuffer;
                const maxBoxX = Math.max(currentX, targetX) + collisionBuffer;
                const minBoxY = Math.min(currentY, targetY) - collisionBuffer;
                const maxBoxY = Math.max(currentY, targetY) + collisionBuffer;

                const localWalls = walls.filter(w => {
                    return !(Math.max(w.x1, w.x2) < minBoxX || Math.min(w.x1, w.x2) > maxBoxX ||
                             Math.max(w.y1, w.y2) < minBoxY || Math.min(w.y1, w.y2) > maxBoxY);
                });

                for (let i = 0; i < steps; i++) {
                    simX += stepX;
                    simY += stepY;

                    for (let iter = 0; iter < 3; iter++) { 
                        for (const wall of localWalls) {
                            const v = { x: wall.x1, y: wall.y1 };
                            const w = { x: wall.x2, y: wall.y2 };
                            const l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
                            let t = Math.max(0, Math.min(1, l2 === 0 ? 0 : ((simX - v.x) * (w.x - v.x) + (simY - v.y) * (w.y - v.y)) / l2));
                            
                            const closestX = v.x + t * (w.x - v.x);
                            const closestY = v.y + t * (w.y - v.y);
                            
                            const d = Math.hypot(simX - closestX, simY - closestY);
                            
                            if (d > 0 && d < tokenRadius) {
                                const overlap = tokenRadius - d;
                                simX += ((simX - closestX) / d) * overlap;
                                simY += ((simY - closestY) / d) * overlap;
                            }
                        }
                    }
                }
                targetX = simX;
                targetY = simY;
            }
        }

        // === 2. МЯГКАЯ ПРУЖИНА (Не даем вылететь за края карты) ===
        targetX = Math.max(tokenRadius, Math.min(mapW - tokenRadius, targetX));
        targetY = Math.max(tokenRadius, Math.min(mapH - tokenRadius, targetY));

        // === 3. КОНТРОЛЬНЫЙ ПРЕДОХРАНИТЕЛЬ ===
        if (isNaN(targetX) || isNaN(targetY)) {
             targetX = start.tokenX;
             targetY = start.tokenY;
        }

        if (mapApiRef.current && mapApiRef.current.moveTokenVisual) {
            mapApiRef.current.moveTokenVisual(draggingTokenId, targetX, targetY);
        }
        draggedTokenPosRef.current = { x: targetX, y: targetY };

        // ОТПРАВКА ДВИЖЕНИЯ В РЕАЛЬНОМ ВРЕМЕНИ
        const now = Date.now();
        if (now - lastSyncRef.current > 40) { 
            lastSyncRef.current = now;
            
            const currentToken = localTokens.find(t => t.id === draggingTokenId);
            const poly = currentToken ? currentToken.fovPolygon : null;

            const payload = { id: draggingTokenId, x: targetX, y: targetY, fovPolygon: poly };

            if (socket.volatile) {
                socket.volatile.emit('broadcast', { sessionId: activeSessionId, event: 'token_move', payload });
            } else {
                socket.emit('broadcast', { sessionId: activeSessionId, event: 'token_move', payload });
            }
        }

        return; 
    }

    // Движение карты
    if (isPanning) { 
        setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y }); 
        return; 
    } 
    
    // Линейка
    if (measureData && activeTool === 'ruler') {
        setMeasureData(prev => prev ? { ...prev, current: {x, y} } : null);
        return;
    } 
    
    // Отрисовка стен
    if (wallDrawData && userRole === 'gm') {
        if (activeTool === 'wall-line') {
            setWallDrawData(prev => ({ points: [prev.points[0], {x, y}] }));
        } else if (activeTool === 'wall-brush') {
            const lastPt = wallDrawData.points[wallDrawData.points.length - 1];
            if (Math.hypot(x - lastPt.x, y - lastPt.y) > 20 / scale) {
                setWallDrawData(prev => ({ points: [...prev.points, {x, y}] }));
            }
        }
        return;
    } 
    
    // Ластик для стен
    if (activeTool === 'wall-eraser' && e.buttons === 1 && userRole === 'gm') {
        const hit = wallsRef.current.find(w => distToSegment({x, y}, {x: w.x1, y: w.y1}, {x: w.x2, y: w.y2}) < 15 / scale);
        if (hit) {
            const newWalls = wallsRef.current.filter(w => w.id !== hit.id);
            wallsRef.current = newWalls; 
            updateSession({ walls: newWalls });
            setLocalTokens(prev => prev.map(t => ({ ...t, fovPolygon: null })));
        }
    }
  }, [isPanning, startPan, measureData, activeTool, scale, pan, wallDrawData, userRole, updateSession, draggingTokenId, localTokens, draggingWidget, dragOffset, templateDrawData, activeSessionId]); // <--- ИСПРАВЛЕНИЕ: Добавлен activeSessionId в зависимости
  const handlePointerUpBg = useCallback((e) => { 
    // === НОВОЕ: СОХРАНЕНИЕ ШАБЛОНА ===
    // === НОВОЕ: СОХРАНЕНИЕ ШАБЛОНА ===
    if (templateDrawData) {
        const dist = Math.hypot(templateDrawData.currentX - templateDrawData.startX, templateDrawData.currentY - templateDrawData.startY);
        // Сохраняем, только если потянули мышь (больше 10 пикселей)
        if (dist > 10 / scale) {
            const newTemplate = {
                id: generateId(),
                type: templateDrawData.type,
                x: templateDrawData.startX,
                y: templateDrawData.startY,
                targetX: templateDrawData.currentX,
                targetY: templateDrawData.currentY,
                color: activeWidgetCharacter?.stats?.tokenColor || '#a855f7'
            };
            const currentTemplates = sessionData.templates || [];
            updateSession({ templates: [...currentTemplates, newTemplate] });
        }
        setTemplateDrawData(null);
    }
    // === 2. Сброс перетаскивания ===
    if (draggingWidget) {
        setDraggingWidget(null);
        return;
    }

    if (draggingTemplate) {
        const newTemplates = (sessionData.templates || []).map(t =>
            t.id === draggingTemplate.id ? {
                ...t,
                x: draggingTemplate.x,
                y: draggingTemplate.y,
                targetX: draggingTemplate.targetX,
                targetY: draggingTemplate.targetY
            } : t
        );
        updateSession({ templates: newTemplates });
        setDraggingTemplate(null);
        return;
    }

    if (draggingTokenId) {
        if (draggedTokenPosRef.current) {
            let { x, y } = draggedTokenPosRef.current;
            
            // === ЗАЩИТА ПРИ СОХРАНЕНИИ (Сброс на начальную позицию при ошибке) ===
            if (isNaN(x) || isNaN(y)) {
                x = dragStartPosRef.current?.tokenX || 100;
                y = dragStartPosRef.current?.tokenY || 100;
            }

            if (mapApiRef.current && mapApiRef.current.clearVisualPos) {
                mapApiRef.current.clearVisualPos(draggingTokenId);
            }
            setLocalTokens(prev => prev.map(t => t.id === draggingTokenId ? { ...t, x, y, fovPolygon: null } : t));
            updateSession({ [`tokens.${draggingTokenId}.x`]: x, [`tokens.${draggingTokenId}.y`]: y });
            draggedTokenPosRef.current = null;
        }
        setDraggingTokenId(null);
    }

    setIsPanning(false); 
    setMeasureData(null); 
    
    // Сохранение стен в БД
    if (wallDrawData && userRole === 'gm') {
        if (wallDrawData.points.length > 1) {
            const newWalls = [];
            const pts = wallDrawData.points;
            for (let i = 0; i < pts.length - 1; i++) {
                newWalls.push({ id: generateId(), x1: pts[i].x, y1: pts[i].y, x2: pts[i+1].x, y2: pts[i+1].y });
            }
            const updatedWalls = [...wallsRef.current, ...newWalls];
            wallsRef.current = updatedWalls; 
            updateSession({ walls: updatedWalls });
            setLocalTokens(prev => prev.map(t => ({ ...t, fovPolygon: null })));
        }
        setWallDrawData(null);
    }
    
    try { e.currentTarget?.releasePointerCapture(e.pointerId); } catch(err){}
  }, [
    wallDrawData, 
    updateSession, 
    draggingTokenId, 
    userRole, 
    draggingWidget, 
    templateDrawData, // <--- ДОБАВИТЬ
    scale,            // <--- ДОБАВИТЬ
    sessionData,      // <--- ДОБАВИТЬ
    activeWidgetCharacter // <--- ДОБАВИТЬ
  ]);

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
  const handleWheel = (e) => {
    if (e.target.closest('aside') || e.target.closest('.no-zoom') || portraitToShow) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; 
    const mouseY = e.clientY - rect.top;

    const mapX = (mouseX - pan.x) / scale;
    const mapY = (mouseY - pan.y) / scale;

    const newScale = Math.min(Math.max(0.1, scale - e.deltaY * 0.001), 5);

    setPan({
        x: mouseX - mapX * newScale,
        y: mouseY - mapY * newScale
    });
    setScale(newScale);
  };
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
            mapApiRef={mapApiRef} containerRef={containerRef} hideLocalGrid={hideLocalGrid} activeTool={activeTool} isPanning={isPanning} handleWheel={handleWheel} handlePointerDownBg={handlePointerDownBg} handleContextMenuMap={handleContextMenuMap}
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