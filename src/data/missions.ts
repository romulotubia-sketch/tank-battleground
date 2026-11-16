import {
  AchievementDefinition,
  AchievementProgress,
  ActiveMissionProgress,
  ArenaId,
  ClaimRewardOutcome,
  GameplayEvent,
  MissionDefinition,
  MissionMetric,
  MissionResetConfig,
  MissionsState,
  PeriodTrackingData,
  PermanentTrackingData,
  PlayerProgression,
  RewardScope,
  TankId,
} from '../types/game';
import { grantProgressionRewards, ProgressionConfigOverrides } from './progression';

export const MISSION_RESET_CONFIG: MissionResetConfig = {
  timezone: 'Asia/Manila',
  dailyResetHour: 0,
  weeklyResetDayOfWeek: 1, // Monday
  weeklyResetHour: 0,
};

export const DAILY_MISSIONS_COUNT = 3;
export const WEEKLY_MISSIONS_COUNT = 3;
export const MISSIONS_SAVE_VERSION = 1;

export const DAILY_MISSION_POOL: MissionDefinition[] = [
  {
    id: 'daily_play_3',
    scope: 'daily',
    title: 'Frontline Duty',
    description: 'Play 3 matches in any arena.',
    metric: 'matches_played',
    target: 3,
    reward: { xp: 60, scrap: 40 },
  },
  {
    id: 'daily_win_1',
    scope: 'daily',
    title: 'First Victory',
    description: 'Win 1 match as the last tank standing or highest HP.',
    metric: 'wins',
    target: 1,
    reward: { xp: 90, scrap: 60 },
  },
  {
    id: 'daily_elims_5',
    scope: 'daily',
    title: 'Target Practice',
    description: 'Eliminate 5 enemy tanks.',
    metric: 'eliminations',
    target: 5,
    reward: { xp: 75, scrap: 50 },
  },
  {
    id: 'daily_powerups_5',
    scope: 'daily',
    title: 'Supply Runner',
    description: 'Collect 5 battlefield power-ups.',
    metric: 'powerups_collected',
    target: 5,
    reward: { xp: 65, scrap: 45 },
  },
  {
    id: 'daily_scout_2',
    scope: 'daily',
    title: 'Recon Patrol',
    description: 'Play 2 matches using the Scout Tank.',
    metric: 'tank_matches',
    target: 2,
    tankId: 'scout',
    reward: { xp: 80, scrap: 55 },
  },
  {
    id: 'daily_abilities_10',
    scope: 'daily',
    title: 'Systems Overdrive',
    description: 'Activate tank active abilities 10 times.',
    metric: 'abilities_activated',
    target: 10,
    reward: { xp: 70, scrap: 45 },
  },
  {
    id: 'daily_industrial_1',
    scope: 'daily',
    title: 'Factory Raid',
    description: 'Play a match in Industrial Zone.',
    metric: 'arena_matches',
    target: 1,
    arenaId: 'industrial_zone',
    reward: { xp: 65, scrap: 45 },
  },
  {
    id: 'daily_obstacles_10',
    scope: 'daily',
    title: 'Breach & Clear',
    description: 'Destroy 10 destructible obstacles.',
    metric: 'obstacles_destroyed',
    target: 10,
    reward: { xp: 70, scrap: 50 },
  },
  {
    id: 'daily_top3_2',
    scope: 'daily',
    title: 'Podium Finish',
    description: 'Survive into the final 3 tanks in 2 matches.',
    metric: 'top_three_finishes',
    target: 2,
    reward: { xp: 85, scrap: 60 },
  },
  {
    id: 'daily_fortress_2',
    scope: 'daily',
    title: 'Armor Bastion',
    description: 'Play 2 matches using the Fortress Tank.',
    metric: 'tank_matches',
    target: 2,
    tankId: 'fortress',
    reward: { xp: 80, scrap: 55 },
  },
];

export const WEEKLY_MISSION_POOL: MissionDefinition[] = [
  {
    id: 'weekly_play_15',
    scope: 'weekly',
    title: 'Campaign Deployment',
    description: 'Complete 15 matches across any arenas.',
    metric: 'matches_played',
    target: 15,
    reward: { xp: 260, scrap: 180 },
  },
  {
    id: 'weekly_win_5',
    scope: 'weekly',
    title: 'Arena Champion',
    description: 'Win 5 matches.',
    metric: 'wins',
    target: 5,
    reward: { xp: 350, scrap: 240 },
  },
  {
    id: 'weekly_elims_40',
    scope: 'weekly',
    title: 'Heavy Barrage',
    description: 'Eliminate 40 enemy tanks.',
    metric: 'eliminations',
    target: 40,
    reward: { xp: 320, scrap: 220 },
  },
  {
    id: 'weekly_powerups_25',
    scope: 'weekly',
    title: 'Field Logistics',
    description: 'Collect 25 power-ups.',
    metric: 'powerups_collected',
    target: 25,
    reward: { xp: 250, scrap: 170 },
  },
  {
    id: 'weekly_diff_tanks_5',
    scope: 'weekly',
    title: 'Versatile Commander',
    description: 'Play matches using 5 different tanks.',
    metric: 'unique_tanks_played',
    target: 5,
    reward: { xp: 300, scrap: 200 },
  },
  {
    id: 'weekly_wasteland_10',
    scope: 'weekly',
    title: 'Dune Warfare',
    description: 'Complete 10 matches in Wasteland.',
    metric: 'arena_matches',
    target: 10,
    arenaId: 'wasteland',
    reward: { xp: 300, scrap: 210 },
  },
  {
    id: 'weekly_obstacles_50',
    scope: 'weekly',
    title: 'Siege Breaker',
    description: 'Destroy 50 destructible obstacles.',
    metric: 'obstacles_destroyed',
    target: 50,
    reward: { xp: 280, scrap: 190 },
  },
];

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Combat
  {
    id: 'ach_first_elim',
    category: 'Combat',
    title: 'First Elimination',
    description: 'Get your first opponent elimination.',
    metric: 'eliminations',
    target: 1,
    reward: { xp: 60, scrap: 0 },
  },
  {
    id: 'ach_sharpshooter',
    category: 'Combat',
    title: 'Sharpshooter',
    description: 'Reach 50 total opponent eliminations.',
    metric: 'eliminations',
    target: 50,
    reward: { xp: 180, scrap: 0, cosmeticId: 'crimson_vanguard' },
  },
  {
    id: 'ach_veteran_fighter',
    category: 'Combat',
    title: 'Veteran Fighter',
    description: 'Reach 250 total opponent eliminations.',
    metric: 'eliminations',
    target: 250,
    reward: { xp: 350, scrap: 0 },
  },
  {
    id: 'ach_dominator',
    category: 'Combat',
    title: 'Dominator',
    description: 'Reach 500 total opponent eliminations.',
    metric: 'eliminations',
    target: 500,
    reward: { xp: 600, scrap: 0, cosmeticId: 'warlord_crimson' },
  },

  // Survival
  {
    id: 'ach_survivor',
    category: 'Survival',
    title: 'Survivor',
    description: 'Win your first arena match.',
    metric: 'wins',
    target: 1,
    reward: { xp: 100, scrap: 0 },
  },
  {
    id: 'ach_last_tank',
    category: 'Survival',
    title: 'Last Tank Standing',
    description: 'Win 10 arena matches.',
    metric: 'wins',
    target: 10,
    reward: { xp: 250, scrap: 0, cosmeticId: 'desert_phantom' },
  },
  {
    id: 'ach_unstoppable',
    category: 'Survival',
    title: 'Unstoppable',
    description: 'Win 50 arena matches.',
    metric: 'wins',
    target: 50,
    reward: { xp: 550, scrap: 0 },
  },

  // Collection
  {
    id: 'ach_collector',
    category: 'Collection',
    title: 'Collector',
    description: 'Collect 50 power-ups across matches.',
    metric: 'powerups_collected',
    target: 50,
    reward: { xp: 180, scrap: 0 },
  },
  {
    id: 'ach_tank_enthusiast',
    category: 'Collection',
    title: 'Tank Enthusiast',
    description: 'Play at least one match with each of the six tanks.',
    metric: 'unique_tanks_played',
    target: 6,
    reward: { xp: 240, scrap: 0, cosmeticId: 'emerald_squad' },
  },

  // Exploration
  {
    id: 'ach_arena_explorer',
    category: 'Exploration',
    title: 'Arena Explorer',
    description: 'Play a match in all three arenas.',
    metric: 'unique_arenas_played',
    target: 3,
    reward: { xp: 160, scrap: 0 },
  },
  {
    id: 'ach_demolition_expert',
    category: 'Exploration',
    title: 'Demolition Expert',
    description: 'Destroy 100 destructible battlefield obstacles.',
    metric: 'obstacles_destroyed',
    target: 100,
    reward: { xp: 220, scrap: 0, cosmeticId: 'hazard_stripes' },
  },
];

export const ALL_MISSION_DEFINITIONS: Record<string, MissionDefinition> = Object.fromEntries(
  [...DAILY_MISSION_POOL, ...WEEKLY_MISSION_POOL].map((m) => [m.id, m])
);

export const ACHIEVEMENT_DEFINITION_MAP: Record<string, AchievementDefinition> = Object.fromEntries(
  ACHIEVEMENT_DEFINITIONS.map((a) => [a.id, a])
);

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

export function getZonedDateParts(
  nowMs: number,
  timezone: string = MISSION_RESET_CONFIG.timezone
): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = formatter.formatToParts(new Date(nowMs));
  const lookup = new Map<string, string>();
  for (const p of parts) {
    lookup.set(p.type, p.value);
  }
  const rawHour = Number(lookup.get('hour') ?? '0');
  const hour = rawHour === 24 ? 0 : rawHour;
  return {
    year: Number(lookup.get('year') ?? '2026'),
    month: Number(lookup.get('month') ?? '1'),
    day: Number(lookup.get('day') ?? '1'),
    hour,
    minute: Number(lookup.get('minute') ?? '0'),
    second: Number(lookup.get('second') ?? '0'),
    weekday: WEEKDAY_MAP[lookup.get('weekday') ?? 'Mon'] ?? 1,
  };
}

function formatUtcDateKey(utcDate: Date): string {
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDailyPeriodKey(
  nowMs: number = Date.now(),
  config: MissionResetConfig = MISSION_RESET_CONFIG
): string {
  const z = getZonedDateParts(nowMs, config.timezone);
  const shiftDay = z.hour < config.dailyResetHour ? 1 : 0;
  const effectiveDate = new Date(Date.UTC(z.year, z.month - 1, z.day - shiftDay));
  return formatUtcDateKey(effectiveDate);
}

export function getWeeklyPeriodKey(
  nowMs: number = Date.now(),
  config: MissionResetConfig = MISSION_RESET_CONFIG
): string {
  const z = getZonedDateParts(nowMs, config.timezone);
  let daysSinceReset = (z.weekday - config.weeklyResetDayOfWeek + 7) % 7;
  if (daysSinceReset === 0 && z.hour < config.weeklyResetHour) {
    daysSinceReset = 7;
  }
  const anchorDate = new Date(Date.UTC(z.year, z.month - 1, z.day - daysSinceReset));
  return `W-${formatUtcDateKey(anchorDate)}`;
}

/**
 * Estimates remaining milliseconds until the next daily or weekly reset in the configured timezone.
 */
export function getResetCountdowns(
  nowMs: number = Date.now(),
  config: MissionResetConfig = MISSION_RESET_CONFIG
): { dailyMsLeft: number; weeklyMsLeft: number } {
  const z = getZonedDateParts(nowMs, config.timezone);
  const secIntoDay = z.hour * 3600 + z.minute * 60 + z.second;
  const dailyResetSec = config.dailyResetHour * 3600;
  let dailySecLeft = dailyResetSec - secIntoDay;
  if (dailySecLeft <= 0) {
    dailySecLeft += 86400;
  }

  let daysUntilWeekly = (config.weeklyResetDayOfWeek - z.weekday + 7) % 7;
  const weeklyResetSecOfDay = config.weeklyResetHour * 3600;
  if (daysUntilWeekly === 0 && secIntoDay >= weeklyResetSecOfDay) {
    daysUntilWeekly = 7;
  }
  const weeklySecLeft = daysUntilWeekly * 86400 + (weeklyResetSecOfDay - secIntoDay);

  return {
    dailyMsLeft: Math.max(0, dailySecLeft * 1000),
    weeklyMsLeft: Math.max(0, weeklySecLeft * 1000),
  };
}

export function formatCountdownDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const mins = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Selects `count` varied missions deterministically for a given period key.
 * Prefers distinct metrics across the selected missions and avoids repeating `avoidIds`.
 */
export function selectMissionsForPeriod(
  periodKey: string,
  pool: MissionDefinition[],
  count: number = 3,
  avoidIds: string[] = []
): MissionDefinition[] {
  if (pool.length <= count) return [...pool];

  const avoidSet = new Set(avoidIds);
  const scored = pool.map((mission) => ({
    mission,
    sortKey: hashSeed(`${periodKey}:${mission.id}`),
  }));
  scored.sort((a, b) => a.sortKey - b.sortKey);

  const chosen: MissionDefinition[] = [];
  const usedMetrics = new Set<MissionMetric>();

  // Pass 1: fresh missions (not in previous period) with unique metrics
  for (const item of scored) {
    if (chosen.length >= count) break;
    if (avoidSet.has(item.mission.id)) continue;
    if (usedMetrics.has(item.mission.metric)) continue;
    chosen.push(item.mission);
    usedMetrics.add(item.mission.metric);
  }

  // Pass 2: allow missions from previous period if needed for unique metrics
  for (const item of scored) {
    if (chosen.length >= count) break;
    if (chosen.some((m) => m.id === item.mission.id)) continue;
    if (usedMetrics.has(item.mission.metric)) continue;
    chosen.push(item.mission);
    usedMetrics.add(item.mission.metric);
  }

  // Pass 3: fill remaining slots if pool has fewer unique metrics than count
  for (const item of scored) {
    if (chosen.length >= count) break;
    if (chosen.some((m) => m.id === item.mission.id)) continue;
    chosen.push(item.mission);
  }

  return chosen;
}

function toInitialMissionProgress(missions: MissionDefinition[]): ActiveMissionProgress[] {
  return missions.map((m) => ({
    missionId: m.id,
    progress: 0,
    completed: false,
    claimed: false,
    claimedAtMs: null,
  }));
}

export function createEmptyPeriodTracking(): PeriodTrackingData {
  return {
    uniqueTanks: [],
    uniqueArenas: [],
  };
}

export function createEmptyPermanentTracking(): PermanentTrackingData {
  return {
    matchesStarted: 0,
    matchesCompleted: 0,
    wins: 0,
    eliminations: 0,
    powerupsCollected: 0,
    abilitiesActivated: 0,
    obstaclesDestroyed: 0,
    uniqueTanks: [],
    uniqueArenas: [],
  };
}

export function createInitialAchievementsRecord(
  defs: AchievementDefinition[] = ACHIEVEMENT_DEFINITIONS,
  seedProgression?: Partial<PlayerProgression>
): Record<string, AchievementProgress> {
  const record: Record<string, AchievementProgress> = {};
  const seedElims = Math.max(0, seedProgression?.totalEliminations ?? 0);
  const seedWins = Math.max(0, seedProgression?.wins ?? 0);

  for (const def of defs) {
    let initialProgress = 0;
    if (def.metric === 'eliminations') initialProgress = Math.min(def.target, seedElims);
    else if (def.metric === 'wins') initialProgress = Math.min(def.target, seedWins);
    const completed = initialProgress >= def.target;
    record[def.id] = {
      achievementId: def.id,
      progress: initialProgress,
      completed,
      unlockedAtMs: completed ? Date.now() : null,
      claimed: false,
      claimedAtMs: null,
    };
  }
  return record;
}

export interface MissionServiceOptions {
  resetConfig?: MissionResetConfig;
  dailyPool?: MissionDefinition[];
  weeklyPool?: MissionDefinition[];
  dailyCount?: number;
  weeklyCount?: number;
  achievements?: AchievementDefinition[];
}

export function createInitialMissionsState(
  nowMs: number = Date.now(),
  options: MissionServiceOptions = {},
  seedProgression?: Partial<PlayerProgression>
): MissionsState {
  const resetConfig = options.resetConfig ?? MISSION_RESET_CONFIG;
  const dailyPool = options.dailyPool ?? DAILY_MISSION_POOL;
  const weeklyPool = options.weeklyPool ?? WEEKLY_MISSION_POOL;
  const dailyCount = options.dailyCount ?? DAILY_MISSIONS_COUNT;
  const weeklyCount = options.weeklyCount ?? WEEKLY_MISSIONS_COUNT;
  const achDefs = options.achievements ?? ACHIEVEMENT_DEFINITIONS;

  const dailyPeriodKey = getDailyPeriodKey(nowMs, resetConfig);
  const weeklyPeriodKey = getWeeklyPeriodKey(nowMs, resetConfig);

  const selectedDaily = selectMissionsForPeriod(dailyPeriodKey, dailyPool, dailyCount);
  const selectedWeekly = selectMissionsForPeriod(weeklyPeriodKey, weeklyPool, weeklyCount);

  const permanentTracking = createEmptyPermanentTracking();
  if (seedProgression) {
    permanentTracking.eliminations = Math.max(0, seedProgression.totalEliminations ?? 0);
    permanentTracking.wins = Math.max(0, seedProgression.wins ?? 0);
    permanentTracking.matchesCompleted = Math.max(0, seedProgression.matchesPlayed ?? 0);
  }

  return {
    saveVersion: MISSIONS_SAVE_VERSION,
    dailyPeriodKey,
    dailyMissions: toInitialMissionProgress(selectedDaily),
    dailyTracking: createEmptyPeriodTracking(),
    weeklyPeriodKey,
    weeklyMissions: toInitialMissionProgress(selectedWeekly),
    weeklyTracking: createEmptyPeriodTracking(),
    achievements: createInitialAchievementsRecord(achDefs, seedProgression),
    permanentTracking,
    processedEventIds: [],
  };
}

/**
 * Checks daily and weekly reset boundaries in the configured timezone.
 * Resets only the expired period(s); never resets permanent achievements.
 */
export function ensureMissionPeriodsCurrent(
  state: MissionsState,
  nowMs: number = Date.now(),
  options: MissionServiceOptions = {}
): { state: MissionsState; dailyReset: boolean; weeklyReset: boolean } {
  const resetConfig = options.resetConfig ?? MISSION_RESET_CONFIG;
  const dailyPool = options.dailyPool ?? DAILY_MISSION_POOL;
  const weeklyPool = options.weeklyPool ?? WEEKLY_MISSION_POOL;
  const dailyCount = options.dailyCount ?? DAILY_MISSIONS_COUNT;
  const weeklyCount = options.weeklyCount ?? WEEKLY_MISSIONS_COUNT;
  const achDefs = options.achievements ?? ACHIEVEMENT_DEFINITIONS;

  const currentDailyKey = getDailyPeriodKey(nowMs, resetConfig);
  const currentWeeklyKey = getWeeklyPeriodKey(nowMs, resetConfig);

  let next = state;
  let dailyReset = false;
  let weeklyReset = false;

  if (state.dailyPeriodKey !== currentDailyKey) {
    const prevIds = state.dailyMissions.map((m) => m.missionId);
    const freshDaily = selectMissionsForPeriod(currentDailyKey, dailyPool, dailyCount, prevIds);
    next = {
      ...next,
      dailyPeriodKey: currentDailyKey,
      dailyMissions: toInitialMissionProgress(freshDaily),
      dailyTracking: createEmptyPeriodTracking(),
    };
    dailyReset = true;
  }

  if (state.weeklyPeriodKey !== currentWeeklyKey) {
    const prevIds = state.weeklyMissions.map((m) => m.missionId);
    const freshWeekly = selectMissionsForPeriod(currentWeeklyKey, weeklyPool, weeklyCount, prevIds);
    next = {
      ...next,
      weeklyPeriodKey: currentWeeklyKey,
      weeklyMissions: toInitialMissionProgress(freshWeekly),
      weeklyTracking: createEmptyPeriodTracking(),
    };
    weeklyReset = true;
  }

  // Ensure any newly configured achievements exist without disturbing existing progress
  let achMap = next.achievements;
  let achChanged = false;
  for (const def of achDefs) {
    if (!achMap[def.id]) {
      if (!achChanged) {
        achMap = { ...achMap };
        achChanged = true;
      }
      achMap[def.id] = {
        achievementId: def.id,
        progress: 0,
        completed: false,
        unlockedAtMs: null,
        claimed: false,
        claimedAtMs: null,
      };
    }
  }
  if (achChanged) {
    next = { ...next, achievements: achMap };
  }

  return { state: next, dailyReset, weeklyReset };
}

function resolveMissionDefinition(
  missionId: string,
  options: MissionServiceOptions
): MissionDefinition | undefined {
  if (options.dailyPool) {
    const found = options.dailyPool.find((m) => m.id === missionId);
    if (found) return found;
  }
  if (options.weeklyPool) {
    const found = options.weeklyPool.find((m) => m.id === missionId);
    if (found) return found;
  }
  return ALL_MISSION_DEFINITIONS[missionId];
}

function advanceMissionList(
  entries: ActiveMissionProgress[],
  tracking: PeriodTrackingData,
  event: GameplayEvent,
  options: MissionServiceOptions
): ActiveMissionProgress[] {
  return entries.map((entry) => {
    const def = resolveMissionDefinition(entry.missionId, options);
    if (!def || entry.completed) return entry;

    let nextProgress = entry.progress;

    switch (event.type) {
      case 'match_completed': {
        if (def.metric === 'matches_played') {
          nextProgress += 1;
        } else if (def.metric === 'tank_matches' && def.tankId === event.tankId) {
          nextProgress += 1;
        } else if (def.metric === 'arena_matches' && def.arenaId === event.arenaId) {
          nextProgress += 1;
        } else if (def.metric === 'top_three_finishes' && event.placement <= 3) {
          nextProgress += 1;
        } else if (def.metric === 'unique_tanks_played') {
          nextProgress = tracking.uniqueTanks.length;
        } else if (def.metric === 'unique_arenas_played') {
          nextProgress = tracking.uniqueArenas.length;
        }
        break;
      }
      case 'match_victory': {
        if (def.metric === 'wins') nextProgress += 1;
        break;
      }
      case 'tank_elimination': {
        if (def.metric === 'eliminations') nextProgress += 1;
        break;
      }
      case 'powerup_collected': {
        if (def.metric === 'powerups_collected') nextProgress += 1;
        break;
      }
      case 'ability_activated': {
        if (def.metric === 'abilities_activated') nextProgress += 1;
        break;
      }
      case 'obstacle_destroyed': {
        if (def.metric === 'obstacles_destroyed') nextProgress += 1;
        break;
      }
      case 'match_started':
      default:
        break;
    }

    const clamped = Math.min(def.target, Math.max(0, nextProgress));
    if (clamped === entry.progress) return entry;

    return {
      ...entry,
      progress: clamped,
      completed: clamped >= def.target,
    };
  });
}

function updatePeriodTracking(tracking: PeriodTrackingData, event: GameplayEvent): PeriodTrackingData {
  if (event.type !== 'match_completed') return tracking;
  const nextTanks = tracking.uniqueTanks.includes(event.tankId)
    ? tracking.uniqueTanks
    : [...tracking.uniqueTanks, event.tankId];
  const nextArenas = tracking.uniqueArenas.includes(event.arenaId)
    ? tracking.uniqueArenas
    : [...tracking.uniqueArenas, event.arenaId];

  if (nextTanks === tracking.uniqueTanks && nextArenas === tracking.uniqueArenas) {
    return tracking;
  }
  return {
    uniqueTanks: nextTanks,
    uniqueArenas: nextArenas,
  };
}

function updatePermanentTracking(
  tracking: PermanentTrackingData,
  event: GameplayEvent
): PermanentTrackingData {
  switch (event.type) {
    case 'match_started':
      return { ...tracking, matchesStarted: tracking.matchesStarted + 1 };
    case 'match_completed':
      return {
        ...tracking,
        matchesCompleted: tracking.matchesCompleted + 1,
        uniqueTanks: tracking.uniqueTanks.includes(event.tankId)
          ? tracking.uniqueTanks
          : [...tracking.uniqueTanks, event.tankId],
        uniqueArenas: tracking.uniqueArenas.includes(event.arenaId)
          ? tracking.uniqueArenas
          : [...tracking.uniqueArenas, event.arenaId],
      };
    case 'match_victory':
      return { ...tracking, wins: tracking.wins + 1 };
    case 'tank_elimination':
      return { ...tracking, eliminations: tracking.eliminations + 1 };
    case 'powerup_collected':
      return { ...tracking, powerupsCollected: tracking.powerupsCollected + 1 };
    case 'ability_activated':
      return { ...tracking, abilitiesActivated: tracking.abilitiesActivated + 1 };
    case 'obstacle_destroyed':
      return { ...tracking, obstaclesDestroyed: tracking.obstaclesDestroyed + 1 };
    default:
      return tracking;
  }
}

function computePermanentMetricValue(
  metric: MissionMetric,
  tracking: PermanentTrackingData
): number {
  switch (metric) {
    case 'eliminations':
      return tracking.eliminations;
    case 'wins':
      return tracking.wins;
    case 'powerups_collected':
      return tracking.powerupsCollected;
    case 'matches_played':
      return tracking.matchesCompleted;
    case 'abilities_activated':
      return tracking.abilitiesActivated;
    case 'obstacles_destroyed':
      return tracking.obstaclesDestroyed;
    case 'unique_tanks_played':
      return tracking.uniqueTanks.length;
    case 'unique_arenas_played':
      return tracking.uniqueArenas.length;
    default:
      return 0;
  }
}

/**
 * Processes a single player gameplay event across Daily Missions, Weekly Missions, and Achievements.
 * Strictly idempotent per `event.eventId` so no event can ever be counted more than once.
 */
export function applyGameplayEvent(
  prevState: MissionsState,
  event: GameplayEvent,
  nowMs: number = Date.now(),
  options: MissionServiceOptions = {}
): { nextState: MissionsState; applied: boolean } {
  const { state: currentState } = ensureMissionPeriodsCurrent(prevState, nowMs, options);

  const eventId = event.eventId?.trim();
  if (eventId && currentState.processedEventIds.includes(eventId)) {
    return { nextState: currentState, applied: false };
  }

  const nextDailyTracking = updatePeriodTracking(currentState.dailyTracking, event);
  const nextWeeklyTracking = updatePeriodTracking(currentState.weeklyTracking, event);
  const nextPermanentTracking = updatePermanentTracking(currentState.permanentTracking, event);

  const nextDailyMissions = advanceMissionList(
    currentState.dailyMissions,
    nextDailyTracking,
    event,
    options
  );
  const nextWeeklyMissions = advanceMissionList(
    currentState.weeklyMissions,
    nextWeeklyTracking,
    event,
    options
  );

  const achDefs = options.achievements ?? ACHIEVEMENT_DEFINITIONS;
  const nextAchievements: Record<string, AchievementProgress> = { ...currentState.achievements };

  for (const def of achDefs) {
    const existing = nextAchievements[def.id] ?? {
      achievementId: def.id,
      progress: 0,
      completed: false,
      unlockedAtMs: null,
      claimed: false,
      claimedAtMs: null,
    };
    const metricVal = computePermanentMetricValue(def.metric, nextPermanentTracking);
    const nextProgress = Math.min(def.target, Math.max(existing.progress, metricVal));
    const completed = existing.completed || nextProgress >= def.target;

    if (nextProgress !== existing.progress || completed !== existing.completed) {
      nextAchievements[def.id] = {
        ...existing,
        progress: nextProgress,
        completed,
        unlockedAtMs: existing.unlockedAtMs ?? (completed ? nowMs : null),
      };
    }
  }

  const nextProcessedIds = eventId
    ? [eventId, ...currentState.processedEventIds].slice(0, 250)
    : currentState.processedEventIds;

  return {
    applied: true,
    nextState: {
      ...currentState,
      dailyMissions: nextDailyMissions,
      dailyTracking: nextDailyTracking,
      weeklyMissions: nextWeeklyMissions,
      weeklyTracking: nextWeeklyTracking,
      achievements: nextAchievements,
      permanentTracking: nextPermanentTracking,
      processedEventIds: nextProcessedIds,
    },
  };
}

/**
 * Centralized reward claim service for Daily Missions, Weekly Missions, and Achievements.
 * Prevents duplicate claims and awards XP/Scrap/Cosmetics via `grantProgressionRewards`.
 */
export function claimMissionOrAchievementReward(
  prevProgression: PlayerProgression,
  prevMissions: MissionsState,
  scope: RewardScope,
  id: string,
  nowMs: number = Date.now(),
  options: MissionServiceOptions = {},
  progressionOverrides: ProgressionConfigOverrides = {}
): {
  nextProgression: PlayerProgression;
  nextMissions: MissionsState;
  outcome: ClaimRewardOutcome;
} {
  const emptyFail = (reason: ClaimRewardOutcome['reason']): ClaimRewardOutcome => ({
    claimed: false,
    reason,
    xpAwarded: 0,
    scrapAwarded: 0,
    cosmeticUnlocked: null,
    previousLevel: prevProgression.level,
    newLevel: prevProgression.level,
    levelsGained: 0,
    unlockedMilestones: [],
  });

  if (scope === 'daily' || scope === 'weekly') {
    const list = scope === 'daily' ? prevMissions.dailyMissions : prevMissions.weeklyMissions;
    const idx = list.findIndex((m) => m.missionId === id);
    if (idx === -1) {
      return { nextProgression: prevProgression, nextMissions: prevMissions, outcome: emptyFail('not_found') };
    }
    const entry = list[idx];
    if (!entry.completed) {
      return {
        nextProgression: prevProgression,
        nextMissions: prevMissions,
        outcome: emptyFail('not_completed'),
      };
    }
    if (entry.claimed) {
      return {
        nextProgression: prevProgression,
        nextMissions: prevMissions,
        outcome: emptyFail('already_claimed'),
      };
    }

    const def = resolveMissionDefinition(id, options);
    if (!def) {
      return { nextProgression: prevProgression, nextMissions: prevMissions, outcome: emptyFail('not_found') };
    }

    const rewardRes = grantProgressionRewards(
      prevProgression,
      {
        xp: def.reward.xp,
        scrap: def.reward.scrap,
        cosmeticId: def.reward.cosmeticId,
      },
      progressionOverrides
    );

    const updatedList = list.map((item, i) =>
      i === idx ? { ...item, claimed: true, claimedAtMs: nowMs } : item
    );

    const nextMissions: MissionsState =
      scope === 'daily'
        ? { ...prevMissions, dailyMissions: updatedList }
        : { ...prevMissions, weeklyMissions: updatedList };

    return {
      nextProgression: rewardRes.nextProgression,
      nextMissions,
      outcome: {
        claimed: true,
        xpAwarded: rewardRes.xpAwarded,
        scrapAwarded: rewardRes.scrapAwarded,
        cosmeticUnlocked: rewardRes.cosmeticUnlocked,
        previousLevel: rewardRes.previousLevel,
        newLevel: rewardRes.newLevel,
        levelsGained: rewardRes.levelsGained,
        unlockedMilestones: rewardRes.unlockedMilestones,
      },
    };
  }

  // Achievement claim
  const achDefs = options.achievements ?? ACHIEVEMENT_DEFINITIONS;
  const achDef = achDefs.find((a) => a.id === id) ?? ACHIEVEMENT_DEFINITION_MAP[id];
  const achEntry = prevMissions.achievements[id];
  if (!achDef || !achEntry) {
    return { nextProgression: prevProgression, nextMissions: prevMissions, outcome: emptyFail('not_found') };
  }
  if (!achEntry.completed) {
    return {
      nextProgression: prevProgression,
      nextMissions: prevMissions,
      outcome: emptyFail('not_completed'),
    };
  }
  if (achEntry.claimed) {
    return {
      nextProgression: prevProgression,
      nextMissions: prevMissions,
      outcome: emptyFail('already_claimed'),
    };
  }

  const rewardRes = grantProgressionRewards(
    prevProgression,
    {
      xp: achDef.reward.xp,
      scrap: achDef.reward.scrap,
      cosmeticId: achDef.reward.cosmeticId,
    },
    progressionOverrides
  );

  const nextMissions: MissionsState = {
    ...prevMissions,
    achievements: {
      ...prevMissions.achievements,
      [id]: {
        ...achEntry,
        claimed: true,
        claimedAtMs: nowMs,
      },
    },
  };

  return {
    nextProgression: rewardRes.nextProgression,
    nextMissions,
    outcome: {
      claimed: true,
      xpAwarded: rewardRes.xpAwarded,
      scrapAwarded: rewardRes.scrapAwarded,
      cosmeticUnlocked: rewardRes.cosmeticUnlocked,
      previousLevel: rewardRes.previousLevel,
      newLevel: rewardRes.newLevel,
      levelsGained: rewardRes.levelsGained,
      unlockedMilestones: rewardRes.unlockedMilestones,
    },
  };
}

export function countUnclaimedRewards(state: MissionsState): {
  daily: number;
  weekly: number;
  achievements: number;
  total: number;
} {
  const daily = state.dailyMissions.filter((m) => m.completed && !m.claimed).length;
  const weekly = state.weeklyMissions.filter((m) => m.completed && !m.claimed).length;
  const achievements = Object.values(state.achievements).filter(
    (a) => a.completed && !a.claimed
  ).length;
  return {
    daily,
    weekly,
    achievements,
    total: daily + weekly + achievements,
  };
}
