import { TankEntity } from '../entities/TankEntity';
import { ProjectilePool } from '../projectiles/ProjectilePool';
import { EffectsPool } from '../systems/EffectsPool';
import { soundFX } from '../systems/SoundFX';

export type FireWeaponStatus = 'fired' | 'reloading' | 'empty' | 'cooldown' | 'dead';

export interface AbilityActivationContext {
  targetX?: number;
  targetY?: number;
  arenaWidth?: number;
  arenaHeight?: number;
}

export function fireTankWeapon(
  tank: TankEntity,
  projectiles: ProjectilePool,
  effects: EffectsPool
): FireWeaponStatus {
  if (!tank.alive) return 'dead';
  if (tank.isReloading) return 'reloading';
  if (tank.ammo <= 0) {
    if (tank.startReload() && tank.isPlayer) {
      soundFX.playReloadStart();
    }
    return 'empty';
  }
  if (tank.fireCooldownTimer > 0) return 'cooldown';

  tank.ammo = Math.max(0, tank.ammo - 1);
  tank.fireCooldownTimer = tank.getEffectiveFireIntervalSec();
  const tip = tank.getBarrelTip();
  const spawnPos = tank.getMuzzleSpawnPoint();
  const damage = tank.getEffectiveDamage();
  const speed = tank.definition.stats.projectileSpeed;
  const range = tank.getEffectiveProjectileRange();
  const radius = tank.definition.stats.projectileRadius;
  const pierceCount = tank.hasBuff('piercing_shell') ? 1 : 0;
  const appliesSlow = tank.definition.id === 'tesla';

  let textureKey = 'proj_standard';
  if (pierceCount > 0) textureKey = 'proj_pierce';
  else if (appliesSlow) textureKey = 'proj_electric';
  else if (tank.definition.id === 'artillery') textureKey = 'proj_artillery';
  else if (tank.hasBuff('heavy_shell')) textureKey = 'proj_heavy';

  const angles = tank.hasBuff('multi_shot')
    ? [tank.turretAngle - 0.16, tank.turretAngle, tank.turretAngle + 0.16]
    : [tank.turretAngle];

  for (const angle of angles) {
    projectiles.spawn({
      owner: tank,
      x: spawnPos.x,
      y: spawnPos.y,
      angle,
      speed,
      damage,
      range,
      radius,
      pierceCount,
      appliesSlow,
      textureKey,
    });
  }

  effects.spawnMuzzleFlash(tip.x, tip.y, tank.turretAngle);
  if (tank.definition.id === 'artillery') {
    soundFX.playArtilleryShot(tank.isPlayer);
  } else {
    soundFX.playShot(tank.isPlayer);
  }

  if (tank.ammo <= 0) {
    if (tank.startReload() && tank.isPlayer) {
      soundFX.playReloadStart();
    }
  }
  return 'fired';
}

export function activateTankAbility(
  tank: TankEntity,
  allTanks: TankEntity[],
  projectiles: ProjectilePool,
  effects: EffectsPool,
  onTankEliminated: (victim: TankEntity, attackerId: string) => void,
  context?: AbilityActivationContext
): boolean {
  if (!tank.alive || tank.abilityCooldownTimer > 0 || tank.abilityActiveTimer > 0) return false;

  const spec = tank.definition.activeAbility;
  tank.abilityCooldownTimer = spec.cooldownSec;
  tank.abilityActiveTimer = spec.durationSec;

  if (tank.definition.id === 'scout') {
    soundFX.playAfterburner();
  } else if (tank.definition.id === 'artillery') {
    soundFX.playBarrageLaunch();
  } else {
    soundFX.playAbility();
  }

  switch (tank.definition.id) {
    case 'assault': {
      // Rapid Fire overclock
      effects.spawnRing(tank.x, tank.y, 48, 0xe08e26, 0.28);
      if (tank.isPlayer) effects.spawnFloatingLabel(tank.x, tank.y, 'RAPID FIRE!', '#F59E0B');
      break;
    }

    case 'fortress': {
      // Fortress Shield
      const shieldAmount = spec.shieldAmount ?? 80;
      tank.activateShield(shieldAmount);
      effects.spawnRing(tank.x, tank.y, tank.radius + 26, 0x38bdf8, 0.34);
      if (tank.isPlayer) effects.spawnFloatingLabel(tank.x, tank.y, 'FORTRESS SHIELD!', '#38BDF8');
      break;
    }

    case 'scout': {
      // Afterburner speed burst
      effects.spawnRing(tank.x, tank.y, tank.radius + 28, 0xfacc15, 0.3);
      effects.spawnAfterburnerExhaust(
        tank.x - Math.cos(tank.hullAngle) * 18,
        tank.y - Math.sin(tank.hullAngle) * 18,
        tank.hullAngle,
        true
      );
      if (tank.isPlayer) effects.spawnFloatingLabel(tank.x, tank.y, 'AFTERBURNER!', '#FACC15');
      break;
    }

    case 'artillery': {
      // Shell Barrage: uses its own ability cooldown; never consumes, refills, or bypasses normal magazine
      const tip = tank.getBarrelTip();
      const maxRange = tank.getEffectiveProjectileRange();
      const arenaW = context?.arenaWidth ?? 2200;
      const arenaH = context?.arenaHeight ?? 1600;
      let targetX: number;
      let targetY: number;
      if (typeof context?.targetX === 'number' && typeof context?.targetY === 'number') {
        const dx = context.targetX - tank.x;
        const dy = context.targetY - tank.y;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(maxRange, Math.max(95, dist));
        const ang = dist > 0.01 ? Math.atan2(dy, dx) : tank.turretAngle;
        targetX = tank.x + Math.cos(ang) * clampedDist;
        targetY = tank.y + Math.sin(ang) * clampedDist;
      } else {
        const defaultDist = Math.min(440, maxRange * 0.6);
        targetX = tank.x + Math.cos(tank.turretAngle) * defaultDist;
        targetY = tank.y + Math.sin(tank.turretAngle) * defaultDist;
      }
      targetX = Math.min(arenaW - 32, Math.max(32, targetX));
      targetY = Math.min(arenaH - 32, Math.max(32, targetY));

      projectiles.spawnBarrage({
        owner: tank,
        startX: tip.x,
        startY: tip.y,
        targetX,
        targetY,
        shellCount: spec.barrageShellCount ?? 4,
        impactIntervalSec: spec.barrageImpactIntervalSec ?? 0.45,
        flightSec: spec.barrageFlightSec ?? 0.65,
        aoeRadius: spec.barrageAoERadius ?? 88,
        damage: spec.barrageShellDamage ?? tank.getEffectiveDamage(),
        scatterRadius: spec.barrageScatterRadius ?? 68,
        arenaWidth: arenaW,
        arenaHeight: arenaH,
      });

      effects.spawnRing(tank.x, tank.y, tank.radius + 26, 0xef4444, 0.3);
      effects.spawnMuzzleFlash(tip.x, tip.y, tank.turretAngle);
      if (tank.isPlayer) effects.spawnFloatingLabel(tank.x, tank.y, 'SHELL BARRAGE!', '#EF4444');
      break;
    }

    case 'tesla': {
      // EMP Pulse: radial shockwave
      const empRadius = 210;
      effects.spawnRing(tank.x, tank.y, empRadius, 0x22d3ee, 0.36);
      for (const other of allTanks) {
        if (!other.alive || other.id === tank.id) continue;
        if (Math.hypot(other.x - tank.x, other.y - tank.y) <= empRadius + other.radius) {
          other.applySlow(0.55, 2.5);
          const res = other.takeDamage(28);
          tank.damageDealt += res.actualDamage;
          effects.spawnImpact(other.x, other.y, 0x22d3ee);
          if (res.killed) onTankEliminated(other, tank.id);
        }
      }
      if (tank.isPlayer) effects.spawnFloatingLabel(tank.x, tank.y, 'EMP PULSE!', '#22D3EE');
      break;
    }

    case 'phantom': {
      // Phase Shift
      tank.phaseCloaked = true;
      effects.spawnRing(tank.x, tank.y, 46, 0xa78bfa, 0.28);
      if (tank.isPlayer) effects.spawnFloatingLabel(tank.x, tank.y, 'PHASE SHIFT!', '#A78BFA');
      break;
    }
  }

  return true;
}
