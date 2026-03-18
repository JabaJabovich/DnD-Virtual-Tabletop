import { useState, useCallback } from 'react';
import { generateId, DELETE_FIELD } from '../utils/helpers';
import { uploadCanvasToStorage } from '../services/socket';

export function useTokens(
  sessionData, updateSession, localTokens, setLocalTokens,
  userRole, myTokenId, setMyTokenId, setCombatSelection,
  containerRef, pan, scale, isFogEnabled, setDiceToasts
) {
  // === СОСТОЯНИЯ ТОКЕНОВ ===
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [draggingTokenId, setDraggingTokenId] = useState(null);
  const [dragPath, setDragPath] = useState(null);
  const [hpInputValue, setHpInputValue] = useState('');

  // === СОСТОЯНИЯ ФОРМЫ СОЗДАНИЯ ТОКЕНА ===
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenType, setNewTokenType] = useState('monster');
  const [newTokenColor, setNewTokenColor] = useState('#ef4444');
  const [newTokenVision, setNewTokenVision] = useState(300);
  const [newTokenHp, setNewTokenHp] = useState(50);
  const [newTokenAc, setNewTokenAc] = useState(10);
  const [newTokenImage, setNewTokenImage] = useState('');
  const [newTokenHidden, setNewTokenHidden] = useState(false);

  // === ФУНКЦИИ ===
  const isTokenVisible = useCallback((token) => {
    try {
        if (userRole === 'gm') return true; 
        if (!token || (token.isHidden && token.id !== myTokenId)) return false; 
        if (!isFogEnabled || token.type === 'player') return true; 

        const tokensArr = Array.isArray(localTokens) ? localTokens : [];
        const players = tokensArr.filter(p => p.type === 'player' && p.vision > 0);
        
        return players.some(p => {
            const tX = Number(token.x) || 0; const tY = Number(token.y) || 0;
            const pX = Number(p.x) || 0; const pY = Number(p.y) || 0;
            const tokenRadius = (Number(token.size) || 60) / 2;

            const dist = Math.hypot(tX - pX, tY - pY);
            if (dist > p.vision + tokenRadius) return false; 
            
            if (Array.isArray(p.fovPolygon) && p.fovPolygon.length > 2) {
                const poly = p.fovPolygon;
                let centerInside = false;
                for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                    const xi = Number(poly[i]?.x)||0, yi = Number(poly[i]?.y)||0;
                    const xj = Number(poly[j]?.x)||0, yj = Number(poly[j]?.y)||0;
                    const intersect = ((yi > tY) !== (yj > tY)) && (tX < (xj - xi) * (tY - yi) / (yj - yi) + xi);
                    if (intersect) centerInside = !centerInside;
                }
                if (centerInside) return true;
                
                const edges = [
                   {x: tX + tokenRadius*0.8, y: tY}, {x: tX - tokenRadius*0.8, y: tY},
                   {x: tX, y: tY + tokenRadius*0.8}, {x: tX, y: tY - tokenRadius*0.8}
                ];
                for (let edge of edges) {
                    let eInside = false;
                    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                        const xi = Number(poly[i]?.x)||0, yi = Number(poly[i]?.y)||0;
                        const xj = Number(poly[j]?.x)||0, yj = Number(poly[j]?.y)||0;
                        const intersect = ((yi > edge.y) !== (yj > edge.y)) && (edge.x < (xj - xi) * (edge.y - yi) / (yj - yi) + xi);
                        if (intersect) eInside = !eInside;
                    }
                    if (eInside) return true;
                }
                return false;
            }
            return true;
        });
    } catch (e) { return true; }
  }, [userRole, isFogEnabled, localTokens, myTokenId]);

  const updateHp = useCallback((id, amount) => {
    if (!amount || isNaN(amount)) return;
    const t = localTokens.find(tok => tok.id === id);
    if(!t) return;

    let newHp = t.hp;
    let newTempHp = t.tempHp || 0;

    if (amount < 0) { 
        let dmg = Math.abs(amount);
        if (newTempHp > 0) {
            if (newTempHp >= dmg) { newTempHp -= dmg; dmg = 0; } 
            else { dmg -= newTempHp; newTempHp = 0; }
        }
        newHp -= dmg;
    } else { 
        newHp += amount;
    }

    if (userRole === 'player' && amount > 0) {
        newHp = Math.min(t.maxHp, newHp);
    }
    newHp = Math.max(0, newHp);
    
    let ds = newHp > 0 ? { successes: 0, failures: 0 } : (t.deathSaves || { successes: 0, failures: 0 });
    updateSession({ [`tokens.${id}.hp`]: newHp, [`tokens.${id}.tempHp`]: newTempHp, [`tokens.${id}.deathSaves`]: ds });
  }, [localTokens, userRole, updateSession]);

  const handleTokenImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
         const canvas = document.createElement('canvas');
         let w = img.width; let h = img.height;
         if (w > 200 || h > 200) { 
             const r = Math.min(200/w, 200/h); w = Math.floor(w*r); h = Math.floor(h*r); 
         }
         canvas.width = w; canvas.height = h;
         const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
         
         const imageUrl = await uploadCanvasToStorage(canvas, 'tokens');
         setNewTokenImage(imageUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const addToken = (e) => {
    e.preventDefault();
    if (userRole !== 'gm') return;
    
    const safeName = newTokenName.trim() || 'Безымянный';
    const safeHp = Number(newTokenHp) || 10;
    const safeAc = Number(newTokenAc) || 10;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const centerX = (containerRect.width / 2 - pan.x) / scale;
    const centerY = (containerRect.height / 2 - pan.y) / scale;
    
    const newToken = { 
      id: generateId(), name: safeName, type: newTokenType, color: newTokenColor, frame: 'solid', 
      x: centerX, y: centerY, size: sessionData.gridConfig?.enabled ? (sessionData.gridConfig.size || 60) : 60, 
      vision: newTokenType === 'player' ? (parseInt(newTokenVision) || 0) : 0, 
      hp: safeHp, maxHp: safeHp, ac: safeAc, image: newTokenImage || null, 
      deathSaves: { successes: 0, failures: 0 }, statuses: [], isHidden: newTokenHidden,
      stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, attacks: [], abilities: '', inventory: ''
    };
    updateSession({ [`tokens.${newToken.id}`]: newToken });
    setNewTokenName(''); setNewTokenImage(''); setNewTokenHidden(false);
  };

  const addTokenFromPreset = (preset) => {
    if (userRole !== 'gm') return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const jitterX = (Math.random() - 0.5) * 40; const jitterY = (Math.random() - 0.5) * 40;
    const centerX = (containerRect.width / 2 - pan.x) / scale + jitterX; 
    const centerY = (containerRect.height / 2 - pan.y) / scale + jitterY;
    
    const newToken = { 
      id: generateId(), name: preset.name || 'Импортированный', type: preset.type || 'monster', color: preset.color || '#ef4444', 
      frame: 'solid', x: centerX, y: centerY, size: sessionData.gridConfig?.enabled ? (sessionData.gridConfig.size || 60) : 60, 
      vision: parseInt(preset.vision || 0), hp: Number(preset.hp) || 1, maxHp: Number(preset.maxHp || preset.hp) || 1, 
      ac: Number(preset.ac) || 10, image: preset.image || null, deathSaves: { successes: 0, failures: 0 }, 
      statuses: [], isHidden: preset.isHidden || false, stats: preset.stats || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, 
      attacks: preset.attacks || [], abilities: preset.abilities || '', inventory: preset.inventory || ''
    };
    updateSession({ [`tokens.${newToken.id}`]: newToken });
  };

  const removeToken = (id) => {
    if (userRole === 'gm' || id === myTokenId) {
      updateSession({ [`tokens.${id}`]: DELETE_FIELD });
      if (id === myTokenId) setMyTokenId(null);
      if (id === selectedTokenId) setSelectedTokenId(null);
      setCombatSelection(prev => prev.filter(cid => cid !== id));
    }
  };

  const updateTokenAc = (id, newAc) => { if (!isNaN(newAc)) updateSession({ [`tokens.${id}.ac`]: Number(newAc) }); };
  
  const toggleStatus = (tokenId, status) => {
    const t = localTokens.find(tok => tok.id === tokenId);
    if(!t) return;
    let st = t.statuses || [];
    const exists = st.some(s => (typeof s === 'string' && s === status) || (typeof s === 'object' && s.type === status));
    if(exists) st = st.filter(s => (typeof s === 'string' ? s !== status : s.type !== status));
    else st = [...st, { type: status, duration: -1 }];
    updateSession({ [`tokens.${tokenId}.statuses`]: st });
  };

  const rollDeathSave = (tokenId) => {
    const t = localTokens.find(tok => tok.id === tokenId);
    if (!t) return;

    const roll = Math.floor(Math.random() * 20) + 1;
    let ds = { ...(t.deathSaves || { successes: 0, failures: 0 }) };
    let hp = t.hp; let extraLog = '';

    if (roll === 1) { ds.failures += 2; extraLog = " (Критический провал!)"; } 
    else if (roll === 20) { ds.successes += 2; extraLog = " (Критический успех!)"; } 
    else if (roll >= 10) { ds.successes += 1; extraLog = " (Успех)"; } 
    else { ds.failures += 1; extraLog = " (Провал)"; }

    if (ds.successes >= 3) { hp = 1; ds = { successes: 0, failures: 0 }; extraLog += " — ПРИШЕЛ В СЕБЯ!"; } 
    else if (ds.failures >= 3) { extraLog += " — ПЕРСОНАЖ ПОГИБ."; }

    const logEntry = { 
      id: generateId(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
      notation: `Спасбросок от смерти: ${roll}${extraLog}`, rolls: String(roll), total: roll, isCrit: roll === 20, isFail: roll === 1, roller: String(t.name) 
    };

    updateSession({ 
      [`tokens.${tokenId}.hp`]: hp,
      [`tokens.${tokenId}.deathSaves`]: ds,
      diceLog: [logEntry, ...(sessionData.diceLog || [])].slice(0, 50) 
    });
    
    setLocalTokens(prev => prev.map(tok => tok.id === tokenId ? { ...tok, hp, deathSaves: ds } : tok));
    const toastId = logEntry.id; setDiceToasts(prev => [...prev, { ...logEntry, toastId }]);
    setTimeout(() => { setDiceToasts(prev => prev.filter(toast => toast.toastId !== toastId)); }, 4000);
  };

  return {
    selectedTokenId, setSelectedTokenId, draggingTokenId, setDraggingTokenId,
    dragPath, setDragPath, hpInputValue, setHpInputValue,
    newTokenName, setNewTokenName, newTokenType, setNewTokenType,
    newTokenColor, setNewTokenColor, newTokenVision, setNewTokenVision,
    newTokenHp, setNewTokenHp, newTokenAc, setNewTokenAc,
    newTokenImage, setNewTokenImage, newTokenHidden, setNewTokenHidden,
    isTokenVisible, updateHp, handleTokenImageUpload, addToken, 
    addTokenFromPreset, removeToken, updateTokenAc, toggleStatus, rollDeathSave
  };
}