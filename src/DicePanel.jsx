import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, Dices, X } from 'lucide-react';

// Безопасный генератор ID
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID(); 
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

export default React.memo(function DicePanel({
  isRightSidebarOpen, 
  setIsRightSidebarOpen,
  updateSession,
  pendingDamageTarget, 
  setPendingDamageTarget,
  localTokens,
  diceCount, 
  setDiceCount,
  rollDice,
  sessionData
}) {

  // === ЛОГИКА ИЗМЕНЕНИЯ ШИРИНЫ (RESIZING) ===
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('rightSidebarWidth');
    return saved ? parseInt(saved, 10) : 340;
  });
  const [isResizing, setIsResizing] = useState(false);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isResizing) {
       localStorage.setItem('rightSidebarWidth', width);
       return;
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (e) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
         // МИНИМАЛЬНАЯ ШИРИНА ИЗМЕНЕНА НА 150px
         const newWidth = Math.min(Math.max(150, window.innerWidth - e.clientX), 800);
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

  return (
    <aside 
      className="absolute top-0 right-0 h-full bg-neutral-900/95 backdrop-blur-2xl border-l border-neutral-800/80 flex flex-col z-40 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] pointer-events-auto"
      style={{ 
        width: `${width}px`, 
        transform: isRightSidebarOpen ? 'translate3d(0, 0, 0)' : `translate3d(${width}px, 0, 0)`,
        transitionProperty: isResizing ? 'none' : 'transform',
        transitionDuration: '300ms',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      onPointerDown={e => e.stopPropagation()} 
      onWheel={e => e.stopPropagation()}
    >
      
      {/* === ПОЛЗУНОК ДЛЯ ИЗМЕНЕНИЯ ШИРИНЫ === */}
      <div 
        className="absolute top-0 left-0 w-3 h-full cursor-col-resize z-[100] hover:bg-red-500/50 active:bg-red-500/80 transition-colors"
        style={{ transform: 'translateX(-50%)' }}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsResizing(true);
        }}
      />

      <div className="p-5 border-b border-neutral-800/80 bg-white/5 flex items-center justify-between shrink-0">
        <button onClick={() => setIsRightSidebarOpen(false)} className="p-2 bg-neutral-800/50 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-colors">
          <ChevronRight size={20} />
        </button>
        <h2 className="text-xl font-black flex items-center gap-2 text-white">
          <Dices size={22} className="text-red-500" /> Кубики
        </h2>
        <button onClick={() => updateSession({diceLog: []})} className="text-xs font-bold text-neutral-500 hover:text-red-400 transition-colors bg-neutral-950/50 px-3 py-1.5 rounded-lg border border-neutral-800">
          Очистить
        </button>
      </div>

      <div className="p-5 border-b border-neutral-800/80 bg-neutral-950/30 shrink-0 flex flex-col gap-3">
        {pendingDamageTarget && (
            <div className="bg-red-900/30 border border-red-500/30 p-3 rounded-xl flex justify-between items-center shadow-inner">
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Цель поражена!</span>
                  <span className="text-sm font-bold text-white truncate max-w-[180px]">Бросьте урон по: {localTokens.find(t => t.id === pendingDamageTarget)?.name}</span>
               </div>
               <button onClick={() => setPendingDamageTarget(null)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors">
                 <X size={16}/>
               </button>
            </div>
        )}
        
        <div className="flex items-center justify-between bg-neutral-900 p-2 rounded-xl border border-neutral-800">
            <span className="text-xs font-bold text-neutral-400 ml-2 uppercase tracking-wider">Кубиков:</span>
            <div className="flex items-center gap-1">
               <button onClick={() => setDiceCount(Math.max(1, diceCount - 1))} className="w-8 h-8 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-black transition-colors">-</button>
               <span className="text-base font-black w-8 text-center text-white">{diceCount}</span>
               <button onClick={() => setDiceCount(Math.min(20, diceCount + 1))} className="w-8 h-8 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg font-black transition-colors">+</button>
            </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-1">
            {[2, 4, 6, 8, 10, 12, 20].map((sides) => (
                <button key={sides} onClick={() => rollDice(`${diceCount}d${sides}`)} className="flex flex-col items-center justify-center py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-indigo-500/50 rounded-xl text-neutral-300 transition-all shadow-sm active:scale-95 group">
                    <span className="text-[10px] text-neutral-500 group-hover:text-indigo-400 font-black mb-1">{diceCount > 1 ? `${diceCount}d${sides}` : `d${sides}`}</span>
                    <Dices size={18} className="text-neutral-400 group-hover:text-white"/>
                </button>
            ))}
           <button onClick={() => rollDice('1d100')} className="col-span-2 flex items-center justify-center gap-2 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-indigo-500/50 rounded-xl text-neutral-300 font-black text-sm transition-all shadow-sm active:scale-95">d100 (%)</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        {!sessionData.diceLog || sessionData.diceLog.length === 0 ? (
          <div className="text-center text-sm font-medium text-neutral-600 mt-10">Броски появятся здесь</div>
        ) : (
          sessionData.diceLog.map((log) => (
            <div key={log.id} className="bg-neutral-900/80 rounded-2xl p-4 border border-neutral-800/80 shadow-sm animate-[slideIn_0.2s_ease-out]">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] text-neutral-500 font-bold">{String(log.time)}</span>
                <span className="text-[10px] text-indigo-400 font-black tracking-wider uppercase truncate max-w-[100px]" title={String(log.roller)}>{String(log.roller)}</span>
              </div>
              <div className="flex justify-between items-end mt-1">
                <span className="text-sm font-black text-neutral-300 bg-neutral-950/50 px-2.5 py-1 rounded-lg border border-neutral-800">{String(log.notation)} <span className="text-[10px] font-normal text-neutral-500 ml-1">[{String(log.rolls)}]</span></span>
                <span className={`text-4xl font-black leading-none drop-shadow-md ${log.isCrit ? 'text-green-500' : log.isFail ? 'text-red-500' : 'text-white'}`}>{log.total}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
});