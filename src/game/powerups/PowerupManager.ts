import Phaser from 'phaser';
import {
  POWERUP_DEFINITIONS,
  POWERUP_IDS,
  POWERUP_SPAWN_CONFIG,
} from '../../data/powerups';
import { PowerupId, SpawnPoint } from '../../types/game';
import { ObstacleEntity } from '../entities/ObstacleEntity';
import { TankEntity } from '../entities/TankEntity';
import { ApplyPickupResult } from './TemporaryEffectManager';
import { EffectsPool } from '../systems/EffectsPool';
import { soundFX } from '../systems/SoundFX';

export interface ActiveWorldPowerup {
  id: PowerupId;
  x: number;
  y: number;
  lifeSec: number;
  sprite: Phaser.GameObjects.Image;
  halo: Phaser.GameObjects.Arc;
  pulseTime: number;
}

export type PickupCollectedCallback = (
  tank: TankEntity,
  powerupId: PowerupId,
  result: ApplyPickupResult
) => void;

export function isValidPickupSpawnPosition(
  x: number,
  y: number,
  arenaWidth: number,
  arenaHeight: number,
  tanks: readonly Pick<TankEntity, 'alive' | 'x' | 'y' | 'radius'>[],
  obstacles: readonly Pick<ObstacleEntity, 'alive' | 'containsPoint'>[],
  spawns: readonly SpawnPoint[],
  existingItems: readonly Pick<ActiveWorldPowerup, 'x' | 'y'>[],
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

  for (const sp of spawns) {
    if (Math.hypot(sp.x - x, sp.y - y) < POWERUP_SPAWN_CONFIG.spawnPointClearance) {
      return false;
    }
  }

  for (const tank of tanks) {
    if (tank.alive && Math.hypot(tank.x - x, tank.y - y) < tank.radius + POWERUP_SPAWN_CONFIG.tankClearance) {
      return false;
    }
  }

  for (const existing of existingItems) {
    if (Math.hypot(existing.x - x, existing.y - y) < minPickupSeparation) {
      return false;
    }
  }

  return true;
}

export class PowerupManager {
  private scene: Phaser.Scene;
  private items: ActiveWorldPowerup[] = [];
  private spawnTimer: number = POWERUP_SPAWN_CONFIG.initialSpawnDelaySec;

  readonly maxActive = POWERUP_SPAWN_CONFIG.maxActive;
  readonly spawnIntervalSec = POWERUP_SPAWN_CONFIG.spawnIntervalSec;
  readonly despawnDurationSec = POWERUP_SPAWN_CONFIG.despawnDurationSec;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  getActivePowerups(): readonly ActiveWorldPowerup[] {
    return this.items;
  }

  update(
    dt: number,
    arenaWidth: number,
    arenaHeight: number,
    tanks: TankEntity[],
    obstacles: ObstacleEntity[],
    spawns: readonly SpawnPoint[],
    effects: EffectsPool,
    onPickupCollected?: PickupCollectedCallback
  ): void {
    // 1. Spawn check
    if (this.items.length < this.maxActive) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnIntervalSec;
        this.trySpawnPowerup(arenaWidth, arenaHeight, tanks, obstacles, spawns, effects);
      }
    }

    // 2. Update & check pickups
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.lifeSec -= dt;
      item.pulseTime += dt;

      if (item.lifeSec <= 0) {
        item.sprite.destroy();
        item.halo.destroy();
        this.items.splice(i, 1);
        continue;
      }

      // Subtle bob, pulsing ground halo, and blink warning near expiration
      const bob = 1 + Math.sin(item.pulseTime * 4) * 0.06;
      item.sprite.setScale(bob);
      item.halo.setScale(0.94 + Math.sin(item.pulseTime * 4) * 0.1);
      if (item.lifeSec < 4.0) {
        const blink = Math.sin(item.pulseTime * 16) > 0 ? 1 : 0.25;
        item.sprite.setAlpha(blink);
        item.halo.setAlpha(blink * 0.75);
      } else {
        item.sprite.setAlpha(1);
        item.halo.setAlpha(0.55 + Math.sin(item.pulseTime * 4) * 0.2);
      }

      let collected = false;
      for (const tank of tanks) {
        if (!tank.alive) continue;
        if (
          Math.hypot(tank.x - item.x, tank.y - item.y) <=
          tank.radius + POWERUP_SPAWN_CONFIG.collectionPadding
        ) {
          this.collectPowerup(tank, item, effects, onPickupCollected);
          item.sprite.destroy();
          item.halo.destroy();
          this.items.splice(i, 1);
          collected = true;
          break;
        }
      }
      if (collected) continue;
    }
  }

  private collectPowerup(
    tank: TankEntity,
    item: ActiveWorldPowerup,
    effects: EffectsPool,
    onPickupCollected?: PickupCollectedCallback
  ): void {
    const def = POWERUP_DEFINITIONS[item.id];
    const result = tank.applyBuff(item.id);
    if (!result.applied) return;

    const colorNum = Phaser.Display.Color.HexStringToColor(def.color).color;
    effects.spawnRing(item.x, item.y, 44, colorNum, 0.28);

    if (tank.isPlayer) {
      let labelText = def.name.toUpperCase();
      if (item.id === 'repair_kit') {
        labelText = result.healedAmount > 0 ? `+${result.healedAmount} HP` : 'HULL FULL';
      } else if (item.id === 'mine_kit') {
        labelText = result.minesAdded > 0 ? `+${result.minesAdded} MINES` : 'MINES FULL';
      }
      effects.spawnFloatingLabel(tank.x, tank.y, labelText, def.color);
      soundFX.playPowerup();
    }

    onPickupCollected?.(tank, item.id, result);
  }

  private trySpawnPowerup(
    arenaWidth: number,
    arenaHeight: number,
    tanks: TankEntity[],
    obstacles: ObstacleEntity[],
    spawns: readonly SpawnPoint[],
    effects: EffectsPool
  ): void {
    const margin = 110;
    const halfW = arenaWidth / 2;
    const halfH = arenaHeight / 2;

    // Count existing pickups per quadrant to avoid clustering on one side of the arena
    const quadCounts = [0, 0, 0, 0];
    for (const item of this.items) {
      const q = (item.x >= halfW ? 1 : 0) + (item.y >= halfH ? 2 : 0);
      quadCounts[q] += 1;
    }
    const minQuadCount = Math.min(...quadCounts);
    const preferredQuads: number[] = [];
    for (let q = 0; q < 4; q++) {
      if (quadCounts[q] === minQuadCount) preferredQuads.push(q);
    }

    let fallbackCandidate: { x: number; y: number } | null = null;
    let chosenCandidate: { x: number; y: number } | null = null;

    for (let attempt = 0; attempt < 48; attempt++) {
      const targetQuad = preferredQuads[attempt % preferredQuads.length];
      const usePreferredQuad = attempt < 36;
      const minX = usePreferredQuad && (targetQuad & 1) ? halfW + 40 : margin;
      const maxX = usePreferredQuad && !(targetQuad & 1) ? halfW - 40 : arenaWidth - margin;
      const minY = usePreferredQuad && (targetQuad & 2) ? halfH + 40 : margin;
      const maxY = usePreferredQuad && !(targetQuad & 2) ? halfH - 40 : arenaHeight - margin;

      const x = minX + Math.random() * Math.max(40, maxX - minX);
      const y = minY + Math.random() * Math.max(40, maxY - minY);

      if (
        isValidPickupSpawnPosition(
          x,
          y,
          arenaWidth,
          arenaHeight,
          tanks,
          obstacles,
          spawns,
          this.items,
          POWERUP_SPAWN_CONFIG.minPickupSeparation
        )
      ) {
        chosenCandidate = { x, y };
        break;
      }

      if (
        !fallbackCandidate &&
        isValidPickupSpawnPosition(
          x,
          y,
          arenaWidth,
          arenaHeight,
          tanks,
          obstacles,
          spawns,
          this.items,
          200
        )
      ) {
        fallbackCandidate = { x, y };
      }
    }

    const chosen = chosenCandidate ?? fallbackCandidate;
    if (!chosen) return;

    const id = POWERUP_IDS[Math.floor(Math.random() * POWERUP_IDS.length)];
    const def = POWERUP_DEFINITIONS[id];
    const colorNum = Phaser.Display.Color.HexStringToColor(def.color).color;

    const halo = this.scene.add
      .circle(chosen.x, chosen.y, 26, colorNum, 0.14)
      .setStrokeStyle(2, colorNum, 0.78)
      .setDepth(8);
    const sprite = this.scene.add.image(chosen.x, chosen.y, `pwr_${id}`).setDepth(9);

    this.items.push({
      id,
      x: chosen.x,
      y: chosen.y,
      lifeSec: this.despawnDurationSec,
      sprite,
      halo,
      pulseTime: Math.random() * 4,
    });
    effects.spawnRing(chosen.x, chosen.y, 34, colorNum, 0.24);
  }

  clear(): void {
    for (const item of this.items) {
      item.sprite.destroy();
      item.halo.destroy();
    }
    this.items = [];
    this.spawnTimer = POWERUP_SPAWN_CONFIG.initialSpawnDelaySec;
  }
}
