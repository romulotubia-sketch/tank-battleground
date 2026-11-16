export interface RectObstacleBounds {
  alive: boolean;
  blocksProjectiles: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Analytical Liang-Barsky slab intersection between segment (x1,y1)->(x2,y2)
 * and axis-aligned rectangle [left, right] x [top, bottom]. Zero allocations.
 */
export function segmentIntersectsAabb(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  left: number,
  top: number,
  right: number,
  bottom: number
): boolean {
  const minX = x1 < x2 ? x1 : x2;
  const maxX = x1 > x2 ? x1 : x2;
  if (maxX < left || minX > right) return false;

  const minY = y1 < y2 ? y1 : y2;
  const maxY = y1 > y2 ? y1 : y2;
  if (maxY < top || minY > bottom) return false;

  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;

  if (Math.abs(dx) < 1e-8) {
    if (x1 < left || x1 > right) return false;
  } else {
    const invDx = 1 / dx;
    let t1 = (left - x1) * invDx;
    let t2 = (right - x1) * invDx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return false;
  }

  if (Math.abs(dy) < 1e-8) {
    if (y1 < top || y1 > bottom) return false;
  } else {
    const invDy = 1 / dy;
    let t1 = (top - y1) * invDy;
    let t2 = (bottom - y1) * invDy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return false;
  }

  return tMin <= tMax;
}

export function hasLineOfSightObstacles(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  obstacles: readonly RectObstacleBounds[],
  padding = 2
): boolean {
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    if (!obs.alive || !obs.blocksProjectiles) continue;
    if (
      segmentIntersectsAabb(
        x1,
        y1,
        x2,
        y2,
        obs.left - padding,
        obs.top - padding,
        obs.right + padding,
        obs.bottom + padding
      )
    ) {
      return false;
    }
  }
  return true;
}
