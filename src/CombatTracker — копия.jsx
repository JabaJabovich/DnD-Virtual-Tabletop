import React from 'react';
import { Swords, ChevronRight, SkipForward, X } from 'lucide-react';

export default React.memo(function CombatTracker({
  sessionData,
  userRole,
  nextTurn,
  endCombat
}) {
  if (!sessionData.combatState?.isActive) return null;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40 bg-neutral-900/80 backdrop-blur-xl border border-amber-600/40 p-2 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-2 max-w-[80%] overflow-x-auto custom-scrollbar no-zoom pointer-events-auto">
      <div className="flex flex-col items-center justify-center bg-amber-900/30 rounded-xl px-4 py-2 text-amber-500 mr-2 border border-amber-500/20">
         <Swords size={20} className="mb-1" />
         <span className="font-black uppercase text-[10px] tracking-widest">Раунд</span>
      </div>
      {sessionData.combatState.order.map((c, i) => {
         const isActive = i === sessionData.combatState.currentTurnIndex;
         return (
           <div key={c.id} className="flex items-center gap-2 shrink-0">
              <div className={`flex flex-col items-center px-4 py-2 rounded-xl border transition-all min-w-[80px] ${isActive ? 'bg-amber-600 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] transform scale-105' : 'bg-neutral-800/80 border-neutral-700 opacity-70'}`}>
                 <span className={`text-[10px] font-black mb-0.5 ${isActive ? 'text-amber-100' : 'text-amber-500'}`}>ИНИЦ {c.initiative}</span>
                 <span className={`text-sm font-bold whitespace-nowrap truncate w-full text-center ${isActive ? 'text-white' : 'text-neutral-300'}`}>{String(c.name)}</span>
              </div>
              {i < sessionData.combatState.order.length - 1 && <ChevronRight size={16} className="text-neutral-600 mx-1" />}
           </div>
         )
      })}
      {userRole === 'gm' && (
         <div className="flex items-center gap-2 ml-4 pl-4 border-l border-neutral-700 shrink-0">
           <button onClick={nextTurn} className="p-3 bg-amber-600/20 hover:bg-amber-600/40 text-amber-500 rounded-xl border border-amber-600/30 transition-colors" title="Следующий ход"><SkipForward size={20}/></button>
           <button onClick={endCombat} className="p-3 bg-red-900/30 hover:bg-red-900/80 text-red-400 rounded-xl border border-red-900/50 transition-colors" title="Завершить бой"><X size={20}/></button>
         </div>
      )}
    </div>
  );
});