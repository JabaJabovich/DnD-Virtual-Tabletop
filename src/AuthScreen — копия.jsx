import React, { useState } from 'react';
import { Lock, Upload, Loader2, LogIn, UserPlus } from 'lucide-react';

export default function AuthScreen({
  authMode, setAuthMode,
  handleAuth,
  username, setUsername,
  password, setPassword,
  regImage, handleRegImageUpload
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e) => {
     e.preventDefault();
     setIsSubmitting(true);
     await handleAuth(e);
     setIsSubmitting(false);
  };

  return (
    <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-700/50 p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-full max-w-[450px] max-h-[90vh] overflow-y-auto flex flex-col gap-6 animate-[slideIn_0.4s_ease-out]">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center mx-auto mb-2 text-white shadow-lg shadow-blue-500/30">
            <Lock size={36} />
          </div>
          <h2 className="text-3xl font-black text-white tracking-tight">D&D Vision</h2>
          <p className="text-neutral-400 font-medium">Виртуальный игровой стол</p>
        </div>

        <div className="flex bg-neutral-950/50 p-1.5 rounded-2xl border border-neutral-800/50">
          <button onClick={() => { setAuthMode('login'); setRegImage(null); }} className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all ${authMode === 'login' ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'}`}>Вход</button>
          <button onClick={() => setAuthMode('register')} className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all ${authMode === 'register' ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'}`}>Регистрация</button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">Логин</label>
              <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-neutral-950/50 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="Имя профиля" />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">Пароль</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-neutral-950/50 border border-neutral-800 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors" placeholder="••••••••" />
            </div>
          </div>

          {authMode === 'register' && (
            <div className="pt-2">
              <div className="bg-neutral-950/30 p-4 rounded-2xl border border-neutral-800/50">
                <label className="block text-xs font-bold text-neutral-400 mb-1.5 uppercase tracking-wider">Аватар (Опционально)</label>
                <label className={`flex w-full items-center justify-center gap-2 bg-neutral-950/50 hover:bg-neutral-800 border-2 border-dashed ${regImage ? 'border-blue-500 text-blue-400' : 'border-neutral-700 text-neutral-500'} rounded-xl p-4 cursor-pointer transition-colors text-sm font-bold`}>
                  <Upload size={18} /> 
                  <span className="truncate">{regImage ? 'Аватар загружен' : 'Нажмите для выбора файла'}</span>
                  <input type="file" accept="image/*" onChange={handleRegImageUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}
          
          <button type="submit" disabled={isSubmitting} className="w-full mt-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black uppercase tracking-wider rounded-xl hover:from-blue-500 hover:to-indigo-500 transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] flex justify-center items-center gap-2 active:scale-95 disabled:opacity-50">
            {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : (authMode === 'login' ? <><LogIn size={24}/> Войти в игру</> : <><UserPlus size={24}/> Создать героя</>)}
          </button>
        </form>
      </div>
    </div>
  );
}