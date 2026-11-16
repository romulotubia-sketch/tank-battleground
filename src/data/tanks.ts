import { TankDefinition, TankId } from '../types/game';

export const TANK_DEFINITIONS: Record<TankId, TankDefinition> = {
  assault: {
    id: 'assault',
    name: 'Assault Tank',
    role: 'Balanced',
    description:
      'Versatile frontline battle tank with dependable armor, crisp handling, moderate magazine capacity, and reliable reload pacing.',
    implemented: true,
    unlockCost: 0,
    isStarter: true,
    stats: {
      maxHp: 160,
      moveSpeed: 215,
      acceleration: 980,
      turnSpeed: 7.5,
      reloadSec: 0.58,
      magazineCapacity: 12,
      reloadDurationSec: 2.5,
      projectileDamage: 19,
      projectileSpeed: 560,
      projectileRange: 540,
      projectileRadius: 6,
      bodyRadius: 23,
      detectionMultiplier: 1.0,
    },
    ratings: {
      armor: 6,
      firepower: 7,
      mobility: 7,
      range: 6,
    },
    activeAbility: {
      id: 'rapid_fire',
      name: 'Rapid Fire',
      description: 'Doubles firing speed for 4 seconds without bypassing magazine capacity.',
      cooldownSec: 11,
      durationSec: 4,
    },
    passiveAbility: {
      id: 'efficient_reload',
      name: 'Efficient Reload',
      description: 'Reduces magazine reload duration by 25% for both automatic and manual reloads.',
      reloadDurationMultiplier: 0.75,
    },
    visual: {
      hullPrimary: '#5B7048',
      hullSecondary: '#3E4F30',
      turretColor: '#708A59',
      accentColor: '#E08E26',
      treadColor: '#242722',
      silhouette: 'balanced',
    },
  },
  fortress: {
    id: 'fortress',
    name: 'Fortress Tank',
    role: 'Heavy Defensive Tank',
    description:
      'Thick composite plating and a heavy-caliber cannon built to anchor choke points and absorb incoming fire.',
    implemented: true,
    unlockCost: 0,
    isStarter: true,
    stats: {
      maxHp: 160,
      moveSpeed: 168,
      acceleration: 740,
      turnSpeed: 5.5,
      reloadSec: 0.82,
      magazineCapacity: 16,
      reloadDurationSec: 4.0,
      projectileDamage: 26,
      projectileSpeed: 510,
      projectileRange: 490,
      projectileRadius: 8,
      bodyRadius: 26,
      detectionMultiplier: 1.05,
    },
    ratings: {
      armor: 10,
      firepower: 8,
      mobility: 4,
      range: 5,
    },
    activeAbility: {
      id: 'fortress_shield',
      name: 'Fortress Shield',
      description:
        'Deploys a 100 HP protective barrier around the hull for 5 seconds to absorb incoming projectile damage.',
      cooldownSec: 12,
      durationSec: 5.0,
      shieldAmount: 100,
    },
    passiveAbility: {
      id: 'reinforced_armor',
      name: 'Reinforced Armor',
      description: 'Heavy layered hull plating increases maximum health by 50% (160 to 240 HP).',
      maxHpMultiplier: 1.5,
    },
    visual: {
      hullPrimary: '#4B5563',
      hullSecondary: '#333B46',
      turretColor: '#647082',
      accentColor: '#38BDF8',
      treadColor: '#1E2228',
      silhouette: 'heavy',
    },
  },
  scout: {
    id: 'scout',
    name: 'Scout Tank',
    role: 'High-mobility tank',
    description:
      'Stripped-down recon chassis built for fast movement, quick repositioning, and hit-and-run combat.',
    implemented: true,
    unlockCost: 0,
    isStarter: true,
    stats: {
      maxHp: 130,
      moveSpeed: 216,
      acceleration: 1300,
      turnSpeed: 10.5,
      reloadSec: 0.56,
      magazineCapacity: 8,
      reloadDurationSec: 1.5,
      projectileDamage: 15,
      projectileSpeed: 600,
      projectileRange: 470,
      projectileRadius: 5,
      bodyRadius: 20,
      detectionMultiplier: 0.95,
    },
    ratings: {
      armor: 4,
      firepower: 5,
      mobility: 10,
      range: 5,
    },
    activeAbility: {
      id: 'afterburner',
      name: 'Afterburner',
      description:
        'Turbine surge grants +45% movement speed for 3.5 seconds, stacking additively with Lightweight Chassis.',
      cooldownSec: 10,
      durationSec: 3.5,
      speedBoostMultiplier: 1.45,
    },
    passiveAbility: {
      id: 'lightweight_chassis',
      name: 'Lightweight Chassis',
      description:
        'Compact frame increases movement speed by 25% (216 to 270) without altering turret aim.',
      moveSpeedMultiplier: 1.25,
    },
    visual: {
      hullPrimary: '#B86B2B',
      hullSecondary: '#8A4E1D',
      turretColor: '#D4823A',
      accentColor: '#FACC15',
      treadColor: '#26211D',
      silhouette: 'sleek',
    },
  },
  artillery: {
    id: 'artillery',
    name: 'Artillery Tank',
    role: 'Long-range specialist',
    description:
      'Long-barreled self-propelled siege cannon built to bombard distant targets with heavy shells and area barrages.',
    implemented: true,
    unlockCost: 0,
    isStarter: true,
    stats: {
      maxHp: 140,
      moveSpeed: 185,
      acceleration: 820,
      turnSpeed: 6.2,
      reloadSec: 1.05,
      magazineCapacity: 3,
      reloadDurationSec: 5.0,
      projectileDamage: 28,
      projectileSpeed: 680,
      projectileRange: 560,
      projectileRadius: 7,
      bodyRadius: 23,
      detectionMultiplier: 1.0,
    },
    ratings: {
      armor: 5,
      firepower: 9,
      mobility: 5,
      range: 10,
    },
    activeAbility: {
      id: 'shell_barrage',
      name: 'Shell Barrage',
      description:
        'Launches 4 arcing shells into the aimed target area with staggered impacts and warning rings (uses ability cooldown only).',
      cooldownSec: 14,
      durationSec: 2.0,
      barrageShellCount: 4,
      barrageImpactIntervalSec: 0.45,
      barrageFlightSec: 0.65,
      barrageAoERadius: 88,
      barrageShellDamage: 28,
      barrageScatterRadius: 68,
    },
    passiveAbility: {
      id: 'extended_range',
      name: 'Extended Range',
      description: 'Extended rifled siege barrel increases normal attack projectile range by 40% (560 to 784).',
      projectileRangeMultiplier: 1.4,
    },
    visual: {
      hullPrimary: '#7C6245',
      hullSecondary: '#59442E',
      turretColor: '#967956',
      accentColor: '#EF4444',
      treadColor: '#25211C',
      silhouette: 'long_barrel',
    },
  },
  tesla: {
    id: 'tesla',
    name: 'Tesla Tank',
    role: 'Crowd-Control Disruptor',
    description:
      'Arc-capacitor turret discharges magnetized bolts that sap enemy drivetrain power on contact.',
    implemented: false,
    unlockCost: 280,
    isStarter: false,
    stats: {
      maxHp: 150,
      moveSpeed: 210,
      acceleration: 950,
      turnSpeed: 7.5,
      reloadSec: 0.7,
      magazineCapacity: 10,
      reloadDurationSec: 3.0,
      projectileDamage: 18,
      projectileSpeed: 580,
      projectileRange: 500,
      projectileRadius: 7,
      bodyRadius: 23,
      detectionMultiplier: 1.0,
    },
    ratings: {
      armor: 6,
      firepower: 7,
      mobility: 7,
      range: 6,
    },
    activeAbility: {
      id: 'emp_pulse',
      name: 'EMP Pulse',
      description: 'Emits a 210px shockwave dealing 28 damage and slowing nearby foes by 45%.',
      cooldownSec: 12,
      durationSec: 2.5,
    },
    passiveAbility: {
      id: 'static_arc',
      name: 'Static Arc',
      description: 'Basic shots apply a 25% movement slow for 1.5 seconds.',
    },
    visual: {
      hullPrimary: '#2E5A6B',
      hullSecondary: '#1D3C48',
      turretColor: '#3C758C',
      accentColor: '#22D3EE',
      treadColor: '#1B2428',
      silhouette: 'coil',
    },
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom Tank',
    role: 'Evasive Infiltrator',
    description:
      'Low-profile composite hull designed to ambush from bushes and slip away from crossfire.',
    implemented: false,
    unlockCost: 320,
    isStarter: false,
    stats: {
      maxHp: 135,
      moveSpeed: 242,
      acceleration: 1150,
      turnSpeed: 9.2,
      reloadSec: 0.64,
      magazineCapacity: 6,
      reloadDurationSec: 2.0,
      projectileDamage: 19,
      projectileSpeed: 610,
      projectileRange: 530,
      projectileRadius: 5,
      bodyRadius: 21,
      detectionMultiplier: 0.65,
    },
    ratings: {
      armor: 4,
      firepower: 7,
      mobility: 9,
      range: 7,
    },
    activeAbility: {
      id: 'phase_shift',
      name: 'Phase Shift',
      description: 'Cloaks partially, gains +35% speed and 50% evasion reduction for 3 seconds.',
      cooldownSec: 12,
      durationSec: 3.0,
    },
    passiveAbility: {
      id: 'low_thermal_profile',
      name: 'Low Thermal Profile',
      description: 'Stealth baffles reduce AI opponent detection range by 35%.',
    },
    visual: {
      hullPrimary: '#4B435E',
      hullSecondary: '#342E43',
      turretColor: '#63587D',
      accentColor: '#A78BFA',
      treadColor: '#1E1B24',
      silhouette: 'angular',
    },
  },
};

export const TANK_LIST: TankDefinition[] = [
  TANK_DEFINITIONS.assault,
  TANK_DEFINITIONS.fortress,
  TANK_DEFINITIONS.scout,
  TANK_DEFINITIONS.artillery,
  TANK_DEFINITIONS.tesla,
  TANK_DEFINITIONS.phantom,
];

export function getEffectiveTankMaxHp(definition: TankDefinition): number {
  const mult = definition.passiveAbility.maxHpMultiplier ?? 1;
  return Math.round(definition.stats.maxHp * mult);
}

export function getEffectiveTankReloadSec(definition: TankDefinition): number {
  const mult = definition.passiveAbility.reloadDurationMultiplier ?? 1;
  return Math.max(0.25, Number((definition.stats.reloadDurationSec * mult).toFixed(3)));
}

export function getEffectiveTankMoveSpeed(definition: TankDefinition): number {
  const mult = definition.passiveAbility.moveSpeedMultiplier ?? 1;
  return Math.round(definition.stats.moveSpeed * mult);
}

export function getEffectiveTankProjectileRange(definition: TankDefinition): number {
  const mult = definition.passiveAbility.projectileRangeMultiplier ?? 1;
  return Math.round(definition.stats.projectileRange * mult);
}
