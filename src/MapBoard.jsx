import React, { useEffect, useRef, useImperativeHandle, useState } from 'react';
import { Camera, EyeOff } from 'lucide-react';
import * as PIXI from 'pixi.js';

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
const FEET_PER_TOKEN = 5;

const lerpColor = (start, end, amount) => {
    const r = Math.round(((start >> 16) & 0xff) + ((((end >> 16) & 0xff) - ((start >> 16) & 0xff)) * amount));
    const g = Math.round(((start >> 8) & 0xff) + ((((end >> 8) & 0xff) - ((start >> 8) & 0xff)) * amount));
    const b = Math.round((start & 0xff) + (((end & 0xff) - (start & 0xff)) * amount));
    return (r << 16) | (g << 8) | b;
};

const generateSmoothPath = (points) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        d += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
    }
    d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
    return d;
};

// === КОД ВОРКЕРА ДЛЯ ТУМАНА ===
const workerCode = `
function getIntersection(ray, segment) {
    const r_px = ray.x; const r_py = ray.y; const r_dx = ray.dx; const r_dy = ray.dy;
    const s_px = segment.x1; const s_py = segment.y1; const s_dx = segment.x2 - segment.x1; const s_dy = segment.y2 - segment.y1;
    const T2 = r_dx * s_dy - r_dy * s_dx; if (T2 === 0) return null;
    const T1 = (s_px - r_px) * s_dy - (s_py - r_py) * s_dx; const T = T1 / T2;
    const U = ((s_px - r_px) * r_dy - (s_py - r_py) * r_dx) / T2;
    if (T > 0 && U >= 0 && U <= 1) return { x: r_px + r_dx * T, y: r_py + r_dy * T, param: T }; return null;
}

function calculateVisibilityPolygon(originX, originY, visionRadius, walls, mapWidth, mapHeight, potatoMode) {
    const allSegments = [...(walls || []), 
        { x1: 0, y1: 0, x2: mapWidth, y2: 0 },
        { x1: mapWidth, y1: 0, x2: mapWidth, y2: mapHeight },
        { x1: mapWidth, y1: mapHeight, x2: 0, y2: mapHeight },
        { x1: 0, y1: mapHeight, x2: 0, y2: 0 }
    ];
    const points = [];
    for (let i = 0; i < allSegments.length; i++) {
        points.push({ x: allSegments[i].x1, y: allSegments[i].y1 });
        points.push({ x: allSegments[i].x2, y: allSegments[i].y2 });
    }

    const uniqueAngles = [];
    for (let i = 0; i < points.length; i++) {
        const angle = Math.atan2(points[i].y - originY, points[i].x - originX);
        uniqueAngles.push(angle - 0.00001, angle, angle + 0.00001);
    }
    const rayCount = potatoMode ? 24 : 72; 
    for (let i = 0; i < rayCount; i++) { 
        uniqueAngles.push((i * Math.PI * 2) / rayCount); 
    }

    const intersects = [];
    for (let j = 0; j < uniqueAngles.length; j++) {
        const angle = uniqueAngles[j];
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const ray = { x: originX, y: originY, dx, dy };
        let closestIntersect = null;
        for (let i = 0; i < allSegments.length; i++) {
            const intersect = getIntersection(ray, allSegments[i]);
            if (!intersect) continue;
            if (!closestIntersect || intersect.param < closestIntersect.param) closestIntersect = intersect;
        }
        if (closestIntersect) {
            closestIntersect.angle = angle;
            intersects.push(closestIntersect);
        }
    }
    intersects.sort((a, b) => a.angle - b.angle);
    const polygon = [];
    for (let i = 0; i < intersects.length; i++) {
        const p = intersects[i];
        const dist = Math.hypot(p.x - originX, p.y - originY);
        if (dist > visionRadius) {
            polygon.push({ x: originX + Math.cos(p.angle) * visionRadius, y: originY + Math.sin(p.angle) * visionRadius });
        } else {
            polygon.push({ x: p.x, y: p.y });
        }
    }
    return polygon;
}

self.onmessage = function(e) {
    const { id, targetX, targetY, vision, walls, width, height, potatoMode } = e.data;
    const newPoly = calculateVisibilityPolygon(targetX, targetY, vision || 300, walls || [], width || 2000, height || 2000, potatoMode);
    self.postMessage({ id, poly: newPoly });
};
`;

// === ОСНОВНОЙ КОМПОНЕНТ MAPBOARD ===
export default React.memo(function MapBoard({
    containerRef, activeTool, mapApiRef, isPanning, handleWheel, handleContextMenuMap,
    measureData, sessionData, pan, scale, localTokens, userRole,
    myTokenId, selectedTokenId, draggingTokenId, wallDrawData, isFogEnabled, gmMode, handlePointerDownBg, 
    handleTokenPointerDown, dragPath, hideLocalGrid, isPotatoMode, templateDrawData, removeTemplate,
    updateSession // Убеждаемся, что мы принимаем функцию сохранения
}) {
    const pixiContainerRef = useRef(null);
    const pixiAppRef = useRef(null);

    const mapSpriteRef = useRef(null);
    const gridLayerRef = useRef(null);
    const wallLayerRef = useRef(null);
    const lightingSpriteRef = useRef(null);
    const tokenLayerRef = useRef(null);
    const fogTextureRef = useRef(null);
    const sceneContainerRef = useRef(null);
    const darkRectRef = useRef(null);

    const isPotatoModeRef = useRef(isPotatoMode);
    const fogSpriteRef = useRef(null);
    const blurFilterRef = useRef(null);
    
    const fogGraphicsPool = useRef({});
    const pixiTokensRef = useRef({});
    const visualCoordsRef = useRef({});
    const latestPolygonsRef = useRef({});
    const needsFogUpdateRef = useRef(true);
    
    const wallsInternalRef = useRef([]);
    const localTokensRef = useRef(localTokens);
    const userRoleRef = useRef(userRole);
    const gmModeRef = useRef(gmMode);
    const isFogEnabledRef = useRef(isFogEnabled);
    const myTokenIdRef = useRef(myTokenId);

    const currentLevelColor = useRef(0xFFFFFF);
    const targetLevelColor = useRef(0xFFFFFF);

    const panRef = useRef(pan);
    const scaleRef = useRef(scale);
    useEffect(() => { panRef.current = pan; }, [pan]);
    useEffect(() => { scaleRef.current = scale; }, [scale]);

    const localWorkerRef = useRef(null);
    const lastFovRequestTime = useRef({});
    const lastCalculatedStateRef = useRef({});

    // === НОВОЕ СОСТОЯНИЕ ДЛЯ ПЕРЕТАСКИВАНИЯ ШАБЛОНОВ ===
    const [draggedTemplate, setDraggedTemplate] = useState(null);

    useEffect(() => { 
        localTokensRef.current = localTokens; 
        needsFogUpdateRef.current = true;
    }, [localTokens]);
    useEffect(() => { 
        wallsInternalRef.current = sessionData?.walls || []; 
        needsFogUpdateRef.current = true;
    }, [sessionData?.walls]);
    useEffect(() => { userRoleRef.current = userRole; }, [userRole]);
    useEffect(() => { gmModeRef.current = gmMode; }, [gmMode]);
    useEffect(() => { isFogEnabledRef.current = isFogEnabled; }, [isFogEnabled]);
    useEffect(() => { myTokenIdRef.current = myTokenId; }, [myTokenId]);

    // === НОВАЯ ЛОГИКА ПЕРЕТАСКИВАНИЯ ШАБЛОНОВ ВНУТРИ MAPBOARD ===
    useEffect(() => {
        if (!draggedTemplate) return;

        const handleMove = (e) => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const currentX = (e.clientX - rect.left - pan.x) / scale;
            const currentY = (e.clientY - rect.top - pan.y) / scale;
            const dx = currentX - draggedTemplate.startX;
            const dy = currentY - draggedTemplate.startY;

            setDraggedTemplate(prev => ({
                ...prev,
                currentX: prev.origX + dx,
                currentY: prev.origY + dy,
                currentTargetX: prev.origTargetX + dx,
                currentTargetY: prev.origTargetY + dy
            }));
        };

        const handleUp = () => {
            setDraggedTemplate(prev => {
                if (prev && prev.currentX !== undefined) {
                    const newTemplates = (sessionData.templates || []).map(t =>
                        t.id === prev.id ? { 
                            ...t, 
                            x: prev.currentX, 
                            y: prev.currentY, 
                            targetX: prev.currentTargetX, 
                            targetY: prev.currentTargetY 
                        } : t
                    );
                    if (updateSession) updateSession({ templates: newTemplates });
                }
                return null;
            });
        };

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleUp);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleUp);
        };
    }, [draggedTemplate, pan, scale, sessionData.templates, updateSession, containerRef]);


    useEffect(() => {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);
        
        worker.onmessage = (e) => {
            const { id, poly } = e.data;
            latestPolygonsRef.current[id] = poly;
            needsFogUpdateRef.current = true; 
        };
        
        localWorkerRef.current = worker;
        return () => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
        };
    }, []);

    useEffect(() => {
        const width = Number(sessionData?.mapConfig?.width);
        const height = Number(sessionData?.mapConfig?.height);
        if (!width || !height) return;

        const maxDimension = Math.max(width, height);
        let safeResolution = Math.min(window.devicePixelRatio || 1, 1.5);
        if (maxDimension * safeResolution > 4000) {
            safeResolution = 4000 / maxDimension;
        }

        const app = new PIXI.Application({
            width, height,
            backgroundAlpha: 0,
            autoDensity: true,
            resolution: Math.min(window.devicePixelRatio, 1.5), 
            antialias: false,
            powerPreference: 'high-performance',
            hello: false
        });

        if (pixiContainerRef.current) {
            pixiContainerRef.current.innerHTML = '';
            pixiContainerRef.current.appendChild(app.view);
        }
        pixiAppRef.current = app;

        const mapLayer = new PIXI.Container();
        const lightingLayer = new PIXI.Container();
        const tokenLayer = new PIXI.Container();
        const fogLayer = new PIXI.Container();
        const gridLayer = new PIXI.Graphics();
        const wallLayer = new PIXI.Graphics();
        
        tokenLayer.sortableChildren = true;
        app.stage.addChild(mapLayer, lightingLayer, fogLayer, tokenLayer, gridLayer, wallLayer);

        gridLayerRef.current = gridLayer;
        wallLayerRef.current = wallLayer;
        tokenLayerRef.current = tokenLayer;

        const mapSprite = new PIXI.Sprite();
        mapLayer.addChild(mapSprite);
        mapSpriteRef.current = mapSprite;

        const lightingSprite = new PIXI.Sprite(PIXI.Texture.WHITE);
        lightingSprite.width = width;
        lightingSprite.height = height;
        lightingSprite.blendMode = PIXI.BLEND_MODES.MULTIPLY;
        lightingLayer.addChild(lightingSprite);
        lightingSpriteRef.current = lightingSprite;

        const renderTexture = PIXI.RenderTexture.create({ 
            width, 
            height,
            resolution: 0.5 
        });
        fogTextureRef.current = renderTexture;
        const fogSprite = new PIXI.Sprite(renderTexture);

        const blurFilter = new PIXI.BlurFilter();
        blurFilter.blur = 8;
        blurFilter.quality = 2;
        blurFilter.resolution = 0.5;
        fogSprite.filters = [blurFilter];

        fogLayer.addChild(fogSprite);
        fogSpriteRef.current = fogSprite;
        blurFilterRef.current = blurFilter;

        const sceneContainer = new PIXI.Container();
        sceneContainerRef.current = sceneContainer;
        const darkRect = new PIXI.Graphics();
        sceneContainer.addChild(darkRect);
        darkRectRef.current = darkRect;

        const renderFogFrame = () => {
            if (!needsFogUpdateRef.current) return;
            needsFogUpdateRef.current = false;

            if (!isFogEnabledRef.current) {
                app.renderer.render(new PIXI.Container(), { renderTexture, clear: true });
                Object.values(pixiTokensRef.current).forEach(tObj => {
                    const token = localTokensRef.current.find(t => t.id === tObj.id);
                    if (token) {
                        tObj.container.visible = !(token.isHidden && token.id !== myTokenIdRef.current && userRoleRef.current !== 'gm');
                    }
                });
                return;
            }

            darkRect.clear();
            darkRect.beginFill(0x000000, gmModeRef.current ? 0.65 : 0.98);
            darkRect.drawRect(0, 0, width, height);
            darkRect.endFill();

            sceneContainer.sortableChildren = true;
            darkRect.zIndex = 0; 

            const pool = fogGraphicsPool.current;
            const tokens = localTokensRef.current || [];
            
            const currentTokenIds = new Set(tokens.map(t => t.id));
            Object.keys(pool).forEach(id => {
                if (!currentTokenIds.has(id)) {
                    sceneContainer.removeChild(pool[id].light, pool[id].glow);
                    pool[id].light.destroy();
                    pool[id].glow.destroy();
                    delete pool[id];
                }
            });
            
            const realPlayers = tokens.filter(t => t.type === 'player' && t.vision > 0 && t.hp > 0);

            tokens.forEach(token => {
                const isPlayerLight = token.type === 'player' && token.vision > 0 && token.hp > 0;
                const isTorchLight = token.type === 'light' && token.vision > 0;
                
                if (!isPlayerLight && !isTorchLight) {
                    if (pool[token.id]) {
                        pool[token.id].light.visible = false;
                        pool[token.id].mask.visible = false;
                        pool[token.id].glow.visible = false;
                    }
                    return;
                }

                let canSeeLight = true;
                if (isTorchLight && userRoleRef.current !== 'gm') {
                    canSeeLight = false;
                    const lX = visualCoordsRef.current[token.id]?.x || Number(token.x) || 0;
                    const lY = visualCoordsRef.current[token.id]?.y || Number(token.y) || 0;
                    const currentWalls = wallsInternalRef.current || [];

                    for (let p of realPlayers) {
                        const pVis = Number(p.vision) || 0;
                        const pX = visualCoordsRef.current[p.id]?.x || Number(p.x) || 0;
                        const pY = visualCoordsRef.current[p.id]?.y || Number(p.y) || 0;
                        
                        if (Math.hypot(lX - pX, lY - pY) > pVis) continue; 
                        
                        let hasLineOfSight = true;
                        const minX = Math.min(pX, lX);
                        const maxX = Math.max(pX, lX);
                        const minY = Math.min(pY, lY);
                        const maxY = Math.max(pY, lY);

                        const relevantWalls = currentWalls.filter(w => {
                            return !(Math.max(w.x1, w.x2) < minX || Math.min(w.x1, w.x2) > maxX ||
                                     Math.max(w.y1, w.y2) < minY || Math.min(w.y1, w.y2) > maxY);
                        });

                        for (let wall of relevantWalls) {
                            const a = pX, b = pY, c = lX, d = lY;
                            const wp = wall.x1, wq = wall.y1, wr = wall.x2, ws = wall.y2;
                            const det = (c - a) * (ws - wq) - (wr - wp) * (d - b);
                            if (det !== 0) {
                                const lambda = ((ws - wq) * (wr - a) + (wp - wr) * (ws - b)) / det;
                                const gamma = ((b - d) * (wr - a) + (c - a) * (ws - b)) / det;
                                if (0 < lambda && lambda < 1 && 0 < gamma && gamma < 1) {
                                    hasLineOfSight = false;
                                    break;
                                }
                            }
                        }

                        if (hasLineOfSight) {
                            canSeeLight = true;
                            break; 
                        }
                    }
                }

                if (!pool[token.id]) {
                    const light = new PIXI.Graphics();
                    const glow = new PIXI.Graphics();
                    
                    light.blendMode = PIXI.BLEND_MODES.ERASE;
                    glow.blendMode = PIXI.BLEND_MODES.SCREEN; 
                    light.zIndex = 10;
                    glow.zIndex = 20;

                    pool[token.id] = { light, glow };
                    sceneContainer.addChild(light, glow);
                }

                const { light, glow } = pool[token.id];

                if (!canSeeLight) {
                    light.visible = false;
                    glow.visible = false;
                    return;
                }

                light.visible = true;
                glow.visible = true;

                const sX = visualCoordsRef.current[token.id]?.x || Number(token.x) || 0;
                const sY = visualCoordsRef.current[token.id]?.y || Number(token.y) || 0;
                const sVis = Number(token.vision) || 0;
                
                const lastCalc = lastCalculatedStateRef.current[token.id];
                const currentWalls = wallsInternalRef.current || [];
                
                if (!lastCalc || Math.hypot(lastCalc.x - sX, lastCalc.y - sY) > 2 || lastCalc.wallsLength !== currentWalls.length) {
                    const now = Date.now();
                    const throttleTime = (typeof isPotatoModeRef !== 'undefined' && isPotatoModeRef.current) ? 100 : 40; 
                    
                    if (!lastFovRequestTime.current[token.id] || now - lastFovRequestTime.current[token.id] > throttleTime) {
                        lastFovRequestTime.current[token.id] = now;
                        lastCalculatedStateRef.current[token.id] = { x: sX, y: sY, wallsLength: currentWalls.length };
                        
                        if (localWorkerRef.current) {
                            const mapW = sessionData?.mapConfig?.width ? Number(sessionData.mapConfig.width) : 800;
                            const mapH = sessionData?.mapConfig?.height ? Number(sessionData.mapConfig.height) : 600;
                            
                            localWorkerRef.current.postMessage({
                                id: token.id, targetX: sX, targetY: sY, vision: sVis,
                                walls: currentWalls, width: mapW, height: mapH,
                                potatoMode: typeof isPotatoModeRef !== 'undefined' ? isPotatoModeRef.current : false
                            });
                        }
                    }
                }

                const poly = latestPolygonsRef.current[token.id] || token.fovPolygon;

                light.clear().beginFill(0xFFFFFF);
                if (poly && poly.length > 2) {
                    light.drawPolygon(poly.flatMap(p => [Number(p.x), Number(p.y)]));
                } else {
                    light.drawCircle(sX, sY, sVis);
                }
                light.endFill();

                glow.clear();
                if (token.type === 'light' && token.color) {
                    const colorHex = parseInt(token.color.replace('#', ''), 16) || 0xFFFFFF;
                    glow.beginFill(colorHex, 0.45); 
                    if (poly && poly.length > 2) {
                        glow.drawPolygon(poly.flatMap(p => [Number(p.x), Number(p.y)]));
                    } else {
                        glow.drawCircle(sX, sY, sVis);
                    }
                    glow.endFill();
                }
            });

            const activePlayers = tokens.filter(t => t.type === 'player' && t.vision > 0 && t.hp > 0);
            const currentWalls = wallsInternalRef.current || [];

            Object.values(pixiTokensRef.current).forEach(tObj => {
                const token = tokens.find(t => t.id === tObj.id);
                if (!token) return;

                const eVis = visualCoordsRef.current[token.id];
                const tX = eVis ? eVis.x : (Number(token.x) || 0);
                const tY = eVis ? eVis.y : (Number(token.y) || 0);
                const r = (Number(token.size) || 60) / 2;

                if (token.isHidden && token.id !== myTokenIdRef.current && userRoleRef.current !== 'gm') {
                    tObj.container.visible = false;
                    return;
                }

                if (userRoleRef.current === 'gm' || token.type === 'player') {
                    tObj.container.visible = true;
                    if (token.type === 'light' && !token.image) tObj.container.alpha = 0.3;
                    return;
                }
                
                if (token.type === 'light' && !token.image) {
                    tObj.container.visible = false;
                    return;
                }
                
                let isVisible = false;

                for (let p of activePlayers) {
                    const visual = visualCoordsRef.current[p.id];
                    const px = visual ? visual.x : (Number(p.x) || 0);
                    const py = visual ? visual.y : (Number(p.y) || 0);
                    const pVis = Number(p.vision) || 0;
                    
                    if (Math.hypot(tX - px, tY - py) > pVis + r) continue;
                    
                    const angleToPlayer = Math.atan2(py - tY, px - tX);
                    const checkPts = [
                        { x: tX, y: tY },
                        { x: tX + Math.cos(angleToPlayer) * r * 0.8, y: tY + Math.sin(angleToPlayer) * r * 0.8 },
                        { x: tX - Math.cos(angleToPlayer) * r * 0.8, y: tY - Math.sin(angleToPlayer) * r * 0.8 }
                    ];

                    let playerCanSeeThis = false;

                    for (let pt of checkPts) {
                        if (Math.hypot(pt.x - px, pt.y - py) > pVis) continue;
                        let hasLoS = true;
                        const minX = Math.min(px, pt.x);
                        const maxX = Math.max(px, pt.x);
                        const minY = Math.min(py, pt.y);
                        const maxY = Math.max(py, pt.y);

                        const relevantWalls = currentWalls.filter(w => {
                            return !(Math.max(w.x1, w.x2) < minX || Math.min(w.x1, w.x2) > maxX ||
                                     Math.max(w.y1, w.y2) < minY || Math.min(w.y1, w.y2) > maxY);
                        });

                        for (let wall of relevantWalls) {
                            const a = px, b = py, c = pt.x, d = pt.y;
                            const wp = wall.x1, wq = wall.y1, wr = wall.x2, ws = wall.y2;
                            const det = (c - a) * (ws - wq) - (wr - wp) * (d - b);
                            if (det !== 0) {
                                const lambda = ((ws - wq) * (wr - a) + (wp - wr) * (ws - b)) / det;
                                const gamma = ((b - d) * (wr - a) + (c - a) * (ws - b)) / det;
                                if (0 < lambda && lambda < 1 && 0 < gamma && gamma < 1) {
                                    hasLoS = false;
                                    break;
                                }
                            }
                        }

                        if (hasLoS) {
                            playerCanSeeThis = true;
                            break;
                        }
                    }

                    if (playerCanSeeThis) {
                        isVisible = true;
                        break;
                    }
                }
                
                tObj.container.visible = isVisible;
            });

            app.renderer.render(sceneContainer, { renderTexture, clear: true });
        };

        app.ticker.add(() => {
            if (lightingSpriteRef.current) {
                const diff = Math.abs(currentLevelColor.current - targetLevelColor.current);
                if (diff > 10) {
                    currentLevelColor.current = lerpColor(currentLevelColor.current, targetLevelColor.current, 0.05);
                    lightingSpriteRef.current.tint = currentLevelColor.current;
                    if (typeof needsFogUpdateRef !== 'undefined') needsFogUpdateRef.current = true;
                }
            }
            renderFogFrame();
        });

        return () => {
            app.destroy(true, { children: true, texture: false, baseTexture: false });
            pixiTokensRef.current = {};
        };
    }, [sessionData?.mapConfig?.width, sessionData?.mapConfig?.height]); 


    useEffect(() => {
        if (fogSpriteRef.current && blurFilterRef.current) {
            fogSpriteRef.current.filters = isPotatoMode ? [] : [blurFilterRef.current];
            if (lightingSpriteRef.current) lightingSpriteRef.current.visible = !isPotatoMode;
            Object.values(pixiTokensRef.current).forEach(tObj => {
                if (tObj.nameText) tObj.nameText.style.dropShadow = !isPotatoMode;
            });
            if (typeof needsFogUpdateRef !== 'undefined') needsFogUpdateRef.current = true;
        }
    }, [isPotatoMode]);

    useEffect(() => {
        if (mapSpriteRef.current && sessionData?.mapConfig) {
            const imgUrl = sessionData.mapConfig.src || sessionData.mapConfig.image;
            if (imgUrl) mapSpriteRef.current.texture = PIXI.Texture.from(imgUrl);
        }
    }, [sessionData.mapConfig]);

    useEffect(() => {
        const grid = gridLayerRef.current;
        if (!grid || !sessionData.mapConfig) return;
        grid.clear();
        const config = sessionData?.gridConfig;
        
        if (!config?.enabled || hideLocalGrid) return;
        
        const w = Number(sessionData.mapConfig.width);
        const h = Number(sessionData.mapConfig.height);
        const size = Math.max(10, Number(config.size) || 70);
        const opacity = config.opacity !== undefined ? Number(config.opacity) : 0.3;
        const colorHex = config.color ? parseInt(config.color.replace('#', '0x'), 16) : 0xFFFFFF;
        grid.lineStyle(1.5, isNaN(colorHex) ? 0xFFFFFF : colorHex, opacity);
        for (let x = 0; x <= w; x += size) { grid.moveTo(x, 0); grid.lineTo(x, h); }
        for (let y = 0; y <= h; y += size) { grid.moveTo(0, y); grid.lineTo(w, y); }
        
    }, [sessionData.gridConfig, sessionData.mapConfig, hideLocalGrid]);

    useEffect(() => {
        const mode = sessionData?.lighting || 'day';
        const colors = { morning: 0xd0e0ff, day: 0xFFFFFF, sunset: 0xff8844, night: 0x222266 };
        targetLevelColor.current = colors[mode] || 0xFFFFFF;
    }, [sessionData.lighting]);

    useEffect(() => {
        const wallsGraphics = wallLayerRef.current;
        if (!wallsGraphics) return;
        wallsGraphics.clear();
        if (userRole !== 'gm' || !sessionData?.walls) return;
        wallsGraphics.lineStyle(3, 0xf43f5e, 0.7);
        sessionData.walls.forEach(w => {
            wallsGraphics.moveTo(w.x1, w.y1);
            wallsGraphics.lineTo(w.x2, w.y2);
        });
    }, [sessionData.walls, userRole]);

    useEffect(() => {
        const layer = tokenLayerRef.current;
        if (!layer) return;

        const currentIds = new Set();
        const tokens = Array.isArray(localTokens) ? localTokens : [];

        tokens.forEach(token => {
            currentIds.add(token.id);

            const size = Number(token.size) || 60;
            const isSelected = token.id === selectedTokenId;
            const isDead = token.hp <= 0;
            let tObj = pixiTokensRef.current[token.id];

            if (!tObj) {
                const container = new PIXI.Container();
                const bg = new PIXI.Graphics();
                const sprite = new PIXI.Sprite();
                sprite.anchor.set(0.5);
                const mask = new PIXI.Graphics();
                sprite.mask = mask;
                const border = new PIXI.Graphics();
                const hpBg = new PIXI.Graphics();
                const hpFill = new PIXI.Graphics();
                
                const nameText = new PIXI.Text(String(token.name), { 
                    fontFamily: 'system-ui, sans-serif', fontSize: 13, fill: 0xFFFFFF, fontWeight: '900', 
                    dropShadow: true, dropShadowDistance: 2, dropShadowAlpha: 0.8 
                });
                nameText.anchor.set(0.5, 0);
                
                const statusText = new PIXI.Text('', { 
                    fontSize: Math.max(16, size / 2.5),
                    dropShadow: true, dropShadowDistance: 2, dropShadowAlpha: 0.8, dropShadowColor: 0x000000
                });
                statusText.anchor.set(0.5, 1);

                const fallbackText = new PIXI.Text('', { 
                    fontFamily: 'sans-serif', fontSize: size / 2.2, fill: 0xFFFFFF, fontWeight: 'bold' 
                });
                fallbackText.anchor.set(0.5, 0.5);

                container.addChild(bg, sprite, mask, fallbackText, border, hpBg, hpFill, nameText, statusText);
                layer.addChild(container);
                tObj = { id: token.id, container, bg, sprite, mask, fallbackText, border, hpBg, hpFill, nameText, statusText, lastImg: null };
                pixiTokensRef.current[token.id] = tObj;
            }

           if (token.type === 'light' && !token.image) {
                tObj.container.visible = (userRole === 'gm');
                tObj.container.alpha = 0.3;
                tObj.bg.visible = false;
                tObj.border.visible = false;
                tObj.hpBg.visible = false;
                tObj.hpFill.visible = false;
                tObj.nameText.visible = false;
                tObj.fallbackText.text = '☀'; 
                tObj.fallbackText.visible = true;
            } else {
                tObj.bg.visible = true;
                tObj.border.visible = true;
                tObj.hpBg.visible = true;
                tObj.hpFill.visible = true;
                tObj.nameText.visible = !isDead;
                tObj.fallbackText.visible = !token.image;
            }

            if (token.id !== draggingTokenId) {
                tObj.container.x = Number(token.x) || 0;
                tObj.container.y = Number(token.y) || 0;
            }
            let tokenAlpha = isDead ? 0.45 : 1;
            if (token.isHidden && userRole === 'gm') {
                tokenAlpha = isDead ? 0.25 : 0.5;
            }
            tObj.container.alpha = tokenAlpha;
            tObj.container.zIndex = isSelected ? 100 : 50;

            tObj.bg.clear().beginFill(parseInt(String(token.color || '#3b82f6').replace('#', '0x'))).drawCircle(0, 0, size / 2).endFill();
            tObj.border.clear().lineStyle(isSelected ? 4 : 2, isSelected ? 0xf59e0b : 0x000000, isSelected ? 1 : 0.5).drawCircle(0, 0, size / 2 + (isSelected ? 2 : 0));

            if (token.image && tObj.lastImg !== token.image) {
                try {
                    tObj.sprite.texture = PIXI.Texture.from(token.image);
                    tObj.lastImg = token.image;
                    tObj.fallbackText.visible = false;
                } catch (e) {}
            } else if (!token.image) {
                tObj.fallbackText.text = String(token.name).charAt(0).toUpperCase();
                tObj.fallbackText.visible = true;
            }

            tObj.sprite.width = tObj.sprite.height = size;
            tObj.mask.clear().beginFill(0xFFFFFF).drawCircle(0, 0, size / 2).endFill();

            const hpPercent = Math.max(0, Math.min(1, (token.hp || 0) / (token.maxHp || 1)));
            const barW = size * 0.8;
            tObj.hpBg.clear().beginFill(0x000000, 0.5).drawRect(-barW / 2, size / 2 + 5, barW, 6).endFill();
            tObj.hpFill.clear().beginFill(hpPercent < 0.3 ? 0xef4444 : 0x22c55e).drawRect(-barW / 2, size / 2 + 5, barW * hpPercent, 6).endFill();

            tObj.nameText.text = String(token.name);
            tObj.nameText.y = size / 2 + 12;
            tObj.nameText.visible = !isDead;

            if (!isDead && ((token.statuses && token.statuses.length > 0) || (token.tempHp > 0))) {
                let emojis = [];
                if (token.tempHp > 0) emojis.push('🛡️');
                if (token.statuses && token.statuses.length > 0) {
                    const EMOJI_MAP = { rooted: '⚓', stunned: '⚡', dying: '💀', regen: '💚', inspired: '✨', dot: '🔥' };
                    token.statuses.forEach(s => {
                        const type = typeof s === 'string' ? s : s.type;
                        emojis.push(EMOJI_MAP[type] || '✨');
                    });
                }
                tObj.statusText.text = emojis.join('');
                tObj.statusText.y = -(size / 2) - 4; 
                tObj.statusText.visible = true;
            } else {
                if (tObj.statusText) tObj.statusText.visible = false;
            }
        });

        Object.keys(pixiTokensRef.current).forEach(id => {
            if (!currentIds.has(id)) {
                layer.removeChild(pixiTokensRef.current[id].container);
                pixiTokensRef.current[id].container.destroy({ children: true });
                delete pixiTokensRef.current[id];
            }
        });
        
        layer.sortChildren();
        needsFogUpdateRef.current = true;
        
    }, [localTokens, selectedTokenId, draggingTokenId]);

    useImperativeHandle(mapApiRef, () => ({
        moveTokenVisual: (id, newX, newY) => {
            const tObj = pixiTokensRef.current[id];
            if (tObj && tObj.container) {
                tObj.container.x = newX;
                tObj.container.y = newY;
                visualCoordsRef.current[id] = { x: newX, y: newY };
            }
            needsFogUpdateRef.current = true;
        },
        clearVisualPos: (id) => { 
            setTimeout(() => {
                if (visualCoordsRef.current) delete visualCoordsRef.current[id]; 
            }, 100);
        }
    }));

   return (
        <div 
            ref={containerRef} 
            className="absolute inset-0 w-full h-full z-0 touch-none pointer-events-auto overflow-hidden"
            onPointerDown={handlePointerDownBg}
            onWheel={handleWheel}
            onContextMenu={handleContextMenuMap}
        >
            <div 
                className="absolute top-0 left-0 transform-gpu origin-top-left will-change-transform pointer-events-none" 
                style={{ 
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, 
                    width: Number(sessionData.mapConfig?.width) || 800, 
                    height: Number(sessionData.mapConfig?.height) || 600, 
                }}
            >
                <div ref={pixiContainerRef} className="absolute inset-0 z-0 pointer-events-none" />
                
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-30 overflow-visible">
                    
                    {/* === ОТРИСОВКА ШАБЛОНОВ ЗАКЛИНАНИЙ === */}
                    {(() => {
                        const renderTemplate = (tObj, isPreview = false) => {
                            if (!tObj) return null;
                            const dist = Math.hypot(tObj.targetX - tObj.x, tObj.targetY - tObj.y);
                            const angle = Math.atan2(tObj.targetY - tObj.y, tObj.targetX - tObj.x);
                            const color = tObj.color || '#a855f7';
                            const opacity = isPreview ? 0.2 : 0.4;
                            const strokeWidth = 3 / scale;
                            const gridSize = sessionData.gridConfig?.size || 60;
                            
                            // ФИГУРЫ ИМЕЮТ pointer-events-none (КЛИКИ ПРОХОДЯТ СКВОЗЬ НИХ К ТОКЕНАМ)
                            const props = {
                                fill: color, 
                                fillOpacity: opacity, 
                                stroke: color, 
                                strokeWidth: strokeWidth,
                                className: "pointer-events-none"
                            };

                            let shape = null;
                            if (tObj.type === 'circle') {
                                shape = <circle cx={tObj.x} cy={tObj.y} r={dist} {...props} />;
                            } else if (tObj.type === 'cone') {
                                const halfAngle = (53.1 / 2) * (Math.PI / 180);
                                const p1 = `${tObj.x},${tObj.y}`;
                                const p2 = `${tObj.x + Math.cos(angle - halfAngle) * dist},${tObj.y + Math.sin(angle - halfAngle) * dist}`;
                                const p3 = `${tObj.x + Math.cos(angle + halfAngle) * dist},${tObj.y + Math.sin(angle + halfAngle) * dist}`;
                                shape = <polygon points={`${p1} ${p2} ${p3}`} {...props} />;
                            } else if (tObj.type === 'line') {
                                const w = gridSize;
                                const deg = angle * (180 / Math.PI);
                                shape = (
                                    <g transform={`translate(${tObj.x}, ${tObj.y}) rotate(${deg})`}>
                                        <rect x={0} y={-w/2} width={dist} height={w} rx={w/4} {...props} />
                                    </g>
                                );
                            } else if (tObj.type === 'cube') {
                                const minX = Math.min(tObj.x, tObj.targetX);
                                const minY = Math.min(tObj.y, tObj.targetY);
                                const w = Math.abs(tObj.targetX - tObj.x);
                                const h = Math.abs(tObj.targetY - tObj.y);
                                shape = <rect x={minX} y={minY} width={w} height={h} rx={4/scale} {...props} />;
                            }

                            const cx = tObj.type === 'cube' ? (tObj.x + tObj.targetX)/2 : (tObj.type === 'line' ? tObj.x + Math.cos(angle)*(dist/2) : (tObj.type === 'circle' ? tObj.x : tObj.x + Math.cos(angle)*(dist*0.6)));
                            const cy = tObj.type === 'cube' ? (tObj.y + tObj.targetY)/2 : (tObj.type === 'line' ? tObj.y + Math.sin(angle)*(dist/2) : (tObj.type === 'circle' ? tObj.y : tObj.y + Math.sin(angle)*(dist*0.6)));
                            const distFt = Math.round(dist / gridSize * 5);

                            return (
                                <g key={tObj.id || 'preview'}>
                                    {shape}
                                    
                                    {/* === ТАБЛИЧКА-ПОЛЗУНОК ДЛЯ ПЕРЕТАСКИВАНИЯ === */}
                                    <g 
                                        transform={`translate(${cx}, ${cy})`} 
                                        className={isPreview ? "pointer-events-none" : "pointer-events-auto cursor-grab active:cursor-grabbing opacity-80 hover:opacity-100 transition-opacity"}
                                        onPointerDown={(e) => {
                                            e.stopPropagation();
                                            if (isPreview) return;
                                            const rect = containerRef.current.getBoundingClientRect();
                                            setDraggedTemplate({
                                                id: tObj.id,
                                                startX: (e.clientX - rect.left - pan.x) / scale,
                                                startY: (e.clientY - rect.top - pan.y) / scale,
                                                origX: tObj.x,
                                                origY: tObj.y,
                                                origTargetX: tObj.targetX,
                                                origTargetY: tObj.targetY
                                            });
                                        }}
                                        onDoubleClick={(e) => { 
                                            e.stopPropagation();
                                            if (!isPreview && removeTemplate) { removeTemplate(tObj.id); } 
                                        }}
                                    >
                                        <rect x={-24/scale} y={-12/scale} width={48/scale} height={24/scale} rx={4/scale} fill="rgba(0,0,0,0.9)" stroke={color} strokeWidth={2/scale} />
                                        <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={12/scale} fontWeight="bold" className="pointer-events-none">{distFt} ft</text>
                                    </g>
                                </g>
                            );
                        };

                        // Подменяем координаты на лету, если шаблон сейчас перетаскивают
                        const activeTemplates = (sessionData.templates || []).map(t => {
                            if (draggedTemplate && draggedTemplate.id === t.id && draggedTemplate.currentX !== undefined) {
                                return { ...t, x: draggedTemplate.currentX, y: draggedTemplate.currentY, targetX: draggedTemplate.currentTargetX, targetY: draggedTemplate.currentTargetY };
                            }
                            return t;
                        });

                        return (
                            <>
                                {activeTemplates.map(t => renderTemplate(t, false))}
                                {templateDrawData && renderTemplate({ ...templateDrawData, x: templateDrawData.startX, y: templateDrawData.startY, targetX: templateDrawData.currentX, targetY: templateDrawData.currentY }, true)}
                            </>
                        );
                    })()}
                    {/* ========================================= */}
                    
                    {measureData && activeTool === 'ruler' && (
                        <g>
                            <line x1={measureData.points[0].x} y1={measureData.points[0].y} x2={measureData.current.x} y2={measureData.current.y} stroke="#3b82f6" strokeWidth={3 / scale} strokeDasharray={`${8 / scale},${8 / scale}`} strokeLinecap="round" />
                            <circle cx={measureData.points[0].x} cy={measureData.points[0].y} r={6 / scale} fill="#3b82f6" />
                            <circle cx={measureData.current.x} cy={measureData.current.y} r={6 / scale} fill="#3b82f6" />
                            <g transform={`translate(${(measureData.points[0].x + measureData.current.x) / 2}, ${(measureData.points[0].y + measureData.current.y) / 2 - 20 / scale})`}>
                                <rect x={-30 / scale} y={-12 / scale} width={60 / scale} height={24 / scale} rx={6 / scale} fill="rgba(0,0,0,0.8)" />
                                <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={14 / scale} fontWeight="900">
                                    {Math.round(Math.hypot(measureData.current.x - measureData.points[0].x, measureData.current.y - measureData.points[0].y) / (sessionData.gridConfig?.size || 60) * 5)} ft
                                </text>
                            </g>
                        </g>
                    )}

                    {userRole === 'gm' && wallDrawData && (activeTool === 'wall-line' || activeTool === 'wall-brush') && (
                        <path d={generateSmoothPath(wallDrawData.points)} fill="none" stroke="#fbbf24" strokeWidth={4 / scale} strokeLinecap="round" strokeLinejoin="round" />
                    )}
                </svg>

                {Array.isArray(sessionData.pings) && sessionData.pings.map((ping, index) => {
                    const pingColor = ping.color || '#ef4444';
                    return (
                        <div 
                            key={`${ping.id}-${index}`}
                            className="absolute pointer-events-none z-40" 
                            style={{ left: ping.x, top: ping.y, transform: 'translate(-50%, -50%)' }}
                        >
                            <div className="relative">
                                <div className="w-4 h-4 rounded-full animate-ping" style={{ backgroundColor: pingColor, boxShadow: `0 0 15px ${pingColor}` }} />
                                <div className="absolute top-0 left-0 w-4 h-4 rounded-full border-2 border-white" style={{ backgroundColor: pingColor }} />
                            </div>
                        </div>
                    );
                })}
            </div>
            {sessionData.weather && sessionData.weather !== 'none' && !isPotatoMode && (
                <div className={`weather-overlay weather-${sessionData.weather}`} />
            )}
        </div>
    );
});