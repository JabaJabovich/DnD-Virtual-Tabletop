// hooks/useWidgets.js
import { useState, useEffect } from 'react';

export function useWidgets() {
  const [widgetPositions, setWidgetPositions] = useState({
    stats:  { x: 24,  y: 100 },
    inv:    { x: 340, y: 100 },
    abil:   { x: 650, y: 100 },
    atk:    { x: 340, y: 450 },
    notes:  { x: 650, y: 450 },
    chat:   {
      x: typeof window !== 'undefined' ? window.innerWidth - 350 : 800,
      y: 100,
    },
  });

  const [showStatsWidget, setShowStatsWidget] = useState(false);
  const [showInvWidget,   setShowInvWidget]   = useState(false);
  const [showAbilWidget,  setShowAbilWidget]  = useState(false);
  const [showAtkWidget,   setShowAtkWidget]   = useState(false);
  const [showNotesWidget, setShowNotesWidget] = useState(false);

  const [draggingWidget, setDraggingWidget] = useState(null);
  const [dragOffset,     setDragOffset]     = useState({ x: 0, y: 0 });

  const [isTokenPanelOpen,       setIsTokenPanelOpen]       = useState(false);
  const [isTokenPanelMinimized,  setIsTokenPanelMinimized]  = useState(false);
  const [tokenPanelPos,          setTokenPanelPos]          = useState({ x: 100, y: 100 });

  const [portraitToShow,    setPortraitToShow]    = useState(null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen,setIsRightSidebarOpen]= useState(true);

  // Центрируем панель токена по экрану при монтировании
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTokenPanelPos({
        x: Math.max(20, window.innerWidth  / 2 - 175),
        y: Math.max(20, window.innerHeight / 2 - 250),
      });
    }
  }, []);

  return {
    widgetPositions,    setWidgetPositions,
    showStatsWidget,    setShowStatsWidget,
    showInvWidget,      setShowInvWidget,
    showAbilWidget,     setShowAbilWidget,
    showAtkWidget,      setShowAtkWidget,
    showNotesWidget,    setShowNotesWidget,
    draggingWidget,     setDraggingWidget,
    dragOffset,         setDragOffset,
    isTokenPanelOpen,   setIsTokenPanelOpen,
    isTokenPanelMinimized, setIsTokenPanelMinimized,
    tokenPanelPos,      setTokenPanelPos,
    portraitToShow,     setPortraitToShow,
    isLeftSidebarOpen,  setIsLeftSidebarOpen,
    isRightSidebarOpen, setIsRightSidebarOpen,
  };
}
