import React from 'react';
import { X, BookOpen, Upload } from 'lucide-react';

// Безопасный генератор ID
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

export default React.memo(function GameModals({
  portraitToShow, setPortraitToShow,
  sessionData, dismissedMediaId, setDismissedMediaId,
  userRole, currentUser, updateSession,
  isShareModalOpen, setIsShareModalOpen,
  shareType, setShareType,
  shareContent, setShareContent,
  shareTargets, setShareTargets,
  localTokens, handleShare
}) {
  return (
    <>
      {/* 1. Модалка портрета */}
      {portraitToShow && (
        <div className="fixed inset-0 z-[260] bg-black/95 flex items-center justify-center p-8 cursor-pointer animate-[slideIn_0.2s_ease-out]" onClick={() => setPortraitToShow(null)}>
           <img src={portraitToShow} alt="Portrait" className="max-w-full max-h-full rounded-2xl shadow-[0_0_100px_rgba(255,255,255,0.1)] object-contain" onClick={(e) => e.stopPropagation()} />
           <button onClick={() => setPortraitToShow(null)} className="absolute top-8 right-8 text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"><X size={24}/></button>
        </div>
      )}

      {/* 2. Просмотр расшаренного материала */}
      {sessionData.sharedMedia && sessionData.sharedMedia.id !== dismissedMediaId && (userRole === 'gm' || sessionData.sharedMedia.visibleTo === 'all' || sessionData.sharedMedia.visibleTo.includes(currentUser?.id)) && (
         <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-[slideIn_0.3s_ease-out]">
            <div className="relative max-w-5xl max-h-full flex flex-col items-center">
               {sessionData.sharedMedia.type === 'image' ? (
                  <img src={sessionData.sharedMedia.content} alt="Shared" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" />
               ) : (
                  <div className="bg-neutral-900/90 text-white p-8 rounded-2xl border border-neutral-700 max-w-3xl w-full max-h-[85vh] overflow-y-auto text-xl whitespace-pre-wrap shadow-2xl custom-scrollbar">
                     {String(sessionData.sharedMedia.content)}
                  </div>
               )}
               <button onClick={() => setDismissedMediaId(sessionData.sharedMedia.id)} className="absolute -top-12 right-0 text-white/70 hover:text-white bg-black/50 p-2 rounded-full transition-colors"><X size={24}/></button>
               {userRole === 'gm' && (
                  <button onClick={() => updateSession({sharedMedia: null})} className="mt-6 px-6 py-2 bg-red-600/20 text-red-500 border border-red-500/30 hover:bg-red-600 hover:text-white rounded-xl transition-colors font-bold text-sm uppercase shadow-lg">Закрыть для всех</button>
               )}
            </div>
         </div>
      )}

      {/* 3. Окно отправки материала (только для ГМ) */}
      {isShareModalOpen && userRole === 'gm' && (
         <div className="fixed inset-0 z-[260] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 animate-[slideIn_0.2s_ease-out]">
               <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black text-white flex items-center gap-2"><BookOpen size={20} className="text-indigo-400"/> Показать материал</h3>
                  <button onClick={() => setIsShareModalOpen(false)} className="text-neutral-500 hover:text-white"><X size={20}/></button>
               </div>
               
               <div className="flex bg-neutral-950 p-1 rounded-lg">
                  <button onClick={() => setShareType('image')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${shareType === 'image' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-500 hover:text-white'}`}>Картинка</button>
                  <button onClick={() => setShareType('text')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${shareType === 'text' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-500 hover:text-white'}`}>Текст</button>
               </div>
               
               {shareType === 'image' ? (
                  <div className="flex flex-col gap-3">
                     <input type="text" placeholder="URL картинки..." value={shareContent} onChange={e => setShareContent(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500" />
                     <span className="text-center text-xs text-neutral-500 font-bold">- ИЛИ -</span>
                     <label className="flex items-center justify-center gap-2 w-full bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl p-3 cursor-pointer transition-colors text-sm font-bold text-neutral-400">
                       <Upload size={16}/> Загрузить с ПК
                       <input type="file" accept="image/*" onChange={(e) => {
                          const file = e.target.files[0];
                          if(!file) return;
                          const r = new FileReader();
                          r.onload = (ev) => {
                             const img = new Image();
                             img.onload = () => {
                                const cvs = document.createElement('canvas');
                                let w = img.width, h = img.height;
                                if(w>1500 || h>1500) { const rt = Math.min(1500/w, 1500/h); w*=rt; h*=rt; }
                                cvs.width=w; cvs.height=h;
                                cvs.getContext('2d').drawImage(img,0,0,w,h);
                                setShareContent(cvs.toDataURL('image/jpeg', 0.8));
                             };
                             // === ИСПРАВЛЕНИЕ: Используем `ev`, а не `event` ===
                             img.src = ev.target.result; 
                          };
                          r.readAsDataURL(file);
                       }} className="hidden" />
                     </label>
                     {shareContent && shareContent.startsWith('data:') && <img src={shareContent} className="h-32 object-contain mt-2 mx-auto rounded-lg border border-neutral-700"/>}
                  </div>
               ) : (
                  <textarea value={shareContent} onChange={e => setShareContent(e.target.value)} placeholder="Текст сообщения..." className="w-full h-32 bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none custom-scrollbar" />
               )}
               
               <div className="space-y-2">
                  <h4 className="text-xs font-black text-neutral-500 uppercase">Кому показать</h4>
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                     <label className="flex items-center gap-3 bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 cursor-pointer hover:border-neutral-600 transition-colors">
                        <input type="checkbox" checked={shareTargets.includes('all')} onChange={(e) => {
                           if(e.target.checked) setShareTargets(['all']);
                           else setShareTargets([]);
                        }} className="w-4 h-4 accent-indigo-500" />
                        <span className="text-sm font-bold text-white">Всем игрокам</span>
                     </label>
                     {!shareTargets.includes('all') && localTokens.filter(t => t.type === 'player').map(p => (
                        <label key={p.id} className="flex items-center gap-3 bg-neutral-950 p-2.5 rounded-lg border border-neutral-800 cursor-pointer hover:border-neutral-600 transition-colors">
                           <input type="checkbox" checked={shareTargets.includes(p.accountId)} onChange={(e) => {
                              if(e.target.checked) setShareTargets(prev => [...prev.filter(x => x!=='all'), p.accountId]);
                              else setShareTargets(prev => prev.filter(x => x !== p.accountId));
                           }} className="w-4 h-4 accent-indigo-500" />
                           <span className="text-sm font-bold text-white">{String(p.name)}</span>
                        </label>
                     ))}
                  </div>
               </div>

               <button onClick={handleShare} disabled={!shareContent} className="w-full py-3.5 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-wider rounded-xl transition-colors active:scale-95 shadow-md shadow-indigo-900/20">
                  Отправить на экраны
               </button>
            </div>
         </div>
      )}
    </>
  );
});