import React from 'react';
import { Users2, LogOut, User, Play, Loader2 } from 'lucide-react';

export default function LobbyScreen({
  leaveLobby,
  sessionData,
  userRole,
  currentUser,
  activeCharId,
  startGameAsGM
}) {
  return (
    <div className="absolute inset-0 z-[100] bg-neutral-950 flex flex-col items-center p-8 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-neutral-950">
       <div className="w-full max-w-5xl flex justify-between items-center mb-10 border-b border-neutral-800/50 pb-6 shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
               <Users2 size={28}/>
             </div>
             <div>
                 <h2 className="text-3xl font-black text-white tracking-tight">Зал ожидания</h2>
                <p className="text-neutral-400 font-medium mt-1">Ждем остальных игроков...</p>
             </div>
          </div>
          <button onClick={leaveLobby} className="px-5 py-2.5 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-xl transition-colors border border-neutral-800 text-sm font-bold flex items-center gap-2">
            <LogOut size={16}/> Вернуться к сессиям
          </button>
       </div>

       <div className="w-full max-w-5xl flex-1 overflow-y-auto custom-scrollbar">
         <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 pb-10">
            {(sessionData?.readyPlayers || []).map(p => (
               <div key={p.id} className="bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 rounded-3xl p-6 flex flex-col items-center gap-4 relative animate-[slideIn_0.3s_ease-out] hover:border-indigo-500/50 transition-colors">
                  <div className="absolute -top-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider px-4 py-1.5 rounded-full shadow-lg shadow-indigo-900/50">Готов</div>
                  {p.image ? ( 
                    <img src={p.image} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-neutral-800 shadow-inner" /> 
                  ) : ( 
                    <div className="w-24 h-24 rounded-full bg-neutral-800 flex items-center justify-center border-4 border-neutral-700 text-neutral-500">
                      <User size={48} />
                    </div> 
                  )}
                  <div className="text-center">
                     <h3 className="font-bold text-white text-lg truncate w-full px-2" title={String(p.name)}>{String(p.name)}</h3>
                     <div className="flex justify-center gap-2 mt-1">
                       <span className="text-xs text-green-400 font-mono font-bold bg-green-500/10 px-2 py-0.5 rounded-md">{p.hp} HP</span>
                       {(userRole === 'gm' || (p.accountId === currentUser.id && p.characterId === activeCharId)) && (
                          <span className="text-xs text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded-md">AC {p.ac || 10}</span>
                       )}
                     </div>
                  </div>
               </div>
            ))}
         </div>
       </div>

       <div className="w-full max-w-5xl mt-6 bg-neutral-900/80 backdrop-blur-md border border-neutral-800 p-8 rounded-3xl flex items-center justify-between shadow-2xl shrink-0">
          <div>
             <h3 className="text-xl font-black text-white mb-2">Статус игры</h3>
             <p className="text-neutral-400 font-medium">После старта все будут перенесены на игровую доску.</p>
          </div>
          {userRole === 'gm' ? (
             <button onClick={startGameAsGM} className="px-10 py-5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all hover:scale-105 active:scale-95 flex items-center gap-3">
                <Play size={24} /> Начать Игру
             </button>
          ) : (
             <div className="px-8 py-5 bg-neutral-950 border border-neutral-800 rounded-2xl text-indigo-400 font-bold flex items-center gap-3">
                <Loader2 size={24} className="animate-spin" /> Ожидаем Мастера...
             </div>
          )}
       </div>
    </div>
  );
}