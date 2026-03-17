import { useState, useRef, useEffect } from 'react';

// Безопасный генератор ID
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
};

export function useChat(sessionData, updateSession, currentUser, activeCharacter, activeSessionId) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  
  const prevChatLen = useRef(0);
  const chatEndRef = useRef(null);

  // Следим за новыми сообщениями для счетчика и звука
  useEffect(() => {
    const currentLen = sessionData.chatMessages?.length || 0;
    
    if (currentLen > prevChatLen.current) {
        const lastMsg = sessionData.chatMessages[currentLen - 1];
        const myChatName = activeCharacter?.name || activeCharacter?.username || currentUser?.username;

        // Если пришло сообщение НЕ от нас
        if (lastMsg && lastMsg.sender !== myChatName) {
            
            // 1. Воспроизводим звук "Дзынь"
            try {
                // Ссылка на звук (можешь заменить на свою или локальный файл, например '/ding.mp3')
                const audio = new Audio('https://actions.google.com/sounds/v1/ui_icons/message_notification_pop.ogg');
                audio.volume = 0.5; // Громкость 50%
                // Браузеры могут блокировать звук до первого клика по странице, 
                // но так как игрок уже авторизовался, звук проиграется без проблем.
                audio.play().catch(e => console.warn('Звук заблокирован браузером до первого клика', e));
            } catch (err) {
                console.error('Ошибка воспроизведения звука', err);
            }

            // 2. Увеличиваем счетчик непрочитанных (только если окно чата закрыто)
            if (!isChatOpen) {
                setUnreadChatCount(prev => prev + (currentLen - prevChatLen.current));
            }
        }
    }
    prevChatLen.current = currentLen;
  }, [sessionData.chatMessages, isChatOpen, activeCharacter, currentUser]);

  // Скролл вниз и сброс счетчика при открытии чата
  useEffect(() => {
    if (isChatOpen) {
        setUnreadChatCount(0);
        if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isChatOpen, sessionData.chatMessages]);

  // Обновление статуса "прочитано" в БД
  useEffect(() => {
    if (isChatOpen && activeSessionId && currentUser) {
        const chatMsgs = sessionData.chatMessages || [];
        const lastMsg = chatMsgs[chatMsgs.length - 1];
        const myLastRead = (sessionData.chatReadStates && sessionData.chatReadStates[currentUser.id]) || 0;
        const myChatName = activeCharacter?.name || activeCharacter?.username || currentUser?.username;

        if (lastMsg && lastMsg.timestamp > myLastRead && lastMsg.sender !== myChatName) {
            updateSession({ [`chatReadStates.${currentUser.id}`]: Date.now() });
        } else if (!lastMsg && myLastRead === 0) {
            updateSession({ [`chatReadStates.${currentUser.id}`]: Date.now() });
        }
    }
  }, [isChatOpen, sessionData.chatMessages, activeSessionId, currentUser, activeCharacter, updateSession]);

  // Отправка сообщения
  const sendChatMessage = (e) => {
    if (e) e.preventDefault(); 
    if (!chatInput.trim()) return;
    
    const text = String(chatInput.trim()); 
    const sender = String(activeCharacter?.name || activeCharacter?.username || 'Гость');
    
    const newMsg = { 
        id: generateId(), 
        timestamp: Date.now(), 
        sender, 
        text, 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }) 
    };
    
    updateSession({ chatMessages: [...(sessionData.chatMessages || []), newMsg].slice(-100) });
    setChatInput('');
  };

  return {
    isChatOpen, setIsChatOpen,
    chatInput, setChatInput,
    unreadChatCount, setUnreadChatCount,
    chatEndRef,
    sendChatMessage
  };
}