export const segmentIntersection = (x1, y1, x2, y2, x3, y3, x4, y4) => {
    const det = (x2 - x1) * (y4 - y3) - (x4 - x3) * (y2 - y1);
    if (Math.abs(det) < 1e-10) return null;
    const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / det;
    const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / det;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
    }
    return null;
};

export const distToSegment = (p, v, w) => {
  const l2 = (w.x - v.x)**2 + (w.y - v.y)**2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
};

export function getIntersectionFallback(ray, segment) {
    const r_px = ray.x; const r_py = ray.y; const r_dx = ray.dx; const r_dy = ray.dy;
    const s_px = segment.x1; const s_py = segment.y1; const s_dx = segment.x2 - segment.x1; const s_dy = segment.y2 - segment.y1;
    const r_mag = Math.sqrt(r_dx * r_dx + r_dy * r_dy); if (r_mag === 0) return null;
    const T2 = r_dx * s_dy - r_dy * s_dx; if (T2 === 0) return null;
    const T1 = (s_px - r_px) * s_dy - (s_py - r_py) * s_dx; const T = T1 / T2;
    const U = ((s_px - r_px) * r_dy - (s_py - r_py) * r_dx) / T2;
    if (T > 0 && U >= 0 && U <= 1) return { x: r_px + r_dx * T, y: r_py + r_dy * T, param: T }; return null;
}

export function calculateVisibilityPolygonFallback(originX, originY, visionRadius, walls, mapWidth, mapHeight) {
    const allSegments = [...(walls || []), { x1: 0, y1: 0, x2: mapWidth, y2: 0 }, { x1: mapWidth, y1: 0, x2: mapWidth, y2: mapHeight }, { x1: mapWidth, y1: mapHeight, x2: 0, y2: mapHeight }, { x1: 0, y1: mapHeight, x2: 0, y2: 0 }];
    const points = []; for (let i = 0; i < allSegments.length; i++) { points.push({ x: allSegments[i].x1, y: allSegments[i].y1 }); points.push({ x: allSegments[i].x2, y: allSegments[i].y2 }); }
    
    const uniqueAngles = []; 
    for (let i = 0; i < points.length; i++) { const angle = Math.atan2(points[i].y - originY, points[i].x - originX); uniqueAngles.push(angle - 0.00001, angle, angle + 0.00001); }
    
    for (let i = 0; i < 72; i++) { uniqueAngles.push((i * Math.PI * 2) / 72); }

    const intersects = [];
    for (let j = 0; j < uniqueAngles.length; j++) {
        const angle = uniqueAngles[j]; const dx = Math.cos(angle); const dy = Math.sin(angle); const ray = { x: originX, y: originY, dx, dy }; let closestIntersect = null;
        for (let i = 0; i < allSegments.length; i++) {
            const intersect = getIntersectionFallback(ray, allSegments[i]); if (!intersect) continue;
            if (!closestIntersect || intersect.param < closestIntersect.param) closestIntersect = intersect;
        }
        if (closestIntersect) { closestIntersect.angle = angle; intersects.push(closestIntersect); }
    }
    intersects.sort((a, b) => a.angle - b.angle); const polygon = [];
    for (let i = 0; i < intersects.length; i++) {
        const p = intersects[i]; const dist = Math.hypot(p.x - originX, p.y - originY);
        if (dist > visionRadius) polygon.push({ x: originX + Math.cos(p.angle) * visionRadius, y: originY + Math.sin(p.angle) * visionRadius }); else polygon.push({ x: p.x, y: p.y });
    }
    return polygon;
}