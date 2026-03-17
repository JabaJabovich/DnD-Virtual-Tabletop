import React, { useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID(); 
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

const msgSound = typeof Audio !== 'undefined' ? new Audio('/sounds/notification.mp3') : null;

export default React.memo(function ChatWidget({
  isChatOpen, setIsChatOpen,
  unreadChatCount,
  sessionData,
  activeCharacter,
  chatEndRef, // Оставляем пропс для совместимости, но отключаем его вредный скролл
  chatInput, setChatInput,
  sendChatMessage, isChatMuted,
  widgetPositions, handleWidgetPointerDown
}) {
  const scrollRef = useRef(null);
  const prevMsgCount = useRef(sessionData.chatMessages?.length || 0);

  // === УМНЫЙ СКРОЛЛ И ЗВУК ===
  useEffect(() => {
    const messages = sessionData.chatMessages || [];
    const isNewMessage = messages.length > prevMsgCount.current;
    
    if (isNewMessage) {
      const lastMsg = messages[messages.length - 1];
      const myName = activeCharacter?.name || activeCharacter?.username;
      const isMe = lastMsg.sender === myName;
      
      // Звук только для чужих сообщений
      if (!isMe && msgSound && !isChatMuted) {
        msgSound.currentTime = 0;
        msgSound.volume = 0.4; 
        msgSound.play().catch(() => {});
      }

      // Плавный скролл (не мешает читать историю)
      if (scrollRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        // Проверяем, находимся ли мы в самом низу (с погрешностью 150px)
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        
        // Скроллим вниз ТОЛЬКО если мы сами написали сообщение, либо уже читали низ чата
        if (isMe || isNearBottom) {
           setTimeout(() => {
               scrollRef.current?.scrollTo({
                  top: scrollRef.current.scrollHeight,
                  behavior: 'smooth'
               });
           }, 50);
        }
      }
    }
    prevMsgCount.current = messages.length;
  }, [sessionData.chatMessages, activeCharacter, isChatMuted]);

  // Принудительный скролл вниз при открытии чата
  useEffect(() => {
     if (isChatOpen && scrollRef.current) {
         setTimeout(() => {
             scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'auto'
             });
         }, 50);
     }
  }, [isChatOpen]);

  // === ОБРАБОТКА SHIFT+ENTER ===
  const handleKeyDown = (e) => {
     if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Отменяем стандартный перенос строки
        if (chatInput.trim()) {
           sendChatMessage(e); // Вызываем отправку
        }
     }
  };

  return (
    <>
      {/* Кнопка Чата (Остается на месте в углу экрана) */}
      <button onClick={() => setIsChatOpen(!isChatOpen)} className={`fixed bottom-4 right-4 z-[9999] p-3 rounded-full shadow-lg transition-all pointer-events-auto flex items-center justify-center ${isChatOpen ? 'bg-indigo-600 text-white scale-110 ring-2 ring-indigo-400' : 'bg-neutral-800 border-2 border-neutral-600 text-neutral-300 hover:text-white hover:bg-neutral-700 hover:scale-110'}`} title="Чат">
         <MessageCircle size={20} />
         {unreadChatCount > 0 && !isChatOpen && (
             <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-neutral-900 shadow-md pointer-events-none">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
             </span>
         )}
      </button>

      {/* Диалоговое окно Чата (Перетаскиваемое) */}
      {isChatOpen && (
        <div 
          className="fixed top-0 left-0 z-[9998] w-80 h-[450px] bg-neutral-900/90 backdrop-blur-xl border border-neutral-700/50 rounded-3xl shadow-2xl flex flex-col no-zoom animate-[slideIn_0.2s_ease-out]" 
          style={{ transform: `translate3d(${widgetPositions?.chat?.x || 100}px, ${widgetPositions?.chat?.y || 100}px, 0)` }}
          onPointerDown={e => e.stopPropagation()} 
          onWheel={e => e.stopPropagation()}
        >
           {/* ШАПКА ОКНА */}
           <div 
             className="p-4 border-b border-neutral-800/50 bg-white/5 rounded-t-3xl flex justify-between items-center shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
             onPointerDown={(e) => handleWidgetPointerDown(e, 'chat')}
           >
              <span className="font-black text-sm text-indigo-400 flex items-center gap-2 uppercase tracking-wider"><MessageCircle size={18}/> Журнал / Чат</span>
              <button onClick={(e) => { e.stopPropagation(); setIsChatOpen(false); }} className="text-neutral-500 hover:text-white bg-neutral-800/50 p-1.5 rounded-full"><X size={16}/></button>
           </div>
           
           {/* СПИСОК СООБЩЕНИЙ */}
           <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-neutral-950/20 scroll-smooth">
              {!sessionData.chatMessages || sessionData.chatMessages.length === 0 ? (
                <div className="text-center text-sm font-medium text-neutral-600 mt-10">Бросайте кубики или напишите что-нибудь!</div>
              ) : (
                sessionData.chatMessages.map((msg) => {
                  const isMe = msg.sender === (activeCharacter?.name || activeCharacter?.username);
                  return (
                    <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
                       
                       <div className="flex items-baseline gap-1.5 mb-1 px-1">
                          {isMe ? (
                             <>
                               <span className="text-[9px] text-neutral-600 font-bold tracking-wider">{String(msg.time)}</span>
                               <span className="text-[10px] font-bold text-neutral-500">Вы</span>
                             </>
                          ) : (
                             <>
                               <span className="text-[10px] font-bold text-neutral-500">{String(msg.sender)}</span>
                               <span className="text-[9px] text-neutral-600 font-bold tracking-wider">{String(msg.time)}</span>
                             </>
                          )}
                       </div>

                       {/* Добавлен whitespace-pre-wrap для работы многострочных текстов */}
                       <div className={`p-3.5 rounded-2xl text-sm select-text shadow-sm whitespace-pre-wrap break-words ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-neutral-800 border border-neutral-700/50 text-neutral-200 rounded-tl-sm'}`}>
                         {String(msg.text)}
                       </div>
                       
                       {isMe && <div className="flex justify-end mt-0.5 px-1"><span className={`text-[10px] tracking-tighter font-black text-blue-400`}>✓✓</span></div>}
                    </div>
                  );
                })
              )}
              {/* Прячем старый реф хука useChat, чтобы его кривой скролл нас не сбивал */}
              <div ref={chatEndRef} style={{ height: 0, width: 0, overflow: 'hidden' }} />
           </div>
           
           {/* ПОЛЕ ВВОДА */}
           <div className="p-3 bg-neutral-950/50 rounded-b-3xl shrink-0 m-2 border border-neutral-800/50">
              <form onSubmit={sendChatMessage} className="flex items-end gap-2 relative">
                <textarea 
                  value={chatInput} 
                  onChange={e => setChatInput(e.target.value)} 
                  onKeyDown={handleKeyDown}
                  placeholder="Сообщение..." 
                  className="w-full bg-transparent py-2.5 pl-3 pr-10 text-sm focus:outline-none text-neutral-200 resize-none custom-scrollbar" 
                  rows={Math.max(1, Math.min(5, chatInput.split('\n').length))}
                />
                <button type="submit" disabled={!chatInput.trim()} className="absolute right-1 bottom-1 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white rounded-xl transition-colors">
                    <Send size={16} />
                </button>
              </form>
           </div>
        </div>
      )}
    </>
  );
});