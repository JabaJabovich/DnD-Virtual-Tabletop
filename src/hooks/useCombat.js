import { useState } from 'react';

// Безопасный генератор ID
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

export function useCombat(
  sessionData, 
  updateSession, 
  localTokens, 
  selectedTokenId, 
  myTokenId, 
  activeCharacter, 
  userRole, 
  setPendingAttack, 
  updateHp, 
  addMapPing
) {
  const [combatSelection, setCombatSelection] = useState([]);

  const toggleCombatSelection = (id) => {
    setCombatSelection(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  };
  
  const startCombat = () => {
    const combatants = localTokens
      .filter(t => combatSelection.includes(t.id))
      .map(t => ({ 
          id: t.id, 
          name: String(t.name), 
          initiative: Math.floor(Math.random() * 20) + 1 + (t.stats?.dex || 0) 
      }))
      .sort((a, b) => b.initiative - a.initiative);
      
    if (combatants.length > 0) { 
        updateSession({ 
            combatState: { isActive: true, order: combatants, currentTurnIndex: 0, currentTurnAP: { main: true, bonus: true, move: true } } 
        }); 
        setCombatSelection([]); 
    } 
    else alert("Выберите существ галочками!");
  };
  
  const endCombat = () => { 
    updateSession({ combatState: { isActive: false, order: [], currentTurnIndex: 0 } }); 
    setCombatSelection([]); 
  };
  
  const nextTurn = () => {
    if (!sessionData.combatState?.isActive) return;
    const nextIdx = (sessionData.combatState.currentTurnIndex + 1) % sessionData.combatState.order.length;
    
    const nextTokenId = sessionData.combatState.order[nextIdx].id;
    const targetToken = localTokens.find(t => t.id === nextTokenId);
    
    let updates = { 
        'combatState.currentTurnIndex': nextIdx,
        'combatState.currentTurnAP': { main: true, bonus: true, move: true }
    };
    
    let combatLog = [];

    if (targetToken && targetToken.statuses) {
        let changed = false;
        let hpUpdate = targetToken.hp;
        let tempHpUpdate = targetToken.tempHp || 0;

        const newStatuses = targetToken.statuses.map(s => {
            if (typeof s === 'object' && s.duration > 0) {
                changed = true;
                if (s.tickCount > 0 && s.tickSides > 0 && targetToken.hp > 0) {
                    let dmg = 0;
                    for(let i=0; i < s.tickCount; i++) dmg += Math.floor(Math.random() * s.tickSides) + 1;
                    
                    if (tempHpUpdate >= dmg) { tempHpUpdate -= dmg; dmg = 0; } 
                    else { dmg -= tempHpUpdate; tempHpUpdate = 0; }
                    hpUpdate -= dmg;

                    combatLog.push(`🩸 ${targetToken.name} получает ${dmg} урона от эффекта!`);
                }
                return { ...s, duration: s.duration - 1 };
            }
            return s;
        }).filter(s => typeof s === 'string' || s.duration > 0 || s.duration === -1); 

        if (changed || newStatuses.length !== targetToken.statuses.length) {
            updates[`tokens.${nextTokenId}.statuses`] = newStatuses;
            if (hpUpdate !== targetToken.hp || tempHpUpdate !== targetToken.tempHp) {
                updates[`tokens.${nextTokenId}.hp`] = Math.max(0, hpUpdate);
                updates[`tokens.${nextTokenId}.tempHp`] = tempHpUpdate;
            }
        }
    }
    updateSession(updates);
    
    if (combatLog.length > 0) {
        const logEntry = { id: generateId(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), notation: `Конец эффектов`, rolls: combatLog.join('\n'), total: 0, isCrit: false, isFail: false, roller: 'Система' };
        updateSession({ diceLog: [logEntry, ...(sessionData.diceLog || [])].slice(0, 50) });
    }
  };

  const executeAbility = (ability, isCrit = false) => {
    let damageTotal = 0;
    let rollLog = '';
    
    const dmgBonus = Number(ability.damageBonus) || 0;

    if (ability.dmgCount > 0 && ability.dmgSides > 0) {
        const dmgRolls = [];
        const diceToRoll = isCrit ? ability.dmgCount * 2 : ability.dmgCount;
        for (let i = 0; i < diceToRoll; i++) {
            const r = Math.floor(Math.random() * ability.dmgSides) + 1;
            dmgRolls.push(r); damageTotal += r;
        }
        damageTotal += dmgBonus;
        const dmgModStr = dmgBonus !== 0 ? (dmgBonus > 0 ? `+${dmgBonus}` : dmgBonus) : '';
        rollLog = `${ability.effectType === 'heal' ? 'Лечение' : ability.effectType === 'shield' ? 'Щит (Временные HP)' : 'Бросок'}: [${dmgRolls.join(', ')}]${dmgModStr} = ${damageTotal}\n`;
    } else if (dmgBonus > 0) {
        damageTotal = dmgBonus;
        rollLog = `${ability.effectType === 'heal' ? 'Лечение' : ability.effectType === 'shield' ? 'Щит (Временные HP)' : 'Бросок'}: ${damageTotal}\n`;
    }

    let effectLog = '';
    if (selectedTokenId) {
        const target = localTokens.find(t => t.id === selectedTokenId);
        if (target) {
            if (ability.effectType === 'heal') {
                 updateHp(target.id, damageTotal);
                 effectLog = `💚 Цель ${target.name} исцелена!\n`;
            } else if (ability.effectType === 'shield') {
                 updateSession({ [`tokens.${target.id}.tempHp`]: Math.max(target.tempHp || 0, damageTotal) });
                 effectLog = `🛡️ ${target.name} получает ${damageTotal} Временных HP!\n`;
            } else if (ability.effectType && ability.effectType !== 'none') {
                const existingStatuses = target.statuses || [];
                const newStatuses = [...existingStatuses.filter(s => (typeof s === 'string' ? s !== ability.effectType : s.type !== ability.effectType)), { type: ability.effectType, duration: ability.effectDuration || 1, tickCount: ability.tickCount || 0, tickSides: ability.tickSides || 0 }];
                updateSession({ [`tokens.${target.id}.statuses`]: newStatuses });
                
                const effectNames = { 'fire': 'Горение', 'poison': 'Отравление', 'bleed': 'Кровотечение', 'stun': 'Оглушение', 'restrain': 'Опутывание', 'invisible': 'Невидимость' };
                effectLog = `✨ Наложен эффект: ${effectNames[ability.effectType] || ability.effectType} (${ability.effectDuration || 1} ход.) на ${target.name}\n`;
                if (ability.tickCount > 0) effectLog += `   (Периодический урон: ${ability.tickCount}d${ability.tickSides})\n`;
            } else {
                effectLog = `🎯 Цель: ${target.name}\n`;
            }

            if (damageTotal > 0 && ability.effectType !== 'heal' && ability.effectType !== 'shield') {
                 updateHp(target.id, -damageTotal);
                 addMapPing(target.id, 'damage', damageTotal);
            }
        }
    } else if (ability.effectType && ability.effectType !== 'none' && ability.effectType !== 'heal' && ability.effectType !== 'shield') {
        effectLog = `⚠️ Эффект не применен: Выберите цель!\n`;
    }

    const descLog = ability.description ? `\n📝 ${ability.description}` : '';

    const logEntry = {
        id: generateId(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        notation: `${isCrit ? '💥 КРИТ ' : ''}Урон/Эффект: ${ability.name}`,
        rolls: rollLog + effectLog + descLog,
        total: damageTotal, isCrit: isCrit, isFail: false, roller: activeCharacter?.name || activeCharacter?.username || 'Игрок'
    };

    updateSession({ diceLog: [logEntry, ...(sessionData.diceLog || [])].slice(0, 50) });
  };

  const useAbility = (ability) => {
    if (ability.effectType === 'heal' || ability.effectType === 'shield') {
        executeAbility(ability, false);
    } else {
        setPendingAttack({ ...ability, isAbility: true, attackBonus: 0 });
    }
  };

  return {
    combatSelection, setCombatSelection, toggleCombatSelection,
    startCombat, endCombat, nextTurn, executeAbility, useAbility
  };
}