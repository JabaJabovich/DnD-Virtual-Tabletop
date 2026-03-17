import React, { useState } from 'react';
import { Swords, Dices, Target, X, Sparkles } from 'lucide-react';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

export default React.memo(function AttackRollModal({
  pendingAttack, setPendingAttack, selectedTokenId, localTokens, myTokenId, userRole,
  updateHp, addMapPing, updateSession, sessionData, activeCharacter, executeAbility, rollDice
}) {
  const [step, setStep] = useState('hit'); 
  const [hitResult, setHitResult] = useState(null);
  const [rollMode, setRollMode] = useState('normal'); 
  const [isRolling, setIsRolling] = useState(false);

  if (!pendingAttack) return null;

  const target = localTokens.find(t => t.id === selectedTokenId);
  const isAbility = pendingAttack.isAbility;
  const isSave = isAbility && pendingAttack.hasSave; 
  const Icon = isAbility ? Sparkles : Swords;

  const handleSendSaveRequest = async () => {
     setIsRolling(true);
     try {
         let dmgTotal = 0;
         if (!pendingAttack.noDamage && pendingAttack.dmgCount > 0) {
             const count = pendingAttack.dmgCount || 1;
             const sides = pendingAttack.dmgSides || 6;
             const dmgBonus = Number(pendingAttack.damageBonus) || 0;

             let dmgNotation = `${count}d${sides}`;
             if (dmgBonus > 0) dmgNotation += `+${dmgBonus}`;
             else if (dmgBonus < 0) dmgNotation += `${dmgBonus}`;

             dmgTotal = await rollDice(dmgNotation, `Урон/Эффект (Спасбросок): ${pendingAttack.name}`);
         }

         updateSession({
             activeSaveRequest: {
                 id: generateId(),
                 targetId: target?.id || null,
                 ability: pendingAttack,
                 damage: dmgTotal,
                 sourceName: activeCharacter?.name || 'Враг'
             }
         });
     } catch(e) { console.error(e); } finally { setIsRolling(false); close(); }
  };

  // === 2. АСИНХРОННЫЙ БРОСОК НА ПОПАДАНИЕ ===
  const handleHitRoll = async () => {
     setIsRolling(true);
     try {
         const atkBonus = Number(pendingAttack.attackBonus) || 0;
         
         let notation = '1d20';
         let modeLabel = '';
         if (rollMode === 'adv') { notation = '2d20kh1'; modeLabel = ' (С преимуществом)'; }
         else if (rollMode === 'dis') { notation = '2d20kl1'; modeLabel = ' (С помехой)'; }
         
         if (atkBonus > 0) notation += `+${atkBonus}`;
         else if (atkBonus < 0) notation += `${atkBonus}`;

         // ЖДЕМ ПАДЕНИЯ 3D КУБИКА (Запрашиваем сырые значения кубиков, передав true)
         const result = await rollDice(notation, `${isAbility ? 'Способность' : 'Атака'}: ${pendingAttack.name}`, true);
         
         const total = typeof result === 'object' ? result.total : result;
         const rawRolls = typeof result === 'object' ? result.rawRolls : [];
         
         const rawRoll = total - atkBonus; 
         const isCrit = rawRoll === 20;
         const isFail = rawRoll === 1;
         
         let isHit = null;
         if (target) {
            isHit = isCrit || (!isFail && total >= (target.ac || 10));
         }
         
         // Формируем красивую строку (например: "11 и 12" вместо просто "12")
         const rollsStr = rawRolls.length > 0 ? rawRolls.join(' и ') : rawRoll.toString();
         
         setHitResult({ roll: rawRoll, rollsStr, total, isCrit, isFail, isHit, atkBonus, modeLabel });
         setStep('damage');
         
         if (target) addMapPing(target.id, isHit ? 'hit' : 'miss');
     } catch (err) {
         console.error("Ошибка при броске атаки:", err);
     } finally {
         setIsRolling(false);
     }
  };

  const handleDamageRoll = async () => {
     const isHeal = pendingAttack.effectType === 'heal';
     const isShield = pendingAttack.effectType === 'shield';

     // 1. НАКЛАДЫВАЕМ ИКОНКУ СТАТУСА НА КАРТЕ
     if (pendingAttack.effectType && pendingAttack.effectType !== 'none' && target) {
         let st = target.statuses || [];
         if (!st.some(s => (typeof s === 'string' ? s === pendingAttack.effectType : s.type === pendingAttack.effectType))) {
             st = [...st, { type: pendingAttack.effectType, duration: pendingAttack.effectDuration || -1 }];
             updateSession({ [`tokens.${target.id}.statuses`]: st });
         }
     }

     // 2. ЕСЛИ ГАЛОЧКА "БЕЗ УРОНА" - ПРОСТО ЗАКРЫВАЕМ ОКНО
     if (isAbility && pendingAttack.noDamage) {
         if (executeAbility) executeAbility(pendingAttack, hitResult?.isCrit);
         close(); 
         return;
     }

     // 3. БРОСАЕМ КУБИКИ ДЛЯ УРОНА/ХИЛА/ЩИТА
     setIsRolling(true);
     try {
         const [countStr, sidesStr] = (pendingAttack.damageDice || '1d6').toLowerCase().split('d');
         const count = parseInt(countStr) || 1; const sides = parseInt(sidesStr) || 6;
         const dmgBonus = Number(pendingAttack.damageBonus) || 0;
         const diceToRoll = hitResult?.isCrit ? count * 2 : count; 
         
         let dmgNotation = `${diceToRoll}d${sides}`;
         if (dmgBonus > 0) dmgNotation += `+${dmgBonus}`; else if (dmgBonus < 0) dmgNotation += `${dmgBonus}`;

         const actionName = isHeal ? 'Лечение' : isShield ? 'Щит (Врем. ХП)' : 'Урон';
         const dmgTotal = await rollDice(dmgNotation, `${actionName}: ${pendingAttack.name}`);

         if (target) { 
             if (isHeal) {
                 // ХИЛЛ: Лечим (Прибавляем ХП)
                 updateHp(target.id, dmgTotal); 
                 if (addMapPing) addMapPing(target.id, 'heal', dmgTotal);
             } else if (isShield) {
                 // ЩИТ: Добавляем Временные ХП (tempHp)
                 updateSession({ [`tokens.${target.id}.tempHp`]: dmgTotal });
                 if (addMapPing) addMapPing(target.id, 'shield', dmgTotal);
             } else {
                 // УРОН: Сначала бьем по Щиту, потом по основному здоровью
                 const currentTempHp = target.tempHp || 0;
                 if (currentTempHp > 0) {
                     const remain = currentTempHp - dmgTotal;
                     if (remain >= 0) {
                         // Щит выдержал весь удар
                         updateSession({ [`tokens.${target.id}.tempHp`]: remain });
                     } else {
                         // Щит пробит, остаток урона идет в ХП
                         updateSession({ [`tokens.${target.id}.tempHp`]: 0 });
                         updateHp(target.id, remain); // remain - отрицательное число, наносит урон
                     }
                 } else {
                     updateHp(target.id, -dmgTotal); 
                 }
                 if (addMapPing) addMapPing(target.id, 'damage', dmgTotal); 
             }
         }
     } catch (err) { console.error(err); } finally { setIsRolling(false); close(); }
  };

  const close = () => { setPendingAttack(null); setStep('hit'); setHitResult(null); setRollMode('normal'); };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-[slideIn_0.2s_ease-out]">
       <div className="bg-neutral-900 border border-neutral-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
             <h3 className="text-lg font-black text-white flex items-center gap-2"><Icon className={isAbility ? "text-purple-500" : "text-red-500"}/> {pendingAttack.name}</h3>
             <button onClick={close} className="text-neutral-500 hover:text-white"><X size={20}/></button>
          </div>

          {target ? (
             <div className="flex items-center gap-2 bg-neutral-950 p-2 rounded-xl border border-neutral-800">
                <Target size={16} className="text-amber-500"/>
                <span className="text-sm font-bold text-neutral-300">Цель: <span className="text-white">{target.name}</span></span>
                <span className="ml-auto text-xs bg-neutral-800 px-2 py-1 rounded text-neutral-400">AC {target.ac || 10}</span>
             </div>
          ) : (
             <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded-xl text-center border border-amber-500/20">
                {isSave ? "Выберите токен на карте, чтобы отправить ему запрос" : "Выберите токен врага для авто-урона"}
             </div>
          )}

          {isSave ? (
             <div className="flex flex-col gap-3 mt-2">
                 <div className="bg-purple-900/20 border border-purple-500/50 p-3 rounded-xl text-center">
                     <span className="block text-xs font-bold text-purple-400 mb-1">Требует спасбросок:</span>
                     <span className="text-xl font-black text-white uppercase">{pendingAttack.saveStat} (СЛ {pendingAttack.saveDC})</span>
                 </div>
                 <button onClick={handleSendSaveRequest} disabled={isRolling} className="w-full py-4 text-white rounded-xl font-black uppercase tracking-wider flex justify-center items-center gap-2 transition-all active:scale-95 shadow-lg bg-purple-600 hover:bg-purple-500 shadow-purple-900/30">
                     <Sparkles size={20}/> {pendingAttack.noDamage ? 'Запросить спасбросок' : 'Бросить урон и отправить'}
                 </button>
             </div>
          ) : (
             <>
                 {step === 'hit' && (
                    <div className="flex flex-col gap-3 mt-2">
                       <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                          <button onClick={() => setRollMode('dis')} disabled={isRolling} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${rollMode === 'dis' ? 'bg-orange-900/30 text-orange-400 shadow-inner' : 'text-neutral-500 hover:text-white'}`}>Помеха</button>
                          <button onClick={() => setRollMode('normal')} disabled={isRolling} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${rollMode === 'normal' ? 'bg-neutral-800 text-white shadow-inner' : 'text-neutral-500 hover:text-white'}`}>Обычный</button>
                          <button onClick={() => setRollMode('adv')} disabled={isRolling} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${rollMode === 'adv' ? 'bg-green-900/30 text-green-400 shadow-inner' : 'text-neutral-500 hover:text-white'}`}>Преим.</button>
                       </div>
                       <button onClick={handleHitRoll} disabled={isRolling} className={`w-full py-4 text-white rounded-xl font-black uppercase tracking-wider flex justify-center items-center gap-2 transition-all active:scale-95 shadow-lg ${rollMode === 'adv' ? 'bg-green-600 hover:bg-green-500' : rollMode === 'dis' ? 'bg-orange-600 hover:bg-orange-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                          <Dices size={20}/> Бросить на попадание
                       </button>
                    </div>
                 )}
                 {step === 'damage' && hitResult && (
                    <div className="flex flex-col gap-4 animate-[slideIn_0.2s_ease-out]">
                       <div className={`p-4 rounded-2xl text-center border ${hitResult.isHit === true || hitResult.isCrit ? 'bg-green-900/20 border-green-500/50' : hitResult.isHit === false || hitResult.isFail ? 'bg-red-900/20 border-red-500/50' : 'bg-neutral-800 border-neutral-700'}`}>
                          <span className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Результат броска {hitResult.modeLabel}</span>
                          <span className={`text-4xl font-black ${hitResult.isCrit ? 'text-green-400' : hitResult.isFail ? 'text-red-500' : 'text-white'}`}>{hitResult.total}</span>
                          <span className="text-xs text-neutral-400 block mt-1">(Бросок: {hitResult.rollsStr} {hitResult.atkBonus >= 0 ? `+ ${hitResult.atkBonus}` : `- ${Math.abs(hitResult.atkBonus)}`})</span>
                          {hitResult.isHit !== null && (<div className={`mt-2 text-sm font-black uppercase tracking-widest ${hitResult.isHit ? 'text-green-400' : 'text-red-500'}`}>{hitResult.isHit ? 'ПОПАДАНИЕ!' : 'ПРОМАХ'}</div>)}
                       </div>
                       {(hitResult.isHit !== false) && (
                          <button onClick={handleDamageRoll} className={`w-full py-4 text-white rounded-xl font-black uppercase tracking-wider flex justify-center items-center gap-2 transition-all active:scale-95 shadow-lg ${isAbility ? 'bg-purple-600 hover:bg-purple-500' : 'bg-red-600 hover:bg-red-500'}`}>
                             <Icon size={20}/> {isAbility && pendingAttack.noDamage ? 'Применить эффект' : isAbility && pendingAttack.effectType === 'heal' ? 'Вылечить (ХП)' : isAbility && pendingAttack.effectType === 'shield' ? 'Дать Щит (ВХП)' : 'Нанести урон'}
                          </button>
                       )}
                    </div>
                 )}
             </>
          )}
       </div>
    </div>
  );
});