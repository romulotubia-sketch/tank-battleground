import { MINE_SYSTEM_CONFIG } from '../../data/powerups';
import { ObstacleEntity } from '../entities/ObstacleEntity';
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
  tank.recentAttackTimer = 1.6;
  const tip = tank.getBarrelTip();
  const spawnPos = tank.getMuzzleSpawnPoint();
  const damage = tank.getEffectiveDamage();
  const speed = tank.definition.stats.projectileSpeed;
  const range = tank.getEffectiveProjectileRange();
  const radius = tank.definition.stats.projectileRadius;
  const pierceCount = tank.effectsManager.getPierceCount();
  const slowStrength = tank.definition.passiveAbility.slowStrength ?? 0;
  const slowDurationSec = tank.definition.passiveAbility.slowDurationSec ?? 0;
  const appliesSlow = slowStrength > 0 && slowDurationSec > 0;
  const slowFactor = Math.max(0.1, 1 - slowStrength);

  let textureKey = 'proj_standard';
  if (pierceCount > 0) textureKey = 'proj_pierce';
  else if (tank.definition.id === 'tesla') textureKey = 'proj_electric';
  else if (tank.definition.id === 'artillery') textureKey = 'proj_artillery';
  else if (tank.hasBuff('heavy_shell')) textureKey = 'proj_heavy';

  const multi = tank.effectsManager.getMultiShotConfig();
  const angles: number[] = [];
  if (multi.count <= 1) {
    angles.push(tank.turretAngle);
  } else {
    const mid = (multi.count - 1) / 2;
    for (let i = 0; i < multi.count; i++) {
      angles.push(tank.turretAngle + (i - mid) * multi.spreadRad);
    }
  }

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
      slowFactor,
      slowDurationSec,
      textureKey,
    });
  }

  tank.triggerFireRecoil();

  if (tank.definition.id === 'tesla') {
    effects.spawnElectricMuzzleFlash(tip.x, tip.y, tank.turretAngle);
    soundFX.playElectricShot(tank.isPlayer);
  } else {
    effects.spawnMuzzleFlash(tip.x, tip.y, tank.turretAngle);
    if (tank.definition.id === 'artillery') {
      soundFX.playArtilleryShot(tank.isPlayer);
    } else {
      soundFX.playShot(tank.isPlayer);
    }
  }

  if (tank.ammo <= 0) {
    if (tank.startReload() && tank.isPlayer) {
      soundFX.playReloadStart();
    }
  }
  return 'fired';
}

export function deployTankMine(
  tank: TankEntity,
  allTanks: TankEntity[],
  obstacles: ObstacleEntity[],
  projectiles: ProjectilePool,
  effects: EffectsPool,
  arenaWidth: number,
  arenaHeight: number
): boolean {
  if (!tank.alive || tank.mineCharges <= 0 || tank.mineDeployCooldown > 0) {
    return false;
  }

  if (
    projectiles.getActiveMineCount(tank.id) >= MINE_SYSTEM_CONFIG.maxActivePerTank ||
    projectiles.getActiveMineCount() >= MINE_SYSTEM_CONFIG.maxActiveGlobal
  ) {
    return false;
  }

  const dropDist = tank.radius + 20;
  const candidateOffsets = [0, 0.55, -0.55, 1.15, -1.15, 1.75, -1.75, Math.PI];

  for (const offset of candidateOffsets) {
    const ang = tank.hullAngle + Math.PI + offset;
    const mx = tank.x + Math.cos(ang) * dropDist;
    const my = tank.y + Math.sin(ang) * dropDist;

    if (mx < 34 || mx > arenaWidth - 34 || my < 34 || my > arenaHeight - 34) {
      continue;
    }

    let blocked = false;
    for (const obs of obstacles) {
      if (!obs.alive || !obs.blocksMovement) continue;
      if (obs.containsPoint(mx, my, 18)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    for (const other of allTanks) {
      if (!other.alive) continue;
      if (Math.hypot(other.x - mx, other.y - my) <= other.radius + 18) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    if (!tank.consumeMineCharge()) return false;

    const spawned = projectiles.spawnMine(
      tank.id,
      mx,
      my,
      MINE_SYSTEM_CONFIG.durationSec,
      MINE_SYSTEM_CONFIG.armDelaySec,
      MINE_SYSTEM_CONFIG.damage
    );
    if (!spawned) return false;

    effects.spawnRing(mx, my, 28, 0xf97316, 0.25);
    if (tank.isPlayer) {
      soundFX.playMineDeploy();
      effects.spawnFloatingLabel(mx, my, `MINE SET (${tank.mineCharges})`, '#F97316');
    }
    return true;
  }

  return false;
}

export function activateTankAbility(
  tank: TankEntity,
  allTanks: TankEntity[],
  projectiles: ProjectilePool,
  effects: EffectsPool,
  onTankEliminated: (victim: TankEntity, attackerId: string) => void,
  context?: AbilityActivationContext
): boolean {
  if (!tank.alive || tank.abilityCooldownTimer > 0 || tank.abilityActiveTimer > 0 || tank.phaseCloaked) {
    return false;
  }

  const spec = tank.definition.activeAbility;
  tank.abilityCooldownTimer = spec.cooldownSec;
  tank.abilityActiveTimer = spec.durationSec;

  if (tank.definition.id === 'scout') {
    soundFX.playAfterburner();
  } else if (tank.definition.id === 'artillery') {
    soundFX.playBarrageLaunch();
  } else if (tank.definition.id === 'tesla') {
    soundFX.playEmpPulse();
  } else if (tank.definition.id === 'phantom') {
    soundFX.playPhaseShift();
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
      tank.activateShield(shieldAmount, 'ability');
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
      // EMP Pulse: area-control electric shockwave around the Tesla Tank (never affects self or bypasses magazine)
      const empRadius = spec.empRadius ?? 220;
      const empSlowStrength = spec.empSlowStrength ?? 0.45;
      const empSlowDuration = spec.empSlowDurationSec ?? 2.5;
      const empDamage = spec.empDamage ?? 12;
      const empSlowFactor = Math.max(0.15, 1 - empSlowStrength);

      effects.spawnEmpPulse(tank.x, tank.y, empRadius);
      for (const other of allTanks) {
        if (!other.alive || other.id === tank.id) continue;
        if (Math.hypot(other.x - tank.x, other.y - tank.y) <= empRadius + other.radius) {
          other.applySlow(empSlowFactor, empSlowDuration, 'emp');
          const interrupted = other.interruptMovementAbilities(effects);
          effects.spawnElectricImpact(other.x, other.y);

          let empActualDmg = 0;
          if (empDamage > 0) {
            const res = other.takeDamage(empDamage, 'ability');
            tank.damageDealt += res.actualDamage;
            empActualDmg = res.actualDamage;
            if (res.killed) {
              onTankEliminated(other, tank.id);
              continue;
            }
          }

          if (tank.isPlayer || other.isPlayer) {
            if (empActualDmg > 0) {
              effects.spawnDamageNumber(other.x, other.y + 12, empActualDmg, 'electric');
            }
            effects.spawnFloatingLabel(
              other.x,
              other.y - 10,
              interrupted ? 'INTERRUPTED!' : 'EMP DISRUPTED!',
              '#67E8F9'
            );
          }
        }
      }
      if (tank.isPlayer) effects.spawnFloatingLabel(tank.x, tank.y, 'EMP PULSE!', '#22D3EE');
      break;
    }

    case 'phantom': {
      // Phase Shift: translucent evasion state without bypassing obstacles or refilling ammo
      tank.phaseCloaked = true;
      effects.spawnPhaseShift(tank.x, tank.y, true);
      if (tank.isPlayer) effects.spawnFloatingLabel(tank.x, tank.y, 'PHASE SHIFT!', '#A78BFA');
      break;
    }
  }

  return true;
}
