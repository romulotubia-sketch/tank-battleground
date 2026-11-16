import Phaser from 'phaser';
import { POWERUP_DEFINITIONS } from '../../data/powerups';
import {
  getEffectiveTankMaxHp,
  getEffectiveTankProjectileRange,
  getEffectiveTankReloadSec,
} from '../../data/tanks';
import { AIPersonality, PowerupId, TankDefinition } from '../../types/game';
import { EffectsPool } from '../systems/EffectsPool';
import { soundFX } from '../systems/SoundFX';
import { ObstacleEntity } from './ObstacleEntity';

export interface ActiveBuffState {
  id: PowerupId;
  remainingSec: number;
  totalSec: number;
}

export class TankEntity {
  readonly id: string;
  readonly displayName: string;
  readonly isPlayer: boolean;
  readonly definition: TankDefinition;
  readonly personality: AIPersonality;

  x: number;
  y: number;
  vx = 0;
  vy = 0;
  hullAngle: number;
  turretAngle: number;

  hp: number;
  maxHp: number;
  shieldHp = 0;
  maxShieldHp = 0;
  alive = true;

  eliminations = 0;
  damageDealt = 0;
  eliminatedAtRank: number | null = null;

  fireCooldownTimer = 0;
  ammo: number;
  isReloading = false;
  magazineReloadTimer = 0;
  magazineReloadTotal = 0;
  abilityCooldownTimer = 0;
  abilityActiveTimer = 0;
  spawnProtectionTimer = 0;
  slowTimer = 0;
  slowFactor = 1;
  concealed = false;
  phaseCloaked = false;

  readonly buffs = new Map<PowerupId, ActiveBuffState>();

  readonly hullSprite: Phaser.GameObjects.Image;
  readonly turretSprite: Phaser.GameObjects.Image;
  private readonly playerRing: Phaser.GameObjects.Arc | null = null;
  private readonly rapidFireRing: Phaser.GameObjects.Arc;
  private readonly afterburnerRing: Phaser.GameObjects.Arc;
  private readonly shieldRing: Phaser.GameObjects.Arc;
  private readonly barrageReticle: Phaser.GameObjects.Arc | null = null;
  private readonly barBg: Phaser.GameObjects.Rectangle;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly reloadBarBg: Phaser.GameObjects.Rectangle;
  private readonly reloadBarFill: Phaser.GameObjects.Rectangle;
  private readonly shieldFill: Phaser.GameObjects.Rectangle;
  private readonly nameLabel: Phaser.GameObjects.Text;

  private dustTimer = 0;
  private afterburnerExhaustTimer = 0;
  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    id: string,
    displayName: string,
    isPlayer: boolean,
    definition: TankDefinition,
    x: number,
    y: number,
    angle: number,
    personality: AIPersonality = 'tactical'
  ) {
    this.scene = scene;
    this.id = id;
    this.displayName = displayName;
    this.isPlayer = isPlayer;
    this.definition = definition;
    this.personality = personality;

    this.x = x;
    this.y = y;
    this.hullAngle = angle;
    this.turretAngle = angle;
    this.maxHp = getEffectiveTankMaxHp(definition);
    this.hp = this.maxHp;
    this.ammo = definition.stats.magazineCapacity;

    if (isPlayer) {
      this.playerRing = scene.add.circle(x, y, definition.stats.bodyRadius + 10, 0x22c55e, 0.14);
      this.playerRing.setStrokeStyle(2.5, 0x4ade80, 0.9);
      this.playerRing.setDepth(13);

      if (definition.id === 'artillery') {
        const aoeR = definition.activeAbility.barrageAoERadius ?? 88;
        this.barrageReticle = scene.add.circle(x, y, aoeR, 0xef4444, 0.06);
        this.barrageReticle.setStrokeStyle(2, 0xf87171, 0.55);
        this.barrageReticle.setDepth(6);
        this.barrageReticle.setVisible(false);
      }
    }

    this.rapidFireRing = scene.add.circle(x, y, definition.stats.bodyRadius + 13, 0xf59e0b, 0.12);
    this.rapidFireRing.setStrokeStyle(2.5, 0xfbbf24, 0.92);
    this.rapidFireRing.setDepth(13);
    this.rapidFireRing.setVisible(false);

    this.afterburnerRing = scene.add.circle(x, y, definition.stats.bodyRadius + 12, 0xfacc15, 0.14);
    this.afterburnerRing.setStrokeStyle(2.5, 0xfacc15, 0.95);
    this.afterburnerRing.setDepth(13);
    this.afterburnerRing.setVisible(false);

    this.hullSprite = scene.add.image(x, y, `tank_hull_${definition.id}`);
    this.hullSprite.setRotation(angle);
    this.hullSprite.setDepth(14);
    if (!isPlayer) {
      this.hullSprite.setTint(0xf2e8e4);
    }

    this.turretSprite = scene.add.image(x, y, `tank_turret_${definition.id}`);
    this.turretSprite.setOrigin(36 / 96, 0.5);
    this.turretSprite.setRotation(angle);
    this.turretSprite.setDepth(15);

    this.shieldRing = scene.add.circle(x, y, definition.stats.bodyRadius + 8, 0x38bdf8, 0.18);
    this.shieldRing.setStrokeStyle(3, 0x38bdf8, 0.95);
    this.shieldRing.setDepth(16);
    this.shieldRing.setVisible(false);

    // Overhead status bar
    this.barBg = scene.add.rectangle(x, y - 34, 46, 6, 0x141714, 0.9).setDepth(24);
    this.barFill = scene.add
      .rectangle(x - 22, y - 34, 44, 4, isPlayer ? 0x22c55e : 0xef4444, 1)
      .setOrigin(0, 0.5)
      .setDepth(25);
    this.reloadBarBg = scene.add
      .rectangle(x, y - 28, 46, 4, 0x141714, 0.9)
      .setDepth(24)
      .setVisible(false);
    this.reloadBarFill = scene.add
      .rectangle(x - 22, y - 28, 0, 2.5, 0xfacc15, 1)
      .setOrigin(0, 0.5)
      .setDepth(25)
      .setVisible(false);
    this.shieldFill = scene.add
      .rectangle(x - 22, y - 39, 44, 2.5, 0x38bdf8, 1)
      .setOrigin(0, 0.5)
      .setDepth(25)
      .setVisible(false);

    this.nameLabel = scene.add
      .text(x, y - 46, isPlayer ? 'YOU' : displayName, {
        fontFamily: '"Barlow Condensed", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: isPlayer ? '#86EFAC' : '#F3EFE6',
        stroke: '#141714',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(25);
  }

  get radius(): number {
    return this.definition.stats.bodyRadius;
  }

  get maxAmmo(): number {
    return this.definition.stats.magazineCapacity;
  }

  getBarrelTip(): { x: number; y: number } {
    const barrelLen = this.definition.visual.silhouette === 'long_barrel' ? 46 : 36;
    return {
      x: this.x + Math.cos(this.turretAngle) * barrelLen,
      y: this.y + Math.sin(this.turretAngle) * barrelLen,
    };
  }

  getMuzzleSpawnPoint(): { x: number; y: number } {
    const spawnDist = this.radius + 2;
    return {
      x: this.x + Math.cos(this.turretAngle) * spawnDist,
      y: this.y + Math.sin(this.turretAngle) * spawnDist,
    };
  }

  getEffectiveMoveSpeed(): number {
    const passiveBonus = (this.definition.passiveAbility.moveSpeedMultiplier ?? 1) - 1;
    const activeBonus =
      this.abilityActiveTimer > 0 && this.definition.activeAbility.speedBoostMultiplier
        ? this.definition.activeAbility.speedBoostMultiplier - 1
        : this.abilityActiveTimer > 0 && this.definition.id === 'phantom'
        ? 0.35
        : 0;
    const powerupBonus = this.buffs.has('speed_boost') ? 0.35 : 0;
    const mult = 1 + passiveBonus + activeBonus + powerupBonus;
    const slowMult = this.slowTimer > 0 ? this.slowFactor : 1;
    return this.definition.stats.moveSpeed * mult * slowMult;
  }

  getEffectiveFireIntervalSec(): number {
    let divisor = 1;
    if (this.buffs.has('rapid_fire')) divisor *= 1.45;
    if (this.abilityActiveTimer > 0 && this.definition.id === 'assault') {
      divisor *= 2.0;
    }
    return this.definition.stats.reloadSec / divisor;
  }

  getEffectiveReloadDurationSec(): number {
    return getEffectiveTankReloadSec(this.definition);
  }

  getEffectiveProjectileRange(): number {
    return getEffectiveTankProjectileRange(this.definition);
  }

  updateBarrageReticle(visible: boolean, targetX: number, targetY: number): void {
    if (!this.barrageReticle) return;
    if (!visible || !this.alive) {
      this.barrageReticle.setVisible(false);
      return;
    }
    this.barrageReticle.setPosition(targetX, targetY).setVisible(true);
  }

  startReload(): boolean {
    if (!this.alive || this.isReloading || this.ammo >= this.maxAmmo) {
      return false;
    }
    const duration = this.getEffectiveReloadDurationSec();
    this.isReloading = true;
    this.magazineReloadTotal = duration;
    this.magazineReloadTimer = duration;
    return true;
  }

  getEffectiveDamage(): number {
    let mult = 1;
    if (this.buffs.has('heavy_shell')) mult *= 1.45;
    return Math.round(this.definition.stats.projectileDamage * mult);
  }

  hasBuff(id: PowerupId): boolean {
    return this.buffs.has(id);
  }

  activateShield(amount: number): void {
    this.shieldHp = Math.max(this.shieldHp, amount);
    this.maxShieldHp = Math.max(this.maxShieldHp, this.shieldHp, amount);
  }

  applyBuff(id: PowerupId): void {
    const def = POWERUP_DEFINITIONS[id];
    if (id === 'repair_kit') {
      this.hp = Math.min(this.maxHp, this.hp + 35);
      return;
    }
    if (id === 'shield') {
      this.activateShield(50);
    }
    if (def.durationSec > 0) {
      // Duplicate temporary effects refresh their duration
      this.buffs.set(id, {
        id,
        remainingSec: def.durationSec,
        totalSec: def.durationSec,
      });
    }
  }

  applySlow(factor: number, durationSec: number): void {
    this.slowFactor = Math.min(this.slowFactor, factor);
    this.slowTimer = Math.max(this.slowTimer, durationSec);
  }

  updateMovement(
    dt: number,
    moveX: number,
    moveY: number,
    obstacles: ObstacleEntity[],
    arenaWidth: number,
    arenaHeight: number,
    effects: EffectsPool
  ): void {
    if (!this.alive) return;

    const mag = Math.hypot(moveX, moveY);
    const nx = mag > 0.05 ? moveX / Math.max(1, mag) : 0;
    const ny = mag > 0.05 ? moveY / Math.max(1, mag) : 0;

    const maxSpd = this.getEffectiveMoveSpeed();
    const targetVx = nx * maxSpd;
    const targetVy = ny * maxSpd;
    const accel = this.definition.stats.acceleration;
    const decel = accel * 1.35;

    const rate = mag > 0.05 ? accel : decel;
    const dxv = targetVx - this.vx;
    const dyv = targetVy - this.vy;
    const dv = Math.hypot(dxv, dyv);
    if (dv > rate * dt) {
      this.vx += (dxv / dv) * rate * dt;
      this.vy += (dyv / dv) * rate * dt;
    } else {
      this.vx = targetVx;
      this.vy = targetVy;
    }

    // Smooth hull rotation toward movement vector
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > 15) {
      const targetAngle = Math.atan2(this.vy, this.vx);
      const diff = Phaser.Math.Angle.Wrap(targetAngle - this.hullAngle);
      const maxTurn = this.definition.stats.turnSpeed * dt;
      this.hullAngle += Phaser.Math.Clamp(diff, -maxTurn, maxTurn);

      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = this.definition.id === 'scout' ? 0.07 : 0.09;
        effects.spawnTreadDust(
          this.x - Math.cos(this.hullAngle) * 18,
          this.y - Math.sin(this.hullAngle) * 18
        );
      }

      if (this.definition.id === 'scout' && this.abilityActiveTimer > 0) {
        this.afterburnerExhaustTimer -= dt;
        if (this.afterburnerExhaustTimer <= 0) {
          this.afterburnerExhaustTimer = 0.055;
          effects.spawnAfterburnerExhaust(
            this.x - Math.cos(this.hullAngle) * 18,
            this.y - Math.sin(this.hullAngle) * 18,
            this.hullAngle
          );
        }
      }
    }

    // Move and resolve obstacle collisions smoothly (circle-vs-AABB)
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.resolveBoundsAndObstacles(obstacles, arenaWidth, arenaHeight);
  }

  resolveBoundsAndObstacles(
    obstacles: ObstacleEntity[],
    arenaWidth: number,
    arenaHeight: number
  ): void {
    const pad = this.radius + 14;
    this.x = Phaser.Math.Clamp(this.x, pad, arenaWidth - pad);
    this.y = Phaser.Math.Clamp(this.y, pad, arenaHeight - pad);

    let inBush = false;
    for (const obs of obstacles) {
      if (!obs.alive) continue;
      if (obs.providesConcealment) {
        if (obs.containsPoint(this.x, this.y, 4)) {
          inBush = true;
        }
        continue;
      }
      if (!obs.blocksMovement) continue;

      const closestX = Phaser.Math.Clamp(this.x, obs.left, obs.right);
      const closestY = Phaser.Math.Clamp(this.y, obs.top, obs.bottom);
      const distX = this.x - closestX;
      const distY = this.y - closestY;
      const distSq = distX * distX + distY * distY;

      if (distSq < this.radius * this.radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const overlap = this.radius - dist;
          this.x += (distX / dist) * overlap;
          this.y += (distY / dist) * overlap;
        } else {
          // Center inside AABB fallback: push out along shortest axis
          const dl = Math.abs(this.x - obs.left);
          const dr = Math.abs(obs.right - this.x);
          const dtSide = Math.abs(this.y - obs.top);
          const dbSide = Math.abs(obs.bottom - this.y);
          const minSide = Math.min(dl, dr, dtSide, dbSide);
          if (minSide === dl) this.x = obs.left - this.radius;
          else if (minSide === dr) this.x = obs.right + this.radius;
          else if (minSide === dtSide) this.y = obs.top - this.radius;
          else this.y = obs.bottom + this.radius;
        }
      }
    }

    this.concealed = inBush;
  }

  aimTurretToward(targetAngle: number, dt: number): void {
    if (!this.alive) return;
    const diff = Phaser.Math.Angle.Wrap(targetAngle - this.turretAngle);
    const maxRot = 14 * dt;
    this.turretAngle += Phaser.Math.Clamp(diff, -maxRot, maxRot);
  }

  updateTimersAndVisuals(dt: number, playerHasRadar: boolean, prepPhase = false): void {
    if (!this.alive) return;

    if (!this.isPlayer && prepPhase) {
      this.hideAllVisuals();
      return;
    }

    if (this.fireCooldownTimer > 0) this.fireCooldownTimer = Math.max(0, this.fireCooldownTimer - dt);
    if (this.isReloading && dt > 0) {
      this.magazineReloadTimer = Math.max(0, this.magazineReloadTimer - dt);
      if (this.magazineReloadTimer <= 0) {
        this.isReloading = false;
        this.magazineReloadTimer = 0;
        this.magazineReloadTotal = 0;
        this.ammo = this.maxAmmo;
        if (this.isPlayer) {
          soundFX.playReloadComplete();
        }
      }
    }
    if (this.spawnProtectionTimer > 0) {
      this.spawnProtectionTimer = Math.max(0, this.spawnProtectionTimer - dt);
    }

    const cdrMult = this.buffs.has('cooldown_boost') ? 2.0 : 1.0;
    if (this.abilityCooldownTimer > 0) {
      this.abilityCooldownTimer = Math.max(0, this.abilityCooldownTimer - dt * cdrMult);
    }

    if (this.abilityActiveTimer > 0) {
      this.abilityActiveTimer = Math.max(0, this.abilityActiveTimer - dt);
      if (this.abilityActiveTimer === 0) {
        this.phaseCloaked = false;
        if (this.definition.id === 'fortress') {
          // Keep shield only if shield powerup isn't active
          if (!this.buffs.has('shield')) {
            this.shieldHp = 0;
            this.maxShieldHp = 0;
          }
        }
      }
    }

    if (this.slowTimer > 0) {
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      if (this.slowTimer === 0) this.slowFactor = 1;
    }

    // Update buffs
    for (const [key, buff] of this.buffs.entries()) {
      buff.remainingSec -= dt;
      if (buff.remainingSec <= 0) {
        this.buffs.delete(key);
        if (key === 'shield' && !(this.definition.id === 'fortress' && this.abilityActiveTimer > 0)) {
          this.shieldHp = 0;
          this.maxShieldHp = 0;
        }
      }
    }

    // Sync sprite transforms
    this.hullSprite.setVisible(true).setPosition(this.x, this.y).setRotation(this.hullAngle);
    this.turretSprite.setVisible(true).setPosition(this.x, this.y).setRotation(this.turretAngle);
    if (this.playerRing) {
      this.playerRing.setVisible(true).setPosition(this.x, this.y);
      if (this.spawnProtectionTimer > 0) {
        this.playerRing.setStrokeStyle(2.5, 0xfacc15, 0.9);
      } else {
        this.playerRing.setStrokeStyle(2.5, 0x4ade80, 0.9);
      }
    }

    // Concealment, Phase & Spawn Protection visibility
    const hiddenFromPlayer = !this.isPlayer && !playerHasRadar && (this.concealed || this.phaseCloaked);
    const spawnPulse =
      this.spawnProtectionTimer > 0
        ? 0.72 + 0.28 * Math.abs(Math.sin(this.spawnProtectionTimer * 10))
        : 1;
    const baseAlpha = this.isPlayer
      ? this.concealed || this.phaseCloaked
        ? 0.55
        : 1
      : hiddenFromPlayer
      ? 0.16
      : 1;
    const targetAlpha = baseAlpha * spawnPulse;

    this.hullSprite.setAlpha(targetAlpha);
    this.turretSprite.setAlpha(targetAlpha);

    // Rapid Fire active visual ring
    const rapidFireActive =
      this.definition.id === 'assault' && this.abilityActiveTimer > 0 && !hiddenFromPlayer;
    if (rapidFireActive) {
      const pulseAlpha = 0.55 + 0.35 * Math.abs(Math.sin(this.abilityActiveTimer * 12));
      this.rapidFireRing
        .setPosition(this.x, this.y)
        .setAlpha(pulseAlpha)
        .setVisible(true);
    } else {
      this.rapidFireRing.setVisible(false);
    }

    // Scout Afterburner active visual ring
    const afterburnerActive =
      this.definition.id === 'scout' && this.abilityActiveTimer > 0 && !hiddenFromPlayer;
    if (afterburnerActive) {
      const pulseAlpha = 0.58 + 0.38 * Math.abs(Math.sin(this.abilityActiveTimer * 14));
      this.afterburnerRing
        .setPosition(this.x, this.y)
        .setAlpha(pulseAlpha)
        .setVisible(true);
    } else {
      this.afterburnerRing.setVisible(false);
    }

    // Shield ring
    if (this.shieldHp > 0) {
      const shieldPulse =
        this.definition.id === 'fortress' && this.abilityActiveTimer > 0
          ? 0.72 + 0.28 * Math.abs(Math.sin(this.abilityActiveTimer * 8))
          : 0.9;
      this.shieldRing
        .setPosition(this.x, this.y)
        .setAlpha(shieldPulse)
        .setVisible(!hiddenFromPlayer);
    } else {
      this.shieldRing.setVisible(false);
    }

    // Health bar & reload progress bar & name
    const showHudBar = !hiddenFromPlayer;
    this.barBg.setPosition(this.x, this.y - 34).setVisible(showHudBar);
    const hpRatio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    this.barFill
      .setPosition(this.x - 22, this.y - 34)
      .setDisplaySize(Math.max(0, 44 * hpRatio), 4)
      .setVisible(showHudBar);

    if (this.isReloading && this.magazineReloadTotal > 0 && showHudBar) {
      const reloadProgress = Phaser.Math.Clamp(
        1 - this.magazineReloadTimer / this.magazineReloadTotal,
        0,
        1
      );
      this.reloadBarBg.setPosition(this.x, this.y - 28).setVisible(true);
      this.reloadBarFill
        .setPosition(this.x - 22, this.y - 28)
        .setDisplaySize(Math.max(2, 44 * reloadProgress), 2.5)
        .setVisible(true);
    } else {
      this.reloadBarBg.setVisible(false);
      this.reloadBarFill.setVisible(false);
    }

    if (this.shieldHp > 0 && showHudBar) {
      const denom = Math.max(1, this.maxShieldHp || this.definition.activeAbility.shieldAmount || 75);
      const shRatio = Phaser.Math.Clamp(this.shieldHp / denom, 0, 1);
      this.shieldFill
        .setPosition(this.x - 22, this.y - 39)
        .setDisplaySize(44 * shRatio, 2.5)
        .setVisible(true);
    } else {
      this.shieldFill.setVisible(false);
    }

    this.nameLabel.setPosition(this.x, this.y - 46).setVisible(showHudBar);
  }

  takeDamage(amount: number): {
    killed: boolean;
    actualDamage: number;
    shieldAbsorbed: number;
    shieldBroken: boolean;
  } {
    if (!this.alive || this.spawnProtectionTimer > 0) {
      return { killed: false, actualDamage: 0, shieldAbsorbed: 0, shieldBroken: false };
    }

    // Phantom Phase Shift grants 50% evasion damage reduction
    let dmg = this.phaseCloaked ? Math.round(amount * 0.5) : amount;
    let absorbed = 0;
    let shieldBroken = false;

    if (this.shieldHp > 0) {
      absorbed = Math.min(this.shieldHp, dmg);
      this.shieldHp -= absorbed;
      dmg -= absorbed;
      if (this.shieldHp <= 0) {
        this.shieldHp = 0;
        this.maxShieldHp = 0;
        shieldBroken = true;
        if (this.definition.id === 'fortress' && this.abilityActiveTimer > 0 && !this.buffs.has('shield')) {
          this.abilityActiveTimer = 0;
        }
      }
    }

    let hullLost = 0;
    if (dmg > 0) {
      const prevHp = this.hp;
      this.hp = Math.max(0, this.hp - dmg);
      hullLost = prevHp - this.hp;
      this.hullSprite.setTint(0xff9999);
      this.scene.time.delayedCall(75, () => {
        if (this.alive) {
          if (this.isPlayer) this.hullSprite.clearTint();
          else this.hullSprite.setTint(0xf2e8e4);
        }
      });
    }

    const totalApplied = Math.round(absorbed + hullLost);

    if (this.hp <= 0) {
      this.alive = false;
      this.hideAllVisuals();
      return {
        killed: true,
        actualDamage: totalApplied,
        shieldAbsorbed: Math.round(absorbed),
        shieldBroken,
      };
    }

    return {
      killed: false,
      actualDamage: totalApplied,
      shieldAbsorbed: Math.round(absorbed),
      shieldBroken,
    };
  }

  hideAllVisuals(): void {
    this.hullSprite.setVisible(false);
    this.turretSprite.setVisible(false);
    this.rapidFireRing.setVisible(false);
    this.afterburnerRing.setVisible(false);
    this.shieldRing.setVisible(false);
    this.barBg.setVisible(false);
    this.barFill.setVisible(false);
    this.reloadBarBg.setVisible(false);
    this.reloadBarFill.setVisible(false);
    this.shieldFill.setVisible(false);
    this.nameLabel.setVisible(false);
    if (this.playerRing) this.playerRing.setVisible(false);
    if (this.barrageReticle) this.barrageReticle.setVisible(false);
  }

  destroy(): void {
    this.hullSprite.destroy();
    this.turretSprite.destroy();
    this.rapidFireRing.destroy();
    this.afterburnerRing.destroy();
    this.shieldRing.destroy();
    this.barBg.destroy();
    this.barFill.destroy();
    this.reloadBarBg.destroy();
    this.reloadBarFill.destroy();
    this.shieldFill.destroy();
    this.nameLabel.destroy();
    if (this.playerRing) this.playerRing.destroy();
    if (this.barrageReticle) this.barrageReticle.destroy();
  }
}
