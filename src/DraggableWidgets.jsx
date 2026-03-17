import React, { useState } from 'react';
import { X, ScrollText, Backpack, Sparkles, Swords, BookOpen } from 'lucide-react';

export default React.memo(function DraggableWidgets({
  showStatsWidget, setShowStatsWidget,
  showInvWidget, setShowInvWidget,
  showAbilWidget, setShowAbilWidget,
  showAtkWidget, setShowAtkWidget,
  showNotesWidget, setShowNotesWidget, // <--- НОВОЕ
  activeCharacter,
  widgetPositions,
  handleWidgetPointerDown,
  rollStat,
  localInv, setLocalInv, 
  localAbil, setLocalAbil,
  localNotes, setLocalNotes, // <--- НОВОЕ
  saveProfileFieldLive,
  useAbility,
  rollAttack
}) {
  const [statRollMode, setStatRollMode] = useState('normal');

  return (
    <>
      {/* 1. ХАРАКТЕРИСТИКИ (stats) */}
      {showStatsWidget && activeCharacter?.stats && (
        <div 
          className="fixed top-0 left-0 z-[150] bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/50 rounded-3xl shadow-2xl w-72 flex flex-col no-zoom animate-[slideIn_0.2s_ease-out]" 
          style={{ transform: `translate3d(${widgetPositions.stats.x}px, ${widgetPositions.stats.y}px, 0)` }} 
          onPointerDown={e => e.stopPropagation()} 
          onWheel={e => e.stopPropagation()}
        >
          <div 
            className="p-4 border-b border-neutral-800/50 flex justify-between items-center bg-white/5 rounded-t-3xl cursor-grab active:cursor-grabbing touch-none select-none" 
            onPointerDown={(e) => handleWidgetPointerDown(e, 'stats')}
          >
            <span className="font-black text-sm text-blue-400 flex items-center gap-2 uppercase tracking-wider"><ScrollText size={18}/> Характеристики</span>
            <button onClick={(e) => { e.stopPropagation(); setShowStatsWidget(false); }} className="text-neutral-500 hover:text-white bg-neutral-800/50 p-1.5 rounded-full"><X size={16}/></button>
          </div>
          
          <div className="p-3 border-b border-neutral-800/50 bg-neutral-950/30 flex gap-2 justify-center shrink-0">
             <button onClick={() => setStatRollMode('dis')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${statRollMode === 'dis' ? 'bg-red-900/30 text-red-400 border border-red-500/50 shadow-inner' : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:text-white'}`}>Помеха</button>
             <button onClick={() => setStatRollMode('normal')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${statRollMode === 'normal' ? 'bg-neutral-800 text-white border border-neutral-500/50 shadow-inner' : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:text-white'}`}>Обычный</button>
             <button onClick={() => setStatRollMode('adv')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${statRollMode === 'adv' ? 'bg-green-900/30 text-green-400 border border-green-500/50 shadow-inner' : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:text-white'}`}>Преим.</button>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            {[{ id: 'str', label: 'Сила' }, { id: 'dex', label: 'Ловкость' }, { id: 'con', label: 'Телосложение' }, { id: 'int', label: 'Интеллект' }, { id: 'wis', label: 'Мудрость' }, { id: 'cha', label: 'Харизма' }].map(stat => {
                const val = activeCharacter.stats[stat.id] || 0;
                const displayVal = val > 0 ? `+${val}` : val;
                return (
                  <button key={stat.id} onClick={() => rollStat(stat.id, val, statRollMode)} className="flex flex-col items-center bg-neutral-950/50 hover:bg-neutral-800 p-3 rounded-2xl border border-neutral-800 transition-all group hover:border-blue-500/50 shadow-sm active:scale-95">
                    <span className="text-[10px] font-bold text-neutral-500 group-hover:text-neutral-300 uppercase tracking-widest mb-1">{String(stat.label)}</span>
                    <span className={`text-xl font-black ${val > 0 ? 'text-green-400' : val < 0 ? 'text-red-400' : 'text-neutral-100'}`}>{displayVal}</span>
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* 2. ИНВЕНТАРЬ (inv) */}
      {showInvWidget && (
        <div 
          className="fixed top-0 left-0 z-[150] bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/50 rounded-3xl shadow-2xl w-72 h-80 flex flex-col no-zoom animate-[slideIn_0.2s_ease-out]" 
          style={{ transform: `translate3d(${widgetPositions.inv.x}px, ${widgetPositions.inv.y}px, 0)` }} 
          onPointerDown={e => e.stopPropagation()} 
          onWheel={e => e.stopPropagation()}
        >
          <div 
            className="p-4 border-b border-neutral-800/50 flex justify-between items-center bg-white/5 rounded-t-3xl shrink-0 cursor-grab active:cursor-grabbing touch-none select-none" 
            onPointerDown={(e) => handleWidgetPointerDown(e, 'inv')}
          >
            <span className="font-black text-sm text-amber-500 flex items-center gap-2 uppercase tracking-wider"><Backpack size={18}/> Инвентарь</span>
            <button onClick={(e) => { e.stopPropagation(); setShowInvWidget(false); }} className="text-neutral-500 hover:text-white bg-neutral-800/50 p-1.5 rounded-full"><X size={16}/></button>
          </div>
          <div className="p-4 flex-1 h-full relative">
             <textarea value={localInv} onChange={(e) => setLocalInv(e.target.value)} onBlur={(e) => saveProfileFieldLive('inventory', e.target.value)} className="absolute inset-0 w-full h-full bg-transparent border-none text-sm text-neutral-300 resize-none p-4 focus:outline-none custom-scrollbar pointer-events-auto select-text" placeholder="Ваш инвентарь..." />
          </div>
        </div>
      )}

      {/* 3. СПОСОБНОСТИ (abil) */}
      {showAbilWidget && (
        <div 
          className="fixed top-0 left-0 z-[150] bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/50 rounded-3xl shadow-2xl w-80 flex flex-col no-zoom animate-[slideIn_0.2s_ease-out]" 
          style={{ transform: `translate3d(${widgetPositions.abil.x}px, ${widgetPositions.abil.y}px, 0)` }} 
          onPointerDown={e => e.stopPropagation()} 
          onWheel={e => e.stopPropagation()}
        >
          <div 
            className="p-4 border-b border-neutral-800/50 flex justify-between items-center bg-white/5 rounded-t-3xl shrink-0 cursor-grab active:cursor-grabbing touch-none select-none" 
            onPointerDown={(e) => handleWidgetPointerDown(e, 'abil')}
          >
            <span className="font-black text-sm text-purple-500 flex items-center gap-2 uppercase tracking-wider"><Sparkles size={18}/> Способности</span>
            <button onClick={(e) => { e.stopPropagation(); setShowAbilWidget(false); }} className="text-neutral-500 hover:text-white bg-neutral-800/50 p-1.5 rounded-full"><X size={16}/></button>
          </div>
          <div className="p-4 flex flex-col gap-3 max-h-80 overflow-y-auto custom-scrollbar">
             {(!Array.isArray(activeCharacter?.abilities) || activeCharacter.abilities.length === 0) ? (
                <span className="text-neutral-500 text-sm text-center">Добавьте способности в профиле.</span>
             ) : (
                activeCharacter.abilities.map(abil => (
                   <button key={abil.id} onClick={() => useAbility(abil)} className="flex flex-col text-left bg-neutral-950/50 hover:bg-neutral-800 p-3 rounded-2xl border border-neutral-800 hover:border-purple-500/50 transition-all group active:scale-95 shadow-sm">
                      <span className="font-black text-white text-sm mb-1">{abil.name}</span>
                      <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider mb-1">
                         {abil.damageDice && <span className="text-neutral-500">Урон: <span className="text-red-400">{abil.damageDice}{abil.damageBonus>0?'+'+abil.damageBonus:''}</span></span>}
                      </div>
                      {abil.description && <span className="text-xs text-neutral-400 leading-tight group-hover:text-neutral-300 whitespace-pre-wrap">{abil.description}</span>}
                   </button>
                ))
             )}
          </div>
        </div>
      )}

      {/* 4. АТАКИ (atk) */}
      {showAtkWidget && (
        <div 
          className="fixed top-0 left-0 z-[150] bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/50 rounded-3xl shadow-2xl w-80 flex flex-col no-zoom animate-[slideIn_0.2s_ease-out]" 
          style={{ transform: `translate3d(${widgetPositions.atk.x}px, ${widgetPositions.atk.y}px, 0)` }} 
          onPointerDown={e => e.stopPropagation()} 
          onWheel={e => e.stopPropagation()}
        >
          <div 
            className="p-4 border-b border-neutral-800/50 flex justify-between items-center bg-white/5 rounded-t-3xl shrink-0 cursor-grab active:cursor-grabbing touch-none select-none" 
            onPointerDown={(e) => handleWidgetPointerDown(e, 'atk')}
          >
            <span className="font-black text-sm text-red-500 flex items-center gap-2 uppercase tracking-wider"><Swords size={18}/> Атаки</span>
            <button onClick={(e) => { e.stopPropagation(); setShowAtkWidget(false); }} className="text-neutral-500 hover:text-white bg-neutral-800/50 p-1.5 rounded-full"><X size={16}/></button>
          </div>
          <div className="p-4 flex flex-col gap-3 max-h-80 overflow-y-auto custom-scrollbar">
             {(!activeCharacter?.attacks || activeCharacter.attacks.length === 0) ? (
                <span className="text-neutral-500 text-sm text-center">Добавьте атаки в профиле.</span>
             ) : (
                activeCharacter.attacks.map(atk => (
                   <button key={atk.id} onClick={() => rollAttack(atk)} className="flex flex-col text-left bg-neutral-950/50 hover:bg-neutral-800 p-3 rounded-2xl border border-neutral-800 hover:border-red-500/50 transition-all group active:scale-95 shadow-sm">
                      <span className="font-black text-white text-sm mb-1">{atk.name}</span>
                      <div className="flex gap-4 text-xs font-bold">
                         <span className="text-neutral-500">Попадание: <span className="text-blue-400">1d20{atk.attackBonus > 0 ? '+'+atk.attackBonus : (atk.attackBonus < 0 ? atk.attackBonus : '')}</span></span>
                         <span className="text-neutral-500">Урон: <span className="text-red-400">{atk.damageDice}{atk.damageBonus > 0 ? '+'+atk.damageBonus : (atk.damageBonus < 0 ? atk.damageBonus : '')}</span></span>
                      </div>
                   </button>
                ))
             )}
          </div>
        </div>
      )}

      {/* 5. ЗАМЕТКИ (notes) */}
      {showNotesWidget && (
        <div 
          className="fixed top-0 left-0 z-[150] bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/50 rounded-3xl shadow-2xl w-72 h-80 flex flex-col no-zoom animate-[slideIn_0.2s_ease-out]" 
          style={{ transform: `translate3d(${widgetPositions.notes?.x || 100}px, ${widgetPositions.notes?.y || 100}px, 0)` }} 
          onPointerDown={e => e.stopPropagation()} 
          onWheel={e => e.stopPropagation()}
        >
          <div 
            className="p-4 border-b border-neutral-800/50 flex justify-between items-center bg-white/5 rounded-t-3xl shrink-0 cursor-grab active:cursor-grabbing touch-none select-none" 
            onPointerDown={(e) => handleWidgetPointerDown(e, 'notes')}
          >
            <span className="font-black text-sm text-green-400 flex items-center gap-2 uppercase tracking-wider"><BookOpen size={18}/> Заметки</span>
            <button onClick={(e) => { e.stopPropagation(); setShowNotesWidget(false); }} className="text-neutral-500 hover:text-white bg-neutral-800/50 p-1.5 rounded-full"><X size={16}/></button>
          </div>
          <div className="p-4 flex-1 h-full relative">
             <textarea 
                value={localNotes} 
                onChange={(e) => setLocalNotes(e.target.value)} 
                onBlur={(e) => saveProfileFieldLive('notes', e.target.value)} 
                className="absolute inset-0 w-full h-full bg-transparent border-none text-sm text-neutral-300 resize-none p-4 focus:outline-none custom-scrollbar pointer-events-auto select-text" 
                placeholder="Заметки по игре, квесты, лут..." 
             />
          </div>
        </div>
      )}
    </>
  );
});