import Phaser from 'phaser';
import { EffectsPool } from '../systems/EffectsPool';
import { soundFX } from '../systems/SoundFX';
import { ObstacleEntity } from '../entities/ObstacleEntity';
import { TankEntity } from '../entities/TankEntity';

export interface ProjectileSpawnOptions {
  owner: TankEntity;
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  range: number;
  radius: number;
  pierceCount: number;
  appliesSlow: boolean;
  textureKey: string;
}

interface PooledProjectile {
  sprite: Phaser.GameObjects.Image;
  active: boolean;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  distanceLeft: number;
  radius: number;
  pierceLeft: number;
  appliesSlow: boolean;
  hitEntityIds: Set<string>;
}

interface ProximityMine {
  sprite: Phaser.GameObjects.Image;
  ownerId: string;
  x: number;
  y: number;
  armTimer: number;
  life: number;
  active: boolean;
}

export interface BarrageStrikeOptions {
  owner: TankEntity;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  shellCount: number;
  impactIntervalSec: number;
  flightSec: number;
  aoeRadius: number;
  damage: number;
  scatterRadius: number;
  arenaWidth: number;
  arenaHeight: number;
}

interface PooledBarrageShell {
  warningOuter: Phaser.GameObjects.Arc;
  warningInner: Phaser.GameObjects.Arc;
  shadow: Phaser.GameObjects.Arc;
  shellSprite: Phaser.GameObjects.Image;
  active: boolean;
  launched: boolean;
  impacted: boolean;
  ownerId: string;
  startX: number;
  startY: number;
  impactX: number;
  impactY: number;
  delayTimer: number;
  flightTimer: number;
  flightTotal: number;
  aoeRadius: number;
  damage: number;
  hitEntityIds: Set<string>;
}

export class ProjectilePool {
  private scene: Phaser.Scene;
  private pool: PooledProjectile[] = [];
  private mines: ProximityMine[] = [];
  private barrageShells: PooledBarrageShell[] = [];

  constructor(scene: Phaser.Scene, poolSize = 110) {
    this.scene = scene;
    for (let i = 0; i < poolSize; i++) {
      const sprite = scene.add.image(-200, -200, 'proj_standard');
      sprite.setDepth(18);
      sprite.setVisible(false);
      this.pool.push({
        sprite,
        active: false,
        ownerId: '',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        damage: 0,
        distanceLeft: 0,
        radius: 6,
        pierceLeft: 0,
        appliesSlow: false,
        hitEntityIds: new Set(),
      });
    }

    for (let i = 0; i < 16; i++) {
      const sprite = scene.add.image(-200, -200, 'entity_mine');
      sprite.setDepth(8);
      sprite.setVisible(false);
      this.mines.push({
        sprite,
        ownerId: '',
        x: 0,
        y: 0,
        armTimer: 0.8,
        life: 25,
        active: false,
      });
    }

    for (let i = 0; i < 16; i++) {
      const warningOuter = scene.add
        .circle(-200, -200, 80, 0xef4444, 0.14)
        .setStrokeStyle(2.5, 0xef4444, 0.85)
        .setDepth(5)
        .setVisible(false);
      const warningInner = scene.add
        .circle(-200, -200, 10, 0xf97316, 0.22)
        .setStrokeStyle(2, 0xfacc15, 0.9)
        .setDepth(5)
        .setVisible(false);
      const shadow = scene.add
        .circle(-200, -200, 8, 0x000000, 0.3)
        .setDepth(19)
        .setVisible(false);
      const shellSprite = scene.add
        .image(-200, -200, 'proj_artillery')
        .setDepth(29)
        .setVisible(false);

      this.barrageShells.push({
        warningOuter,
        warningInner,
        shadow,
        shellSprite,
        active: false,
        launched: false,
        impacted: false,
        ownerId: '',
        startX: 0,
        startY: 0,
        impactX: 0,
        impactY: 0,
        delayTimer: 0,
        flightTimer: 0,
        flightTotal: 0.65,
        aoeRadius: 88,
        damage: 28,
        hitEntityIds: new Set(),
      });
    }
  }

  spawn(opts: ProjectileSpawnOptions): void {
    for (const p of this.pool) {
      if (!p.active) {
        p.active = true;
        p.ownerId = opts.owner.id;
        p.x = opts.x;
        p.y = opts.y;
        p.vx = Math.cos(opts.angle) * opts.speed;
        p.vy = Math.sin(opts.angle) * opts.speed;
        p.damage = opts.damage;
        p.distanceLeft = opts.range;
        p.radius = opts.radius;
        p.pierceLeft = opts.pierceCount;
        p.appliesSlow = opts.appliesSlow;
        p.hitEntityIds.clear();

        p.sprite.setTexture(opts.textureKey);
        p.sprite.setPosition(opts.x, opts.y);
        p.sprite.setRotation(opts.angle);
        p.sprite.setVisible(true);
        return;
      }
    }
  }

  spawnMine(ownerId: string, x: number, y: number): void {
    for (const m of this.mines) {
      if (!m.active) {
        m.active = true;
        m.ownerId = ownerId;
        m.x = x;
        m.y = y;
        m.armTimer = 0.75;
        m.life = 28;
        m.sprite.setPosition(x, y).setAlpha(0.65).setVisible(true);
        return;
      }
    }
  }

  spawnBarrage(opts: BarrageStrikeOptions): number {
    let scheduled = 0;
    const count = Math.max(1, opts.shellCount);
    const baseAngle = Math.random() * Math.PI * 2;
    const minCoord = 28;
    const maxW = Math.max(minCoord + 1, opts.arenaWidth - minCoord);
    const maxH = Math.max(minCoord + 1, opts.arenaHeight - minCoord);

    for (let i = 0; i < count; i++) {
      const slot = this.barrageShells.find((b) => !b.active);
      if (!slot) break;

      const offsetDist =
        i === 0
          ? Math.random() * 14
          : opts.scatterRadius * (0.45 + Math.random() * 0.55);
      const offsetAng =
        baseAngle + (i * Math.PI * 2) / Math.max(1, count - 1) + (Math.random() - 0.5) * 0.4;
      const impactX = Phaser.Math.Clamp(
        opts.targetX + Math.cos(offsetAng) * offsetDist,
        minCoord,
        maxW
      );
      const impactY = Phaser.Math.Clamp(
        opts.targetY + Math.sin(offsetAng) * offsetDist,
        minCoord,
        maxH
      );

      slot.active = true;
      slot.launched = false;
      slot.impacted = false;
      slot.ownerId = opts.owner.id;
      slot.startX = opts.startX;
      slot.startY = opts.startY;
      slot.impactX = impactX;
      slot.impactY = impactY;
      slot.delayTimer = i * opts.impactIntervalSec;
      slot.flightTotal = Math.max(0.25, opts.flightSec);
      slot.flightTimer = slot.flightTotal;
      slot.aoeRadius = opts.aoeRadius;
      slot.damage = opts.damage;
      slot.hitEntityIds.clear();

      slot.warningOuter.setVisible(false);
      slot.warningInner.setVisible(false);
      slot.shadow.setVisible(false);
      slot.shellSprite.setVisible(false);
      scheduled += 1;
    }
    return scheduled;
  }

  update(
    dt: number,
    tanks: TankEntity[],
    obstacles: ObstacleEntity[],
    arenaWidth: number,
    arenaHeight: number,
    effects: EffectsPool,
    onBarrelExplode: (x: number, y: number, attackerId: string) => void,
    onTankEliminated: (victim: TankEntity, attackerId: string) => void
  ): void {
    const tankMap = new Map<string, TankEntity>();
    for (const t of tanks) tankMap.set(t.id, t);

    // 1. Update mines
    for (const m of this.mines) {
      if (!m.active) continue;
      m.life -= dt;
      if (m.life <= 0) {
        m.active = false;
        m.sprite.setVisible(false);
        continue;
      }
      if (m.armTimer > 0) {
        m.armTimer -= dt;
        if (m.armTimer <= 0) m.sprite.setAlpha(1);
        continue;
      }

      for (const t of tanks) {
        if (!t.alive || t.id === m.ownerId) continue;
        if (Math.hypot(t.x - m.x, t.y - m.y) <= t.radius + 16) {
          m.active = false;
          m.sprite.setVisible(false);
          effects.spawnDestruction(m.x, m.y, 0xf97316, 85);
          soundFX.playExplosion();

          const res = t.takeDamage(45);
          const attacker = tankMap.get(m.ownerId);
          if (attacker) attacker.damageDealt += res.actualDamage;
          if (res.killed) onTankEliminated(t, m.ownerId);
          break;
        }
      }
    }

    // 2. Update projectiles with continuous sub-stepping to prevent tunneling
    for (const p of this.pool) {
      if (!p.active) continue;

      const totalDx = p.vx * dt;
      const totalDy = p.vy * dt;
      const totalDist = Math.hypot(totalDx, totalDy);
      const subSteps = Math.max(1, Math.ceil(totalDist / 8));
      const subDx = totalDx / subSteps;
      const subDy = totalDy / subSteps;
      const subDist = totalDist / subSteps;

      for (let step = 0; step < subSteps; step++) {
        if (!p.active) break;

        p.x += subDx;
        p.y += subDy;
        p.distanceLeft -= subDist;

        if (
          p.distanceLeft <= 0 ||
          p.x < 10 ||
          p.x > arenaWidth - 10 ||
          p.y < 10 ||
          p.y > arenaHeight - 10
        ) {
          p.active = false;
          p.sprite.setVisible(false);
          effects.spawnImpact(p.x, p.y, 0xd6d3d1);
          break;
        }

        // Check solid obstacles (water & bushes let projectiles pass)
        let consumed = false;
        for (const obs of obstacles) {
          if (!obs.alive || !obs.blocksProjectiles) continue;
          const obsKey = `obs_${obs.id}`;
          if (p.hitEntityIds.has(obsKey)) continue;

          if (obs.containsPoint(p.x, p.y, p.radius)) {
            p.hitEntityIds.add(obsKey);
            if (obs.destructible) {
              const destroyed = obs.damage(p.damage, this.scene);
              if (destroyed) {
                if (obs.type === 'barrel') {
                  onBarrelExplode(obs.x, obs.y, p.ownerId);
                } else {
                  effects.spawnDestruction(
                    obs.x,
                    obs.y,
                    obs.type === 'brick' ? 0xb45309 : 0xd97706,
                    48
                  );
                  soundFX.playImpact(true);
                }
              } else {
                effects.spawnImpact(p.x, p.y, 0xf59e0b);
                soundFX.playImpact(false);
              }

              if (p.pierceLeft > 0) {
                p.pierceLeft -= 1;
              } else {
                consumed = true;
              }
            } else {
              // Indestructible steel stops all projectiles
              effects.spawnImpact(p.x, p.y, 0x94a3b8);
              soundFX.playImpact(false);
              consumed = true;
            }
            break;
          }
        }

        if (consumed) {
          p.active = false;
          p.sprite.setVisible(false);
          break;
        }

        // Check tanks
        for (const tank of tanks) {
          if (!tank.alive || tank.id === p.ownerId) continue;
          if (p.hitEntityIds.has(tank.id)) continue;

          const dist = Math.hypot(tank.x - p.x, tank.y - p.y);
          if (dist <= tank.radius + p.radius) {
            p.hitEntityIds.add(tank.id);
            const res = tank.takeDamage(p.damage);
            const attacker = tankMap.get(p.ownerId);
            if (attacker) {
              attacker.damageDealt += res.actualDamage;
            }

            if (p.appliesSlow) {
              tank.applySlow(0.75, 1.5);
            }

            if (res.shieldAbsorbed > 0) {
              effects.spawnImpact(p.x, p.y, 0x38bdf8);
              if (res.shieldBroken) {
                effects.spawnRing(tank.x, tank.y, tank.radius + 22, 0x38bdf8, 0.28);
              }
            } else {
              effects.spawnImpact(p.x, p.y, p.appliesSlow ? 0x22d3ee : 0xef4444);
            }
            soundFX.playImpact(true);

            if (res.killed) {
              onTankEliminated(tank, p.ownerId);
            }

            if (p.pierceLeft > 0) {
              p.pierceLeft -= 1;
            } else {
              p.active = false;
              p.sprite.setVisible(false);
            }
            break;
          }
        }
      }

      if (p.active) {
        p.sprite.setPosition(p.x, p.y);
      }
    }

    // 3. Update incoming Artillery Shell Barrage strikes
    for (const b of this.barrageShells) {
      if (!b.active || b.impacted) continue;

      if (b.delayTimer > 0) {
        b.delayTimer -= dt;
        if (b.delayTimer > 0) continue;
        b.delayTimer = 0;
      }

      if (!b.launched) {
        b.launched = true;
        b.warningOuter
          .setPosition(b.impactX, b.impactY)
          .setRadius(b.aoeRadius)
          .setVisible(true);
        b.warningInner
          .setPosition(b.impactX, b.impactY)
          .setRadius(8)
          .setVisible(true);
        b.shadow.setPosition(b.startX, b.startY).setVisible(true);
        b.shellSprite
          .setPosition(b.startX, b.startY)
          .setRotation(Math.atan2(b.impactY - b.startY, b.impactX - b.startX))
          .setScale(0.95)
          .setVisible(true);
        effects.spawnMuzzleFlash(b.startX, b.startY, Math.atan2(b.impactY - b.startY, b.impactX - b.startX));
      }

      b.flightTimer -= dt;
      if (b.flightTimer > 0) {
        const progress = Phaser.Math.Clamp(1 - b.flightTimer / b.flightTotal, 0, 1);
        b.warningInner.setRadius(Math.max(8, b.aoeRadius * progress));

        const sx = Phaser.Math.Linear(b.startX, b.impactX, progress);
        const sy = Phaser.Math.Linear(b.startY, b.impactY, progress);
        const arcLift = Math.sin(progress * Math.PI) * 64;
        b.shadow.setPosition(sx, sy);
        b.shellSprite
          .setPosition(sx, sy - arcLift)
          .setScale(0.95 + Math.sin(progress * Math.PI) * 0.45);
        continue;
      }

      // Impact occurs exactly once
      b.impacted = true;
      b.active = false;
      b.warningOuter.setVisible(false);
      b.warningInner.setVisible(false);
      b.shadow.setVisible(false);
      b.shellSprite.setVisible(false);

      effects.spawnDestruction(b.impactX, b.impactY, 0xef4444, b.aoeRadius);
      soundFX.playExplosion();

      const attacker = tankMap.get(b.ownerId);
      for (const tank of tanks) {
        if (!tank.alive || tank.id === b.ownerId) continue;
        if (b.hitEntityIds.has(tank.id)) continue;

        const dist = Math.hypot(tank.x - b.impactX, tank.y - b.impactY);
        const hitThreshold = b.aoeRadius + tank.radius * 0.5;
        if (dist <= hitThreshold) {
          b.hitEntityIds.add(tank.id);
          const falloff = 1 - 0.35 * Math.min(1, dist / Math.max(1, hitThreshold));
          const dmg = Math.round(b.damage * falloff);
          const res = tank.takeDamage(dmg);
          if (attacker) attacker.damageDealt += res.actualDamage;
          if (res.killed) onTankEliminated(tank, b.ownerId);
        }
      }

      for (const obs of obstacles) {
        if (!obs.alive || !obs.destructible) continue;
        const obsKey = `obs_${obs.id}`;
        if (b.hitEntityIds.has(obsKey)) continue;

        if (Math.hypot(obs.x - b.impactX, obs.y - b.impactY) <= b.aoeRadius * 0.85) {
          b.hitEntityIds.add(obsKey);
          const destroyed = obs.damage(Math.round(b.damage * 0.85), this.scene);
          if (destroyed) {
            if (obs.type === 'barrel') {
              onBarrelExplode(obs.x, obs.y, b.ownerId);
            } else {
              effects.spawnDestruction(
                obs.x,
                obs.y,
                obs.type === 'brick' ? 0xb45309 : 0xd97706,
                48
              );
            }
          }
        }
      }
    }
  }

  getActiveBarrageCount(ownerId?: string): number {
    let count = 0;
    for (const b of this.barrageShells) {
      if (b.active && (!ownerId || b.ownerId === ownerId)) count += 1;
    }
    return count;
  }

  getActiveThreatNear(x: number, y: number, radius: number, ignoreOwnerId: string): { vx: number; vy: number } | null {
    for (const p of this.pool) {
      if (!p.active || p.ownerId === ignoreOwnerId) continue;
      if (Math.hypot(p.x - x, p.y - y) < radius) {
        return { vx: p.vx, vy: p.vy };
      }
    }
    for (const b of this.barrageShells) {
      if (!b.active || !b.launched || b.impacted) continue;
      const dx = b.impactX - x;
      const dy = b.impactY - y;
      if (Math.hypot(dx, dy) <= b.aoeRadius + 30) {
        // Return pseudo-velocity vector pointing toward impact center so AI dodges perpendicularly/away
        return { vx: dx || 1, vy: dy || 0 };
      }
    }
    return null;
  }
}
