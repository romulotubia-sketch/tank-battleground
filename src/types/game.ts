export type ScreenId =
  | 'MAIN_MENU'
  | 'TANK_SELECT'
  | 'TANK_COLLECTION'
  | 'SETTINGS'
  | 'HOW_TO_PLAY'
  | 'IN_GAME'
  | 'RESULTS';

export type TankId =
  | 'assault'
  | 'fortress'
  | 'scout'
  | 'artillery'
  | 'tesla'
  | 'phantom';

export type ArenaId = 'training_grounds' | 'industrial_zone' | 'wasteland';

export type PowerupId =
  | 'repair_kit'
  | 'rapid_fire'
  | 'heavy_shell'
  | 'speed_boost'
  | 'shield'
  | 'multi_shot'
  | 'piercing_shell'
  | 'radar'
  | 'cooldown_boost'
  | 'mine_kit';

export type AIPersonality =
  | 'aggressive'
  | 'defensive'
  | 'opportunistic'
  | 'mobile'
  | 'tactical';

export type ObstacleType =
  | 'brick'
  | 'steel'
  | 'crate'
  | 'bush'
  | 'water'
  | 'barrel';

export interface TankVisualConfig {
  hullPrimary: string;
  hullSecondary: string;
  turretColor: string;
  accentColor: string;
  treadColor: string;
  silhouette: 'balanced' | 'heavy' | 'sleek' | 'long_barrel' | 'coil' | 'angular';
}

export interface TankAbilitySpec {
  id: string;
  name: string;
  description: string;
  cooldownSec: number;
  durationSec: number;
  shieldAmount?: number;
  speedBoostMultiplier?: number;
  barrageShellCount?: number;
  barrageImpactIntervalSec?: number;
  barrageFlightSec?: number;
  barrageAoERadius?: number;
  barrageShellDamage?: number;
  barrageScatterRadius?: number;
}

export interface TankPassiveSpec {
  id: string;
  name: string;
  description: string;
  reloadDurationMultiplier?: number;
  maxHpMultiplier?: number;
  moveSpeedMultiplier?: number;
  projectileRangeMultiplier?: number;
}

export interface TankDefinition {
  id: TankId;
  name: string;
  role: string;
  description: string;
  implemented: boolean;
  unlockCost: number;
  isStarter: boolean;
  stats: {
    maxHp: number;
    moveSpeed: number;
    acceleration: number;
    turnSpeed: number;
    reloadSec: number; // fire interval between individual shots
    magazineCapacity: number;
    reloadDurationSec: number;
    projectileDamage: number;
    projectileSpeed: number;
    projectileRange: number;
    projectileRadius: number;
    bodyRadius: number;
    detectionMultiplier: number;
  };
  ratings: {
    armor: number; // 1..10
    firepower: number; // 1..10
    mobility: number; // 1..10
    range: number; // 1..10
  };
  activeAbility: TankAbilitySpec;
  passiveAbility: TankPassiveSpec;
  visual: TankVisualConfig;
}

export interface PowerupDefinition {
  id: PowerupId;
  name: string;
  shortLabel: string;
  description: string;
  durationSec: number; // 0 for instant
  color: string;
  accent: string;
}

export interface ObstaclePlacement {
  type: ObstacleType;
  x: number; // grid col or world center x
  y: number; // grid row or world center y
  w: number;
  h: number;
}

export interface SpawnPoint {
  x: number;
  y: number;
  angle: number;
}

export interface ArenaDefinition {
  id: ArenaId;
  name: string;
  subtitle: string;
  description: string;
  width: number;
  height: number;
  groundColor: string;
  groundGridColor: string;
  borderColor: string;
  spawns: SpawnPoint[];
  obstacles: ObstaclePlacement[];
}

export interface ActiveBuffSnapshot {
  id: PowerupId;
  name: string;
  shortLabel: string;
  remainingSec: number;
  totalSec: number;
  color: string;
}

export interface HUDStateSnapshot {
  tankId: TankId;
  tankName: string;
  hp: number;
  maxHp: number;
  shieldHp: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadRemainingSec: number;
  reloadTotalSec: number;
  aliveCount: number;
  totalTanks: number;
  eliminations: number;
  timeRemainingSec: number;
  abilityCooldownSec: number;
  abilityTotalCooldownSec: number;
  abilityActiveSec: number;
  abilityName: string;
  activeBuffs: ActiveBuffSnapshot[];
  isConcealed: boolean;
  radarActive: boolean;
  isPaused: boolean;
  isPreparing: boolean;
  prepLabel: string | null;
  killFeedText: string | null;
}

export interface MatchResult {
  victory: boolean;
  reason: 'last_standing' | 'time_highest_hp' | 'eliminated' | 'time_outscored';
  placement: number; // 1..8
  totalTanks: number;
  eliminations: number;
  damageDealt: number;
  survivalSec: number;
  scrapEarned: number;
  arenaId: ArenaId;
  tankId: TankId;
  winnerName: string;
}

export interface GameSettings {
  soundEnabled: boolean;
  soundVolume: number; // 0..1
  showTouchControls: 'auto' | 'always';
  autoFireOnAim: boolean;
  lowDetailMode: boolean;
  matchDurationSec: number;
  landscapePromptEnabled: boolean;
}

export interface PlayerProgression {
  unlockedTanks: TankId[];
  selectedTank: TankId;
  selectedArena: ArenaId;
  scrap: number;
  matchesPlayed: number;
  wins: number;
  totalEliminations: number;
  bestPlacement: number | null;
}
