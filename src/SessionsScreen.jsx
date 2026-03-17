import React from 'react';
import { FolderPlus, ChevronLeft, Trash2 } from 'lucide-react';

export default function SessionsScreen({
  setAuthStep,
  userRole, setUserRole,
  loginHp, setLoginHp,
  createSession,
  newSessionName, setNewSessionName,
  sessionsList,
  joinSession,
  deleteSession
}) {
  return (
    <div className="absolute inset-0 z-[100] bg-neutral-950 flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-neutral-950">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col animate-[slideIn_0.3s_ease-out]">
        <div className="flex justify-between items-center mb-6 shrink-0">
           <h2 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
             <FolderPlus size={32} className="text-indigo-500"/> Доступные сессии
           </h2>
           <button onClick={() => setAuthStep('profile')} className="px-5 py-2.5 bg-neutral-900/80 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-colors text-sm font-bold flex items-center gap-2 border border-neutral-800 shadow-sm">
             <ChevronLeft size={16}/> В профиль
           </button>
        </div>

        <div className="w-full bg-neutral-900/60 backdrop-blur-md border border-neutral-800/80 rounded-3xl shadow-2xl p-8 mb-6 shrink-0">
           <h3 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-4">Настройки подключения</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                 <label className="block text-sm font-bold text-neutral-300 mb-3">Кем вы будете в игре?</label>
                 <div className="flex gap-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
                    <button onClick={() => setUserRole('player')} className={`flex-1 py-3 px-2 rounded-lg text-sm font-bold transition-all ${userRole === 'player' ? 'bg-blue-600 shadow-md text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Игрок</button>
                    <button onClick={() => setUserRole('gm')} className={`flex-1 py-3 px-2 rounded-lg text-sm font-bold transition-all ${userRole === 'gm' ? 'bg-amber-600 shadow-md text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Мастер</button>
                    <button onClick={() => setUserRole('spectator')} className={`flex-1 py-3 px-2 rounded-lg text-sm font-bold transition-all ${userRole === 'spectator' ? 'bg-neutral-700 shadow-md text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Зритель</button>
                 </div>
              </div>
              {userRole === 'player' && (
                 <div>
                   <label className="block text-sm font-bold text-neutral-300 mb-3">Начальное Здоровье (HP)</label>
                   <input type="number" min="1" max="500" value={loginHp} onChange={(e) => setLoginHp(Math.min(500, e.target.value))} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 text-xl font-black focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white hide-arrows transition-all text-center" />
                 </div>
              )}
           </div>
        </div>

        {userRole === 'gm' && (
           <form onSubmit={createSession} className="w-full flex gap-3 mb-6 shrink-0">
              <input type="text" value={newSessionName} onChange={e => setNewSessionName(e.target.value)} placeholder="Название новой кампании..." className="flex-1 bg-neutral-900/80 backdrop-blur-md border border-neutral-800 rounded-2xl p-4 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-white font-medium transition-all" />
              <button type="submit" disabled={!newSessionName.trim()} className="px-8 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-black uppercase tracking-wider rounded-2xl shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all disabled:opacity-50 active:scale-95">Создать</button>
           </form>
        )}

        <div className="w-full flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 pb-10">
           {(sessionsList || []).length === 0 ? (
              <div className="text-center py-16 bg-neutral-900/30 rounded-3xl border-2 border-dashed border-neutral-800 text-neutral-500 font-medium">Нет доступных сессий. Попросите Мастера создать её!</div>
           ) : (
              (sessionsList || []).map(sess => (
                 <div key={sess.id} className="flex items-center justify-between bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 p-5 rounded-2xl hover:border-neutral-600 hover:bg-neutral-900 transition-all">
                    <div>
                       <h3 className="text-xl font-bold text-white mb-2 tracking-tight group-hover:text-indigo-400 transition-colors">{String(sess.name)}</h3>
                       <div className="flex items-center gap-3 text-xs font-bold">
                          <span className={`px-3 py-1 rounded-md uppercase tracking-wider ${sess.isGameStarted ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {sess.isGameStarted ? 'Игра идет' : 'В лобби'}
                          </span>
                          <span className="text-neutral-500">{new Date(sess.createdAt).toLocaleDateString()}</span>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => joinSession(sess.id)} className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-900/20 transition-all active:scale-95">Присоединиться</button>
                       {userRole === 'gm' && (
                          <button onClick={() => deleteSession(sess.id)} className="px-4 py-3.5 bg-neutral-950 hover:bg-red-900/50 text-neutral-500 hover:text-red-500 rounded-xl transition-colors border border-neutral-800" title="Удалить"><Trash2 size={20}/></button>
                       )}
                    </div>
                 </div>
              ))
           )}
        </div>
      </div>
    </div>
  );
}