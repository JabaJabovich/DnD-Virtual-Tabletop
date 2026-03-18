import { useState, useEffect, useCallback } from 'react';

export function useMap() {
  // === КАМЕРА И МАСШТАБ ===
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  // === ИНСТРУМЕНТЫ И РИСОВАНИЕ ===
  const [activeTool, setActiveTool] = useState('pointer'); 
  const [measureData, setMeasureData] = useState(null);
  const [wallDrawData, setWallDrawData] = useState(null);
  const [templateDrawData, setTemplateDrawData] = useState(null); 
  const [draggingTemplate, setDraggingTemplate] = useState(null);

  // === ПОЛНОЭКРАННЫЙ РЕЖИМ ===
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
      const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
      } else {
          if (document.exitFullscreen) document.exitFullscreen();
      }
  }, []);

  // === ЛОГИКА ЗУМА (Колесико мыши) ===
  const handleWheel = useCallback((e, containerRef, portraitToShow) => {
    // Блокируем зум, если мышка над боковым меню или открыт портрет
    if (e.target.closest('aside') || e.target.closest('.no-zoom') || portraitToShow) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; 
    const mouseY = e.clientY - rect.top;

    const mapX = (mouseX - pan.x) / scale;
    const mapY = (mouseY - pan.y) / scale;

    // Ограничиваем зум от 0.1 (далеко) до 5 (близко)
    const newScale = Math.min(Math.max(0.1, scale - e.deltaY * 0.001), 5);

    setPan({
        x: mouseX - mapX * newScale,
        y: mouseY - mapY * newScale
    });
    setScale(newScale);
  }, [pan, scale]);

  return {
    scale, setScale, pan, setPan, isPanning, setIsPanning, startPan, setStartPan,
    activeTool, setActiveTool, measureData, setMeasureData,
    wallDrawData, setWallDrawData, templateDrawData, setTemplateDrawData,
    draggingTemplate, setDraggingTemplate, isFullscreen, toggleFullscreen, handleWheel
  };
}