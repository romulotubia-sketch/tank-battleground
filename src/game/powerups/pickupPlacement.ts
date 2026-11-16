import { POWERUP_SPAWN_CONFIG } from '../../data/powerups';
import { SpawnPoint } from '../../types/game';

export interface SpawnTankRef {
  alive: boolean;
  x: number;
  y: number;
  radius: number;
}

export interface SpawnObstacleRef {
  alive: boolean;
  containsPoint(px: number, py: number, padding?: number): boolean;
}

export interface SpawnPointRef {
  x: number;
  y: number;
}

export function isValidPickupSpawnPosition(
  x: number,
  y: number,
  arenaWidth: number,
  arenaHeight: number,
  tanks: readonly SpawnTankRef[],
  obstacles: readonly SpawnObstacleRef[],
  spawns: readonly SpawnPoint[],
  existingItems: readonly SpawnPointRef[],
  minPickupSeparation: number = POWERUP_SPAWN_CONFIG.minPickupSeparation
): boolean {
  const margin = 105;
  if (x < margin || x > arenaWidth - margin || y < margin || y > arenaHeight - margin) {
    return false;
  }

  for (const obs of obstacles) {
    if (!obs.alive) continue;
    if (obs.containsPoint(x, y, POWERUP_SPAWN_CONFIG.obstacleClearance)) {
      return false;
    }
  }

  const spawnClearSq =
    POWERUP_SPAWN_CONFIG.spawnPointClearance * POWERUP_SPAWN_CONFIG.spawnPointClearance;
  for (const sp of spawns) {
    const dx = sp.x - x;
    const dy = sp.y - y;
    if (dx * dx + dy * dy < spawnClearSq) {
      return false;
    }
  }

  for (const tank of tanks) {
    if (!tank.alive) continue;
    const dx = tank.x - x;
    const dy = tank.y - y;
    const minDist = tank.radius + POWERUP_SPAWN_CONFIG.tankClearance;
    if (dx * dx + dy * dy < minDist * minDist) {
      return false;
    }
  }

  const minSepSq = minPickupSeparation * minPickupSeparation;
  for (const existing of existingItems) {
    const dx = existing.x - x;
    const dy = existing.y - y;
    if (dx * dx + dy * dy < minSepSq) {
      return false;
    }
  }

  return true;
}
