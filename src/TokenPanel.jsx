import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Minus, Eye, EyeOff, Shield, Heart, Skull, Flame, 
  Anchor, Zap, Sparkles, HeartPulse, Swords, User
} from 'lucide-react';

const STATUS_EFFECTS = [
  { id: 'rooted', label: 'Рут', icon: Anchor, color: 'text-orange-500', bg: 'border-orange-500' },
  { id: 'stunned', label: 'Стан', icon: Zap, color: 'text-amber-400', bg: 'border-amber-400' },
  { id: 'dying', label: 'При смерти', icon: Skull, color: 'text-red-600', bg: 'border-red-600' },
  { id: 'regen', label: 'Лечение', icon: HeartPulse, color: 'text-green-400', bg: 'border-green-400' },
  { id: 'inspired', label: 'Вдохновение', icon: Sparkles, color: 'text-cyan-300', bg: 'border-cyan-300' },
  { id: 'dot', label: 'Дот', icon: Flame, color: 'text-orange-600', bg: 'border-orange-600' }
];

export default React.memo(function TokenPanel({
  selectedToken, isTokenPanelOpen, setIsTokenPanelOpen, tokenPanelPos,
  isTokenPanelMinimized, setIsTokenPanelMinimized, handleWidgetPointerDown, setPortraitToShow,
  userRole, myTokenId, setMyTokenId, canEditSelected, updateTokenAc, updateSession, handleManualHit, addMapPing, toggleStatus, rollDice,
  hpInputValue, setHpInputValue, updateHp, rollDeathSave, rollStat, rollAttack
}) {
  
  const [localVision, setLocalVision] = useState(0);
  const [localSize, setLocalSize] = useState(60);

  // --- ОПТИМИЗИРОВАННАЯ ЛОГИКА ПЕРЕТАСКИВАНИЯ (GPU + RAF) ---
  const [pos, setPos] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragRafRef = useRef(null); // Ссылка для requestAnimationFrame

  useEffect(() => {
    if (tokenPanelPos && !isDragging) {
      setPos(tokenPanelPos);
    }
  }, [tokenPanelPos]);

  useEffect(() => {
    const onPointerMove = (e) => {
      if (isDragging) {
        // Отменяем предыдущий кадр, если браузер не успел его нарисовать (защита от лагов)
        if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
        
        // Запрашиваем отрисовку строго в момент обновления экрана
        dragRafRef.current = requestAnimationFrame(() => {
            setPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
        });
      }
    };
    const onPointerUp = () => setIsDragging(false);
    
    if (isDragging) {
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
    };
  }, [isDragging, dragOffset]);

  const handleHeaderPointerDown = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDragging(true);
  };
  // -------------------------------------------

  useEffect(() => {
    if (selectedToken) {
      setLocalVision(selectedToken.vision || 0);
      setLocalSize(selectedToken.size || 60);
    }
  }, [selectedToken?.id]);

  if (!selectedToken || !isTokenPanelOpen) return null;

  const isMyToken = myTokenId === selectedToken.id;
  const hasShield = (selectedToken.tempHp || 0) > 0;

  return (
    <div className="fixed z-[180] bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 pointer-events-auto no-zoom"
         style={{ 
            /* ИСПОЛЬЗУЕМ GPU-УСКОРЕНИЕ ДЛЯ ПЛАВНОСТИ */
            transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, 
            left: 0, top: 0, 
            width: isTokenPanelMinimized ? '240px' : '360px',
            /* Отключаем transition во время перетаскивания, чтобы виджет не "догонял" мышку */
            transitionProperty: isDragging ? 'none' : 'all'
         }}>
      
      {/* Шапка панели */}
      <div className="p-4 bg-white/5 border-b border-neutral-800 flex items-center justify-between cursor-grab active:cursor-grabbing"
           onPointerDown={handleHeaderPointerDown}>
         <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-full border-2 shrink-0 shadow-lg flex items-center justify-center bg-neutral-900" style={{ borderColor: selectedToken.color || '#3b82f6', backgroundColor: (selectedToken.color || '#3b82f6') + '20' }}>
               {selectedToken.image ? <img src={selectedToken.image} className="w-full h-full rounded-full object-cover" draggable="false" /> : <Skull size={20} className="text-neutral-500" />}
            </div>
            <div className="flex flex-col">
               <span className="text-sm font-black text-white truncate uppercase tracking-wider leading-tight">{selectedToken.name}</span>
               <span className="text-[10px] font-bold text-neutral-500 uppercase mt-0.5">{selectedToken.type === 'player' ? 'Игрок' : 'Существо'}</span>
            </div>
         </div>
         <div className="flex items-center gap-1 shrink-0" onPointerDown={e => e.stopPropagation()}>
            {userRole === 'gm' && (
               <button onClick={() => updateSession({ [`tokens.${selectedToken.id}.isHidden`]: !selectedToken.isHidden })} 
                       className={`p-2 transition-colors rounded-lg ${selectedToken.isHidden ? 'bg-indigo-900/50 text-indigo-400' : 'bg-neutral-900/50 text-neutral-500 hover:text-white'}`} 
                       title={selectedToken.isHidden ? "Показать игрокам" : "Скрыть от игроков"}>
                  {selectedToken.isHidden ? <EyeOff size={16}/> : <Eye size={16}/>}
               </button>
            )}
            <button onClick={() => setIsTokenPanelMinimized(!isTokenPanelMinimized)} className="p-2 text-neutral-500 hover:text-white transition-colors bg-neutral-900/50 rounded-lg"><Minus size={16}/></button>
            <button onClick={() => setIsTokenPanelOpen(false)} className="p-2 text-neutral-500 hover:text-red-500 transition-colors bg-neutral-900/50 rounded-lg"><X size={16}/></button>
         </div>
      </div>

      {!isTokenPanelMinimized && (
         <div className="flex flex-col max-h-[75vh]" onPointerDown={e => e.stopPropagation()}>
            {userRole === 'gm' && (
               <div className="px-5 pt-4 pb-1">
                  <button 
                    onClick={() => setMyTokenId(isMyToken ? null : selectedToken.id)}
                    className={`w-full py-2.5 flex items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border shadow-sm active:scale-95 ${isMyToken ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                  >
                     {isMyToken ? <><Zap size={16} className="text-indigo-400"/> Под вашим контролем</> : <><User size={16} /> Взять под контроль</>}
                  </button>
               </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
               <div className="grid grid-cols-2 gap-3">
                  
                  {/* БЛОК ЗДОРОВЬЯ И ЩИТА */}
                  <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 relative overflow-hidden group">
                     <div className="absolute top-0 left-0 w-full h-1 bg-red-500/20"></div>
                     <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5"><Heart size={12} className="text-red-500"/> Здоровье</span>
                        {hasShield && (
                           <span className="text-[10px] font-black text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-md flex items-center gap-1 border border-blue-500/30" title="Временные Очки Здоровья">
                              <Shield size={10}/> {selectedToken.tempHp} ВХП
                           </span>
                        )}
                     </div>
                     <div className="flex items-end gap-1 mb-3">
                        <span className="text-3xl font-black text-white leading-none">{selectedToken.hp}</span>
                        <span className="text-xs font-bold text-neutral-600 mb-1">/ {selectedToken.maxHp}</span>
                     </div>
                     
                     <div className="flex gap-1.5 mb-2">
                        <input type="number" value={hpInputValue} onChange={e => setHpInputValue(e.target.value)} placeholder="Число" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-1.5 text-xs font-bold focus:border-red-500 outline-none text-white text-center hide-arrows" />
                        
                        <button onClick={() => { 
                           const dmg = Number(hpInputValue);
                           if (dmg > 0) updateHp(selectedToken.id, -dmg); 
                           setHpInputValue(''); 
                        }} className="px-2.5 bg-red-900/50 hover:bg-red-600 text-red-100 rounded-lg transition-colors font-black text-sm" title="Нанести урон">-</button>
                        
                        <button onClick={() => { 
                           const heal = Number(hpInputValue);
                           if (heal > 0) updateHp(selectedToken.id, heal);
                           setHpInputValue(''); 
                        }} className="px-2.5 bg-green-900/50 hover:bg-green-600 text-green-100 rounded-lg transition-colors font-black text-sm" title="Вылечить">+</button>
                     </div>
                     
                     <button onClick={() => { 
                        const shieldVal = Number(hpInputValue);
                        if (shieldVal > 0) {
                           const newShield = Math.max(selectedToken.tempHp || 0, shieldVal);
                           updateSession({ [`tokens.${selectedToken.id}.tempHp`]: newShield }); 
                        } else if (hpInputValue !== '') {
                           updateSession({ [`tokens.${selectedToken.id}.tempHp`]: 0 }); 
                        }
                        setHpInputValue(''); 
                     }} className="w-full py-1.5 bg-blue-900/20 hover:bg-blue-600/40 text-blue-400 text-[9px] font-black uppercase tracking-wider rounded-lg transition-colors border border-blue-900/50 flex items-center justify-center gap-1" title="Установить ВХП">
                        <Shield size={10}/> Зарядить Щит
                     </button>
                  </div>

                  <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/20"></div>
                     <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5"><Shield size={12} className="text-amber-500"/> Защита (КД)</span>
                     </div>
                     <div className="flex items-center justify-center h-[52px]">
                        <button onClick={() => updateTokenAc(selectedToken.id, selectedToken.ac - 1)} className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors">-</button>
                        <span className="text-4xl font-black text-white w-16 text-center">{selectedToken.ac}</span>
                        <button onClick={() => updateTokenAc(selectedToken.id, selectedToken.ac + 1)} className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors">+</button>
                     </div>
                  </div>
               </div>

               {selectedToken.stats && (
                  <div className="space-y-2">
                     <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Характеристики (Клик = Бросок)</h3>
                     <div className="grid grid-cols-6 gap-1.5">
                        {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((stat) => {
                           const val = selectedToken.stats[stat] || 0;
                           return (
                              <button key={stat} onClick={() => rollStat && rollStat(stat, val)} className="flex flex-col items-center justify-center bg-neutral-900 border border-neutral-800 py-2 rounded-xl hover:border-indigo-500 hover:bg-indigo-500/10 transition-all active:scale-95 group">
                                 <span className="text-[9px] font-black text-neutral-500 group-hover:text-indigo-400 uppercase mb-0.5">{stat}</span>
                                 <span className="text-sm font-black text-white">{val >= 0 ? `+${val}` : val}</span>
                              </button>
                           )
                        })}
                     </div>
                  </div>
               )}

               <div className="space-y-3">
                  <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Параметры токена</h3>
                  
                  <div className="flex items-center gap-3">
                     <span className="text-xs font-bold text-neutral-400 w-16">Обзор</span>
                     <input 
                        type="range" min="0" max="1000" step="10" 
                        value={localVision} 
                        onChange={(e) => {
                           const val = Number(e.target.value);
                           setLocalVision(val); 
                           updateSession({ [`tokens.${selectedToken.id}.vision`]: val }); 
                        }} 
                        disabled={!canEditSelected}
                        className="flex-1 accent-amber-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
                     />
                     <span className="text-sm font-mono font-bold text-white w-12 text-right">{localVision}px</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                     <span className="text-xs font-bold text-neutral-400 w-16">Размер</span>
                     <input 
                        type="range" min="20" max="200" step="5" 
                        value={localSize} 
                        onChange={(e) => {
                           const val = Number(e.target.value);
                           setLocalSize(val); 
                           updateSession({ [`tokens.${selectedToken.id}.size`]: val }); 
                        }} 
                        disabled={!canEditSelected}
                        className="flex-1 accent-amber-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
                     />
                     <span className="text-sm font-mono font-bold text-white w-12 text-right">{localSize}px</span>
                  </div>
               </div>

               {selectedToken.attacks && selectedToken.attacks.length > 0 && (
                  <div className="space-y-2">
                     <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Атаки</h3>
                     <div className="space-y-1.5">
                        {selectedToken.attacks.map(atk => (
                           <button key={atk.id} onClick={() => rollAttack && rollAttack(atk)} className="w-full flex items-center justify-between p-3 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-red-500 hover:bg-red-500/10 transition-all group active:scale-95 text-left">
                              <div className="flex flex-col">
                                 <span className="text-xs font-black text-white group-hover:text-red-400 transition-colors">{atk.name}</span>
                                 <span className="text-[9px] font-bold text-neutral-500 uppercase mt-0.5">АТК: <span className="text-white">+{atk.attackBonus}</span> • УРОН: <span className="text-white">{atk.damageDice}{atk.damageBonus ? `+${atk.damageBonus}` : ''}</span></span>
                              </div>
                              <div className="w-8 h-8 rounded-lg bg-neutral-950 group-hover:bg-red-500/20 flex items-center justify-center transition-colors">
                                 <Swords size={14} className="text-neutral-600 group-hover:text-red-500" />
                              </div>
                           </button>
                        ))}
                     </div>
                  </div>
               )}

               <div className="space-y-2">
                  <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-1">Состояния</h3>
                  <div className="flex flex-wrap gap-1.5">
                     
                     {hasShield && (
                        <button 
                           onClick={() => updateSession({ [`tokens.${selectedToken.id}.tempHp`]: 0 })}
                           className="px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all active:scale-90 bg-neutral-800 border-blue-400 text-blue-400 shadow-md"
                           title="Снять щит"
                        >
                           <Shield size={12}/> 
                           <span className="text-[9px] font-black uppercase tracking-wider">Щит ({selectedToken.tempHp})</span>
                        </button>
                     )}

                     {STATUS_EFFECTS.map(effect => {
                        const isActive = (selectedToken.statuses || []).some(s => (typeof s === 'string' ? s === effect.id : s.type === effect.id));
                        return (
                           <button key={effect.id} onClick={() => toggleStatus(selectedToken.id, effect.id)} 
                                   className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all active:scale-90 ${isActive ? `bg-neutral-800 ${effect.bg} ${effect.color} shadow-md` : 'bg-neutral-900 border-neutral-800 text-neutral-600 hover:text-neutral-400 hover:bg-neutral-800'}`}>
                              <effect.icon size={12}/> <span className="text-[9px] font-black uppercase tracking-wider">{effect.label}</span>
                           </button>
                        );
                     })}
                  </div>
               </div>

            </div>
         </div>
      )}
    </div>
  );
});