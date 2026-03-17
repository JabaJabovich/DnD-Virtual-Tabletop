import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, User, Eye, ChevronLeft, ScrollText, Backpack, Sparkles, Swords, 
  Layers, Save, Play, Trash2, Target, Upload, EyeOff, Settings, BookOpen, 
  FileText, Music, Skull, Plus, Heart, LogOut, Link, Grid3X3, Sun, Moon, Search, Loader2,
  ChevronDown, ChevronRight, X as CloseIcon, VolumeX, Zap, Maximize, Minimize, Dices, CloudRain, Snowflake, Cloud, Leaf, Wind, 
} from 'lucide-react';

// Безопасный генератор ID
const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

const STAT_LABELS = { str: 'СИЛ', dex: 'ЛОВ', con: 'ВЫН', int: 'ИНТ', wis: 'МУД', cha: 'ХАР' };

const AccordionSection = ({ id, icon: Icon, title, children, count, activePanel, setActivePanel }) => {
   const isOpen = activePanel === id;
   return (
      <div className="border-t border-neutral-800/50 shrink-0">
         <button onClick={() => setActivePanel(isOpen ? '' : id)} className="w-full flex items-center justify-between p-4 hover:bg-neutral-800/50 transition-colors">
            <div className="flex items-center gap-3 text-neutral-300 font-black uppercase tracking-widest text-xs">
               <Icon size={16} className={isOpen ? 'text-indigo-400' : 'text-neutral-500'} /> {title}
            </div>
            <div className="flex items-center gap-3">
               {count !== undefined && count > 0 && <span className="bg-neutral-800 px-2 py-0.5 rounded-md text-white text-[10px] font-bold">{count}</span>}
               {isOpen ? <ChevronDown size={16} className="text-neutral-500"/> : <ChevronRight size={16} className="text-neutral-600"/>}
            </div>
         </button>
         {isOpen && <div className="p-4 pt-0 space-y-4 animate-[fadeIn_0.2s_ease-out]">{children}</div>}
      </div>
   );
};

export default React.memo(function LeftSidebar({
  isLeftSidebarOpen, setIsLeftSidebarOpen, userRole, activeCharacter,
  showStatsWidget, setShowStatsWidget, showInvWidget, setShowInvWidget,
  showAbilWidget, setShowAbilWidget, showAtkWidget, setShowAtkWidget,
  saveScene, sessionData, sessionScenes, loadScene, deleteScene, showNotesWidget, setShowNotesWidget,
  handleImageUpload, updateSession, isFogEnabled, gmMode, setGmMode, setIsShareModalOpen,
  localVideoUrl, setLocalVideoUrl, extractYTId, ytPlayerRef, handleIframeLoad, localVolume, handleVolumeChange,
  localTokens, addToken, newTokenName, setNewTokenName, newTokenHp, setNewTokenHp, newTokenAc, setNewTokenAc,
  newTokenType, setNewTokenType, newTokenColor, setNewTokenColor,
  newTokenImage, setNewTokenImage, handleTokenImageUpload, isPotatoMode, setIsPotatoMode,
  newTokenVision, setNewTokenVision, newTokenHidden, setNewTokenHidden, enable3DDice, setEnable3DDice,
  endCombat, startCombat, combatSelection, toggleCombatSelection, isFullscreen, toggleFullscreen,
  myTokenId, selectedTokenId, handleTokenPointerDown, removeToken, handleLeaveSession,
  isTokenVisible, bestiary, setBestiary, addTokenFromPreset, SERVER_URL, hideLocalGrid, setHideLocalGrid, isChatMuted, setIsChatMuted
}) {

  const [activePanel, setActivePanel] = useState('creatures'); 
  const [tokenTab, setTokenTab] = useState('new'); 
  const [apiSearch, setApiSearch] = useState(''); 
  const [isImporting, setIsImporting] = useState(false); 

  // === ЛОКАЛЬНЫЕ СОСТОЯНИЯ ДЛЯ РЕДАКТОРА СУЩЕСТВ ===
  const [customStats, setCustomStats] = useState({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
  const [customAttacks, setCustomAttacks] = useState([]);
  const [customAbilities, setCustomAbilities] = useState([]); 
  const [customInventory, setCustomInventory] = useState('');

  // === ЛОГИКА ИЗМЕНЕНИЯ ШИРИНЫ (RESIZING) ===
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('leftSidebarWidth');
    return saved ? parseInt(saved, 10) : 360;
  });
  const [isResizing, setIsResizing] = useState(false);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isResizing) {
       localStorage.setItem('leftSidebarWidth', width);
       return;
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (e) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
         // МИНИМАЛЬНАЯ ШИРИНА ИЗМЕНЕНА НА 150px
         const newWidth = Math.min(Math.max(150, e.clientX), 800);
         setWidth(newWidth);
      });
    };
    
    const handleUp = () => setIsResizing(false);
    
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isResizing]);
  // ===========================================

  const defaultGrid = { enabled: false, size: 60, offsetX: 0, offsetY: 0, color: '#ffffff', opacity: 0.3 };
  const gridConfig = sessionData?.gridConfig ? { ...defaultGrid, ...sessionData.gridConfig } : defaultGrid;
  const visibleTokens = (localTokens || []).filter(isTokenVisible);

  const handleApiImport = async (e) => {
    if (e) e.preventDefault();
    if (!apiSearch.trim()) return;
    setIsImporting(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/import-monster/${apiSearch.trim().toLowerCase().replace(/\s+/g, '-')}`);
      if (res.ok) {
        const data = await res.json();
        
        let statsArr = [
          { key: 'str', val: data.stats.str }, { key: 'dex', val: data.stats.dex },
          { key: 'con', val: data.stats.con }, { key: 'int', val: data.stats.int },
          { key: 'wis', val: data.stats.wis }, { key: 'cha', val: data.stats.cha }
        ];
        
        statsArr.forEach(s => s.val = Math.max(-5, Math.min(5, s.val))); 
        data.stats = statsArr.reduce((acc, s) => { acc[s.key] = s.val; return acc; }, {});

        let adaptedAbilities = [];
        if (typeof data.abilities === 'string' && data.abilities.trim() !== '') {
           const parts = data.abilities.split('\n\n');
           adaptedAbilities = parts.map(p => {
              const match = p.match(/\*\*(.*?):\*\*\n(.*)/s);
              return {
                 id: generateId(),
                 name: match ? match[1].trim() : 'Способность',
                 description: match ? match[2].trim() : p.trim(),
                 dmgCount: 0, dmgSides: 6, damageBonus: 0, effectType: 'none', effectDuration: 1, tickCount: 0, tickSides: 4
              };
           });
        }
        data.abilities = adaptedAbilities;

        addTokenFromPreset(data); 
        setApiSearch('');
      } else {
        alert('Монстр не найден. Ищите на английском (напр. Goblin)');
      }
    } catch (err) {
      alert('Ошибка подключения к серверу');
    } finally {
      setIsImporting(false);
    }
  };

  const clearForm = () => {
    setNewTokenName(''); setNewTokenHp(50); setNewTokenAc(10); setNewTokenImage(''); setNewTokenHidden(false);
    setCustomStats({ str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 });
    setCustomAttacks([]); setCustomAbilities([]); setCustomInventory('');
  };

  const buildPreset = () => ({
    id: generateId(), name: newTokenName.trim() || 'Безымянный',
    hp: Number(newTokenHp) || 10, maxHp: Number(newTokenHp) || 10, ac: Number(newTokenAc) || 10,
    type: newTokenType, color: newTokenColor, image: newTokenImage, vision: Number(newTokenVision) || 0, isHidden: newTokenHidden,
    stats: customStats, attacks: customAttacks, abilities: customAbilities, inventory: customInventory
  });

  const handleCustomCreate = (e) => {
    e.preventDefault();
    if (!sessionData.mapConfig) return alert("Сначала загрузите карту!");
    addTokenFromPreset(buildPreset());
    clearForm();
  };

  const handleSaveToBestiary = () => {
    if (!newTokenName.trim()) return alert("Введите имя существа!");
    setBestiary([...bestiary, buildPreset()]);
    setTokenTab('bestiary');
    clearForm();
  };

  return (
    <aside 
      className="absolute top-0 left-0 h-full bg-neutral-900/95 backdrop-blur-2xl border-r border-neutral-800/80 flex flex-col z-40 shadow-2xl pointer-events-auto"
      style={{ 
        width: `${width}px`, 
        transform: isLeftSidebarOpen ? 'translate3d(0, 0, 0)' : `translate3d(-${width}px, 0, 0)`,
        transitionProperty: isResizing ? 'none' : 'transform',
        transitionDuration: '300ms',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onPointerDown={e => e.stopPropagation()} 
      onWheel={e => e.stopPropagation()}
    >
      
      {/* === ПОЛЗУНОК ДЛЯ ИЗМЕНЕНИЯ ШИРИНЫ === */}
      <div 
        className="absolute top-0 right-0 w-3 h-full cursor-col-resize z-[100] hover:bg-indigo-500/50 active:bg-indigo-500/80 transition-colors"
        style={{ transform: 'translateX(50%)' }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsResizing(true);
        }}
      />

      <div className="p-5 border-b border-neutral-800/80 bg-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${userRole === 'gm' ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-900/30' : userRole === 'player' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-900/30' : 'bg-neutral-700'}`}>
            {userRole === 'gm' ? <Shield size={20} /> : userRole === 'player' ? <User size={20} /> : <Eye size={20} />}
          </div>
          <div className="flex flex-col">
            <h1 className="text-base font-black tracking-tight text-white leading-none mb-1">D&D Vision</h1>
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{String(activeCharacter?.name || activeCharacter?.username || 'Игрок')} ({userRole})</span>
          </div>
        </div>
        <button onClick={() => setIsLeftSidebarOpen(false)} className="p-2 bg-neutral-800/50 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
      </div>

      {userRole === 'gm' && (
         <div className="p-4 border-b border-neutral-800/50 shrink-0">
            <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2 mb-3"><User size={14}/> Ваши виджеты</h2>
            <div className="grid grid-cols-4 gap-2">
               <button onClick={() => { setShowStatsWidget(!showStatsWidget); setShowInvWidget(false); setShowAbilWidget(false); setShowAtkWidget(false); }} className={`p-2.5 rounded-xl flex justify-center items-center transition-all ${showStatsWidget ? 'bg-blue-600 text-white shadow-md' : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Характеристики"><ScrollText size={18} /></button>
               <button onClick={() => { setShowInvWidget(!showInvWidget); setShowStatsWidget(false); setShowAbilWidget(false); setShowAtkWidget(false); }} className={`p-2.5 rounded-xl flex justify-center items-center transition-all ${showInvWidget ? 'bg-amber-600 text-white shadow-md' : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Инвентарь"><Backpack size={18} /></button>
               <button onClick={() => { setShowAbilWidget(!showAbilWidget); setShowStatsWidget(false); setShowInvWidget(false); setShowAtkWidget(false); }} className={`p-2.5 rounded-xl flex justify-center items-center transition-all ${showAbilWidget ? 'bg-purple-600 text-white shadow-md' : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Способности"><Sparkles size={18} /></button>
               <button onClick={() => { setShowAtkWidget(!showAtkWidget); setShowStatsWidget(false); setShowInvWidget(false); setShowAbilWidget(false); }} className={`p-2.5 rounded-xl flex justify-center items-center transition-all ${showAtkWidget ? 'bg-red-600 text-white shadow-md' : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Атаки"><Swords size={18} /></button>
               <button onClick={() => { setShowNotesWidget(!showNotesWidget); setShowStatsWidget(false); setShowInvWidget(false); setShowAbilWidget(false); setShowAtkWidget(false); }} className={`p-2.5 rounded-xl flex justify-center items-center transition-all ${showNotesWidget ? 'bg-green-600 text-white shadow-md' : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Заметки"><BookOpen size={18} /></button>
            </div>
         </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24">
        
        {userRole === 'gm' && (
           <AccordionSection id="map" icon={Layers} title="Карта и Сцены" activePanel={activePanel} setActivePanel={setActivePanel}>
              <div className="flex flex-col gap-2 bg-neutral-950/50 p-3 rounded-2xl border border-neutral-800">
                 <button onClick={saveScene} disabled={!sessionData?.mapConfig} className="w-full py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-bold uppercase transition-colors flex items-center justify-center gap-2 border border-indigo-500/30 disabled:opacity-50"><Save size={14}/> Сохранить текущую</button>
                 <div className="mt-2 flex flex-col gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                    {sessionScenes.length === 0 ? <div className="text-[10px] text-center text-neutral-600 uppercase font-bold py-2">Сцен нет</div> : sessionScenes.map(scene => (
                          <div key={scene.id} className="flex justify-between items-center bg-neutral-900 p-2 rounded-lg border border-neutral-700">
                             <span className="text-xs font-bold text-neutral-200 truncate w-32" title={scene.name}>{String(scene.name)}</span>
                             <div className="flex gap-1">
                                <button onClick={() => loadScene(scene)} className="p-1.5 bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white rounded-md transition-colors"><Play size={14}/></button>
                                <button onClick={() => deleteScene(scene.id)} className="p-1.5 bg-red-900/30 text-red-500 hover:bg-red-600 hover:text-white rounded-md transition-colors"><Trash2 size={14}/></button>
                             </div>
                          </div>
                    ))}
                 </div>
              </div>

              <label className="flex items-center justify-center gap-2 w-full bg-neutral-950/50 hover:bg-neutral-800 border-2 border-neutral-800 border-dashed rounded-2xl p-4 cursor-pointer transition-colors text-sm font-bold text-neutral-400 hover:text-white">
                <Upload size={18} className="text-amber-500" /> <span>{sessionData?.mapConfig ? 'Сменить карту' : 'Загрузить карту'}</span>
                <input type="file" accept="image/*,.dd2vtt" onChange={handleImageUpload} className="hidden" />
              </label>

              <div className="bg-neutral-950/50 p-3 rounded-2xl border border-neutral-800 flex flex-col gap-3">
                 <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-300 flex items-center gap-2"><Grid3X3 size={18}/> Сетка карты</span>
                    <button onClick={() => updateSession({ gridConfig: { ...gridConfig, enabled: !gridConfig.enabled,size: gridConfig.size || 70, color: gridConfig.color || '#ffffff' } })} className={`w-10 h-5 rounded-full relative transition-colors ${gridConfig.enabled ? 'bg-amber-500' : 'bg-neutral-700'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${gridConfig.enabled ? 'left-5' : 'left-0.5'}`} /></button>
                 </div>
                 {gridConfig.enabled && (
                    <div className="flex flex-col gap-3 pt-3 border-t border-neutral-800/50">
                       <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-neutral-500 uppercase w-16">Размер</span><input type="range" min="20" max="200" value={gridConfig.size} onChange={(e) => updateSession({ 'gridConfig.size': Number(e.target.value) })} className="flex-1 accent-amber-500 h-1" /></div>
                       <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-neutral-500 uppercase w-16">Сдвиг X</span><input type="range" min="-100" max="100" value={gridConfig.offsetX} onChange={(e) => updateSession({ 'gridConfig.offsetX': Number(e.target.value) })} className="flex-1 accent-amber-500 h-1" /></div>
                       <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-neutral-500 uppercase w-16">Сдвиг Y</span><input type="range" min="-100" max="100" value={gridConfig.offsetY} onChange={(e) => updateSession({ 'gridConfig.offsetY': Number(e.target.value) })} className="flex-1 accent-amber-500 h-1" /></div>
                       {/* ДОБАВЛЕН ПОЛЗУНОК ЯРКОСТИ (ПРОЗРАЧНОСТИ) */}
                       <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-neutral-500 uppercase w-16">Яркость</span><input type="range" min="0.1" max="1" step="0.1" value={gridConfig.opacity !== undefined ? gridConfig.opacity : 0.3} onChange={(e) => updateSession({ 'gridConfig.opacity': Number(e.target.value) })} className="flex-1 accent-amber-500 h-1" /></div>
                       <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-neutral-500 uppercase w-16">Цвет</span><input type="color" value={gridConfig.color?.startsWith('#') ? gridConfig.color : '#ffffff'} onChange={(e) => updateSession({ 'gridConfig.color': e.target.value })} className="w-full h-6 rounded border-0 bg-transparent p-0" /></div>
                    </div>
                 )}
              </div>
              
              <div className="bg-neutral-950/50 p-2 rounded-2xl border border-neutral-800 flex flex-col gap-1">
                <button onClick={() => updateSession({ fogEnabled: !isFogEnabled })} className={`flex items-center justify-between p-3 rounded-xl font-bold text-sm ${isFogEnabled ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:bg-neutral-900'}`}>
                  <span className="flex items-center gap-3"><EyeOff size={18}/> Туман Войны</span>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${isFogEnabled ? 'bg-amber-500' : 'bg-neutral-700'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isFogEnabled ? 'left-5' : 'left-0.5'}`} /></div>
                </button>
                <button onClick={() => setGmMode(!gmMode)} disabled={!isFogEnabled} className={`flex items-center justify-between p-3 rounded-xl font-bold text-sm ${!isFogEnabled ? 'opacity-50' : gmMode ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:bg-neutral-900'}`}>
                  <span className="flex items-center gap-3"><Settings size={18}/> Прозрение Мастера</span>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${gmMode ? 'bg-indigo-500' : 'bg-neutral-700'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${gmMode ? 'left-5' : 'left-0.5'}`} /></div>
                </button>
              </div>

              <button onClick={() => setIsShareModalOpen(true)} className="w-full py-3 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 border border-indigo-500/30">
                 <FileText size={16}/> Раздаточный материал
              </button>
           </AccordionSection>
        )}

        {userRole === 'gm' && (
           <AccordionSection id="env" icon={Sun} title="Окружение и Музыка" activePanel={activePanel} setActivePanel={setActivePanel}>
              <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800 mb-4">
               <button 
                  onClick={() => updateSession({ lighting: 'morning' })} 
                  className={`flex justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${sessionData.lighting === 'morning' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-inner' : 'text-neutral-500 hover:text-white'}`}
               >
                  <Sun size={12}/> Утро
               </button>

               <button 
                  onClick={() => updateSession({ lighting: 'day' })} 
                  className={`flex justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${(!sessionData.lighting || sessionData.lighting === 'day') ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-inner' : 'text-neutral-500 hover:text-white'}`}
               >
                  День
               </button>

               <button 
                  onClick={() => updateSession({ lighting: 'sunset' })} 
                  className={`flex justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${sessionData.lighting === 'sunset' ? 'bg-orange-600/20 text-orange-500 border border-orange-600/30 shadow-inner' : 'text-neutral-500 hover:text-white'}`}
               >
                  Закат
               </button>

               <button 
                  onClick={() => updateSession({ lighting: 'night' })} 
                  className={`flex justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${sessionData.lighting === 'night' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 shadow-inner' : 'text-neutral-500 hover:text-white'}`}
               >
                  <Moon size={12}/> Ночь
               </button>
               </div>

              <div className="grid grid-cols-5 gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 mb-4">
                 <button onClick={() => updateSession({ weather: 'none' })} className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9px] font-black uppercase transition-all ${!sessionData.weather || sessionData.weather === 'none' ? 'bg-neutral-800 text-white shadow-inner' : 'text-neutral-500 hover:text-white'}`}>
                    <Wind size={14} className="mb-1"/> Нет
                 </button>
                 <button onClick={() => updateSession({ weather: 'rain' })} className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9px] font-black uppercase transition-all ${sessionData.weather === 'rain' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-inner' : 'text-neutral-500 hover:text-white'}`}>
                    <CloudRain size={14} className="mb-1"/> Дождь
                 </button>
                 <button onClick={() => updateSession({ weather: 'snow' })} className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9px] font-black uppercase transition-all ${sessionData.weather === 'snow' ? 'bg-white/20 text-white border border-white/30 shadow-inner' : 'text-neutral-500 hover:text-white'}`}>
                    <Snowflake size={14} className="mb-1"/> Снег
                 </button>
                 <button onClick={() => updateSession({ weather: 'fog' })} className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9px] font-black uppercase transition-all ${sessionData.weather === 'fog' ? 'bg-neutral-600/40 text-neutral-300 border border-neutral-500/30 shadow-inner' : 'text-neutral-500 hover:text-white'}`}>
                    <Cloud size={14} className="mb-1"/> Туман
                 </button>
                 <button onClick={() => updateSession({ weather: 'leaves' })} className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9px] font-black uppercase transition-all ${sessionData.weather === 'leaves' ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30 shadow-inner' : 'text-neutral-500 hover:text-white'}`}>
                    <Leaf size={14} className="mb-1"/> Листва
                 </button>
              </div>

              <div className="flex gap-2 mb-2">
                 <input type="text" placeholder="YouTube URL..." value={localVideoUrl} onChange={e => setLocalVideoUrl(e.target.value)} className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-red-500" />
                 <button onClick={() => { const id = extractYTId(localVideoUrl); if (id) updateSession({ 'bgMusic.videoId': id, 'bgMusic.isPlaying': true }); else alert('Неверная ссылка!'); }} className="bg-red-600 hover:bg-red-500 text-white px-3 rounded-xl transition-all"><Play size={14}/></button>
              </div>
              {sessionData.bgMusic?.videoId && (
                 <button onClick={() => updateSession({ 'bgMusic.isPlaying': !sessionData.bgMusic.isPlaying })} className={`w-full py-2 mb-2 rounded-xl text-xs font-black uppercase transition-colors border ${sessionData.bgMusic.isPlaying ? 'bg-neutral-800 border-neutral-700 text-neutral-400' : 'bg-red-600/20 border-red-500/30 text-red-500'}`}>
                   {sessionData.bgMusic.isPlaying ? 'Остановить' : 'Возобновить'}
                 </button>
              )}
           </AccordionSection>
        )}

        {sessionData.bgMusic?.videoId && sessionData.bgMusic?.isPlaying && (
           <div className="px-4 pb-4 mt-4">
              <div className="w-full aspect-video rounded-xl overflow-hidden bg-black border border-neutral-800 relative mb-2">
                 <iframe ref={ytPlayerRef} onLoad={handleIframeLoad} width="100%" height="100%" src={`https://www.youtube.com/embed/${sessionData.bgMusic.videoId}?autoplay=1&loop=1&playlist=${sessionData.bgMusic.videoId}&controls=1`} frameBorder="0" allow="autoplay; encrypted-media"></iframe>
              </div>
              <div className="flex items-center gap-3 bg-neutral-950 p-2 rounded-xl border border-neutral-800">
                 <Music size={14} className={localVolume > 0 ? 'text-red-400' : 'text-neutral-600'} />
                 <input type="range" min="0" max="100" value={localVolume} onChange={handleVolumeChange} className="flex-1 accent-red-500 h-1.5" />
                 <span className="text-[10px] font-black text-white w-6 text-right">{localVolume}%</span>
              </div>
           </div>
        )}
         
        {userRole !== 'gm' && (
           <AccordionSection id="settings" icon={Settings} title="Локальные настройки" activePanel={activePanel} setActivePanel={setActivePanel}>
              <div className="bg-neutral-950/50 p-2 rounded-2xl border border-neutral-800 flex flex-col gap-1">
                 <button onClick={() => setHideLocalGrid(!hideLocalGrid)} className={`flex items-center justify-between p-3 rounded-xl font-bold text-sm ${!hideLocalGrid ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:bg-neutral-900'}`}>
                   <span className="flex items-center gap-3"><Grid3X3 size={18}/> Показывать сетку</span>
                   <div className={`w-10 h-5 rounded-full relative transition-colors ${!hideLocalGrid ? 'bg-indigo-500' : 'bg-neutral-700'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${!hideLocalGrid ? 'left-5' : 'left-0.5'}`} /></div>
                 </button>

                 <button onClick={() => setIsPotatoMode(!isPotatoMode)} className={`flex items-center justify-between p-3 rounded-xl font-bold text-sm transition-colors ${!isPotatoMode ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:bg-neutral-900'}`}>
                   <span className="flex items-center gap-3">
                      <Zap size={18} className={isPotatoMode ? 'text-amber-500' : ''}/> 
                      Оптимизация (Слабый ПК)
                   </span>
                   <div className={`w-10 h-5 rounded-full relative transition-colors ${!isPotatoMode ? 'bg-neutral-700' : 'bg-amber-500'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${!isPotatoMode ? 'left-0.5' : 'left-5'}`} />
                   </div>
                 </button>

                 <button onClick={toggleFullscreen} className="flex items-center justify-between p-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-sm transition-colors">
                   <span className="flex items-center gap-3">
                      {isFullscreen ? <Minimize size={18} className="text-blue-400" /> : <Maximize size={18} />} 
                      {isFullscreen ? 'Оконный режим' : 'На весь экран'}
                   </span>
                 </button>
               
                 <button onClick={() => {
                     const newValue = !enable3DDice;
                     setEnable3DDice(newValue);
                     localStorage.setItem('disable3D', !newValue); 
                 }} className={`flex items-center justify-between p-3 rounded-xl font-bold text-sm transition-colors ${enable3DDice ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:bg-neutral-900'}`}>
                   <span className="flex items-center gap-3"><Dices size={18} className={enable3DDice ? 'text-indigo-400' : ''}/> 3D Кубики</span>
                   <div className={`w-10 h-5 rounded-full relative transition-colors ${enable3DDice ? 'bg-indigo-500' : 'bg-neutral-700'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enable3DDice ? 'left-5' : 'left-0.5'}`} />
                   </div>
                 </button>

                 <button onClick={() => setIsChatMuted(!isChatMuted)} className={`flex items-center justify-between p-3 rounded-xl font-bold text-sm transition-colors ${!isChatMuted ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:bg-neutral-900'}`}>
                   <span className="flex items-center gap-3"><VolumeX size={18}/> Звук чата</span>
                   <div className={`w-10 h-5 rounded-full relative transition-colors ${!isChatMuted ? 'bg-indigo-500' : 'bg-neutral-700'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${!isChatMuted ? 'left-5' : 'left-0.5'}`} />
                   </div>
                 </button>
              </div>
           </AccordionSection>
        )}

        <AccordionSection id="creatures" icon={Skull} title="Существа и Бой" count={visibleTokens.length} activePanel={activePanel} setActivePanel={setActivePanel}>
          {userRole === 'gm' && (
             <div className="bg-neutral-950/50 rounded-2xl border border-neutral-800 shadow-inner overflow-hidden flex flex-col mb-4">
                <div className="flex border-b border-neutral-800">
                   <button onClick={() => setTokenTab('new')} className={`flex-1 py-3 text-[10px] font-black uppercase transition-colors ${tokenTab === 'new' ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Создать</button>
                   <button onClick={() => setTokenTab('bestiary')} className={`flex-1 py-3 text-[10px] font-black uppercase transition-colors ${tokenTab === 'bestiary' ? 'bg-neutral-900 text-amber-400' : 'text-neutral-500 hover:text-neutral-300'}`}>Бестиарий ({bestiary.length})</button>
                </div>

                <div className="p-4">
                   {tokenTab === 'new' ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                           <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1">Импорт из базы API</span>
                           <form onSubmit={handleApiImport} className="flex gap-2 p-1.5 bg-indigo-900/10 border border-indigo-500/20 rounded-xl">
                              <input type="text" value={apiSearch} onChange={e => setApiSearch(e.target.value)} placeholder="Напр. Goblin..." className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500" />
                              <button type="submit" disabled={isImporting || !apiSearch.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center min-w-[40px]">
                                 {isImporting ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}
                              </button>
                           </form>
                        </div>

                        <div className="relative border-t border-neutral-800 pt-4 mt-2">
                           <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-neutral-950 px-2 text-[8px] font-black text-neutral-700 uppercase">Или вручную</span>
                        </div>

                        <form onSubmit={handleCustomCreate} className="space-y-4">
                          <div className="space-y-3">
                             <input type="text" required value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} placeholder="Имя существа..." className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-indigo-500" />
                             <div className="flex gap-2">
                                <input type="number" required min="1" value={newTokenHp} onChange={(e) => setNewTokenHp(e.target.value)} placeholder="HP" className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-sm font-black text-center text-white hide-arrows outline-none focus:border-red-500" />
                                <div className="relative flex-1">
                                   <Shield size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500" />
                                   <input type="number" required min="1" value={newTokenAc} onChange={(e) => setNewTokenAc(e.target.value)} placeholder="КД (AC)" className="w-full pl-8 pr-2 bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-sm font-black text-center text-white hide-arrows outline-none focus:border-amber-500" />
                                </div>
                             </div>
                          </div>

                          <div className="bg-neutral-900 p-2 rounded-xl border border-neutral-800">
                             <span className="block text-[9px] font-black text-neutral-500 uppercase text-center mb-2 tracking-widest">Плюсы к броскам (Лимит [-5; 5])</span>
                             <div className="grid grid-cols-3 gap-2">
                                {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(stat => (
                                   <div key={stat} className="flex flex-col items-center bg-neutral-950 border border-neutral-800 rounded-lg p-1.5">
                                      <span className="text-[10px] text-neutral-400 font-black mb-1">{STAT_LABELS[stat]}</span>
                                      <div className="flex items-center gap-1.5">
                                         <button type="button" onClick={() => setCustomStats({...customStats, [stat]: Math.max(-5, customStats[stat] - 1)})} className="w-5 h-5 bg-neutral-800 hover:bg-red-900/50 text-white rounded flex items-center justify-center text-xs font-black transition-colors">-</button>
                                         <span className="text-xs font-black text-white w-4 text-center">{customStats[stat] > 0 ? `+${customStats[stat]}` : customStats[stat]}</span>
                                         <button type="button" onClick={() => setCustomStats({...customStats, [stat]: Math.min(5, customStats[stat] + 1)})} className="w-5 h-5 bg-neutral-800 hover:bg-green-900/50 text-white rounded flex items-center justify-center text-xs font-black transition-colors">+</button>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>

                          <div className="bg-neutral-900 p-2 rounded-xl border border-neutral-800">
                             <div className="flex justify-between items-center mb-2 px-1">
                                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Атаки</span>
                                <button type="button" onClick={() => setCustomAttacks([...customAttacks, { id: generateId(), name: 'Новая атака', attackBonus: 0, damageDice: '1d6', damageBonus: 0 }])} className="text-[9px] text-red-400 bg-red-900/20 px-2 py-0.5 rounded uppercase font-bold hover:bg-red-900/40 transition-colors">+ Добавить</button>
                             </div>
                             <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                                {customAttacks.length === 0 ? <div className="text-center text-[10px] text-neutral-600 py-2 italic">Нет атак</div> : customAttacks.map((atk, i) => (
                                   <div key={atk.id} className="flex flex-col gap-1.5 bg-neutral-950 p-2 rounded-lg border border-neutral-800 relative">
                                      <button type="button" onClick={() => setCustomAttacks(customAttacks.filter(a => a.id !== atk.id))} className="absolute top-1 right-1 text-neutral-600 hover:text-red-500 transition-colors"><CloseIcon size={12}/></button>
                                      <input type="text" value={atk.name} onChange={e => { const arr = [...customAttacks]; arr[i].name = e.target.value; setCustomAttacks(arr); }} className="w-[calc(100%-20px)] bg-transparent text-xs font-bold text-white outline-none border-b border-neutral-800 focus:border-red-500 pb-0.5" placeholder="Название (напр. Укус)" />
                                      <div className="flex gap-1 items-center mt-1">
                                         <span className="text-[8px] text-neutral-500 font-bold">АТК</span>
                                         <input type="number" placeholder="+Бонус" value={atk.attackBonus} onChange={e => { const arr = [...customAttacks]; arr[i].attackBonus = Number(e.target.value); setCustomAttacks(arr); }} className="w-10 bg-neutral-900 border border-neutral-700 rounded text-center text-[10px] text-white hide-arrows py-0.5 outline-none" />
                                         <span className="text-[8px] text-neutral-500 ml-1 font-bold">УРОН</span>
                                         <input type="text" placeholder="1d6" value={atk.damageDice} onChange={e => { const arr = [...customAttacks]; arr[i].damageDice = e.target.value; setCustomAttacks(arr); }} className="w-10 bg-neutral-900 border border-neutral-700 rounded text-center text-[10px] text-white outline-none py-0.5" />
                                         <span className="text-[10px] text-neutral-500 font-bold">+</span>
                                         <input type="number" placeholder="Бонус" value={atk.damageBonus} onChange={e => { const arr = [...customAttacks]; arr[i].damageBonus = Number(e.target.value); setCustomAttacks(arr); }} className="w-10 bg-neutral-900 border border-neutral-700 rounded text-center text-[10px] text-white hide-arrows py-0.5 outline-none" />
                                      </div>
                                   </div>
                                ))}
                             </div>
                          </div>

                          <div className="bg-neutral-900 p-2 rounded-xl border border-neutral-800">
                             <div className="flex justify-between items-center mb-2 px-1">
                                <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Способности</span>
                                <button type="button" onClick={() => setCustomAbilities([...customAbilities, { id: generateId(), name: 'Новая способность', description: '', dmgCount: 0, dmgSides: 6, damageBonus: 0, effectType: 'none', effectDuration: 1, tickCount: 0, tickSides: 4, hasSave: false, saveStat: 'dex', saveDC: 12, noDamage: false }])} className="text-[9px] text-purple-400 bg-purple-900/20 px-2 py-0.5 rounded uppercase font-bold hover:bg-purple-900/40 transition-colors">+ Добавить</button>
                             </div>
                             <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                                {customAbilities.length === 0 ? <div className="text-center text-[10px] text-neutral-600 py-2 italic">Нет способностей</div> : customAbilities.map((abil, i) => (
                                   <div key={abil.id} className="flex flex-col gap-1.5 bg-neutral-950 p-2 rounded-lg border border-neutral-800 relative">
                                      <button type="button" onClick={() => setCustomAbilities(customAbilities.filter(a => a.id !== abil.id))} className="absolute top-1 right-1 text-neutral-600 hover:text-red-500 transition-colors z-10"><CloseIcon size={12}/></button>
                                      
                                      <input type="text" value={abil.name} onChange={e => { const arr = [...customAbilities]; arr[i].name = e.target.value; setCustomAbilities(arr); }} className="w-[calc(100%-20px)] bg-transparent text-xs font-bold text-purple-400 outline-none border-b border-neutral-800 focus:border-purple-500 pb-0.5" placeholder="Название (напр. Огненное дыхание)" />
                                      <textarea value={abil.description} onChange={e => { const arr = [...customAbilities]; arr[i].description = e.target.value; setCustomAbilities(arr); }} className="w-full bg-neutral-900 border border-neutral-800 rounded p-1.5 text-[10px] text-white outline-none focus:border-purple-500 min-h-[40px] custom-scrollbar" placeholder="Описание способности..." />
                                      
                                      <div className="bg-neutral-900 p-2 rounded border border-neutral-800 mt-1">
                                         <span className="block text-[8px] font-black text-neutral-500 uppercase mb-1.5">Урон и Спасбросок</span>
                                         
                                         <label className="flex items-center gap-1.5 mb-2 cursor-pointer">
                                            <input type="checkbox" checked={abil.noDamage || false} onChange={e => { const arr = [...customAbilities]; arr[i].noDamage = e.target.checked; setCustomAbilities(arr); }} className="w-3 h-3 accent-red-500 cursor-pointer" />
                                            <span className="text-[9px] font-bold text-neutral-400 uppercase">Без урона (Только эффект)</span>
                                          </label>

                                          {!abil.noDamage && (
                                             <div className="flex items-center gap-1 mb-2">
                                                <input type="number" min="0" value={abil.dmgCount} onChange={e => { const arr = [...customAbilities]; arr[i].dmgCount = Number(e.target.value); setCustomAbilities(arr); }} className="w-8 bg-neutral-950 border border-neutral-700 rounded py-0.5 text-center text-[10px] font-bold text-white hide-arrows outline-none focus:border-purple-500" placeholder="Шт" />
                                                <span className="text-neutral-500 font-bold text-[10px]">d</span>
                                                <select value={abil.dmgSides} onChange={e => { const arr = [...customAbilities]; arr[i].dmgSides = Number(e.target.value); setCustomAbilities(arr); }} className="bg-neutral-950 border border-neutral-700 rounded py-0.5 px-1 text-[10px] font-bold text-white outline-none focus:border-purple-500">
                                                   <option value="4">4</option><option value="6">6</option><option value="8">8</option><option value="10">10</option><option value="12">12</option><option value="20">20</option><option value="100">100</option>
                                                </select>
                                                <span className="text-neutral-500 font-bold text-[10px]">+</span>
                                                <input type="number" value={abil.damageBonus} onChange={e => { const arr = [...customAbilities]; arr[i].damageBonus = Number(e.target.value); setCustomAbilities(arr); }} className="w-10 bg-neutral-950 border border-neutral-700 rounded py-0.5 text-center text-[10px] font-bold text-white hide-arrows outline-none focus:border-purple-500" placeholder="Мод." />
                                             </div>
                                          )}

                                          <div className="border-t border-neutral-800 pt-1.5 mt-2">
                                             <label className="flex items-center gap-1.5 mb-1.5 cursor-pointer">
                                                <input type="checkbox" checked={abil.hasSave || false} onChange={e => { const arr = [...customAbilities]; arr[i].hasSave = e.target.checked; setCustomAbilities(arr); }} className="w-3 h-3 accent-purple-500 cursor-pointer" />
                                                <span className="text-[9px] font-bold text-neutral-400 uppercase">Требует Спасбросок</span>
                                             </label>

                                             {abil.hasSave && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                   <span className="text-[9px] font-bold text-neutral-500 uppercase">Спас:</span>
                                                   <select value={abil.saveStat || 'dex'} onChange={e => { const arr = [...customAbilities]; arr[i].saveStat = e.target.value; setCustomAbilities(arr); }} className="bg-neutral-950 border border-neutral-700 rounded py-0.5 px-1 text-[9px] font-bold text-white uppercase outline-none focus:border-purple-500">
                                                      <option value="str">СИЛ</option><option value="dex">ЛОВ</option><option value="con">ВЫН</option><option value="int">ИНТ</option><option value="wis">МУД</option><option value="cha">ХАР</option>
                                                   </select>
                                                   <span className="text-[9px] font-bold text-neutral-500 uppercase ml-1">СЛ:</span>
                                                   <input type="number" min="1" max="30" value={abil.saveDC || 12} onChange={e => { const arr = [...customAbilities]; arr[i].saveDC = Number(e.target.value); setCustomAbilities(arr); }} className="w-8 bg-neutral-950 border border-neutral-700 rounded py-0.5 text-center text-[10px] font-bold text-white hide-arrows outline-none focus:border-purple-500" />
                                                </div>
                                             )}
                                          </div>
                                      </div>

                                      <div className="bg-neutral-900 p-2 rounded border border-neutral-800 mt-1">
                                          <span className="block text-[8px] font-black text-neutral-500 uppercase mb-1.5">Эффект / Статус</span>
                                          <select value={abil.effectType} onChange={e => { const arr = [...customAbilities]; arr[i].effectType = e.target.value; setCustomAbilities(arr); }} className="w-full bg-neutral-950 border border-neutral-700 rounded py-1 px-2 text-[9px] font-bold text-white mb-1.5 outline-none focus:border-purple-500 custom-scrollbar">
                                             <option value="none">Нет (Только урон)</option>
                                             <option value="heal">Лечение (HP)</option>
                                             <option value="shield">Щит (Врем. HP)</option>
                                             <option value="bleed">Кровотечение (Урон)</option>
                                             <option disabled>─── Статусы ───</option>
                                             <option value="blinded">Ослеплен</option>
                                             <option value="charmed">Очарован</option>
                                             <option value="deafened">Оглохший</option>
                                             <option value="frightened">Испуган</option>
                                             <option value="grappled">Схвачен</option>
                                             <option value="incapacitated">Недееспособен</option>
                                             <option value="invisible">Невидимый</option>
                                             <option value="paralyzed">Парализован</option>
                                             <option value="petrified">Окаменевший</option>
                                             <option value="poisoned">Отравлен</option>
                                             <option value="prone">Сбит с ног</option>
                                             <option value="restrained">Опутан</option>
                                             <option value="stunned">Оглушен</option>
                                             <option value="unconscious">Без сознания</option>
                                             <option value="onFire">Горит</option>
                                             <option value="blessed">Благословен</option>
                                          </select>
                                          
                                          {abil.effectType !== 'none' && abil.effectType !== 'heal' && abil.effectType !== 'shield' && (
                                             <div className="flex items-center gap-1 mt-1">
                                                <span className="text-[8px] text-neutral-500 font-bold">Длит.</span>
                                                <input type="number" min="1" value={abil.effectDuration} onChange={e => { const arr = [...customAbilities]; arr[i].effectDuration = Number(e.target.value); setCustomAbilities(arr); }} className="w-8 bg-neutral-950 border border-neutral-700 rounded py-0.5 text-center text-[9px] font-bold text-white hide-arrows outline-none focus:border-purple-500" />
                                                <span className="text-[8px] text-neutral-500 font-bold ml-1">Урон</span>
                                                <input type="number" min="0" value={abil.tickCount} onChange={e => { const arr = [...customAbilities]; arr[i].tickCount = Number(e.target.value); setCustomAbilities(arr); }} className="w-6 bg-neutral-950 border border-neutral-700 rounded py-0.5 text-center text-[9px] font-bold text-white hide-arrows outline-none focus:border-purple-500" />
                                                <span className="text-[8px] text-neutral-500 font-bold">d</span>
                                                <select value={abil.tickSides} onChange={e => { const arr = [...customAbilities]; arr[i].tickSides = Number(e.target.value); setCustomAbilities(arr); }} className="bg-neutral-950 border border-neutral-700 rounded py-0.5 px-0.5 text-[9px] font-bold text-white outline-none focus:border-purple-500">
                                                   <option value="4">4</option><option value="6">6</option><option value="8">8</option><option value="10">10</option><option value="12">12</option><option value="20">20</option>
                                                </select>
                                             </div>
                                          )}
                                      </div>

                                   </div>
                                ))}
                             </div>
                          </div>

                          <div className="bg-neutral-900 p-2 rounded-xl border border-neutral-800">
                             <span className="block text-[9px] font-black text-neutral-500 uppercase tracking-widest px-1 mb-2">Лут и Инвентарь</span>
                             <textarea placeholder="Что упадет с этого монстра..." value={customInventory} onChange={e => setCustomInventory(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white outline-none focus:border-amber-500 min-h-[50px] custom-scrollbar" />
                          </div>

                          <div className="flex gap-2 p-1 bg-neutral-900 rounded-xl border border-neutral-800 items-center">
                            <button type="button" onClick={() => { setNewTokenType('player'); setNewTokenColor('#3b82f6'); }} className={`flex-1 py-2 px-1 rounded-lg text-[10px] font-black uppercase flex justify-center gap-1.5 ${newTokenType === 'player' ? 'bg-blue-600 text-white' : 'text-neutral-500'}`}><User size={14} /> НПЦ</button>
                            <button type="button" onClick={() => { setNewTokenType('monster'); setNewTokenColor('#ef4444'); }} className={`flex-1 py-2 px-1 rounded-lg text-[10px] font-black uppercase flex justify-center gap-1.5 ${newTokenType === 'monster' ? 'bg-red-600 text-white' : 'text-neutral-500'}`}><Skull size={14} /> Враг</button>
                            
                            <button type="button" onClick={() => { setNewTokenType('light'); setNewTokenColor('#f59e0b'); }} className={`flex-1 py-2 px-1 rounded-lg text-[10px] font-black uppercase flex justify-center gap-1.5 ${newTokenType === 'light' ? 'bg-amber-500 text-white' : 'text-neutral-500'}`}><Sun size={14} /> Свет</button>
                            
                            <input type="color" value={newTokenColor} onChange={(e) => setNewTokenColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent p-0 mx-1 shrink-0" title="Цвет токена/света" />
                          </div>

                          <div className="flex gap-2 items-center">
                             <div className="relative flex-1">
                                <Link size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500" />
                                <input type="text" value={newTokenImage} onChange={(e) => setNewTokenImage(e.target.value)} placeholder="URL картинки..." className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white outline-none focus:border-indigo-500" />
                             </div>
                             <label className="bg-neutral-900 border border-neutral-800 p-2.5 rounded-xl text-neutral-400 hover:text-white cursor-pointer transition-colors" title="Загрузить картинку">
                                <Upload size={16} />
                                <input type="file" accept="image/*" onChange={handleTokenImageUpload} className="hidden" />
                             </label>
                          </div>

                          <div className="flex items-center justify-between bg-neutral-900 p-2.5 rounded-xl border border-neutral-800">
                             <span className="text-xs font-bold text-neutral-400 flex items-center gap-2"><EyeOff size={14}/> Скрытый токен</span>
                             <button type="button" onClick={() => setNewTokenHidden(!newTokenHidden)} className={`w-10 h-5 rounded-full relative transition-colors ${newTokenHidden ? 'bg-indigo-500' : 'bg-neutral-700'}`}><div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${newTokenHidden ? 'left-5' : 'left-0.5'}`} /></button>
                          </div>

                          <div className="pt-2 border-t border-neutral-800/50">
                            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 flex justify-between"><span>Зрение</span><span className="text-amber-500">{newTokenVision} px</span></label>
                            <input type="range" min="0" max="1000" step="50" value={newTokenVision} onChange={(e) => setNewTokenVision(e.target.value)} className="w-full accent-amber-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer" />
                          </div>

                          <div className="flex gap-2 pt-2">
                             <button type="submit" disabled={!sessionData.mapConfig} className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white font-black uppercase rounded-xl flex justify-center items-center gap-2 text-[10px] transition-colors"><Plus size={16} /> На карту</button>
                             <button type="button" onClick={handleSaveToBestiary} className="py-3 px-4 bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white rounded-xl transition-colors flex justify-center items-center border border-amber-500/30" title="Сохранить в Бестиарий"><Save size={16} /></button>
                          </div>
                        </form>
                      </div>
                   ) : (
                      <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                         {bestiary.length === 0 ? <div className="text-xs text-neutral-500 text-center py-4">Бестиарий пуст.</div> : bestiary.map(preset => (
                               <div key={preset.id} className="flex items-center justify-between bg-neutral-900 p-2.5 rounded-xl border border-neutral-800 group hover:border-amber-500/50 transition-colors">
                                  <button onClick={() => addTokenFromPreset(preset)} className="flex items-center gap-3 flex-1 text-left">
                                     {preset.image ? <img src={preset.image} className="w-10 h-10 rounded-full object-cover border-2 shrink-0" style={{borderColor: preset.color}} /> : <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 bg-neutral-800 shrink-0" style={{borderColor: preset.color}}><Skull size={16} className="text-neutral-500" /></div>}
                                     <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white truncate w-24">{preset.name}</span>
                                        <span className="text-[10px] font-black text-neutral-500 mt-0.5">HP {preset.hp} | AC {preset.ac}</span>
                                     </div>
                                  </button>
                                  <button onClick={() => setBestiary(bestiary.filter(b => b.id !== preset.id))} className="p-2 text-neutral-600 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                               </div>
                            ))
                         }
                      </div>
                   )}
                </div>
             </div>
          )}

          {userRole === 'gm' && (
             <div className="mb-4">
                {sessionData.combatState?.isActive ? (
                   <button type="button" onClick={endCombat} className="w-full py-3 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-xl font-bold border border-red-900/50 transition-colors">Завершить бой</button>
                ) : (
                   <button type="button" onClick={startCombat} className="w-full py-3 bg-amber-600/20 text-amber-500 hover:bg-amber-600/40 rounded-xl font-bold border border-amber-500/30 transition-colors shadow-[0_0_15px_rgba(245,158,11,0.1)]">Бросить Инициативу (✔)</button>
                )}
             </div>
          )}

          <div className="space-y-2">
            {visibleTokens.length === 0 ? (
              <div className="text-sm text-center text-neutral-600 py-8 border-2 border-dashed border-neutral-800 rounded-2xl">Карта пуста</div>
            ) : (
              visibleTokens.map(t => {
                const isMine = t.id === myTokenId;
                const isSelected = t.id === selectedTokenId;
                const isDead = (t.hp || 0) <= 0;
                const safeName = t.name && t.name !== 'undefined' ? String(t.name) : 'Сломанный Токен';
                
                return (
                  <div key={t.id} onClick={(e) => handleTokenPointerDown(e, t.id)} className={`flex flex-col bg-neutral-950/50 p-3 rounded-2xl border transition-all cursor-pointer group ${isSelected ? 'border-amber-500 bg-neutral-900 scale-[1.02]' : isMine ? 'border-indigo-500/50 hover:border-indigo-500' : 'border-neutral-800 hover:border-neutral-600'}`}>
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-3 overflow-hidden ${isDead ? 'grayscale opacity-50' : ''} ${t.isHidden ? 'opacity-60' : ''}`}>
                        {userRole === 'gm' && !sessionData.combatState?.isActive && (
                           <input type="checkbox" checked={combatSelection.includes(t.id)} onChange={() => toggleCombatSelection(t.id)} onClick={e => e.stopPropagation()} className="w-4 h-4 accent-amber-500 cursor-pointer shrink-0" />
                        )}
                        {t.image ? <img src={t.image} className="w-8 h-8 rounded-full object-cover border-2 shrink-0" style={{ borderColor: t.color || '#3b82f6' }} /> : <div className="w-8 h-8 rounded-full border border-neutral-700 shrink-0" style={{ backgroundColor: t.color || '#3b82f6' }} />}
                        <span className={`text-sm font-bold truncate leading-tight ${t.name === 'undefined' ? 'text-red-500' : isDead ? 'text-neutral-500 line-through' : isSelected ? 'text-amber-400' : 'text-white'}`}>
                           {safeName} {t.isHidden && <span className="text-[10px] text-indigo-400 ml-1">(Скрыт)</span>}
                        </span>
                      </div>
                      
                      {(userRole === 'gm' || isMine) && ( 
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {userRole === 'gm' && <button onClick={(e) => { e.stopPropagation(); updateSession({ [`tokens.${t.id}.isHidden`]: !t.isHidden }); }} className={`p-2 rounded-md transition-colors ${t.isHidden ? 'text-indigo-400 hover:text-indigo-300' : 'text-neutral-500 hover:text-white'}`}>{t.isHidden ? <EyeOff size={16} /> : <Eye size={16} />}</button>}
                              <button onClick={(e) => { e.stopPropagation(); removeToken(t.id); }} className="text-neutral-600 hover:text-red-400 p-2 transition-colors"><Trash2 size={16} /></button>
                          </div>
                      )}
                    </div>
                    
                    <div className="mt-3 flex items-center gap-3">
                      <Heart size={14} className={isDead ? 'text-neutral-600' : (t.hp || 0) <= (t.maxHp || 1) * 0.3 ? 'text-red-500' : 'text-green-500'} />
                      <div className="flex-1 h-2 bg-neutral-900 rounded-full overflow-hidden relative shadow-inner">
                        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-green-600 to-green-400 transition-all" style={{ width: `${Math.min(100, ((t.hp || 0) / (t.maxHp || 1)) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-black font-mono w-10 text-right text-neutral-400">{t.hp || 0}/{t.maxHp || 1}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </AccordionSection>
      </div>
      
      <div className="absolute bottom-0 left-0 w-full p-5 border-t border-neutral-800/80 bg-neutral-900/95 backdrop-blur-md z-50">
         <button onClick={handleLeaveSession} className="w-full py-3 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-red-900/30">
           <LogOut size={16} /> Покинуть игру
         </button>
      </div>
    </aside>
  );
});