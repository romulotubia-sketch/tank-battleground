import Phaser from 'phaser';
import { POWERUP_DEFINITIONS, POWERUP_IDS } from '../../data/powerups';
import { PowerupId } from '../../types/game';
import { ObstacleEntity } from '../entities/ObstacleEntity';
import { TankEntity } from '../entities/TankEntity';
import { ProjectilePool } from '../projectiles/ProjectilePool';
import { EffectsPool } from '../systems/EffectsPool';
import { soundFX } from '../systems/SoundFX';

export interface ActiveWorldPowerup {
  id: PowerupId;
  x: number;
  y: number;
  lifeSec: number;
  sprite: Phaser.GameObjects.Image;
  pulseTime: number;
}

export class PowerupManager {
  private scene: Phaser.Scene;
  private items: ActiveWorldPowerup[] = [];
  private spawnTimer = 2.5;

  readonly maxActive = 5;
  readonly spawnIntervalSec = 4.5;
  readonly despawnDurationSec = 24;

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
    projectiles: ProjectilePool,
    effects: EffectsPool
  ): void {
    // 1. Spawn check
    if (this.items.length < this.maxActive) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnIntervalSec;
        this.trySpawnPowerup(arenaWidth, arenaHeight, tanks, obstacles, effects);
      }
    }

    // 2. Update & check pickups
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.lifeSec -= dt;
      item.pulseTime += dt;

      if (item.lifeSec <= 0) {
        item.sprite.destroy();
        this.items.splice(i, 1);
        continue;
      }

      // Subtle bob + blink warning near expiration
      const bob = 1 + Math.sin(item.pulseTime * 4) * 0.06;
      item.sprite.setScale(bob);
      if (item.lifeSec < 3.5) {
        item.sprite.setAlpha(Math.sin(item.pulseTime * 14) > 0 ? 1 : 0.3);
      }

      let collected = false;
      for (const tank of tanks) {
        if (!tank.alive) continue;
        if (Math.hypot(tank.x - item.x, tank.y - item.y) <= tank.radius + 20) {
          this.collectPowerup(tank, item, projectiles, effects);
          item.sprite.destroy();
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
    projectiles: ProjectilePool,
    effects: EffectsPool
  ): void {
    const def = POWERUP_DEFINITIONS[item.id];
    if (item.id === 'mine_kit') {
      const dropX = tank.x - Math.cos(tank.hullAngle) * 32;
      const dropY = tank.y - Math.sin(tank.hullAngle) * 32;
      projectiles.spawnMine(tank.id, dropX, dropY);
    } else {
      tank.applyBuff(item.id);
    }

    effects.spawnRing(item.x, item.y, 44, Phaser.Display.Color.HexStringToColor(def.color).color, 0.28);
    if (tank.isPlayer) {
      effects.spawnFloatingLabel(tank.x, tank.y, def.name.toUpperCase(), def.color);
      soundFX.playPowerup();
    }
  }

  private trySpawnPowerup(
    arenaWidth: number,
    arenaHeight: number,
    tanks: TankEntity[],
    obstacles: ObstacleEntity[],
    effects: EffectsPool
  ): void {
    const margin = 110;
    for (let attempt = 0; attempt < 35; attempt++) {
      const x = margin + Math.random() * (arenaWidth - margin * 2);
      const y = margin + Math.random() * (arenaHeight - margin * 2);

      // Never spawn inside obstacles (including bushes/water)
      let blocked = false;
      for (const obs of obstacles) {
        if (!obs.alive) continue;
        if (obs.containsPoint(x, y, 32)) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      // Never spawn inside tanks or right on top of another powerup
      for (const tank of tanks) {
        if (tank.alive && Math.hypot(tank.x - x, tank.y - y) < tank.radius + 55) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      for (const existing of this.items) {
        if (Math.hypot(existing.x - x, existing.y - y) < 140) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const id = POWERUP_IDS[Math.floor(Math.random() * POWERUP_IDS.length)];
      const sprite = this.scene.add.image(x, y, `pwr_${id}`).setDepth(9);
      this.items.push({
        id,
        x,
        y,
        lifeSec: this.despawnDurationSec,
        sprite,
        pulseTime: Math.random() * 4,
      });
      effects.spawnRing(x, y, 32, 0xf3efe6, 0.24);
      return;
    }
  }

  clear(): void {
    for (const item of this.items) {
      item.sprite.destroy();
    }
    this.items = [];
  }
}
