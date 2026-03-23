import React from 'react';
import { Swords, Sparkles, Move, CheckCircle2, XCircle } from 'lucide-react';

export default function ActionTracker({ 
  sessionData, updateSession, userRole, myTokenId, nextTurn,
  setShowAtkWidget, setShowAbilWidget, setShowInvWidget, setShowStatsWidget,
  containerRef, scale, setPan, localTokens, currentUser, activeCharacter
}) {
  const combat = sessionData.combatState;
  if (!combat?.isActive || !combat?.order || combat.order.length === 0) return null;

  const activeCombatant = combat.order[combat.currentTurnIndex];
  
  // Надежно определяем, чей сейчас ход (даже если стейт myTokenId потерялся)
  const myToken = localTokens.find(t => t.accountId === currentUser?.id && t.characterId === activeCharacter?.id);
  const actualMyTokenId = myTokenId || (myToken ? myToken.id : null);
  
  const isMyTurn = String(activeCombatant?.id) === String(actualMyTokenId);
  const canEdit = isMyTurn || userRole === 'gm'; 
  
  const ap = combat.currentTurnAP || { main: true, bonus: true, move: true };

  const handleActionClick = (e, type) => {
    e.preventDefault();
    e.stopPropagation(); // Блокируем клик "насквозь" по карте
    
    if (!canEdit) return;
    
    // Переключаем потраченное очко
    updateSession({ [`combatState.currentTurnAP.${type}`]: !ap[type] });

    // Логика виджетов и камеры
    if (type === 'main' || type === 'bonus') {
        setShowAtkWidget(true);
        setShowAbilWidget(true);
        setShowInvWidget(false);
        setShowStatsWidget(false);
    } else if (type === 'move') {
        // Центрируем камеру на том токене, чей сейчас ход
        const targetToken = localTokens.find(t => t.id === activeCombatant.id);
        if (targetToken && containerRef?.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPan({ x: (rect.width / 2) - (targetToken.x * scale), y: (rect.height / 2) - (targetToken.y * scale) });
        }
    }
  };

  return (
    <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[200] bg-neutral-900/95 backdrop-blur-xl border-2 border-amber-600/50 p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col items-center gap-4 animate-[slideIn_0.3s_ease-out] pointer-events-auto no-zoom" onPointerDown={e => e.stopPropagation()}>
      
      <div className="text-center">
        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Текущий ход:</span>
        <h3 className={`text-xl font-black ${isMyTurn ? 'text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'text-white'}`}>
          {isMyTurn ? 'ВАШ ХОД!' : activeCombatant?.name}
        </h3>
      </div>

      <div className="flex gap-4">
        <button 
          onClick={(e) => handleActionClick(e, 'main')}
          disabled={!canEdit}
          className={`relative flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all ${ap.main ? 'bg-red-600/20 border-red-500 hover:bg-red-600/40 cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-neutral-950 border-neutral-800 opacity-50 grayscale'}`}
        >
          {ap.main ? <Swords size={32} className="text-red-400 mb-2"/> : <XCircle size={32} className="text-neutral-600 mb-2"/>}
          <span className="text-xs font-black text-white uppercase tracking-wider text-center leading-none mt-1">Осн.<br/>Действие</span>
        </button>

        <button 
          onClick={(e) => handleActionClick(e, 'bonus')}
          disabled={!canEdit}
          className={`relative flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all ${ap.bonus ? 'bg-purple-600/20 border-purple-500 hover:bg-purple-600/40 cursor-pointer shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-neutral-950 border-neutral-800 opacity-50 grayscale'}`}
        >
          {ap.bonus ? <Sparkles size={32} className="text-purple-400 mb-2"/> : <XCircle size={32} className="text-neutral-600 mb-2"/>}
          <span className="text-xs font-black text-white uppercase tracking-wider text-center leading-none mt-1">Доп.<br/>Действие</span>
        </button>

        <button 
          onClick={(e) => handleActionClick(e, 'move')}
          disabled={!canEdit}
          className={`relative flex flex-col items-center justify-center w-24 h-24 rounded-2xl border-2 transition-all ${ap.move ? 'bg-blue-600/20 border-blue-500 hover:bg-blue-600/40 cursor-pointer shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-neutral-950 border-neutral-800 opacity-50 grayscale'}`}
        >
          {ap.move ? <Move size={32} className="text-blue-400 mb-2"/> : <XCircle size={32} className="text-neutral-600 mb-2"/>}
          <span className="text-xs font-black text-white uppercase tracking-wider">Движение</span>
        </button>
      </div>

      {canEdit && (
        <button onClick={nextTurn} className="mt-2 px-8 py-3 bg-neutral-800 hover:bg-amber-600 hover:text-white text-neutral-400 rounded-xl font-black uppercase tracking-widest transition-colors flex items-center gap-2 border border-neutral-700">
          <CheckCircle2 size={18} /> Завершить ход
        </button>
      )}
    </div>
  );
}