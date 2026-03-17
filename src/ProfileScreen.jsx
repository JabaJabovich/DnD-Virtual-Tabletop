import React from 'react';
import { User, Plus, LogOut, Upload, Shield, Trash2, Edit3, Backpack, Sparkles, Swords, Save } from 'lucide-react';

// Безопасный генератор ID
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

export default function ProfileScreen({
  currentUser, setCurrentUser,
  activeCharId, setActiveCharId,
  activeCharacter,
  supabase,
  isEditingProfile, setIsEditingProfile,
  tempProfile, setTempProfile,
  handleProfileImageUpload,
  adjustStat,
  saveProfile,
  deleteCharacter,
  setAuthStep, syncAccount, 
  setUsername, setPassword, setRegImage
}) {

  const safeCharacter = activeCharacter || {};
  const safeChar = activeCharacter || {};

  const handleAddCharacter = () => {
    const newCharId = generateId();
    const newChar = { 
      id: newCharId, name: 'Новый Герой', image: null, ac: 10, 
      stats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, tokenColor: '#3b82f6', tokenFrame: 'solid', tokenPulse: true }, 
      attacks: [], inventory: '', abilities: [] 
    };
    
    const updatedChars = [...(Array.isArray(currentUser?.characters) ? currentUser.characters : []), newChar];
    const updatedUser = { ...currentUser, characters: updatedChars };
    
    if (syncAccount) syncAccount(updatedUser);
    
    setCurrentUser(updatedUser);
    setActiveCharId(newCharId);
    
    setTempProfile(newChar);
    setIsEditingProfile(true);
  };

  const handleDeleteCharacter = () => {
    if (!safeChar.id) return;
    const confirmDelete = window.confirm(`Вы уверены, что хотите безвозвратно удалить героя "${safeChar.name}"?`);
    if (!confirmDelete) return;

    if (typeof deleteCharacter === 'function') {
        deleteCharacter(safeChar.id);
    } else {
        const updatedChars = (currentUser?.characters || []).filter(c => c.id !== safeChar.id);
        const updatedUser = { ...currentUser, characters: updatedChars };
        
        if (syncAccount) syncAccount(updatedUser);
        
        setCurrentUser(updatedUser);
        setActiveCharId(updatedChars.length > 0 ? updatedChars[0].id : null);
        setIsEditingProfile(false);
    }
  };

  const handleEditClick = () => {
    let parsedAbilities = [];
    
    if (Array.isArray(safeChar.abilities)) {
        parsedAbilities = safeChar.abilities.map(a => ({ 
            ...a, 
            dmgCount: a.dmgCount || 0, 
            dmgSides: a.dmgSides || 6, 
            tickCount: a.tickCount || 0, 
            tickSides: a.tickSides || 4,
            hasSave: a.hasSave || false,
            saveStat: a.saveStat || 'dex',
            saveDC: a.saveDC || 12,
            noDamage: a.noDamage || false
        }));
    } else if (typeof safeChar.abilities === 'string' && safeChar.abilities.trim() !== '') {
        parsedAbilities = [{ id: generateId(), name: 'Старые записи', description: safeChar.abilities, dmgCount: 0, dmgSides: 6, damageBonus: 0, effectType: 'none', effectDuration: 1, tickCount: 0, tickSides: 4, hasSave: false, saveStat: 'dex', saveDC: 12, noDamage: false }];
    }
    
    setTempProfile({ 
      id: safeChar.id, 
      name: safeChar.name || safeChar.username || '', 
      image: safeChar.image || '', 
      inventory: safeChar.inventory || '', 
      abilities: parsedAbilities, 
      attacks: safeChar.attacks || [], 
      ac: safeChar.ac || 10, 
      tokenColor: safeChar.stats?.tokenColor || '#3b82f6', 
      tokenFrame: safeChar.stats?.tokenFrame || 'solid', 
      tokenPulse: safeChar.stats?.tokenPulse !== false,
      stats: safeChar.stats ? { ...safeChar.stats } : { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 } 
    });
    
    setIsEditingProfile(true);
  };

  return (
    <div className="absolute inset-0 z-[100] bg-neutral-950 flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-neutral-950">
      
      {/* ПАНЕЛЬ ВЫБОРА ГЕРОЕВ */}
      <div className="w-full max-w-5xl mb-4 bg-neutral-900/60 backdrop-blur-xl border border-neutral-800/80 rounded-3xl p-4 flex gap-4 overflow-x-auto custom-scrollbar items-center shadow-lg">
         <span className="text-xs font-black text-neutral-500 uppercase tracking-widest whitespace-nowrap px-2">Ваши герои:</span>
         {Array.isArray(currentUser?.characters) && currentUser.characters.map(char => (
            <button 
              key={char.id} 
              onClick={() => { setActiveCharId(char.id); setIsEditingProfile(false); }}
              className={`flex items-center gap-3 px-4 py-2 rounded-2xl transition-all border ${activeCharId === char.id ? 'bg-indigo-600 border-indigo-500 shadow-md shadow-indigo-900/30 text-white' : 'bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'}`}
            >
               {char.image ? <img src={char.image} alt="avatar" className="w-8 h-8 rounded-full object-cover border border-black/50" draggable="false" /> : <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700"><User size={14}/></div>}
               <span className="font-bold text-sm truncate max-w-[120px]">{char.name}</span>
            </button>
         ))}
         
         <div className="ml-auto flex items-center gap-2 pl-4 border-l border-neutral-800">
           <button onClick={handleAddCharacter} className="p-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-colors shadow-sm" title="Создать нового героя">
             <Plus size={20} />
           </button>
           <button onClick={() => { setCurrentUser(null); setActiveCharId(null); setUsername(''); setPassword(''); setRegImage(null); setAuthStep('auth'); }} className="p-3 bg-red-900/20 hover:bg-red-900/40 text-red-500 rounded-xl transition-colors border border-red-900/30" title="Выйти из аккаунта">
             <LogOut size={20} />
           </button>
         </div>
      </div>

      <div className="w-full max-w-5xl bg-neutral-900/80 backdrop-blur-xl border border-neutral-800/80 p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col h-[80vh] animate-[slideIn_0.3s_ease-out]">
         
         {/* ШАПКА ПРОФИЛЯ */}
         <div className="flex justify-between items-start mb-6 shrink-0 border-b border-neutral-800/80 pb-6">
            <div className="flex items-center gap-6">
               <div className="relative group">
                 {isEditingProfile ? (
                    <label className="w-28 h-28 rounded-full bg-neutral-950 flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-indigo-500 text-indigo-400 hover:bg-neutral-900 transition-colors shadow-inner overflow-hidden relative">
                       {tempProfile.image && <img src={tempProfile.image} className="absolute inset-0 w-full h-full object-cover opacity-30" draggable="false" />}
                       <Upload size={24} className="mb-1 relative z-10" />
                       <span className="text-[10px] font-bold uppercase relative z-10">Аватар</span>
                       <input type="file" accept="image/*" onChange={handleProfileImageUpload} className="hidden" />
                    </label>
                 ) : (
                    <div className="w-28 h-28 rounded-full bg-neutral-950 flex items-center justify-center border-[3px] shadow-xl overflow-hidden relative" style={{ borderColor: safeChar.stats?.tokenColor || '#3b82f6', borderStyle: safeChar.stats?.tokenFrame === 'dashed' ? 'dashed' : safeChar.stats?.tokenFrame === 'double' ? 'double' : 'solid' }}>
                       {safeChar.image ? <img src={safeChar.image} alt="avatar" className="w-full h-full object-cover" draggable="false" /> : <User size={48} className="text-neutral-700"/>}
                       <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] pointer-events-none"></div>
                    </div>
                 )}
               </div>
               
               <div className="flex flex-col">
                  {isEditingProfile ? (
                     <input type="text" value={tempProfile.name} onChange={e => setTempProfile({...tempProfile, name: e.target.value})} className="bg-neutral-950 border border-indigo-500/50 rounded-xl px-4 py-3 text-2xl font-black text-white focus:outline-none focus:border-indigo-500 w-72 mb-2 shadow-inner" placeholder="Имя героя" />
                  ) : (
                     <h2 className="text-4xl font-black text-white tracking-tight drop-shadow-md mb-1">{safeChar.name || 'Безымянный'}</h2>
                  )}
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest bg-neutral-950 px-3 py-1 rounded-lg border border-neutral-800 w-fit">{currentUser?.username || 'Игрок'}</span>
               </div>
            </div>

            <div className="flex gap-2">
               {isEditingProfile ? (
                  <>
                    <button onClick={saveProfile} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-95 flex items-center gap-2"><Save size={18}/> Сохранить</button>
                    <button onClick={() => setIsEditingProfile(false)} className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold uppercase tracking-wider rounded-xl transition-colors">Отмена</button>
                  </>
               ) : (
                  <>
                    <button onClick={handleEditClick} className="px-5 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center gap-2 border border-neutral-700 shadow-sm"><Edit3 size={18}/> Редактировать</button>
                    <button onClick={handleDeleteCharacter} className="p-3 bg-red-900/20 hover:bg-red-900/40 text-red-500 rounded-xl transition-colors border border-red-900/30" title="Удалить героя"><Trash2 size={18}/></button>
                  </>
               )}
            </div>
         </div>

         {/* ОСНОВНАЯ ЗОНА */}
         <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pr-2">
            
            <div className="grid grid-cols-[1fr_2.5fr] gap-6 shrink-0">
               {/* AC (Класс Доспеха) */}
               <div className="bg-neutral-950/50 p-5 rounded-2xl border border-neutral-800/80 shadow-inner flex flex-col items-center justify-center">
                  <div className="flex items-center gap-2 text-neutral-400 mb-3"><Shield size={20}/> <span className="text-xs font-black uppercase tracking-widest">КД (Доспех)</span></div>
                  {isEditingProfile ? (
                     <input type="number" value={tempProfile.ac} onChange={e => setTempProfile({...tempProfile, ac: Number(e.target.value)})} className="w-24 bg-neutral-900 border border-indigo-500/50 rounded-2xl text-4xl font-black text-center py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white hide-arrows transition-all" />
                  ) : (
                     <div className="w-24 bg-neutral-900 border-2 border-neutral-800 rounded-2xl text-4xl font-black text-center py-3 text-white shadow-md">{safeChar.ac || 10}</div>
                  )}
               </div>

               {/* Характеристики */}
               <div className="bg-neutral-950/50 p-5 rounded-2xl border border-neutral-800/80 shadow-inner">
                  <div className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Характеристики (Модификаторы)</div>
                  <div className="grid grid-cols-6 gap-3">
                     {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(stat => (
                        <div key={stat} className={`flex flex-col items-center py-3 rounded-xl border ${isEditingProfile ? 'bg-neutral-950 border-neutral-800/50' : 'bg-neutral-900 border-neutral-800'}`}>
                           <span className="text-[10px] font-black uppercase text-neutral-500 mb-1">{stat}</span>
                           
                           {isEditingProfile ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                 <button onClick={() => adjustStat(stat, -1)} className="w-6 h-6 bg-neutral-800 hover:bg-red-500/20 hover:text-red-400 text-neutral-400 rounded-md flex items-center justify-center font-black transition-colors">-</button>
                                 <span className="text-lg font-black text-white w-5 text-center">{tempProfile.stats?.[stat] || 0}</span>
                                 <button onClick={() => adjustStat(stat, 1)} className="w-6 h-6 bg-neutral-800 hover:bg-green-500/20 hover:text-green-400 text-neutral-400 rounded-md flex items-center justify-center font-black transition-colors">+</button>
                              </div>
                           ) : (
                              <span className="text-xl font-black text-white mt-1">
                                 {(safeChar.stats?.[stat] || 0) > 0 ? '+' : ''}
                                 {safeChar.stats?.[stat] || 0}
                              </span>
                           )}
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* Настройки токена */}
            {isEditingProfile && (
               <div className="bg-neutral-950/50 p-5 rounded-2xl border border-neutral-800/80 shadow-inner shrink-0">
                  <div className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-pink-500"></div> Настройка фишки (Токена)</div>
                  <div className="grid grid-cols-3 gap-4">
                     <div className="flex flex-col">
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-2 pl-1">Цвет рамки</label>
                        <div className="flex items-center gap-3 bg-neutral-900 p-2 rounded-xl border border-neutral-800">
                           <input type="color" value={tempProfile.tokenColor} onChange={e => setTempProfile({...tempProfile, tokenColor: e.target.value})} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent p-0" />
                           <span className="text-xs font-mono font-bold text-neutral-300">{tempProfile.tokenColor}</span>
                        </div>
                     </div>
                     <div className="flex flex-col">
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-2 pl-1">Стиль рамки</label>
                        <select value={tempProfile.tokenFrame} onChange={e => setTempProfile({...tempProfile, tokenFrame: e.target.value})} className="w-full h-[56px] bg-neutral-900 border border-neutral-800 rounded-xl px-4 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer">
                           <option value="solid">Сплошная</option>
                           <option value="dashed">Пунктир</option>
                           <option value="double">Двойная</option>
                           <option value="glow">Свечение</option>
                        </select>
                     </div>
                     <div className="flex flex-col">
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-2 pl-1">Пульсация (Ваш токен)</label>
                        <button 
                           onClick={() => setTempProfile({...tempProfile, tokenPulse: !tempProfile.tokenPulse})}
                           className={`w-full h-[56px] rounded-xl text-xs font-bold uppercase transition-colors border ${tempProfile.tokenPulse ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:bg-neutral-800'}`}
                        >
                           {tempProfile.tokenPulse ? 'Включена' : 'Отключена'}
                        </button>
                     </div>
                  </div>
               </div>
            )}

            {/* СПОСОБНОСТИ, ИНВЕНТАРЬ И АТАКИ */}
            <div className="grid grid-cols-[2fr_1.5fr] gap-6 shrink-0 pb-6">
               <div className="space-y-6">
                  
                  {/* Способности */}
                  <div className="bg-neutral-950/50 p-5 rounded-2xl border border-neutral-800/80 shadow-inner">
                     <div className="flex justify-between items-center mb-4">
                        <div className="text-xs font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2"><Sparkles size={14} className="text-purple-500"/> Способности и Заклинания</div>
                        {isEditingProfile && (
                           <button onClick={() => setTempProfile({...tempProfile, abilities: [...(tempProfile.abilities || []), { id: generateId(), name: 'Новая способность', description: '', dmgCount: 0, dmgSides: 6, damageBonus: 0, effectType: 'none', effectDuration: 1, tickCount: 0, tickSides: 4, hasSave: false, saveStat: 'dex', saveDC: 12, noDamage: false }]})} className="text-[10px] font-black uppercase bg-purple-600/20 text-purple-400 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded-lg transition-colors">+ Добавить</button>
                        )}
                     </div>
                     
                     <div className="space-y-4">
                        {isEditingProfile ? (
                           (tempProfile.abilities || []).map((abil, index) => (
                              <div key={abil.id} className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 relative">
                                 <button onClick={() => setTempProfile({...tempProfile, abilities: tempProfile.abilities.filter(a => a.id !== abil.id)})} className="absolute top-3 right-3 text-neutral-500 hover:text-white bg-neutral-950 hover:bg-red-600 p-2 rounded-lg transition-colors border border-neutral-800 z-10" title="Удалить способность"><Trash2 size={14}/></button>
                                 
                                 <input type="text" value={abil.name} onChange={e => { const newAbils = [...tempProfile.abilities]; newAbils[index] = { ...newAbils[index], name: e.target.value }; setTempProfile({...tempProfile, abilities: newAbils}); }} className="w-[calc(100%-40px)] bg-transparent text-base font-black text-white focus:outline-none mb-3 border-b border-transparent focus:border-purple-500 pb-1 transition-colors" placeholder="Название способности..." />
                                 <textarea value={abil.description} onChange={e => { const newAbils = [...tempProfile.abilities]; newAbils[index] = { ...newAbils[index], description: e.target.value }; setTempProfile({...tempProfile, abilities: newAbils}); }} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-neutral-300 focus:outline-none focus:border-purple-500 resize-none h-20 mb-4 custom-scrollbar" placeholder="Подробное описание эффекта или лора..." />
                                 
                                 <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                                       <span className="block text-[9px] font-black text-neutral-500 uppercase mb-2">Настройки Урона и Спаса</span>
                                       
                                       <label className="flex items-center gap-2 mb-3 cursor-pointer group">
                                          <input 
                                             type="checkbox" 
                                             checked={abil.noDamage || false} 
                                             onChange={e => { 
                                                const newAbils = [...tempProfile.abilities]; 
                                                newAbils[index] = { ...newAbils[index], noDamage: e.target.checked };
                                                setTempProfile({...tempProfile, abilities: newAbils}); 
                                             }} 
                                             className="w-4 h-4 accent-red-500 cursor-pointer" 
                                          />
                                          <span className="text-[10px] font-black text-neutral-400 group-hover:text-white uppercase transition-colors">
                                             Без урона (Только эффект)
                                          </span>
                                       </label>

                                       {!abil.noDamage && (
                                          <div className="flex items-center gap-1.5 animate-[slideIn_0.2s_ease-out]">
                                             <input type="number" min="0" value={abil.dmgCount} onChange={e => { const newAbils = [...tempProfile.abilities]; newAbils[index] = { ...newAbils[index], dmgCount: Number(e.target.value) }; setTempProfile({...tempProfile, abilities: newAbils}); }} className="w-12 bg-neutral-900 border border-neutral-700 rounded-lg py-1.5 text-center text-xs font-bold text-white hide-arrows focus:border-purple-500 outline-none" placeholder="Шт" />
                                             <span className="text-neutral-500 font-bold text-xs">d</span>
                                             <select value={abil.dmgSides} onChange={e => { const newAbils = [...tempProfile.abilities]; newAbils[index] = { ...newAbils[index], dmgSides: Number(e.target.value) }; setTempProfile({...tempProfile, abilities: newAbils}); }} className="bg-neutral-900 border border-neutral-700 rounded-lg py-1.5 px-2 text-xs font-bold text-white appearance-none text-center cursor-pointer focus:border-purple-500 outline-none">
                                                <option value="4">4</option><option value="6">6</option><option value="8">8</option><option value="10">10</option><option value="12">12</option><option value="20">20</option><option value="100">100</option>
                                             </select>
                                             <span className="text-neutral-500 font-bold text-xs ml-1">+</span>
                                             <input type="number" value={abil.damageBonus} onChange={e => { const newAbils = [...tempProfile.abilities]; newAbils[index] = { ...newAbils[index], damageBonus: Number(e.target.value) }; setTempProfile({...tempProfile, abilities: newAbils}); }} className="w-14 bg-neutral-900 border border-neutral-700 rounded-lg py-1.5 text-center text-xs font-bold text-white hide-arrows focus:border-purple-500 outline-none" placeholder="Мод." />
                                          </div>
                                       )}

                                       <div className="mt-4 pt-3 border-t border-neutral-800">
                                          <label className="flex items-center gap-2 mb-3 cursor-pointer group">
                                             <input 
                                                type="checkbox" 
                                                checked={abil.hasSave || false} 
                                                onChange={e => { 
                                                   const newAbils = [...tempProfile.abilities]; 
                                                   newAbils[index] = { ...newAbils[index], hasSave: e.target.checked };
                                                   setTempProfile({...tempProfile, abilities: newAbils}); 
                                                }} 
                                                className="w-4 h-4 accent-purple-500 cursor-pointer" 
                                             />
                                             <span className="text-[10px] font-black text-neutral-400 group-hover:text-white uppercase transition-colors">
                                                Требует Спасбросок
                                             </span>
                                          </label>

                                          {abil.hasSave && (
                                              <div className="flex items-center gap-2 animate-[slideIn_0.2s_ease-out]">
                                                 <span className="text-[10px] font-black text-neutral-500 uppercase">Спас по:</span>
                                                 <select 
                                                    value={abil.saveStat || 'dex'} 
                                                    onChange={e => { 
                                                       const newAbils = [...tempProfile.abilities]; 
                                                       newAbils[index] = { ...newAbils[index], saveStat: e.target.value };
                                                       setTempProfile({...tempProfile, abilities: newAbils}); 
                                                    }} 
                                                    className="bg-neutral-900 border border-neutral-700 rounded py-1 px-2 text-[10px] font-bold text-white uppercase outline-none focus:border-purple-500 cursor-pointer"
                                                 >
                                                    <option value="str">СИЛ</option>
                                                    <option value="dex">ЛОВ</option>
                                                    <option value="con">ВЫН</option>
                                                    <option value="int">ИНТ</option>
                                                    <option value="wis">МУД</option>
                                                    <option value="cha">ХАР</option>
                                                 </select>
                                                 
                                                 <span className="text-[10px] font-black text-neutral-500 uppercase ml-2">СЛ:</span>
                                                 <input 
                                                    type="number" 
                                                    min="1" max="30" 
                                                    value={abil.saveDC || 12} 
                                                    onChange={e => { 
                                                       const newAbils = [...tempProfile.abilities]; 
                                                       newAbils[index] = { ...newAbils[index], saveDC: Number(e.target.value) };
                                                       setTempProfile({...tempProfile, abilities: newAbils}); 
                                                    }} 
                                                    className="w-12 bg-neutral-900 border border-neutral-700 rounded py-1 text-center text-xs font-bold text-white hide-arrows outline-none focus:border-purple-500" 
                                                 />
                                              </div>
                                          )}
                                       </div>
                                    </div>
                                    
                                    <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                                       <span className="block text-[9px] font-black text-neutral-500 uppercase mb-2">Накладываемый Эффект / Статус</span>
                                       <div className="flex flex-col gap-2">
                                          <select value={abil.effectType} onChange={e => { const newAbils = [...tempProfile.abilities]; newAbils[index] = { ...newAbils[index], effectType: e.target.value }; setTempProfile({...tempProfile, abilities: newAbils}); }} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg py-1.5 px-3 text-xs font-bold text-white appearance-none cursor-pointer focus:border-purple-500 outline-none custom-scrollbar">
                                             <option value="none">Нет (Только урон/спас)</option>
                                             <option value="heal">Лечение (HP)</option>
                                             <option value="shield">Щит (Врем. HP)</option>
                                             <option value="bleed">Кровотечение (Урон)</option>
                                             <option disabled>─── Статусы ───</option>
                                             <option value="blinded">Ослеплен</option>
                                             <option value="charmed">Очарован</option>
                                             <option value="deafened">Оглохший</option>
                                             <option value="frightened">Испуган</option>
                                             <option value="grappled">Схвачен</option>
                                             <option value="incapacitated">Недееспособен</option>
                                             <option value="invisible">Невидимый</option>
                                             <option value="paralyzed">Парализован</option>
                                             <option value="petrified">Окаменевший</option>
                                             <option value="poisoned">Отравлен</option>
                                             <option value="prone">Сбит с ног</option>
                                             <option value="restrained">Опутан</option>
                                             <option value="stunned">Оглушен</option>
                                             <option value="unconscious">Без сознания</option>
                                             <option value="onFire">Горит</option>
                                             <option value="blessed">Благословен</option>
                                          </select>
                                          
                                          {abil.effectType !== 'none' && abil.effectType !== 'heal' && abil.effectType !== 'shield' && (
                                             <div className="flex items-center gap-2 mt-1">
                                                <div className="flex items-center gap-1.5">
                                                   <span className="text-[9px] text-neutral-500 font-bold">Длит.</span>
                                                   <input type="number" min="1" value={abil.effectDuration} onChange={e => { const newAbils = [...tempProfile.abilities]; newAbils[index] = { ...newAbils[index], effectDuration: Number(e.target.value) }; setTempProfile({...tempProfile, abilities: newAbils}); }} className="w-10 bg-neutral-900 border border-neutral-700 rounded py-1 text-center text-[10px] font-bold text-white hide-arrows" title="Количество ходов" />
                                                </div>
                                                <div className="flex items-center gap-1 ml-auto">
                                                   <span className="text-[9px] text-neutral-500 font-bold">Урон</span>
                                                   <input type="number" min="0" value={abil.tickCount} onChange={e => { const newAbils = [...tempProfile.abilities]; newAbils[index] = { ...newAbils[index], tickCount: Number(e.target.value) }; setTempProfile({...tempProfile, abilities: newAbils}); }} className="w-8 bg-neutral-900 border border-neutral-700 rounded py-1 text-center text-[10px] font-bold text-white hide-arrows" />
                                                   <span className="text-[10px] text-neutral-500 font-bold">d</span>
                                                   <select value={abil.tickSides} onChange={e => { const newAbils = [...tempProfile.abilities]; newAbils[index] = { ...newAbils[index], tickSides: Number(e.target.value) }; setTempProfile({...tempProfile, abilities: newAbils}); }} className="bg-neutral-900 border border-neutral-700 rounded py-1 px-1 text-[10px] font-bold text-white appearance-none text-center">
                                                      <option value="4">4</option><option value="6">6</option><option value="8">8</option><option value="10">10</option><option value="12">12</option><option value="20">20</option>
                                                   </select>
                                                </div>
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           ))
                        ) : (
                           (!safeCharacter.abilities || safeCharacter.abilities.length === 0) ? <span className="text-neutral-600 italic text-sm">Нет способностей...</span> : (
                              (safeCharacter.abilities || []).map(abil => (
                                 <div key={abil.id} className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800">
                                    <div className="flex justify-between items-start mb-2">
                                       <span className="font-black text-sm text-white">{abil.name}</span>
                                       {abil.effectType !== 'none' && (
                                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${abil.effectType==='heal'?'bg-green-900/30 text-green-400 border-green-800':abil.effectType==='shield'?'bg-blue-900/30 text-blue-400 border-blue-800':abil.effectType==='fire'?'bg-orange-900/30 text-orange-400 border-orange-800':abil.effectType==='poison'?'bg-green-900/30 text-green-400 border-green-800':'bg-purple-900/30 text-purple-400 border-purple-800'}`}>
                                             {abil.effectType} {abil.effectDuration > 1 && `(${abil.effectDuration} х.)`}
                                          </span>
                                       )}
                                    </div>
                                    <p className="text-xs text-neutral-400 mb-3 leading-relaxed">{abil.description}</p>
                                    
                                    <div className="flex flex-col gap-1">
                                       {(!abil.noDamage && (abil.dmgCount > 0 || abil.damageBonus !== 0)) && (
                                          <div className="text-[10px] font-bold text-neutral-500 bg-neutral-950 inline-block px-3 py-1.5 rounded-lg border border-neutral-800 w-fit">
                                             Урон/Хил: <span className={abil.effectType === 'heal' ? 'text-green-400' : abil.effectType === 'shield' ? 'text-blue-400' : 'text-purple-400'}>{abil.dmgCount > 0 && `${abil.dmgCount}d${abil.dmgSides}`}{abil.damageBonus > 0 ? '+'+abil.damageBonus : (abil.damageBonus < 0 ? abil.damageBonus : '')}</span>
                                             {abil.tickCount > 0 && <span className="ml-2 text-orange-400">(+{abil.tickCount}d${abil.tickSides}/ход)</span>}
                                          </div>
                                       )}
                                       {abil.hasSave && (
                                          <div className="text-[10px] font-bold text-purple-400 bg-purple-900/20 inline-block px-3 py-1.5 rounded-lg border border-purple-500/50 w-fit mt-1">
                                             Спасбросок: {String(abil.saveStat).toUpperCase()} (СЛ {abil.saveDC})
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              ))
                           )
                        )}
                     </div>
                  </div>

                  {/* Инвентарь */}
                  <div className="bg-neutral-950/50 p-5 rounded-2xl border border-neutral-800/80 shadow-inner">
                     <div className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2"><Backpack size={14} className="text-amber-500"/> Инвентарь</div>
                     {isEditingProfile ? (
                        <textarea value={tempProfile.inventory} onChange={e => setTempProfile({...tempProfile, inventory: e.target.value})} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-amber-500 resize-none h-40 custom-scrollbar leading-relaxed" placeholder="Опишите ваши предметы, золото, артефакты..." />
                     ) : (
                        <div className="w-full bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 text-sm text-neutral-300 min-h-[100px] whitespace-pre-wrap leading-relaxed">
                           {safeChar.inventory || <span className="text-neutral-600 italic">Пусто...</span>}
                        </div>
                     )}
                  </div>
               </div>

               {/* Атаки и Оружие */}
               <div className="bg-neutral-950/50 p-5 rounded-2xl border border-neutral-800/80 shadow-inner h-fit">
                  <div className="flex justify-between items-center mb-4">
                     <div className="text-xs font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2"><Swords size={14} className="text-red-500"/> Оружие и Атаки</div>
                     {isEditingProfile && (
                        <button onClick={() => setTempProfile({...tempProfile, attacks: [...(tempProfile.attacks || []), { id: generateId(), name: 'Новая атака', attackBonus: 0, damageDice: '1d8', damageBonus: 0 }]})} className="text-[10px] font-black uppercase bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-lg transition-colors">+ Добавить</button>
                     )}
                  </div>
                  <div className="space-y-3">
                     {isEditingProfile ? (
                         (tempProfile.attacks || []).map((atk, index) => (
                            <div key={atk.id} className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 relative">
                               <button onClick={() => setTempProfile({...tempProfile, attacks: tempProfile.attacks.filter(a => a.id !== atk.id)})} className="absolute top-2 right-2 text-neutral-500 hover:text-white bg-neutral-950 hover:bg-red-600 p-2 rounded-lg transition-colors border border-neutral-800 z-10"><Trash2 size={14}/></button>
                               
                               <input type="text" value={atk.name} onChange={e => { const newAtks = [...tempProfile.attacks]; newAtks[index] = { ...newAtks[index], name: e.target.value }; setTempProfile({...tempProfile, attacks: newAtks}); }} className="w-[calc(100%-35px)] bg-transparent text-sm font-bold text-white focus:outline-none mb-3 border-b border-transparent focus:border-red-500 pb-1 transition-colors" placeholder="Название (напр. Меч)" />
                               <div className="flex gap-2 items-center flex-wrap">
                                  <input type="number" value={atk.attackBonus} onChange={e => { const newAtks = [...tempProfile.attacks]; newAtks[index] = { ...newAtks[index], attackBonus: Number(e.target.value) }; setTempProfile({...tempProfile, attacks: newAtks}); }} className="w-14 bg-neutral-950 border border-neutral-700 rounded-lg py-1.5 text-center text-xs font-bold text-white hide-arrows focus:border-red-500 outline-none" placeholder="+АТК" title="Бонус к попаданию" />
                                  <span className="text-neutral-500 text-xs font-black">АТК</span>
                                  <div className="w-[1px] h-5 bg-neutral-700 mx-1"></div>
                                  <input type="text" value={atk.damageDice} onChange={e => { const newAtks = [...tempProfile.attacks]; newAtks[index] = { ...newAtks[index], damageDice: e.target.value }; setTempProfile({...tempProfile, attacks: newAtks}); }} className="w-16 bg-neutral-950 border border-neutral-700 rounded-lg py-1.5 text-center text-xs font-bold text-white focus:border-red-500 outline-none" placeholder="1d8" title="Кости урона" />
                                  <span className="text-neutral-500 text-xs font-black">+</span>
                                  <input type="number" value={atk.damageBonus} onChange={e => { const newAtks = [...tempProfile.attacks]; newAtks[index] = { ...newAtks[index], damageBonus: Number(e.target.value) }; setTempProfile({...tempProfile, attacks: newAtks}); }} className="w-14 bg-neutral-950 border border-neutral-700 rounded-lg py-1.5 text-center text-xs font-bold text-white hide-arrows focus:border-red-500 outline-none" placeholder="Урон" title="Бонус к урону" />
                               </div>
                            </div>
                         ))
                     ) : (
                         (!safeChar.attacks || safeChar.attacks.length === 0) ? <span className="text-neutral-600 italic text-sm">Нет добавленного оружия...</span> : (
                            (safeChar.attacks || []).map(atk => (
                               <div key={atk.id} className="flex justify-between items-center bg-neutral-900/50 p-3 rounded-xl border border-neutral-800">
                                  <span className="font-bold text-sm text-white">{atk.name}</span>
                                  <div className="flex gap-4 text-xs font-black bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800">
                                     <span className="text-neutral-500">АТК: <span className="text-blue-400">{atk.attackBonus >= 0 ? '+'+atk.attackBonus : atk.attackBonus}</span></span>
                                     <span className="text-neutral-500">УРОН: <span className="text-red-400">{atk.damageDice}{atk.damageBonus > 0 ? '+'+atk.damageBonus : (atk.damageBonus < 0 ? atk.damageBonus : '')}</span></span>
                                  </div>
                               </div>
                            ))
                         )
                     )}
                  </div>
               </div>

            </div>

            <button onClick={() => setAuthStep('sessions')} disabled={isEditingProfile} className="w-full py-4 mt-2 shrink-0 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-neutral-200 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
              Перейти к сессиям <div className="w-5 h-5 bg-black rounded-full text-white flex items-center justify-center text-[10px]">➔</div>
            </button>
         </div>
      </div>
    </div>
  );
}