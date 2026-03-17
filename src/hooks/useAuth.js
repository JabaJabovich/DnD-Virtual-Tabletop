import { useState, useEffect } from 'react';
import { socket, uploadCanvasToStorage } from '../services/socket';
import { generateId } from '../utils/helpers';

export function useAuth(updateSession, activeSessionId, localTokens) {
  const [accounts, setAccounts] = useState([]); 
  const [authStep, setAuthStep] = useState('auth'); 
  const [authMode, setAuthMode] = useState('login'); 
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [regImage, setRegImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeCharId, setActiveCharId] = useState(null);
  const [userRole, setUserRole] = useState('player'); 
  const [myTokenId, setMyTokenId] = useState(null); 
  const [loginHp, setLoginHp] = useState(100);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState({});

  useEffect(() => {
    socket.emit('get_accounts', (data) => setAccounts(data));
    
    const handleAccountsUpdated = (data) => {
        setAccounts(data);
        setCurrentUser(prev => prev ? data.find(a => a.id === prev.id) || prev : prev);
    };
    
    socket.on('accounts_updated', handleAccountsUpdated);
    
    return () => {
        socket.off('accounts_updated', handleAccountsUpdated);
    };
  }, []);

  const safeCharacters = Array.isArray(currentUser?.characters) ? currentUser.characters : [];
  const activeCharacter = safeCharacters.find(c => c.id === activeCharId) || safeCharacters[0] || {};

  const handleRegImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
         const canvas = document.createElement('canvas');
         let w = img.width; let h = img.height;
         if (w > 200 || h > 200) { const r = Math.min(200/w, 200/h); w = Math.floor(w*r); h = Math.floor(h*r); }
         canvas.width = w; canvas.height = h;
         const ctx = canvas.getContext('2d');
         ctx.drawImage(img, 0, 0, w, h);
         const imageUrl = await uploadCanvasToStorage(canvas, 'avatars');
         setRegImage(imageUrl);
      };
      img.src = ev.target.result; 
    };
    reader.readAsDataURL(file);
  };

  const handleAuth = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanUsername = username.trim(); 
    const cleanPassword = password.trim();
    
    if (!cleanUsername || !cleanPassword) return alert('Введите логин и пароль!');

    if (authMode === 'register') {
      if (accounts.some(a => a.username.toLowerCase() === cleanUsername.toLowerCase())) return alert('Логин уже занят!');
      
      const initialCharId = generateId();
      const newAcc = { 
        id: generateId(), username: cleanUsername, password: cleanPassword, 
        characters: [{
           id: initialCharId, name: cleanUsername, image: regImage || null, ac: 10, 
           stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, tokenColor: '#3b82f6', tokenFrame: 'solid' },
           attacks: [], inventory: '', abilities: ''
        }]
      };
      
      socket.emit('save_account', newAcc);
      setCurrentUser(newAcc); setActiveCharId(initialCharId); setRegImage(null); setAuthStep('profile');
    } else {
      const acc = accounts.find(a => a.username.toLowerCase() === cleanUsername.toLowerCase() && a.password === cleanPassword);
      if (acc) { 
         if (!acc.characters || acc.characters.length === 0) {
            const migratedChar = { 
                id: generateId(), name: acc.username, image: acc.image || null, ac: acc.ac || 10, 
                stats: acc.stats || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, tokenColor: '#3b82f6', tokenFrame: 'solid' }, 
                attacks: [], inventory: acc.inventory || '', abilities: acc.abilities || '' 
            };
            acc.characters = [migratedChar];
            socket.emit('save_account', acc);
         }
         setCurrentUser(acc); setActiveCharId(acc.characters[0].id); setRegImage(null); setAuthStep('profile'); 
      } else {
         alert('Неверные данные! Или аккаунт не найден.');
      }
    }
  };

  const startEditingProfile = () => {
    let parsedAbilities = [];
    if (Array.isArray(activeCharacter.abilities)) { 
        parsedAbilities = activeCharacter.abilities.map(a => ({ ...a, dmgCount: a.dmgCount || 0, dmgSides: a.dmgSides || 6, tickCount: a.tickCount || 0, tickSides: a.tickSides || 4 })); 
    } else if (typeof activeCharacter.abilities === 'string' && activeCharacter.abilities.trim() !== '') { 
        parsedAbilities = [{ id: generateId(), name: 'Старые записи', description: activeCharacter.abilities, dmgCount: 0, dmgSides: 6, damageBonus: 0, effectType: 'none', effectDuration: 1, tickCount: 0, tickSides: 4 }]; 
    }
    
    setTempProfile({ 
        id: activeCharacter.id, name: activeCharacter.name || activeCharacter.username, image: activeCharacter.image || '', 
        inventory: activeCharacter.inventory || '', abilities: parsedAbilities, attacks: activeCharacter.attacks || [], 
        ac: activeCharacter.ac || 10, tokenColor: activeCharacter.stats?.tokenColor || '#3b82f6', tokenFrame: activeCharacter.stats?.tokenFrame || 'solid', 
        stats: activeCharacter.stats ? { ...activeCharacter.stats } : { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } 
    });
    setIsEditingProfile(true);
  };

  const handleProfileImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
         const canvas = document.createElement('canvas');
         let w = img.width; let h = img.height;
         if (w > 200 || h > 200) { const r = Math.min(200/w, 200/h); w = Math.floor(w*r); h = Math.floor(h*r); }
         canvas.width = w; canvas.height = h;
         const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
         const imageUrl = await uploadCanvasToStorage(canvas, 'avatars');
         setTempProfile({...tempProfile, image: imageUrl});
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const adjustStat = (stat, amount) => {
      setTempProfile(p => ({ ...p, stats: { ...(p.stats || {}), [stat]: Math.max(-5, Math.min(5, (p.stats?.[stat] || 0) + amount)) } }));
  };

  const saveProfile = () => {
    const updatedStats = { ...(tempProfile.stats || { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }), tokenColor: tempProfile.tokenColor, tokenFrame: tempProfile.tokenFrame };
    const updatedChar = { ...activeCharacter, ...tempProfile, stats: updatedStats };
    delete updatedChar.tokenColor; delete updatedChar.tokenFrame;

    const updatedCharacters = safeCharacters.map(c => c.id === activeCharacter.id ? updatedChar : c);
    const updatedUser = { ...currentUser, characters: updatedCharacters };
    
    socket.emit('save_account', updatedUser);
    setCurrentUser(updatedUser);
    setIsEditingProfile(false);
    
    if (myTokenId && activeSessionId) {
        const myCurrentToken = localTokens.find(t => t.id === myTokenId);
        if (myCurrentToken && myCurrentToken.characterId === activeCharacter.id) {
            updateSession({ 
                [`tokens.${myTokenId}.name`]: updatedChar.name || updatedChar.username, 
                [`tokens.${myTokenId}.color`]: updatedStats.tokenColor, 
                [`tokens.${myTokenId}.frame`]: updatedStats.tokenFrame, 
                [`tokens.${myTokenId}.image`]: updatedChar.image, 
                [`tokens.${myTokenId}.ac`]: updatedChar.ac 
            });
        }
    }
  };

  const saveProfileFieldLive = (field, value) => {
    if (userRole === 'gm' && myTokenId) {
        const controlledToken = localTokens.find(t => t.id === myTokenId);
        if (controlledToken && controlledToken.type !== 'player') {
            updateSession({ [`tokens.${myTokenId}.${field}`]: value });
            return;
        }
    }
    if (!currentUser?.id || !activeCharacter) return;
    const updatedCharacters = safeCharacters.map(c => c.id === activeCharacter.id ? { ...c, [field]: value } : c);
    const updatedUser = { ...currentUser, characters: updatedCharacters };
    setCurrentUser(updatedUser);
    socket.emit('save_account', updatedUser);
  };

  const deleteCharacter = (charId) => {
    if (safeCharacters.length <= 1) return alert("У вас должен остаться хотя бы один персонаж!");
    if (!window.confirm("Вы уверены?")) return;
    
    const updatedCharacters = safeCharacters.filter(c => c.id !== charId);
    const updatedUser = { ...currentUser, characters: updatedCharacters };
    
    socket.emit('save_account', updatedUser);
    setCurrentUser(updatedUser);
    if (activeCharId === charId) setActiveCharId(updatedCharacters[0].id);
    setIsEditingProfile(false);
  };

  return {
    accounts, authStep, setAuthStep, authMode, setAuthMode,
    username, setUsername, password, setPassword, regImage, setRegImage,
    currentUser, setCurrentUser, activeCharId, setActiveCharId,
    userRole, setUserRole, myTokenId, setMyTokenId, loginHp, setLoginHp,
    isEditingProfile, setIsEditingProfile, tempProfile, setTempProfile,
    safeCharacters, activeCharacter,
    handleRegImageUpload, handleAuth, startEditingProfile, 
    handleProfileImageUpload, adjustStat, saveProfile, 
    saveProfileFieldLive, deleteCharacter
  };
}