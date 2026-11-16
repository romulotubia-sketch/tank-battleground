import {
  MAX_TOTAL_FIRERATE_MULTIPLIER,
  MAX_TOTAL_SPEED_MULTIPLIER,
  MINE_SYSTEM_CONFIG,
  POWERUP_DEFINITIONS,
} from '../../data/powerups';
import { ActiveBuffSnapshot, PowerupId } from '../../types/game';

export interface ActiveBuffState {
  id: PowerupId;
  remainingSec: number;
  totalSec: number;
}

export type DamageSource = 'projectile' | 'explosion' | 'ability';

export interface ApplyPickupResult {
  applied: boolean;
  healedAmount: number;
  minesAdded: number;
}

/**
 * Centralized Temporary Effect Manager
 * Tracks durations, prevents unlimited stacking, applies duplicate policies consistently
 * across Player and AI tanks, and leaves base TankDefinition immutable.
 */
export class TemporaryEffectManager {
  readonly activeBuffs = new Map<PowerupId, ActiveBuffState>();

  mineCharges = 0;
  mineDeployCooldown = 0;

  shieldHp = 0;
  maxShieldHp = 0;
  shieldFromPowerup = false;
  shieldFromAbility = false;

  hasBuff(id: PowerupId): boolean {
    const buff = this.activeBuffs.get(id);
    return Boolean(buff && buff.remainingSec > 0);
  }

  getRemainingSec(id: PowerupId): number {
    return this.activeBuffs.get(id)?.remainingSec ?? 0;
  }

  activateShield(amount: number, source: 'powerup' | 'ability'): void {
    const safeAmount = Math.max(0, amount);
    if (safeAmount <= 0) return;

    if (source === 'powerup') {
      this.shieldFromPowerup = true;
    } else {
      this.shieldFromAbility = true;
    }

    // Priority rule: never stack shields additively (keep highest active shield capacity)
    this.shieldHp = Math.max(this.shieldHp, safeAmount);
    this.maxShieldHp = Math.max(this.maxShieldHp, this.shieldHp, safeAmount);
  }

  onAbilityShieldExpired(): void {
    this.shieldFromAbility = false;
    if (this.shieldFromPowerup && this.hasBuff('shield')) {
      const powerupCap = POWERUP_DEFINITIONS.shield.shieldAmount ?? 50;
      this.shieldHp = Math.min(this.shieldHp, powerupCap);
      this.maxShieldHp = Math.min(this.maxShieldHp, powerupCap);
    } else {
      this.shieldHp = 0;
      this.maxShieldHp = 0;
    }
  }

  /**
   * Absorbs damage with active Shield before hull mitigation (Phase Shift) runs,
   * preventing multiplicative EHP inflation from Shield + Phase Shift.
   */
  absorbIncomingDamage(
    rawAmount: number,
    source: DamageSource
  ): { remainingDamage: number; absorbed: number; broken: boolean } {
    if (this.shieldHp <= 0 || rawAmount <= 0) {
      return { remainingDamage: rawAmount, absorbed: 0, broken: false };
    }

    // Fortress Shield protects against all combat hits; Shield powerup protects specifically against projectiles
    const canAbsorb = source === 'projectile' || this.shieldFromAbility;
    if (!canAbsorb) {
      return { remainingDamage: rawAmount, absorbed: 0, broken: false };
    }

    const absorbed = Math.min(this.shieldHp, rawAmount);
    this.shieldHp -= absorbed;
    const remainingDamage = rawAmount - absorbed;
    let broken = false;

    if (this.shieldHp <= 0) {
      this.shieldHp = 0;
      this.maxShieldHp = 0;
      this.shieldFromPowerup = false;
      this.shieldFromAbility = false;
      this.activeBuffs.delete('shield');
      broken = true;
    }

    return { remainingDamage, absorbed, broken };
  }

  applyPowerup(
    id: PowerupId,
    alive: boolean,
    currentHp: number,
    maxHp: number,
    setHp: (nextHp: number) => void
  ): ApplyPickupResult {
    if (!alive) {
      return { applied: false, healedAmount: 0, minesAdded: 0 };
    }

    const def = POWERUP_DEFINITIONS[id];
    if (!def) {
      return { applied: false, healedAmount: 0, minesAdded: 0 };
    }

    if (id === 'repair_kit') {
      const missing = Math.max(0, maxHp - currentHp);
      if (missing <= 0) {
        return { applied: true, healedAmount: 0, minesAdded: 0 };
      }
      const ratio = def.healMissingRatio ?? 0.45;
      const minHeal = def.healMinAmount ?? 25;
      const healAmount = Math.min(missing, Math.max(minHeal, Math.round(missing * ratio)));
      setHp(Math.min(maxHp, currentHp + healAmount));
      return { applied: true, healedAmount: healAmount, minesAdded: 0 };
    }

    if (id === 'mine_kit') {
      const grant = def.minesGranted ?? 2;
      const cap = def.maxMineCharges ?? MINE_SYSTEM_CONFIG.maxCarriedCharges;
      const before = this.mineCharges;
      this.mineCharges = Math.min(cap, this.mineCharges + grant);
      return {
        applied: true,
        healedAmount: 0,
        minesAdded: Math.max(0, this.mineCharges - before),
      };
    }

    if (id === 'shield') {
      this.activateShield(def.shieldAmount ?? 50, 'powerup');
    }

    if (def.durationSec > 0) {
      // Refresh policy: re-collecting a timed buff resets its full timer cleanly without stacking modifiers
      this.activeBuffs.set(id, {
        id,
        remainingSec: def.durationSec,
        totalSec: def.durationSec,
      });
    }

    return { applied: true, healedAmount: 0, minesAdded: 0 };
  }

  consumeMineCharge(): boolean {
    if (this.mineCharges <= 0 || this.mineDeployCooldown > 0) return false;
    this.mineCharges -= 1;
    this.mineDeployCooldown = MINE_SYSTEM_CONFIG.deployCooldownSec;
    return true;
  }

  update(dt: number, fortressAbilityActive: boolean): void {
    if (this.mineDeployCooldown > 0) {
      this.mineDeployCooldown = Math.max(0, this.mineDeployCooldown - dt);
    }

    for (const [key, buff] of this.activeBuffs.entries()) {
      buff.remainingSec -= dt;
      if (buff.remainingSec <= 0) {
        this.activeBuffs.delete(key);
        if (key === 'shield') {
          this.shieldFromPowerup = false;
          if (!fortressAbilityActive) {
            this.shieldFromAbility = false;
            this.shieldHp = 0;
            this.maxShieldHp = 0;
          }
        }
      }
    }
  }

  clearAll(): void {
    this.activeBuffs.clear();
    this.mineCharges = 0;
    this.mineDeployCooldown = 0;
    this.shieldHp = 0;
    this.maxShieldHp = 0;
    this.shieldFromPowerup = false;
    this.shieldFromAbility = false;
  }

  getMoveSpeedMultiplier(passiveBonus: number, activeAbilityBonus: number): number {
    const powerupBonus = this.hasBuff('speed_boost')
      ? POWERUP_DEFINITIONS.speed_boost.speedBonusMultiplier ?? 0.35
      : 0;
    return Math.min(
      MAX_TOTAL_SPEED_MULTIPLIER,
      1 + passiveBonus + activeAbilityBonus + powerupBonus
    );
  }

  getFireRateMultiplier(activeAbilityFireRateMult: number): number {
    const powerupMult = this.hasBuff('rapid_fire')
      ? POWERUP_DEFINITIONS.rapid_fire.fireRateMultiplier ?? 1.45
      : 1;
    return Math.min(MAX_TOTAL_FIRERATE_MULTIPLIER, activeAbilityFireRateMult * powerupMult);
  }

  getDamageMultiplier(): number {
    return this.hasBuff('heavy_shell')
      ? POWERUP_DEFINITIONS.heavy_shell.damageMultiplier ?? 1.45
      : 1;
  }

  getCooldownRecoveryMultiplier(): number {
    return this.hasBuff('cooldown_boost')
      ? POWERUP_DEFINITIONS.cooldown_boost.cooldownRecoveryMultiplier ?? 2.0
      : 1.0;
  }

  getMultiShotConfig(): { count: number; spreadRad: number } {
    if (!this.hasBuff('multi_shot')) {
      return { count: 1, spreadRad: 0 };
    }
    return {
      count: POWERUP_DEFINITIONS.multi_shot.multiShotCount ?? 3,
      spreadRad: POWERUP_DEFINITIONS.multi_shot.multiShotSpreadRad ?? 0.16,
    };
  }

  getPierceCount(): number {
    return this.hasBuff('piercing_shell')
      ? POWERUP_DEFINITIONS.piercing_shell.pierceCount ?? 1
      : 0;
  }

  getRadarRadius(): number {
    return this.hasBuff('radar') ? POWERUP_DEFINITIONS.radar.radarRadius ?? 880 : 0;
  }

  toHudSnapshots(): ActiveBuffSnapshot[] {
    const out: ActiveBuffSnapshot[] = [];
    this.activeBuffs.forEach((buff) => {
      const def = POWERUP_DEFINITIONS[buff.id];
      out.push({
        id: buff.id,
        name: def.name,
        shortLabel: def.shortLabel,
        remainingSec: buff.remainingSec,
        totalSec: buff.totalSec,
        color: def.color,
      });
    });
    return out;
  }
}
