// hooks/useMapInteractions.js
import { useCallback, useRef } from 'react';
import { socket } from '../services/socket';
import { generateId } from '../utils/helpers';
import { distToSegment } from '../utils/math';

export function useMapInteractions({
  activeSessionId,
  sessionData,
  updateSession,
  localTokens,
  setLocalTokens,
  userRole,
  myTokenId,

  // инструменты и рисование
  activeTool,
  portraitToShow,
  isTokenVisible,
  measureData,
  setMeasureData,
  wallDrawData,
  setWallDrawData,
  templateDrawData,
  setTemplateDrawData,

  // камера
  pan,
  setPan,
  scale,
  isPanning,
  setIsPanning,
  startPan,
  setStartPan,

  // выбор токена / панель
  setSelectedTokenId,
  setHpInputValue,
  draggingTokenId,
  setDraggingTokenId,
  setIsTokenPanelOpen,
  setIsTokenPanelMinimized,

  // виджеты
  draggingWidget,
  setDraggingWidget,
  dragOffset,
  setDragOffset,
  setWidgetPositions,

  // refs
  containerRef,
  mapApiRef,
}) {
  const lastTapRef = useRef({ id: null, time: 0 });
  const dragStartPosRef = useRef(null);
  const draggedTokenPosRef = useRef(null);
  const wallsRef = useRef([]);
  const moveRequestRef = useRef(null);
  const lastSyncRef = useRef(0);

  // синхронизировать стены снаружи
  const syncWallsRef = useCallback((walls) => {
    wallsRef.current = walls || [];
  }, []);

  const handleTokenPointerDown = useCallback(
    (e, id) => {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

      const now = Date.now();
      const lastTap = lastTapRef.current || {};
      const isDoubleTap =
        lastTap.id === id && now - (lastTap.time || 0) < 400;

      lastTapRef.current = { id, time: now };
      setSelectedTokenId(id);
      setHpInputValue('');

      if (isDoubleTap) {
        setIsTokenPanelOpen(true);
        setIsTokenPanelMinimized(false);
      }
      if (activeTool !== 'pointer') return;
      if (userRole === 'spectator') return;
      if (userRole === 'player' && id !== myTokenId) return;

      const t = localTokens.find(tok => tok.id === id);
      if (t) {
        dragStartPosRef.current = { x: t.x, y: t.y };
        // lastValidPosRef раньше не использовался снаружи, можно не хранить
      }
      setDraggingTokenId(id);
    },
    [
      activeTool,
      userRole,
      myTokenId,
      localTokens,
      setSelectedTokenId,
      setHpInputValue,
      setIsTokenPanelOpen,
      setIsTokenPanelMinimized,
      setDraggingTokenId,
    ]
  );

  const handlePointerDownBg = useCallback(
    (e) => {
      if (e.button === 2 || portraitToShow) return;
      if (!containerRef.current) return;

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {}

      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / scale;
      const y = (e.clientY - rect.top - pan.y) / scale;

      if (activeTool.startsWith('template-')) {
        setTemplateDrawData({
          type: activeTool.replace('template-', ''),
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
        });
        return;
      }

      if (userRole === 'gm') {
        if (activeTool === 'wall-line' || activeTool === 'wall-brush') {
          setWallDrawData({ points: [{ x, y }] });
          return;
        }
      }

      if (activeTool === 'ruler') {
        setMeasureData({ points: [{ x, y }], current: { x, y } });
        return;
      }

      if (activeTool === 'pointer') {
        const tokens = Array.isArray(localTokens) ? localTokens : [];
        const clickedToken = [...tokens].reverse().find(t => {
          if (!isTokenVisible(t)) return false;
          const hitRadius = (Number(t.size) || 60) / 2 + 20 / scale;
          return Math.hypot(t.x - x, t.y - y) <= hitRadius;
        });

        if (clickedToken) {
          const now = Date.now();
          const lastTap = lastTapRef.current || {};
          const isDoubleTap =
            lastTap.id === clickedToken.id &&
            now - (lastTap.time || 0) < 400;
          lastTapRef.current = { id: clickedToken.id, time: now };

          setSelectedTokenId(clickedToken.id);

          if (userRole === 'player' && clickedToken.id !== myTokenId) return;

          dragStartPosRef.current = {
            tokenX: clickedToken.x,
            tokenY: clickedToken.y,
            cursorX: x,
            cursorY: y,
          };
          draggedTokenPosRef.current = {
            x: clickedToken.x,
            y: clickedToken.y,
          };
          setDraggingTokenId(clickedToken.id);

          if (isDoubleTap) {
            setIsTokenPanelOpen(true);
            setIsTokenPanelMinimized(false);
          }
          return;
        }
      }

      if (activeTool !== 'wall-eraser') {
        setSelectedTokenId(null);
        setIsTokenPanelOpen(false);
        setIsPanning(true);
        setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [
      activeTool,
      containerRef,
      pan,
      scale,
      portraitToShow,
      userRole,
      localTokens,
      myTokenId,
      isTokenVisible,
      setTemplateDrawData,
      setWallDrawData,
      setMeasureData,
      setSelectedTokenId,
      setIsTokenPanelOpen,
      setIsTokenPanelMinimized,
      setIsPanning,
      setStartPan,
      setDraggingTokenId,
    ]
  );

  const handlePointerMoveBg = useCallback(
    (e) => {
      if (draggingWidget) {
        if (moveRequestRef.current)
          cancelAnimationFrame(moveRequestRef.current);

        moveRequestRef.current = requestAnimationFrame(() => {
          setWidgetPositions(prev => ({
            ...prev,
            [draggingWidget]: {
              x: e.clientX - dragOffset.x,
              y: e.clientY - dragOffset.y,
            },
          }));
        });
        return;
      }

      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / scale;
      const y = (e.clientY - rect.top - pan.y) / scale;

      if (draggingTemplate) {
        const deltaX = x - draggingTemplate.startCursorX;
        const deltaY = y - draggingTemplate.startCursorY;
        setTemplateDrawData(prev =>
          prev
            ? {
                ...prev,
                x: prev.origX + deltaX,
                y: prev.origY + deltaY,
                targetX: prev.origTargetX + deltaX,
                targetY: prev.origTargetY + deltaY,
              }
            : null
        );
        return;
      }

      if (
        !isPanning &&
        !draggingTokenId &&
        !measureData &&
        !wallDrawData &&
        !templateDrawData &&
        activeTool !== 'wall-eraser'
      )
        return;

      if (templateDrawData) {
        setTemplateDrawData(prev =>
          prev ? { ...prev, currentX: x, currentY: y } : null
        );
        return;
      }

      if (draggingTokenId) {
        const start = dragStartPosRef.current;
        if (!start) return;

        let targetX = start.tokenX + (x - start.cursorX);
        let targetY = start.tokenY + (y - start.cursorY);

        if (isNaN(targetX) || isNaN(targetY)) return;

        const mapW = sessionData?.mapConfig?.width
          ? Number(sessionData.mapConfig.width)
          : 2000;
        const mapH = sessionData?.mapConfig?.height
          ? Number(sessionData.mapConfig.height)
          : 2000;
        const tokenRadius =
          (localTokens.find(t => t.id === draggingTokenId)?.size || 60) / 2;

        if (userRole !== 'gm') {
          const walls = wallsRef.current || [];

          let currentX = draggedTokenPosRef.current
            ? draggedTokenPosRef.current.x
            : start.tokenX;
          let currentY = draggedTokenPosRef.current
            ? draggedTokenPosRef.current.y
            : start.tokenY;

          let dx = targetX - currentX;
          let dy = targetY - currentY;
          let dist = Math.hypot(dx, dy);

          if (dist > 0) {
            let steps = Math.min(
              100,
              Math.ceil(dist / (tokenRadius * 0.5))
            );
            let stepX = dx / steps;
            let stepY = dy / steps;

            let simX = currentX;
            let simY = currentY;

            const collisionBuffer = tokenRadius + 50;

            const minBoxX = Math.min(currentX, targetX) - collisionBuffer;
            const maxBoxX = Math.max(currentX, targetX) + collisionBuffer;
            const minBoxY = Math.min(currentY, targetY) - collisionBuffer;
            const maxBoxY = Math.max(currentY, targetY) + collisionBuffer;

            const localWalls = walls.filter(w => {
              return !(
                Math.max(w.x1, w.x2) < minBoxX ||
                Math.min(w.x1, w.x2) > maxBoxX ||
                Math.max(w.y1, w.y2) < minBoxY ||
                Math.min(w.y1, w.y2) > maxBoxY
              );
            });

            for (let i = 0; i < steps; i++) {
              simX += stepX;
              simY += stepY;

              for (let iter = 0; iter < 3; iter++) {
                for (const wall of localWalls) {
                  const v = { x: wall.x1, y: wall.y1 };
                  const w = { x: wall.x2, y: wall.y2 };
                  const l2 =
                    (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
                  let t =
                    Math.max(
                      0,
                      Math.min(
                        1,
                        l2 === 0
                          ? 0
                          : ((simX - v.x) * (w.x - v.x) +
                              (simY - v.y) * (w.y - v.y)) /
                              l2
                      )
                    );

                  const closestX = v.x + t * (w.x - v.x);
                  const closestY = v.y + t * (w.y - v.y);

                  const d = Math.hypot(simX - closestX, simY - closestY);

                  if (d > 0 && d < tokenRadius) {
                    const overlap = tokenRadius - d;
                    simX += ((simX - closestX) / d) * overlap;
                    simY += ((simY - closestY) / d) * overlap;
                  }
                }
              }
            }

            targetX = simX;
            targetY = simY;
          }
        }

        targetX = Math.max(
          tokenRadius,
          Math.min(mapW - tokenRadius, targetX)
        );
        targetY = Math.max(
          tokenRadius,
          Math.min(mapH - tokenRadius, targetY)
        );

        if (isNaN(targetX) || isNaN(targetY)) {
          targetX = start.tokenX;
          targetY = start.tokenY;
        }

        if (mapApiRef.current && mapApiRef.current.moveTokenVisual) {
          mapApiRef.current.moveTokenVisual(draggingTokenId, targetX, targetY);
        }
        draggedTokenPosRef.current = { x: targetX, y: targetY };

        const now = Date.now();
        if (now - lastSyncRef.current > 40) {
          lastSyncRef.current = now;

          const currentToken = localTokens.find(
            t => t.id === draggingTokenId
          );
          const poly = currentToken ? currentToken.fovPolygon : null;

          const payload = {
            id: draggingTokenId,
            x: targetX,
            y: targetY,
            fovPolygon: poly,
          };

          if (socket.volatile) {
            socket.volatile.emit('broadcast', {
              sessionId: activeSessionId,
              event: 'token_move',
              payload,
            });
          } else {
            socket.emit('broadcast', {
              sessionId: activeSessionId,
              event: 'token_move',
              payload,
            });
          }
        }

        return;
      }

      if (isPanning) {
        setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
        return;
      }

      if (measureData && activeTool === 'ruler') {
        setMeasureData(prev =>
          prev ? { ...prev, current: { x, y } } : null
        );
        return;
      }

      if (wallDrawData && userRole === 'gm') {
        if (activeTool === 'wall-line') {
          setWallDrawData(prev => ({
            points: [prev.points[0], { x, y }],
          }));
        } else if (activeTool === 'wall-brush') {
          const lastPt =
            wallDrawData.points[wallDrawData.points.length - 1];
          if (Math.hypot(x - lastPt.x, y - lastPt.y) > 20 / scale) {
            setWallDrawData(prev => ({
              points: [...prev.points, { x, y }],
            }));
          }
        }
        return;
      }

      if (
        activeTool === 'wall-eraser' &&
        e.buttons === 1 &&
        userRole === 'gm'
      ) {
        const hit = wallsRef.current.find(
          w =>
            distToSegment(
              { x, y },
              { x: w.x1, y: w.y1 },
              { x: w.x2, y: w.y2 }
            ) <
            15 / scale
        );
        if (hit) {
          const newWalls = wallsRef.current.filter(w => w.id !== hit.id);
          wallsRef.current = newWalls;
          updateSession({ walls: newWalls });
          setLocalTokens(prev =>
            prev.map(t => ({ ...t, fovPolygon: null }))
          );
        }
      }
    },
    [
      draggingWidget,
      dragOffset,
      setWidgetPositions,
      draggingTemplate,
      setTemplateDrawData,
      isPanning,
      draggingTokenId,
      pan,
      scale,
      sessionData,
      localTokens,
      userRole,
      activeTool,
      measureData,
      wallDrawData,
      activeSessionId,
      setPan,
      startPan,
      setMeasureData,
      setWallDrawData,
      updateSession,
      setLocalTokens,
      containerRef,
      mapApiRef,
    ]
  );

  const handlePointerUpBg = useCallback(
    (e, { activeWidgetCharacter }) => {
      if (templateDrawData) {
        const dist = Math.hypot(
          templateDrawData.currentX - templateDrawData.startX,
          templateDrawData.currentY - templateDrawData.startY
        );
        if (dist > 10 / scale) {
          const newTemplate = {
            id: generateId(),
            type: templateDrawData.type,
            x: templateDrawData.startX,
            y: templateDrawData.startY,
            targetX: templateDrawData.currentX,
            targetY: templateDrawData.currentY,
            color:
              activeWidgetCharacter?.stats?.tokenColor || '#a855f7',
          };
          const currentTemplates = sessionData.templates || [];
          updateSession({
            templates: [...currentTemplates, newTemplate],
          });
        }
        setTemplateDrawData(null);
      }

      if (draggingWidget) {
        setDraggingWidget(null);
        return;
      }

      if (draggingTemplate) {
        const newTemplates = (sessionData.templates || []).map(t =>
          t.id === draggingTemplate.id
            ? {
                ...t,
                x: draggingTemplate.x,
                y: draggingTemplate.y,
                targetX: draggingTemplate.targetX,
                targetY: draggingTemplate.targetY,
              }
            : t
        );
        updateSession({ templates: newTemplates });
        setTemplateDrawData(null);
        return;
      }

      if (draggingTokenId) {
        if (draggedTokenPosRef.current) {
          let { x, y } = draggedTokenPosRef.current;

          if (isNaN(x) || isNaN(y)) {
            x = dragStartPosRef.current?.tokenX || 100;
            y = dragStartPosRef.current?.tokenY || 100;
          }

          if (mapApiRef.current && mapApiRef.current.clearVisualPos) {
            mapApiRef.current.clearVisualPos(draggingTokenId);
          }
          setLocalTokens(prev =>
            prev.map(t =>
              t.id === draggingTokenId ? { ...t, x, y, fovPolygon: null } : t
            )
          );
          updateSession({
            [`tokens.${draggingTokenId}.x`]: x,
            [`tokens.${draggingTokenId}.y`]: y,
          });
          draggedTokenPosRef.current = null;
        }
        setDraggingTokenId(null);
      }

      setIsPanning(false);
      setMeasureData(null);

      if (wallDrawData && userRole === 'gm') {
        if (wallDrawData.points.length > 1) {
          const newWalls = [];
          const pts = wallDrawData.points;
          for (let i = 0; i < pts.length - 1; i++) {
            newWalls.push({
              id: generateId(),
              x1: pts[i].x,
              y1: pts[i].y,
              x2: pts[i + 1].x,
              y2: pts[i + 1].y,
            });
          }
          const updatedWalls = [...wallsRef.current, ...newWalls];
          wallsRef.current = updatedWalls;
          updateSession({ walls: updatedWalls });
          setLocalTokens(prev =>
            prev.map(t => ({ ...t, fovPolygon: null }))
          );
        }
        setWallDrawData(null);
      }

      try {
        e.currentTarget?.releasePointerCapture(e.pointerId);
      } catch (err) {}
    },
    [
      templateDrawData,
      scale,
      sessionData,
      updateSession,
      draggingWidget,
      draggingTemplate,
      draggingTokenId,
      wallDrawData,
      userRole,
      setDraggingWidget,
      setTemplateDrawData,
      setDraggingTokenId,
      setIsPanning,
      setMeasureData,
      setLocalTokens,
      setWallDrawData,
      mapApiRef,
    ]
  );

  const handleWidgetPointerDown = useCallback(
    (e, widget) => {
      e.stopPropagation();
      const rect = e.currentTarget.parentElement.getBoundingClientRect();
      setDraggingWidget(widget);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [setDraggingWidget, setDragOffset]
  );

  return {
    syncWallsRef,
    handleTokenPointerDown,
    handlePointerDownBg,
    handlePointerMoveBg,
    handlePointerUpBg,
    handleWidgetPointerDown,
  };
}
