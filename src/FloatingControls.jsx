import React from 'react';
import { Menu, MousePointer2, Ruler, Backpack, Sparkles, Swords, Pencil, Eraser, Minus, ScrollText, Circle, Triangle, Square, Slash, BookOpen } from 'lucide-react';

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

export default React.memo(function FloatingControls({
  isLeftSidebarOpen, setIsLeftSidebarOpen,
  isRightSidebarOpen, setIsRightSidebarOpen,
  activeTool, setActiveTool,
  userRole,
  showStatsWidget, setShowStatsWidget,
  showInvWidget, setShowInvWidget,
  showAbilWidget, setShowAbilWidget,
  showAtkWidget, setShowAtkWidget,
  showNotesWidget, setShowNotesWidget // <--- НОВОЕ
}) {
  return (
    <>
      {!isLeftSidebarOpen && (
        <button onClick={() => setIsLeftSidebarOpen(true)} className="absolute top-4 left-4 z-30 p-3 bg-neutral-900/80 backdrop-blur-md border border-neutral-700/50 rounded-xl shadow-lg text-neutral-400 hover:text-white transition-colors no-zoom pointer-events-auto">
          <Menu size={24} />
        </button>
      )}
      {!isRightSidebarOpen && (
        <button onClick={() => setIsRightSidebarOpen(true)} className="absolute top-4 right-4 z-30 p-3 bg-neutral-900/80 backdrop-blur-md border border-neutral-700/50 rounded-xl shadow-lg text-neutral-400 hover:text-white transition-colors no-zoom pointer-events-auto flex items-center justify-center">
          <Menu size={24} className="scale-x-[-1]" />
        </button>
      )}

      {/* Основная панель инструментов по центру внизу */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-neutral-900/90 backdrop-blur-md border border-neutral-700 p-2 rounded-2xl shadow-2xl flex items-center gap-2 pointer-events-auto no-zoom">
        <button onClick={() => setActiveTool('pointer')} className={`p-3 rounded-xl transition-all ${activeTool === 'pointer' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Курсор"><MousePointer2 size={20} /></button>
        <button onClick={() => setActiveTool('ruler')} className={`p-3 rounded-xl transition-all ${activeTool === 'ruler' ? 'bg-indigo-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Линейка"><Ruler size={20} /></button>
        
        <div className="w-px h-8 bg-neutral-700/50 mx-1"></div>
        <button onClick={() => setActiveTool('template-circle')} className={`p-3 rounded-xl transition-all ${activeTool === 'template-circle' ? 'bg-purple-600 text-white shadow-lg' : 'text-neutral-400 hover:text-purple-400 hover:bg-neutral-800'}`} title="Сфера / Круг (Двойной клик по шаблону удалит его)"><Circle size={20} /></button>
        <button onClick={() => setActiveTool('template-cone')} className={`p-3 rounded-xl transition-all ${activeTool === 'template-cone' ? 'bg-purple-600 text-white shadow-lg' : 'text-neutral-400 hover:text-purple-400 hover:bg-neutral-800'}`} title="Конус (Двойной клик удалит)"><Triangle size={20} /></button>
        <button onClick={() => setActiveTool('template-line')} className={`p-3 rounded-xl transition-all ${activeTool === 'template-line' ? 'bg-purple-600 text-white shadow-lg' : 'text-neutral-400 hover:text-purple-400 hover:bg-neutral-800'}`} title="Линия / Луч (Двойной клик удалит)"><Slash size={20} /></button>
        <button onClick={() => setActiveTool('template-cube')} className={`p-3 rounded-xl transition-all ${activeTool === 'template-cube' ? 'bg-purple-600 text-white shadow-lg' : 'text-neutral-400 hover:text-purple-400 hover:bg-neutral-800'}`} title="Куб / Квадрат (Двойной клик удалит)"><Square size={20} /></button>

        {userRole === 'gm' && (
          <>
            <div className="w-px h-8 bg-neutral-700/50 mx-1"></div>
            <button onClick={() => setActiveTool('wall-line')} className={`p-3 rounded-xl transition-all ${activeTool === 'wall-line' ? 'bg-amber-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Стена: Прямая линия"><Minus size={20} /></button>
            <button onClick={() => setActiveTool('wall-brush')} className={`p-3 rounded-xl transition-all ${activeTool === 'wall-brush' ? 'bg-amber-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Стена: Свободная кисть"><Pencil size={20} /></button>
            <button onClick={() => setActiveTool('wall-eraser')} className={`p-3 rounded-xl transition-all ${activeTool === 'wall-eraser' ? 'bg-red-600 text-white shadow-lg' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`} title="Ластик стен (Зажать и провести)"><Eraser size={20} /></button>
          </>
        )}
      </div>

      {/* Виджеты игрока в правом нижнем углу */}
      {userRole === 'player' && (
         <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-40 flex items-end gap-3 no-zoom pointer-events-auto">
             <button onClick={() => { setShowNotesWidget(!showNotesWidget); setShowInvWidget(false); setShowStatsWidget(false); setShowAbilWidget(false); setShowAtkWidget(false); }} className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center ${showNotesWidget ? 'bg-green-600 text-white scale-110 ring-2 ring-green-400 ring-offset-2 ring-offset-neutral-950' : 'bg-neutral-900/80 backdrop-blur-md text-neutral-400 hover:text-white border border-neutral-700 hover:bg-neutral-800'}`} title="Заметки"><BookOpen size={24} /></button>
             <button onClick={() => { setShowInvWidget(!showInvWidget); setShowNotesWidget(false); setShowStatsWidget(false); setShowAbilWidget(false); setShowAtkWidget(false); }} className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center ${showInvWidget ? 'bg-amber-600 text-white scale-110 ring-2 ring-amber-400 ring-offset-2 ring-offset-neutral-950' : 'bg-neutral-900/80 backdrop-blur-md text-neutral-400 hover:text-white border border-neutral-700 hover:bg-neutral-800'}`} title="Инвентарь"><Backpack size={24} /></button>
             <button onClick={() => { setShowAbilWidget(!showAbilWidget); setShowNotesWidget(false); setShowStatsWidget(false); setShowInvWidget(false); setShowAtkWidget(false); }} className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center ${showAbilWidget ? 'bg-purple-600 text-white scale-110 ring-2 ring-purple-400 ring-offset-2 ring-offset-neutral-950' : 'bg-neutral-900/80 backdrop-blur-md text-neutral-400 hover:text-white border border-neutral-700 hover:bg-neutral-800'}`} title="Способности"><Sparkles size={24} /></button>
             <button onClick={() => { setShowAtkWidget(!showAtkWidget); setShowNotesWidget(false); setShowStatsWidget(false); setShowInvWidget(false); setShowAbilWidget(false); }} className={`p-4 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center ${showAtkWidget ? 'bg-red-600 text-white scale-110 ring-2 ring-red-400 ring-offset-2 ring-offset-neutral-950' : 'bg-neutral-900/80 backdrop-blur-md text-neutral-400 hover:text-white border border-neutral-700 hover:bg-neutral-800'}`} title="Атаки"><Swords size={24} /></button>
             <button onClick={() => { setShowStatsWidget(!showStatsWidget); setShowNotesWidget(false); setShowInvWidget(false); setShowAbilWidget(false); setShowAtkWidget(false); }} className={`p-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center ${showStatsWidget ? 'bg-blue-600 text-white scale-110 ring-4 ring-blue-400 ring-offset-4 ring-offset-neutral-950' : 'bg-neutral-800 border border-neutral-600 text-white hover:bg-neutral-700'}`} title="Характеристики"><ScrollText size={28} /></button>
         </div>
      )}
    </>
  );
});