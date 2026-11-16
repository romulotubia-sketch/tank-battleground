import Phaser from 'phaser';
import {
  getEffectiveTankMaxHp,
  getEffectiveTankProjectileRange,
  getEffectiveTankReloadSec,
} from '../../data/tanks';
import { AIPersonality, PowerupId, TankDefinition } from '../../types/game';
import {
  ApplyPickupResult,
  DamageSource,
  TemporaryEffectManager,
} from '../powerups/TemporaryEffectManager';
import { EffectsPool } from '../systems/EffectsPool';
import { soundFX } from '../systems/SoundFX';
import { ObstacleEntity } from './ObstacleEntity';

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
  staticSlowTimer = 0;
  staticSlowFactor = 1;
  empSlowTimer = 0;
  empSlowFactor = 1;
  recentAttackTimer = 0;
  concealed = false;
  phaseCloaked = false;

  readonly effectsManager = new TemporaryEffectManager();
  get buffs() {
    return this.effectsManager.activeBuffs;
  }
  get shieldHp(): number {
    return this.effectsManager.shieldHp;
  }
  set shieldHp(val: number) {
    this.effectsManager.shieldHp = val;
  }
  get maxShieldHp(): number {
    return this.effectsManager.maxShieldHp;
  }
  set maxShieldHp(val: number) {
    this.effectsManager.maxShieldHp = val;
  }
  get mineCharges(): number {
    return this.effectsManager.mineCharges;
  }
  get mineDeployCooldown(): number {
    return this.effectsManager.mineDeployCooldown;
  }

  readonly hullSprite: Phaser.GameObjects.Image;
  readonly turretSprite: Phaser.GameObjects.Image;
  private readonly playerRing: Phaser.GameObjects.Arc | null = null;
  private readonly rapidFireRing: Phaser.GameObjects.Arc;
  private readonly afterburnerRing: Phaser.GameObjects.Arc;
  private readonly phaseRing: Phaser.GameObjects.Arc;
  private readonly slowRing: Phaser.GameObjects.Arc;
  private readonly shieldRing: Phaser.GameObjects.Arc;
  private readonly powerupAuraRing: Phaser.GameObjects.Arc;
  private readonly radarSweepRing: Phaser.GameObjects.Arc | null = null;
  private readonly radarRevealRing: Phaser.GameObjects.Arc | null = null;
  private readonly barrageReticle: Phaser.GameObjects.Arc | null = null;
  private readonly barBg: Phaser.GameObjects.Rectangle;
  private readonly barTrailFill: Phaser.GameObjects.Rectangle;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private readonly reloadBarBg: Phaser.GameObjects.Rectangle;
  private readonly reloadBarFill: Phaser.GameObjects.Rectangle;
  private readonly shieldFill: Phaser.GameObjects.Rectangle;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly slowLabel: Phaser.GameObjects.Text;

  private dustTimer = 0;
  private treadMarkTimer = 0;
  private afterburnerExhaustTimer = 0;
  private visualClock = 0;
  private fireRecoilOffset = 0;
  private hitFlashTimer = 0;
  private hitFlashTint = 0xff9999;
  private damageTrailRatio = 1;
  private wasConcealed = false;

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

    this.phaseRing = scene.add.circle(x, y, definition.stats.bodyRadius + 11, 0xa78bfa, 0.14);
    this.phaseRing.setStrokeStyle(2.5, 0xc4b5fd, 0.9);
    this.phaseRing.setDepth(13);
    this.phaseRing.setVisible(false);

    this.slowRing = scene.add.circle(x, y, definition.stats.bodyRadius + 11, 0x22d3ee, 0.16);
    this.slowRing.setStrokeStyle(2.8, 0x22d3ee, 0.95);
    this.slowRing.setDepth(16);
    this.slowRing.setVisible(false);

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

    this.powerupAuraRing = scene.add.circle(x, y, definition.stats.bodyRadius + 15, 0xf59e0b, 0.08);
    this.powerupAuraRing.setStrokeStyle(2.2, 0xf59e0b, 0.85);
    this.powerupAuraRing.setDepth(12);
    this.powerupAuraRing.setVisible(false);

    if (isPlayer) {
      this.radarSweepRing = scene.add.circle(x, y, 42, 0x10b981, 0.05);
      this.radarSweepRing.setStrokeStyle(2, 0x10b981, 0.55);
      this.radarSweepRing.setDepth(7);
      this.radarSweepRing.setVisible(false);
    } else {
      this.radarRevealRing = scene.add.circle(x, y, definition.stats.bodyRadius + 16, 0x10b981, 0.12);
      this.radarRevealRing.setStrokeStyle(2.6, 0x34d399, 0.92);
      this.radarRevealRing.setDepth(21);
      this.radarRevealRing.setVisible(false);
    }

    // Overhead status bar with smooth damage trail
    this.barBg = scene.add.rectangle(x, y - 34, 46, 6, 0x141714, 0.9).setDepth(24);
    this.barTrailFill = scene.add
      .rectangle(x - 22, y - 34, 44, 4, 0xfef08a, 0.9)
      .setOrigin(0, 0.5)
      .setDepth(24);
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

    this.slowLabel = scene.add
      .text(x, y - 59, '⚡ SLOWED', {
        fontFamily: '"Barlow Condensed", sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#67E8F9',
        stroke: '#083344',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(26)
      .setVisible(false);
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

  triggerFireRecoil(): void {
    const kick =
      this.definition.id === 'artillery'
        ? 8.5
        : this.definition.id === 'fortress'
        ? 6.5
        : 4.8;
    this.fireRecoilOffset = Math.max(this.fireRecoilOffset, kick);
  }

  get isSlowed(): boolean {
    return this.staticSlowTimer > 0 || this.empSlowTimer > 0;
  }

  get isEmpDisrupted(): boolean {
    return this.empSlowTimer > 0;
  }

  get slowRemainingSec(): number {
    return Math.max(this.staticSlowTimer, this.empSlowTimer);
  }

  getEffectiveDetectionMultiplier(): number {
    if (this.definition.id !== 'phantom') {
      return this.definition.stats.detectionMultiplier;
    }
    return (
      this.definition.passiveAbility.detectionMultiplier ??
      this.definition.stats.detectionMultiplier
    );
  }

  getEffectiveMoveSpeed(): number {
    const passiveBonus = (this.definition.passiveAbility.moveSpeedMultiplier ?? 1) - 1;
    const activeBonus =
      this.abilityActiveTimer > 0 && this.definition.activeAbility.speedBoostMultiplier
        ? this.definition.activeAbility.speedBoostMultiplier - 1
        : 0;
    const mult = this.effectsManager.getMoveSpeedMultiplier(passiveBonus, activeBonus);
    const slowMult = Math.min(
      this.staticSlowTimer > 0 ? this.staticSlowFactor : 1,
      this.empSlowTimer > 0 ? this.empSlowFactor : 1
    );
    return this.definition.stats.moveSpeed * mult * slowMult;
  }

  getEffectiveFireIntervalSec(): number {
    const activeMult =
      this.abilityActiveTimer > 0 && this.definition.activeAbility.fireRateMultiplier
        ? this.definition.activeAbility.fireRateMultiplier
        : 1;
    const divisor = this.effectsManager.getFireRateMultiplier(activeMult);
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
    const mult = this.effectsManager.getDamageMultiplier();
    return Math.round(this.definition.stats.projectileDamage * mult);
  }

  hasBuff(id: PowerupId): boolean {
    return this.effectsManager.hasBuff(id);
  }

  activateShield(amount: number, source: 'powerup' | 'ability' = 'ability'): void {
    this.effectsManager.activateShield(amount, source);
  }

  applyBuff(id: PowerupId): ApplyPickupResult {
    return this.effectsManager.applyPowerup(id, this.alive, this.hp, this.maxHp, (nextHp) => {
      this.hp = nextHp;
    });
  }

  consumeMineCharge(): boolean {
    if (!this.alive) return false;
    return this.effectsManager.consumeMineCharge();
  }

  clearTemporaryEffects(): void {
    this.effectsManager.clearAll();
    this.staticSlowTimer = 0;
    this.staticSlowFactor = 1;
    this.empSlowTimer = 0;
    this.empSlowFactor = 1;
    this.phaseCloaked = false;
    this.powerupAuraRing.setVisible(false);
    this.shieldRing.setVisible(false);
    this.shieldFill.setVisible(false);
    if (this.radarSweepRing) this.radarSweepRing.setVisible(false);
    if (this.radarRevealRing) this.radarRevealRing.setVisible(false);
  }

  applySlow(factor: number, durationSec: number, source: 'static' | 'emp' = 'static'): void {
    const clampedFactor = Math.min(1, Math.max(0.2, factor));
    const safeDuration = Math.max(0, durationSec);
    if (safeDuration <= 0) return;

    if (source === 'emp') {
      // Refresh EMP disruption duration without stacking multiplicatively
      this.empSlowFactor = clampedFactor;
      this.empSlowTimer = safeDuration;
    } else {
      // Refresh Static Charge slow duration without stacking multiplicatively
      this.staticSlowFactor = clampedFactor;
      this.staticSlowTimer = safeDuration;
    }
  }

  interruptMovementAbilities(effects?: EffectsPool): boolean {
    if (!this.alive) return false;
    let interrupted = false;

    // Interrupt active movement-based tank abilities (e.g., Afterburner, Phase Shift) cleanly
    if (this.abilityActiveTimer > 0 && this.definition.activeAbility.speedBoostMultiplier) {
      this.abilityActiveTimer = 0;
      if (this.phaseCloaked) {
        this.phaseCloaked = false;
        effects?.spawnPhaseShift(this.x, this.y, false);
        if (this.isPlayer) soundFX.playPhaseEnd();
      }
      interrupted = true;
    }

    // Damp current drivetrain momentum briefly without disabling combat
    this.vx *= 0.35;
    this.vy *= 0.35;
    return interrupted;
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
        this.dustTimer = this.definition.id === 'scout' ? 0.07 : 0.095;
        effects.spawnTreadDust(
          this.x - Math.cos(this.hullAngle) * 18,
          this.y - Math.sin(this.hullAngle) * 18
        );
      }

      this.treadMarkTimer -= dt;
      if (this.treadMarkTimer <= 0) {
        this.treadMarkTimer = this.definition.id === 'scout' ? 0.11 : 0.145;
        effects.spawnTreadMark(
          this.x - Math.cos(this.hullAngle) * 10,
          this.y - Math.sin(this.hullAngle) * 10,
          this.hullAngle,
          this.definition.id === 'fortress'
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
    if (this.concealed && !this.wasConcealed) {
      effects.spawnLeafRustle(this.x, this.y);
    }
    this.wasConcealed = this.concealed;
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

  aimTurretToward(targetAngle: number, dt: number, sensitivity = 1): void {
    if (!this.alive) return;
    const diff = Phaser.Math.Angle.Wrap(targetAngle - this.turretAngle);
    const maxRot = 14 * Math.min(1.6, Math.max(0.5, sensitivity)) * dt;
    this.turretAngle += Phaser.Math.Clamp(diff, -maxRot, maxRot);
  }

  updateTimersAndVisuals(
    dt: number,
    playerHasRadar: boolean,
    prepPhase = false,
    effects?: EffectsPool,
    playerX = 0,
    playerY = 0,
    playerRadarRadius = 0
  ): void {
    if (!this.alive) return;

    if (!this.isPlayer && prepPhase) {
      this.hideAllVisuals();
      return;
    }

    this.visualClock += dt;

    if (this.fireCooldownTimer > 0) this.fireCooldownTimer = Math.max(0, this.fireCooldownTimer - dt);
    if (this.recentAttackTimer > 0) this.recentAttackTimer = Math.max(0, this.recentAttackTimer - dt);
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

    const cdrMult = this.effectsManager.getCooldownRecoveryMultiplier();
    if (this.abilityCooldownTimer > 0) {
      this.abilityCooldownTimer = Math.max(0, this.abilityCooldownTimer - dt * cdrMult);
    }

    if (this.abilityActiveTimer > 0) {
      this.abilityActiveTimer = Math.max(0, this.abilityActiveTimer - dt);
      if (this.abilityActiveTimer === 0) {
        const wasPhased = this.phaseCloaked;
        this.phaseCloaked = false;
        if (wasPhased) {
          effects?.spawnPhaseShift(this.x, this.y, false);
          if (this.isPlayer) soundFX.playPhaseEnd();
        } else if (this.definition.id === 'fortress') {
          this.effectsManager.onAbilityShieldExpired();
          effects?.spawnRing(this.x, this.y, this.radius + 22, 0x38bdf8, 0.24);
          if (this.isPlayer) soundFX.playAbilityExpire('fortress');
        } else if (this.definition.id === 'assault') {
          effects?.spawnRing(this.x, this.y, this.radius + 20, 0xf59e0b, 0.2);
          if (this.isPlayer) soundFX.playAbilityExpire('assault');
        } else if (this.definition.id === 'scout') {
          effects?.spawnRing(this.x, this.y, this.radius + 18, 0xfacc15, 0.2);
          if (this.isPlayer) soundFX.playAbilityExpire('scout');
        }
      }
    } else if (this.phaseCloaked) {
      // Safety invariant: phased state can never outlive abilityActiveTimer
      this.phaseCloaked = false;
    }

    if (this.staticSlowTimer > 0) {
      this.staticSlowTimer = Math.max(0, this.staticSlowTimer - dt);
      if (this.staticSlowTimer === 0) this.staticSlowFactor = 1;
    }
    if (this.empSlowTimer > 0) {
      this.empSlowTimer = Math.max(0, this.empSlowTimer - dt);
      if (this.empSlowTimer === 0) this.empSlowFactor = 1;
    }

    const fortressShieldActive = this.definition.id === 'fortress' && this.abilityActiveTimer > 0;
    this.effectsManager.update(dt, fortressShieldActive);

    if (this.fireRecoilOffset > 0) {
      this.fireRecoilOffset = Math.max(0, this.fireRecoilOffset - 46 * dt);
    }
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }

    const spd = Math.hypot(this.vx, this.vy);
    const engineVib =
      spd > 45 && !prepPhase ? 1 + Math.sin(this.visualClock * 26) * 0.012 : 1;
    const hitScale = this.hitFlashTimer > 0 ? 1.045 : 1;

    // Sync sprite transforms (hull & turret remain completely independent)
    const recoilX = Math.cos(this.turretAngle) * this.fireRecoilOffset;
    const recoilY = Math.sin(this.turretAngle) * this.fireRecoilOffset;
    this.hullSprite
      .setVisible(true)
      .setPosition(this.x, this.y)
      .setRotation(this.hullAngle)
      .setScale(engineVib * hitScale);
    this.turretSprite
      .setVisible(true)
      .setPosition(this.x - recoilX, this.y - recoilY)
      .setRotation(this.turretAngle)
      .setScale(hitScale);

    // Hit flash & Rapid Fire barrel glow tinting (zero timer allocations)
    if (this.hitFlashTimer > 0) {
      this.hullSprite.setTint(this.hitFlashTint);
      this.turretSprite.setTint(this.hitFlashTint);
    } else {
      if (this.isPlayer) this.hullSprite.clearTint();
      else this.hullSprite.setTint(0xf2e8e4);

      if (this.definition.id === 'assault' && this.abilityActiveTimer > 0) {
        this.turretSprite.setTint(0xfde68a);
      } else {
        this.turretSprite.clearTint();
      }
    }

    if (this.playerRing) {
      this.playerRing.setVisible(true).setPosition(this.x, this.y);
      if (this.spawnProtectionTimer > 0) {
        this.playerRing.setStrokeStyle(2.5, 0xfacc15, 0.9);
      } else {
        this.playerRing.setStrokeStyle(2.5, 0x4ade80, 0.9);
      }
    }

    // Concealment, Phase, Radar reveal & Spawn Protection visibility
    const radarRevealed =
      !this.isPlayer &&
      !prepPhase &&
      playerHasRadar &&
      playerRadarRadius > 0 &&
      Math.hypot(this.x - playerX, this.y - playerY) <= playerRadarRadius;
    const hiddenFromPlayer =
      !this.isPlayer && !radarRevealed && (this.concealed || this.phaseCloaked);
    const spawnPulse =
      this.spawnProtectionTimer > 0
        ? 0.72 + 0.28 * Math.abs(Math.sin(this.spawnProtectionTimer * 10))
        : 1;
    const baseAlpha = this.isPlayer
      ? this.phaseCloaked
        ? 0.38
        : this.concealed
        ? 0.55
        : 1
      : hiddenFromPlayer
      ? 0.16
      : this.phaseCloaked
      ? 0.34
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

    // Phantom Phase Shift visual ring
    const phaseActive = this.phaseCloaked && (!hiddenFromPlayer || this.isPlayer);
    if (phaseActive) {
      const pulseAlpha = 0.45 + 0.35 * Math.abs(Math.sin(this.abilityActiveTimer * 10));
      this.phaseRing
        .setPosition(this.x, this.y)
        .setAlpha(pulseAlpha)
        .setVisible(true);
    } else {
      this.phaseRing.setVisible(false);
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

    // Health bar, smooth damage trail, reload progress bar & name
    const showHudBar = !hiddenFromPlayer;
    this.barBg.setPosition(this.x, this.y - 34).setVisible(showHudBar);
    const hpRatio = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    if (this.damageTrailRatio < hpRatio) {
      this.damageTrailRatio = hpRatio;
    } else if (this.damageTrailRatio > hpRatio) {
      this.damageTrailRatio = Math.max(hpRatio, this.damageTrailRatio - dt * 0.95);
    }
    this.barTrailFill
      .setPosition(this.x - 22, this.y - 34)
      .setDisplaySize(Math.max(0, 44 * this.damageTrailRatio), 4)
      .setVisible(showHudBar && this.damageTrailRatio > hpRatio + 0.01);
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

    // Distinct visual aura for active offensive / utility powerups
    const auraColor = this.hasBuff('heavy_shell')
      ? 0xef4444
      : this.hasBuff('rapid_fire')
      ? 0xf59e0b
      : this.hasBuff('multi_shot')
      ? 0xec4899
      : this.hasBuff('piercing_shell')
      ? 0xa855f7
      : this.hasBuff('speed_boost')
      ? 0x06b6d4
      : this.hasBuff('cooldown_boost')
      ? 0xeab308
      : null;

    if (auraColor !== null && !hiddenFromPlayer) {
      const auraPulse = 0.55 + 0.35 * Math.abs(Math.sin(this.visualClock * 8));
      this.powerupAuraRing
        .setPosition(this.x, this.y)
        .setStrokeStyle(2.2, auraColor, auraPulse)
        .setFillStyle(auraColor, 0.08)
        .setVisible(true);
    } else {
      this.powerupAuraRing.setVisible(false);
    }

    // Radar pulse ring on player (only after preparation countdown ends)
    if (this.radarSweepRing) {
      if (!prepPhase && this.hasBuff('radar')) {
        const sweepPhase = (this.visualClock * 0.95) % 1;
        this.radarSweepRing
          .setPosition(this.x, this.y)
          .setRadius(40 + sweepPhase * 120)
          .setAlpha(0.75 * (1 - sweepPhase))
          .setVisible(true);
      } else {
        this.radarSweepRing.setVisible(false);
      }
    }

    // Radar detection highlight ring on revealed enemy tanks (strictly disabled before GO)
    if (this.radarRevealRing) {
      if (radarRevealed) {
        const pulse = 0.58 + 0.38 * Math.abs(Math.sin(this.visualClock * 10));
        this.radarRevealRing
          .setPosition(this.x, this.y)
          .setAlpha(pulse)
          .setVisible(true);
      } else {
        this.radarRevealRing.setVisible(false);
      }
    }

    // Slow / EMP Disruption visual indicator
    if (this.isSlowed && !hiddenFromPlayer) {
      const slowPulse = 0.55 + 0.4 * Math.abs(Math.sin(this.slowRemainingSec * 16));
      const ringColor = this.isEmpDisrupted ? 0x38bdf8 : 0x22d3ee;
      this.slowRing
        .setPosition(this.x, this.y)
        .setStrokeStyle(2.8, ringColor, slowPulse)
        .setAlpha(slowPulse)
        .setVisible(true);
    } else {
      this.slowRing.setVisible(false);
    }

    this.nameLabel.setPosition(this.x, this.y - 46).setVisible(showHudBar);
    if (this.isSlowed && showHudBar) {
      this.slowLabel
        .setText(this.isEmpDisrupted ? '⚡ EMP SLOW' : '⚡ STATIC')
        .setPosition(this.x, this.y - 59)
        .setVisible(true);
    } else {
      this.slowLabel.setVisible(false);
    }
  }

  takeDamage(
    amount: number,
    source: DamageSource = 'projectile'
  ): {
    killed: boolean;
    actualDamage: number;
    shieldAbsorbed: number;
    shieldBroken: boolean;
  } {
    if (!this.alive || this.spawnProtectionTimer > 0) {
      return { killed: false, actualDamage: 0, shieldAbsorbed: 0, shieldBroken: false };
    }

    // Shield absorbs incoming damage before Phantom Phase Shift hull reduction (prevents EHP inflation)
    const shieldRes = this.effectsManager.absorbIncomingDamage(amount, source);
    const absorbed = shieldRes.absorbed;
    const shieldBroken = shieldRes.broken;
    if (shieldBroken && this.definition.id === 'fortress' && this.abilityActiveTimer > 0) {
      this.abilityActiveTimer = 0;
    }

    // Phantom Phase Shift applies configurable incoming damage reduction to damage reaching hull
    const phaseDamageMult = this.definition.activeAbility.phaseDamageMultiplier ?? 0.4;
    const dmg = this.phaseCloaked
      ? Math.round(shieldRes.remainingDamage * phaseDamageMult)
      : shieldRes.remainingDamage;

    let hullLost = 0;
    if (dmg > 0) {
      const prevHp = this.hp;
      this.hp = Math.max(0, this.hp - dmg);
      hullLost = prevHp - this.hp;
      this.hitFlashTimer = 0.085;
      this.hitFlashTint = 0xff9999;
    } else if (absorbed > 0) {
      this.hitFlashTimer = 0.075;
      this.hitFlashTint = 0x93c5fd;
    }

    const totalApplied = Math.round(absorbed + hullLost);

    if (this.hp <= 0) {
      this.alive = false;
      this.clearTemporaryEffects();
      this.recentAttackTimer = 0;
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
    this.phaseRing.setVisible(false);
    this.slowRing.setVisible(false);
    this.shieldRing.setVisible(false);
    this.powerupAuraRing.setVisible(false);
    this.barBg.setVisible(false);
    this.barTrailFill.setVisible(false);
    this.barFill.setVisible(false);
    this.reloadBarBg.setVisible(false);
    this.reloadBarFill.setVisible(false);
    this.shieldFill.setVisible(false);
    this.nameLabel.setVisible(false);
    this.slowLabel.setVisible(false);
    if (this.playerRing) this.playerRing.setVisible(false);
    if (this.barrageReticle) this.barrageReticle.setVisible(false);
    if (this.radarSweepRing) this.radarSweepRing.setVisible(false);
    if (this.radarRevealRing) this.radarRevealRing.setVisible(false);
  }

  destroy(): void {
    this.clearTemporaryEffects();
    this.hullSprite.destroy();
    this.turretSprite.destroy();
    this.rapidFireRing.destroy();
    this.afterburnerRing.destroy();
    this.phaseRing.destroy();
    this.slowRing.destroy();
    this.shieldRing.destroy();
    this.powerupAuraRing.destroy();
    this.barBg.destroy();
    this.barTrailFill.destroy();
    this.barFill.destroy();
    this.reloadBarBg.destroy();
    this.reloadBarFill.destroy();
    this.shieldFill.destroy();
    this.nameLabel.destroy();
    this.slowLabel.destroy();
    if (this.playerRing) this.playerRing.destroy();
    if (this.barrageReticle) this.barrageReticle.destroy();
    if (this.radarSweepRing) this.radarSweepRing.destroy();
    if (this.radarRevealRing) this.radarRevealRing.destroy();
  }
}
