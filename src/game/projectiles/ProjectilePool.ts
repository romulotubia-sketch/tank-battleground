import Phaser from 'phaser';
import { MINE_SYSTEM_CONFIG } from '../../data/powerups';
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
  slowFactor: number;
  slowDurationSec: number;
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
  slowFactor: number;
  slowDurationSec: number;
  hitEntityIds: Set<string>;
  hitObstacleIds: Set<number>;
  trailTimer: number;
  trailColor: number;
}

interface ProximityMine {
  sprite: Phaser.GameObjects.Image;
  indicatorRing: Phaser.GameObjects.Arc;
  ownerId: string;
  x: number;
  y: number;
  armTimer: number;
  life: number;
  damage: number;
  pulseClock: number;
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
  hitObstacleIds: Set<number>;
  trailTimer: number;
}

export class ProjectilePool {
  private scene: Phaser.Scene;
  private pool: PooledProjectile[] = [];
  private mines: ProximityMine[] = [];
  private barrageShells: PooledBarrageShell[] = [];
  private tankLookup = new Map<string, TankEntity>();

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
        slowFactor: 1,
        slowDurationSec: 0,
        hitEntityIds: new Set(),
        hitObstacleIds: new Set(),
        trailTimer: 0,
        trailColor: 0xfde68a,
      });
    }

    for (let i = 0; i < 16; i++) {
      const indicatorRing = scene.add
        .circle(-200, -200, 22, 0xf97316, 0.12)
        .setStrokeStyle(2, 0xf97316, 0.8)
        .setDepth(7)
        .setVisible(false);
      const sprite = scene.add.image(-200, -200, 'entity_mine');
      sprite.setDepth(8);
      sprite.setVisible(false);
      this.mines.push({
        sprite,
        indicatorRing,
        ownerId: '',
        x: 0,
        y: 0,
        armTimer: MINE_SYSTEM_CONFIG.armDelaySec,
        life: MINE_SYSTEM_CONFIG.durationSec,
        damage: MINE_SYSTEM_CONFIG.damage,
        pulseClock: 0,
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
        hitObstacleIds: new Set(),
        trailTimer: 0,
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
        p.slowFactor = opts.slowFactor;
        p.slowDurationSec = opts.slowDurationSec;
        p.hitEntityIds.clear();
        p.hitObstacleIds.clear();
        p.trailTimer = 0.025;
        p.trailColor =
          opts.textureKey === 'proj_electric'
            ? 0x22d3ee
            : opts.textureKey === 'proj_artillery' || opts.textureKey === 'proj_heavy'
            ? 0xf97316
            : opts.textureKey === 'proj_pierce'
            ? 0xc084fc
            : 0xfde68a;

        p.sprite.setTexture(opts.textureKey);
        p.sprite.setPosition(opts.x, opts.y);
        p.sprite.setRotation(opts.angle);
        p.sprite.setVisible(true);
        return;
      }
    }
  }

  spawnMine(
    ownerId: string,
    x: number,
    y: number,
    durationSec = MINE_SYSTEM_CONFIG.durationSec,
    armDelaySec = MINE_SYSTEM_CONFIG.armDelaySec,
    damage = MINE_SYSTEM_CONFIG.damage
  ): boolean {
    if (
      this.getActiveMineCount(ownerId) >= MINE_SYSTEM_CONFIG.maxActivePerTank ||
      this.getActiveMineCount() >= MINE_SYSTEM_CONFIG.maxActiveGlobal
    ) {
      return false;
    }

    for (const m of this.mines) {
      if (!m.active) {
        m.active = true;
        m.ownerId = ownerId;
        m.x = x;
        m.y = y;
        m.armTimer = armDelaySec;
        m.life = durationSec;
        m.damage = damage;
        m.pulseClock = 0;
        m.sprite.setPosition(x, y).setAlpha(0.65).setVisible(true);
        m.indicatorRing
          .setPosition(x, y)
          .setStrokeStyle(2, 0xfacc15, 0.65)
          .setFillStyle(0xfacc15, 0.1)
          .setVisible(true);
        return true;
      }
    }
    return false;
  }

  canSpawnMine(ownerId: string): boolean {
    if (
      this.getActiveMineCount(ownerId) >= MINE_SYSTEM_CONFIG.maxActivePerTank ||
      this.getActiveMineCount() >= MINE_SYSTEM_CONFIG.maxActiveGlobal
    ) {
      return false;
    }
    for (const m of this.mines) {
      if (!m.active) return true;
    }
    return false;
  }

  getActiveMineCount(ownerId?: string): number {
    let count = 0;
    for (const m of this.mines) {
      if (m.active && (!ownerId || m.ownerId === ownerId)) count += 1;
    }
    return count;
  }

  clearAll(): void {
    for (const p of this.pool) {
      p.active = false;
      p.sprite.setVisible(false);
    }
    for (const m of this.mines) {
      m.active = false;
      m.sprite.setVisible(false);
      m.indicatorRing.setVisible(false);
    }
    for (const b of this.barrageShells) {
      b.active = false;
      b.launched = false;
      b.impacted = false;
      b.warningOuter.setVisible(false);
      b.warningInner.setVisible(false);
      b.shadow.setVisible(false);
      b.shellSprite.setVisible(false);
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
      slot.hitObstacleIds.clear();
      slot.trailTimer = 0.04;

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
    onTankEliminated: (victim: TankEntity, attackerId: string) => void,
    onObstacleDestroyed?: (obs: ObstacleEntity, attackerId: string) => void
  ): void {
    this.tankLookup.clear();
    const tankMap = this.tankLookup;
    for (const t of tanks) tankMap.set(t.id, t);

    // 1. Update mines (clear visual indicators, expiration, single-hit safety)
    for (const m of this.mines) {
      if (!m.active) continue;
      m.life -= dt;
      m.pulseClock += dt;
      if (m.life <= 0) {
        m.active = false;
        m.sprite.setVisible(false);
        m.indicatorRing.setVisible(false);
        continue;
      }
      if (m.armTimer > 0) {
        m.armTimer -= dt;
        if (m.armTimer <= 0) {
          m.sprite.setAlpha(1);
          m.indicatorRing.setStrokeStyle(2, 0xf97316, 0.85).setFillStyle(0xf97316, 0.14);
        }
        continue;
      }

      const blinkWarn = m.life < 4 ? (Math.sin(m.pulseClock * 18) > 0 ? 1 : 0.3) : 1;
      const pulseAlpha = (0.45 + 0.4 * Math.abs(Math.sin(m.pulseClock * 6))) * blinkWarn;
      m.sprite.setAlpha(blinkWarn);
      m.indicatorRing.setAlpha(pulseAlpha);

      for (const t of tanks) {
        if (!t.alive || t.id === m.ownerId) continue;
        const mdx = t.x - m.x;
        const mdy = t.y - m.y;
        const trigR = t.radius + MINE_SYSTEM_CONFIG.triggerPadding;
        if (mdx * mdx + mdy * mdy <= trigR * trigR) {
          // Deactivate immediately BEFORE dealing damage so a mine never deals repeated hits
          m.active = false;
          m.sprite.setVisible(false);
          m.indicatorRing.setVisible(false);
          effects.spawnDestruction(m.x, m.y, 0xf97316, 85);
          soundFX.playExplosion();

          const res = t.takeDamage(m.damage, 'explosion');
          const attacker = tankMap.get(m.ownerId);
          if (attacker) attacker.damageDealt += res.actualDamage;
          if ((t.isPlayer || attacker?.isPlayer) && res.actualDamage > 0) {
            effects.spawnDamageNumber(t.x, t.y, res.actualDamage, 'explosion');
          }
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

        const outOfBounds =
          p.x < 10 || p.x > arenaWidth - 10 || p.y < 10 || p.y > arenaHeight - 10;
        if (p.distanceLeft <= 0 || outOfBounds) {
          p.active = false;
          p.sprite.setVisible(false);
          if (outOfBounds) {
            effects.spawnImpact(p.x, p.y, 0x94a3b8);
            effects.spawnRing(p.x, p.y, 16, 0x94a3b8, 0.14);
          } else {
            effects.spawnTrailPuff(p.x, p.y, 0xe5e7eb, 0.25);
          }
          break;
        }

        // Check solid obstacles (water & bushes let projectiles pass)
        let consumed = false;
        for (const obs of obstacles) {
          if (!obs.alive || !obs.blocksProjectiles) continue;
          if (p.hitObstacleIds.has(obs.id)) continue;

          if (obs.containsPoint(p.x, p.y, p.radius)) {
            p.hitObstacleIds.add(obs.id);
            const obsKind =
              obs.type === 'crate' ? 'crate' : obs.type === 'brick' ? 'brick' : 'steel';
            if (obs.destructible) {
              const destroyed = obs.damage(p.damage, this.scene, p.ownerId);
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
                  effects.spawnObstacleDebris(obs.x, obs.y, obsKind);
                  soundFX.playImpact('destructible');
                  onObstacleDestroyed?.(obs, p.ownerId);
                }
              } else {
                effects.spawnObstacleDebris(p.x, p.y, obsKind);
                if (obs.isPriming) {
                  effects.spawnImpact(p.x, p.y, 0xfacc15);
                }
                soundFX.playImpact('destructible');
              }

              if (p.pierceLeft > 0) {
                p.pierceLeft -= 1;
              } else {
                consumed = true;
              }
            } else {
              // Indestructible steel stops all projectiles
              effects.spawnObstacleDebris(p.x, p.y, 'steel');
              soundFX.playImpact('steel');
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

          const tdx = tank.x - p.x;
          const tdy = tank.y - p.y;
          const hitR = tank.radius + p.radius;
          if (tdx * tdx + tdy * tdy <= hitR * hitR) {
            p.hitEntityIds.add(tank.id);
            const res = tank.takeDamage(p.damage);
            const attacker = tankMap.get(p.ownerId);
            if (attacker) {
              attacker.damageDealt += res.actualDamage;
            }

            if (p.appliesSlow) {
              tank.applySlow(p.slowFactor, p.slowDurationSec, 'static');
            }

            if (res.shieldAbsorbed > 0) {
              effects.spawnImpact(p.x, p.y, 0x38bdf8);
              soundFX.playImpact('shield');
              if (res.shieldBroken) {
                effects.spawnRing(tank.x, tank.y, tank.radius + 22, 0x38bdf8, 0.28);
                soundFX.playShieldBreak();
              }
            } else if (p.appliesSlow) {
              effects.spawnElectricImpact(p.x, p.y);
              soundFX.playImpact('tank');
            } else {
              effects.spawnImpact(p.x, p.y, 0xef4444);
              soundFX.playImpact('tank');
            }

            if ((tank.isPlayer || attacker?.isPlayer) && res.actualDamage > 0) {
              const kind =
                res.shieldAbsorbed > 0 && res.actualDamage === res.shieldAbsorbed
                  ? 'shield'
                  : p.appliesSlow
                  ? 'electric'
                  : 'normal';
              effects.spawnDamageNumber(tank.x, tank.y, res.actualDamage, kind);
            }

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
        p.trailTimer -= dt;
        if (p.trailTimer <= 0) {
          p.trailTimer = p.trailColor === 0x22d3ee ? 0.04 : 0.052;
          effects.spawnTrailPuff(p.x, p.y, p.trailColor, p.radius >= 8 ? 0.28 : 0.2);
        }
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
        b.trailTimer -= dt;
        if (b.trailTimer <= 0) {
          b.trailTimer = 0.06;
          effects.spawnTrailPuff(sx, sy - arcLift, 0xf97316, 0.26);
        }
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
          const res = tank.takeDamage(dmg, 'explosion');
          if (attacker) attacker.damageDealt += res.actualDamage;
          if ((tank.isPlayer || attacker?.isPlayer) && res.actualDamage > 0) {
            effects.spawnDamageNumber(tank.x, tank.y, res.actualDamage, 'explosion');
          }
          if (res.killed) onTankEliminated(tank, b.ownerId);
        }
      }

      const obsHitRangeSq = (b.aoeRadius * 0.85) * (b.aoeRadius * 0.85);
      for (const obs of obstacles) {
        if (!obs.alive || !obs.destructible) continue;
        if (b.hitObstacleIds.has(obs.id)) continue;

        const odx = obs.x - b.impactX;
        const ody = obs.y - b.impactY;
        if (odx * odx + ody * ody <= obsHitRangeSq) {
          b.hitObstacleIds.add(obs.id);
          const destroyed = obs.damage(Math.round(b.damage * 0.85), this.scene, b.ownerId);
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
              effects.spawnObstacleDebris(obs.x, obs.y, obs.type === 'brick' ? 'brick' : 'crate');
              onObstacleDestroyed?.(obs, b.ownerId);
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
    const radiusSq = radius * radius;
    for (const p of this.pool) {
      if (!p.active || p.ownerId === ignoreOwnerId) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < radiusSq) {
        return { vx: p.vx, vy: p.vy };
      }
    }
    for (const b of this.barrageShells) {
      if (!b.active || !b.launched || b.impacted) continue;
      const dx = b.impactX - x;
      const dy = b.impactY - y;
      const r = b.aoeRadius + 30;
      if (dx * dx + dy * dy <= r * r) {
        // Return pseudo-velocity vector pointing toward impact center so AI dodges perpendicularly/away
        return { vx: dx || 1, vy: dy || 0 };
      }
    }
    return null;
  }
}
