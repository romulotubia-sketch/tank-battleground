export type ScreenId =
  | 'MAIN_MENU'
  | 'PROFILE'
  | 'STATISTICS'
  | 'GARAGE'
  | 'TANK_COLLECTION'
  | 'ARENA_SELECT'
  | 'MISSIONS'
  | 'SETTINGS'
  | 'HOW_TO_PLAY'
  | 'IN_GAME'
  | 'RESULTS';

export type GraphicsQuality = 'low' | 'medium' | 'high';

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
  barrelColor?: string;
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
  fireRateMultiplier?: number;
  shieldAmount?: number;
  speedBoostMultiplier?: number;
  barrageShellCount?: number;
  barrageImpactIntervalSec?: number;
  barrageFlightSec?: number;
  barrageAoERadius?: number;
  barrageShellDamage?: number;
  barrageScatterRadius?: number;
  empRadius?: number;
  empSlowStrength?: number;
  empSlowDurationSec?: number;
  empDamage?: number;
  phaseDamageMultiplier?: number;
}

export interface TankPassiveSpec {
  id: string;
  name: string;
  description: string;
  reloadDurationMultiplier?: number;
  maxHpMultiplier?: number;
  moveSpeedMultiplier?: number;
  projectileRangeMultiplier?: number;
  slowStrength?: number;
  slowDurationSec?: number;
  detectionMultiplier?: number;
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

export type DuplicatePickupPolicy = 'refresh' | 'stack_capped' | 'instant';

export interface PowerupDefinition {
  id: PowerupId;
  name: string;
  shortLabel: string;
  description: string;
  durationSec: number; // 0 for instant
  color: string;
  accent: string;
  duplicatePolicy: DuplicatePickupPolicy;
  healMissingRatio?: number;
  healMinAmount?: number;
  fireRateMultiplier?: number;
  damageMultiplier?: number;
  speedBonusMultiplier?: number;
  shieldAmount?: number;
  multiShotCount?: number;
  multiShotSpreadRad?: number;
  pierceCount?: number;
  radarRadius?: number;
  cooldownRecoveryMultiplier?: number;
  minesGranted?: number;
  maxMineCharges?: number;
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
  identity: string;
  description: string;
  features: string[];
  width: number;
  height: number;
  groundColor: string;
  groundGridColor: string;
  borderColor: string;
  themeAccent: string;
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
  mineCharges: number;
  maxMineCharges: number;
  activeMineCount: number;
  isConcealed: boolean;
  isPhased: boolean;
  isSlowed: boolean;
  slowRemainingSec: number;
  radarActive: boolean;
  radarRemainingSec: number;
  radarDetectedCount: number;
  recentPickupName: string | null;
  recentPickupColor: string | null;
  isPaused: boolean;
  isPreparing: boolean;
  prepLabel: string | null;
  killFeedText: string | null;
}

export type CosmeticId =
  | 'default'
  | 'brass_trim'
  | 'cobalt_strike'
  | 'apex_obsidian'
  | 'crimson_vanguard'
  | 'desert_phantom'
  | 'emerald_squad'
  | 'hazard_stripes'
  | 'warlord_crimson'
  | 'arctic_chrome'
  | 'inferno_forged';

export interface TankCosmeticDefinition {
  id: CosmeticId;
  name: string;
  description: string;
  unlockLevel: number;
  scrapCost?: number;
  unlockSourceLabel?: string;
  previewPrimary: string;
  previewSecondary: string;
  previewAccent: string;
  hullPrimaryOverride?: string;
  hullSecondaryOverride?: string;
  turretColorOverride?: string;
  accentColorOverride?: string;
  treadColorOverride?: string;
}

export interface XpBreakdown {
  completionXp: number;
  victoryBonusXp: number;
  eliminationXp: number;
  topThreeBonusXp: number;
  totalXp: number;
}

export interface MatchScrapBreakdown {
  completionScrap: number;
  eliminationScrap: number;
  victoryBonusScrap: number;
  performanceBonusScrap: number;
  totalScrap: number;
}

export type MilestoneRewardType = 'currency' | 'cosmetic';

export interface MilestoneRewardDefinition {
  level: number;
  id: string;
  title: string;
  description: string;
  type: MilestoneRewardType;
  scrapAmount?: number;
  cosmeticId?: CosmeticId;
}

export interface MatchProgressionSummary {
  matchId: string;
  xpBreakdown: XpBreakdown;
  scrapBreakdown?: MatchScrapBreakdown;
  previousLevel: number;
  newLevel: number;
  previousXp: number;
  previousXpToNext: number;
  newXp: number;
  newXpToNext: number;
  levelsGained: number;
  unlockedMilestones: MilestoneRewardDefinition[];
  scrapFromMatch: number;
  scrapFromMilestones: number;
  totalScrapAwarded: number;
  alreadyProcessed: boolean;
}

export interface MatchResult {
  matchId: string;
  victory: boolean;
  reason: 'last_standing' | 'time_highest_hp' | 'eliminated' | 'time_outscored';
  placement: number; // 1..8
  totalTanks: number;
  eliminations: number;
  damageDealt: number;
  survivalSec: number;
  scrapEarned: number;
  scrapBreakdown?: MatchScrapBreakdown;
  arenaId: ArenaId;
  tankId: TankId;
  winnerName: string;
}

export interface GameSettings {
  soundEnabled: boolean;
  soundVolume: number; // 0..1
  musicEnabled: boolean;
  musicVolume: number; // 0..1
  graphicsQuality: GraphicsQuality;
  screenShakeEnabled: boolean;
  vibrationEnabled: boolean;
  controlSensitivity: number; // 0.6..1.5
  showTouchControls: 'auto' | 'always';
  autoFireOnAim: boolean;
  lowDetailMode: boolean; // derived mirror of graphicsQuality === 'low' for compatibility
  matchDurationSec: number;
  landscapePromptEnabled: boolean;
}

export interface PlayerProgression {
  saveVersion: number;
  playerName: string;
  level: number;
  xp: number;
  xpToNext: number;
  totalXpEarned: number;
  unlockedTanks: TankId[];
  selectedTank: TankId;
  selectedArena: ArenaId;
  scrap: number;
  totalScrapEarned: number;
  totalScrapSpent: number;
  matchesPlayed: number;
  wins: number;
  defeats: number;
  totalEliminations: number;
  totalPlaytimeSec: number;
  bestPlacement: number | null;
  claimedMilestoneLevels: number[];
  unlockedCosmetics: CosmeticId[];
  equippedCosmetic: CosmeticId;
  unlockedPaintColors: string[];
  unlockedDecals: TankDecalId[];
  unlockedPresets: string[];
  customPaintUnlocked: boolean;
  tankCustomizations: Partial<Record<TankId, TankCustomization>>;
  processedMatchIds: string[];
  processedRewardedAdIds?: string[];
}

export interface SaveFeedbackEvent {
  status: 'saved' | 'error';
  scope: 'progression' | 'missions' | 'settings';
  timestampMs: number;
}

export type PurchaseReason =
  | 'purchased'
  | 'already_unlocked'
  | 'insufficient_scrap'
  | 'not_purchasable'
  | 'not_found';

export interface PurchaseOutcome {
  success: boolean;
  reason: PurchaseReason;
  cost: number;
  remainingScrap: number;
  nextProgression: PlayerProgression;
}

export type GameplayEvent =
  | {
      eventId: string;
      type: 'match_started';
      matchId: string;
      tankId: TankId;
      arenaId: ArenaId;
    }
  | {
      eventId: string;
      type: 'match_completed';
      matchId: string;
      tankId: TankId;
      arenaId: ArenaId;
      placement: number;
      survivalSec: number;
    }
  | {
      eventId: string;
      type: 'match_victory';
      matchId: string;
      tankId: TankId;
      arenaId: ArenaId;
    }
  | {
      eventId: string;
      type: 'tank_elimination';
      matchId: string;
      victimId: string;
    }
  | {
      eventId: string;
      type: 'powerup_collected';
      matchId: string;
      powerupId: PowerupId;
    }
  | {
      eventId: string;
      type: 'ability_activated';
      matchId: string;
      tankId: TankId;
    }
  | {
      eventId: string;
      type: 'obstacle_destroyed';
      matchId: string;
      obstacleId: number;
      obstacleType: ObstacleType;
    };

export type MissionScope = 'daily' | 'weekly';
export type RewardScope = MissionScope | 'achievement';
export type AchievementCategory = 'Combat' | 'Survival' | 'Collection' | 'Exploration';

export type MissionMetric =
  | 'matches_played'
  | 'wins'
  | 'eliminations'
  | 'powerups_collected'
  | 'tank_matches'
  | 'abilities_activated'
  | 'arena_matches'
  | 'obstacles_destroyed'
  | 'top_three_finishes'
  | 'unique_tanks_played'
  | 'unique_arenas_played';

export interface MissionRewardSpec {
  xp: number;
  scrap: number;
  cosmeticId?: CosmeticId;
}

export interface MissionDefinition {
  id: string;
  scope: MissionScope;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  tankId?: TankId;
  arenaId?: ArenaId;
  reward: MissionRewardSpec;
}

export interface AchievementDefinition {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  reward: MissionRewardSpec;
}

export interface ActiveMissionProgress {
  missionId: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  claimedAtMs: number | null;
}

export interface AchievementProgress {
  achievementId: string;
  progress: number;
  completed: boolean;
  unlockedAtMs: number | null;
  claimed: boolean;
  claimedAtMs: number | null;
}

export interface PeriodTrackingData {
  uniqueTanks: TankId[];
  uniqueArenas: ArenaId[];
}

export interface PermanentTrackingData {
  matchesStarted: number;
  matchesCompleted: number;
  wins: number;
  eliminations: number;
  powerupsCollected: number;
  abilitiesActivated: number;
  obstaclesDestroyed: number;
  uniqueTanks: TankId[];
  uniqueArenas: ArenaId[];
}

export interface MissionsState {
  saveVersion: number;
  dailyPeriodKey: string;
  dailyMissions: ActiveMissionProgress[];
  dailyTracking: PeriodTrackingData;
  weeklyPeriodKey: string;
  weeklyMissions: ActiveMissionProgress[];
  weeklyTracking: PeriodTrackingData;
  achievements: Record<string, AchievementProgress>;
  permanentTracking: PermanentTrackingData;
  processedEventIds: string[];
}

export interface MissionResetConfig {
  timezone: string;
  dailyResetHour: number;
  weeklyResetDayOfWeek: number; // 0=Sun .. 1=Mon .. 6=Sat
  weeklyResetHour: number;
}

export interface ClaimRewardOutcome {
  claimed: boolean;
  reason?: 'not_found' | 'not_completed' | 'already_claimed';
  xpAwarded: number;
  scrapAwarded: number;
  cosmeticUnlocked: CosmeticId | null;
  previousLevel: number;
  newLevel: number;
  levelsGained: number;
  unlockedMilestones: MilestoneRewardDefinition[];
}

export type TankDecalCategory =
  | 'None'
  | 'Insignia'
  | 'Star'
  | 'Number'
  | 'Stripes'
  | 'Geometric'
  | 'Special';

export type TankDecalId =
  | 'none'
  | 'chevron'
  | 'iron_crosshair'
  | 'shield_crest'
  | 'command_star'
  | 'num_01'
  | 'num_07'
  | 'num_42'
  | 'num_99'
  | 'twin_stripes'
  | 'hazard_stripes'
  | 'apex_diamond'
  | 'hex_core'
  | 'thunder_bolt'
  | 'apex_crown'
  | 'winged_crest';

export type DecalPosition = 'hull_front' | 'hull_rear' | 'hull_flanks' | 'turret_top';

export interface TankDecalDefinition {
  id: TankDecalId;
  name: string;
  category: TankDecalCategory;
  description: string;
  labelText?: string;
  scrapCost?: number;
}

export interface TankCustomization {
  primaryColor: string;
  secondaryColor: string;
  turretColor: string;
  barrelColor: string;
  decalId: TankDecalId;
  decalPosition: DecalPosition;
  decalColor: string;
  presetId?: string | null;
}

export interface TankCosmeticPreset {
  id: string;
  tankId: TankId;
  name: string;
  description: string;
  scrapCost?: number;
  customization: TankCustomization;
}

export type RewardedAdStatus = 'rewarded' | 'skipped' | 'failed' | 'unavailable';

export interface RewardedAdOutcome {
  status: RewardedAdStatus;
  granted: boolean;
  grantId?: string;
}

export type InterstitialTrigger = 'match_complete' | 'return_to_menu';

export interface InterstitialOutcome {
  shown: boolean;
  reason: 'completed' | 'failed' | 'unavailable' | 'cooldown' | 'in_match' | 'busy';
}

export interface BridgeRuntimeState {
  isInitialized: boolean;
  isInitPending: boolean;
  platformId: string;
  isPlaygamaPlatform: boolean;
  isPlatformPaused: boolean;
  isAudioEnabled: boolean;
  isPageVisible: boolean;
  isAdPlaying: boolean;
  isRewardedSupported: boolean;
  isInterstitialSupported: boolean;
  supportsPlatformStorage: boolean;
}

