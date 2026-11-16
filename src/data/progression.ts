import {
  CosmeticId,
  MatchProgressionSummary,
  MatchResult,
  MatchScrapBreakdown,
  MilestoneRewardDefinition,
  PlayerProgression,
  TankCosmeticDefinition,
  TankDefinition,
  TankVisualConfig,
  XpBreakdown,
} from '../types/game';

export interface ScrapRewardConfig {
  matchCompletionScrap: number;
  eliminationScrap: number;
  victoryBonusScrap: number;
  placementPerformanceBonuses: number[];
  damagePerBonusScrap: number;
  maxDamagePerformanceScrap: number;
}

export const SCRAP_REWARD_CONFIG: ScrapRewardConfig = {
  matchCompletionScrap: 20,
  eliminationScrap: 10,
  victoryBonusScrap: 35,
  placementPerformanceBonuses: [25, 18, 12, 6, 2, 0, 0, 0],
  damagePerBonusScrap: 50,
  maxDamagePerformanceScrap: 15,
};

export interface XpRewardConfig {
  matchCompletionXp: number;
  victoryBonusXp: number;
  eliminationXp: number;
  topThreeBonusXp: number;
  topThreeMaxPlacement: number;
}

export const XP_REWARD_CONFIG: XpRewardConfig = {
  matchCompletionXp: 50,
  victoryBonusXp: 100,
  eliminationXp: 20,
  topThreeBonusXp: 30,
  topThreeMaxPlacement: 3,
};

export interface LevelCurveConfig {
  startingLevel: number;
  baseXp: number;
  linearStep: number;
  quadraticStep: number;
}

export const LEVEL_CURVE_CONFIG: LevelCurveConfig = {
  startingLevel: 1,
  baseXp: 100,
  linearStep: 50,
  quadraticStep: 10,
};

/**
 * Computes the XP required to advance from `level` to `level + 1`.
 * Strictly increasing for every level >= 1 without excessive grinding:
 * Lv1->2: 100, Lv2->3: 160, Lv3->4: 240, Lv4->5: 340, Lv5->6: 460, ...
 */
export function getXpRequiredForLevel(
  level: number,
  config: LevelCurveConfig = LEVEL_CURVE_CONFIG
): number {
  const safeLevel = Math.max(config.startingLevel, Math.floor(level));
  const n = safeLevel - config.startingLevel;
  return Math.max(
    1,
    Math.round(config.baseXp + n * config.linearStep + n * n * config.quadraticStep)
  );
}

/**
 * Visual-only tank cosmetics. Never modifies tank damage, HP, speed, reload, or ability strength.
 */
export const COSMETIC_DEFINITIONS: Record<CosmeticId, TankCosmeticDefinition> = {
  default: {
    id: 'default',
    name: 'Factory Standard',
    description: 'Original combat livery unique to each tank hull.',
    unlockLevel: 1,
    previewPrimary: '#5B7048',
    previewSecondary: '#3E4F30',
    previewAccent: '#E08E26',
  },
  brass_trim: {
    id: 'brass_trim',
    name: 'Field Brass Trim',
    description: 'Warm brushed-brass turret plating and gilded barrel accents (visual only).',
    unlockLevel: 3,
    previewPrimary: '#6F6842',
    previewSecondary: '#4B452B',
    previewAccent: '#F59E0B',
    turretColorOverride: '#8F824E',
    accentColorOverride: '#FBBF24',
  },
  cobalt_strike: {
    id: 'cobalt_strike',
    name: 'Cobalt Strike',
    description: 'Slate-cobalt armor finish with crisp glacier-cyan highlights (visual only).',
    unlockLevel: 7,
    previewPrimary: '#365573',
    previewSecondary: '#22384D',
    previewAccent: '#38BDF8',
    hullPrimaryOverride: '#365573',
    hullSecondaryOverride: '#22384D',
    turretColorOverride: '#4A7094',
    accentColorOverride: '#38BDF8',
  },
  apex_obsidian: {
    id: 'apex_obsidian',
    name: 'Apex Obsidian',
    description: 'Championship matte-obsidian armor with radiant gold trim (visual only).',
    unlockLevel: 10,
    previewPrimary: '#26292E',
    previewSecondary: '#181A1E',
    previewAccent: '#FACC15',
    hullPrimaryOverride: '#2A2D34',
    hullSecondaryOverride: '#1B1D22',
    turretColorOverride: '#383C46',
    accentColorOverride: '#FACC15',
    treadColorOverride: '#121316',
  },
  crimson_vanguard: {
    id: 'crimson_vanguard',
    name: 'Crimson Vanguard',
    description: 'Earned via Sharpshooter achievement. Deep crimson steel & ember trim (visual only).',
    unlockLevel: 0,
    unlockSourceLabel: 'Sharpshooter',
    previewPrimary: '#7F2B2B',
    previewSecondary: '#541B1B',
    previewAccent: '#FB923C',
    hullPrimaryOverride: '#7F2B2B',
    hullSecondaryOverride: '#541B1B',
    turretColorOverride: '#993838',
    accentColorOverride: '#FB923C',
  },
  desert_phantom: {
    id: 'desert_phantom',
    name: 'Sandstorm Spec',
    description: 'Earned via Last Tank Standing achievement. Arid dune plating & amber optics (visual only).',
    unlockLevel: 0,
    unlockSourceLabel: 'Last Tank Standing',
    previewPrimary: '#A38A62',
    previewSecondary: '#735E3E',
    previewAccent: '#FDE047',
    hullPrimaryOverride: '#A38A62',
    hullSecondaryOverride: '#735E3E',
    turretColorOverride: '#B89E74',
    accentColorOverride: '#FDE047',
  },
  emerald_squad: {
    id: 'emerald_squad',
    name: 'Emerald Corps',
    description: 'Earned via Tank Enthusiast achievement. Forest-emerald armor & lime trim (visual only).',
    unlockLevel: 0,
    unlockSourceLabel: 'Tank Enthusiast',
    previewPrimary: '#2E6B4E',
    previewSecondary: '#1E4A35',
    previewAccent: '#4ADE80',
    hullPrimaryOverride: '#2E6B4E',
    hullSecondaryOverride: '#1E4A35',
    turretColorOverride: '#3C8763',
    accentColorOverride: '#4ADE80',
  },
  hazard_stripes: {
    id: 'hazard_stripes',
    name: 'Demolition Amber',
    description: 'Earned via Demolition Expert achievement. Charcoal iron & high-vis amber (visual only).',
    unlockLevel: 0,
    unlockSourceLabel: 'Demolition Expert',
    previewPrimary: '#44464A',
    previewSecondary: '#2C2E31',
    previewAccent: '#F59E0B',
    hullPrimaryOverride: '#44464A',
    hullSecondaryOverride: '#2C2E31',
    turretColorOverride: '#575A60',
    accentColorOverride: '#F59E0B',
  },
  warlord_crimson: {
    id: 'warlord_crimson',
    name: 'Dominator Ruby',
    description: 'Earned via Dominator achievement. Dark titanium hull & ruby glow (visual only).',
    unlockLevel: 0,
    unlockSourceLabel: 'Dominator',
    previewPrimary: '#3A232D',
    previewSecondary: '#24141B',
    previewAccent: '#F43F5E',
    hullPrimaryOverride: '#3A232D',
    hullSecondaryOverride: '#24141B',
    turretColorOverride: '#4F303D',
    accentColorOverride: '#F43F5E',
    treadColorOverride: '#161114',
  },
  arctic_chrome: {
    id: 'arctic_chrome',
    name: 'Arctic Chrome',
    description: 'Workshop Edition: Polar titanium plating with glacier-blue accents (visual only).',
    unlockLevel: 0,
    scrapCost: 120,
    unlockSourceLabel: 'Shop · 120 Scrap',
    previewPrimary: '#B9C8D9',
    previewSecondary: '#64798F',
    previewAccent: '#38BDF8',
    hullPrimaryOverride: '#B9C8D9',
    hullSecondaryOverride: '#64798F',
    turretColorOverride: '#DAE5F0',
    accentColorOverride: '#38BDF8',
    treadColorOverride: '#242D38',
  },
  inferno_forged: {
    id: 'inferno_forged',
    name: 'Inferno Forged',
    description: 'Workshop Edition: Molten charcoal steel with forged amber-red highlights (visual only).',
    unlockLevel: 0,
    scrapCost: 160,
    unlockSourceLabel: 'Shop · 160 Scrap',
    previewPrimary: '#3B2322',
    previewSecondary: '#241413',
    previewAccent: '#FB923C',
    hullPrimaryOverride: '#3B2322',
    hullSecondaryOverride: '#241413',
    turretColorOverride: '#572C26',
    accentColorOverride: '#FB923C',
    treadColorOverride: '#171111',
  },
};

export const COSMETIC_LIST: TankCosmeticDefinition[] = [
  COSMETIC_DEFINITIONS.default,
  COSMETIC_DEFINITIONS.brass_trim,
  COSMETIC_DEFINITIONS.cobalt_strike,
  COSMETIC_DEFINITIONS.apex_obsidian,
  COSMETIC_DEFINITIONS.crimson_vanguard,
  COSMETIC_DEFINITIONS.desert_phantom,
  COSMETIC_DEFINITIONS.emerald_squad,
  COSMETIC_DEFINITIONS.hazard_stripes,
  COSMETIC_DEFINITIONS.warlord_crimson,
  COSMETIC_DEFINITIONS.arctic_chrome,
  COSMETIC_DEFINITIONS.inferno_forged,
];

/**
 * Returns a purely visual TankVisualConfig with the cosmetic color scheme applied.
 */
export function getEffectiveTankVisual(
  tank: TankDefinition,
  cosmeticId: CosmeticId = 'default'
): TankVisualConfig {
  const cosmetic = COSMETIC_DEFINITIONS[cosmeticId] ?? COSMETIC_DEFINITIONS.default;
  if (cosmetic.id === 'default') {
    return tank.visual;
  }
  return {
    ...tank.visual,
    hullPrimary: cosmetic.hullPrimaryOverride ?? tank.visual.hullPrimary,
    hullSecondary: cosmetic.hullSecondaryOverride ?? tank.visual.hullSecondary,
    turretColor: cosmetic.turretColorOverride ?? tank.visual.turretColor,
    accentColor: cosmetic.accentColorOverride ?? tank.visual.accentColor,
    treadColor: cosmetic.treadColorOverride ?? tank.visual.treadColor,
  };
}

/**
 * Configurable level milestone reward schedule. Easy to expand with additional levels/rewards.
 */
export const MILESTONE_REWARDS: MilestoneRewardDefinition[] = [
  {
    level: 2,
    id: 'milestone_lvl_2',
    title: 'Field Requisition',
    description: 'Small Scrap currency bonus for reaching Level 2.',
    type: 'currency',
    scrapAmount: 100,
  },
  {
    level: 3,
    id: 'milestone_lvl_3',
    title: 'Field Brass Trim',
    description: 'Basic tank cosmetic with brushed brass turret & barrel accents (visual only).',
    type: 'cosmetic',
    cosmeticId: 'brass_trim',
  },
  {
    level: 5,
    id: 'milestone_lvl_5',
    title: 'Commander Supply Crate',
    description: 'Scrap currency reward for seasoned arena commanders.',
    type: 'currency',
    scrapAmount: 250,
  },
  {
    level: 7,
    id: 'milestone_lvl_7',
    title: 'Cobalt Strike Camo',
    description: 'Additional tank cosmetic featuring cobalt plating & cyan trim (visual only).',
    type: 'cosmetic',
    cosmeticId: 'cobalt_strike',
  },
  {
    level: 10,
    id: 'milestone_lvl_10',
    title: 'Apex Obsidian Skin',
    description: 'Special mastery tank skin with obsidian armor & gold trim (visual only).',
    type: 'cosmetic',
    cosmeticId: 'apex_obsidian',
  },
];

export function calculateMatchXpBreakdown(
  result: Pick<MatchResult, 'victory' | 'eliminations' | 'placement'>,
  config: XpRewardConfig = XP_REWARD_CONFIG
): XpBreakdown {
  const completionXp = Math.max(0, Math.round(config.matchCompletionXp));
  const victoryBonusXp = result.victory ? Math.max(0, Math.round(config.victoryBonusXp)) : 0;
  const safeElims = Math.max(0, Math.floor(result.eliminations));
  const eliminationXp = safeElims * Math.max(0, Math.round(config.eliminationXp));
  const topThreeBonusXp =
    result.placement >= 1 && result.placement <= config.topThreeMaxPlacement
      ? Math.max(0, Math.round(config.topThreeBonusXp))
      : 0;

  return {
    completionXp,
    victoryBonusXp,
    eliminationXp,
    topThreeBonusXp,
    totalXp: completionXp + victoryBonusXp + eliminationXp + topThreeBonusXp,
  };
}

export function calculateMatchScrapBreakdown(
  result: Pick<MatchResult, 'victory' | 'eliminations' | 'placement' | 'damageDealt'>,
  config: ScrapRewardConfig = SCRAP_REWARD_CONFIG
): MatchScrapBreakdown {
  const completionScrap = Math.max(0, Math.round(config.matchCompletionScrap));
  const safeElims = Math.max(0, Math.floor(result.eliminations));
  const eliminationScrap = safeElims * Math.max(0, Math.round(config.eliminationScrap));
  const victoryBonusScrap = result.victory
    ? Math.max(0, Math.round(config.victoryBonusScrap))
    : 0;

  const placementIdx = Math.max(0, Math.floor(result.placement) - 1);
  const placementBonus = Math.max(
    0,
    Math.round(config.placementPerformanceBonuses[placementIdx] ?? 0)
  );
  const damageStep = Math.max(1, Math.round(config.damagePerBonusScrap));
  const damageBonus = Math.min(
    Math.max(0, Math.round(config.maxDamagePerformanceScrap)),
    Math.max(0, Math.floor(Math.max(0, result.damageDealt) / damageStep))
  );
  const performanceBonusScrap = placementBonus + damageBonus;

  return {
    completionScrap,
    eliminationScrap,
    victoryBonusScrap,
    performanceBonusScrap,
    totalScrap:
      completionScrap + eliminationScrap + victoryBonusScrap + performanceBonusScrap,
  };
}

export interface ProgressionConfigOverrides {
  xpConfig?: XpRewardConfig;
  scrapConfig?: ScrapRewardConfig;
  curveConfig?: LevelCurveConfig;
  milestones?: MilestoneRewardDefinition[];
}

/**
 * Centralized XP, leveling, and milestone reward service.
 * Idempotent per matchId: calling multiple times with the same matchId returns the existing state with alreadyProcessed=true.
 */
export function applyMatchProgression(
  prev: PlayerProgression,
  result: MatchResult,
  overrides: ProgressionConfigOverrides = {}
): { nextProgression: PlayerProgression; summary: MatchProgressionSummary } {
  const xpConfig = overrides.xpConfig ?? XP_REWARD_CONFIG;
  const curveConfig = overrides.curveConfig ?? LEVEL_CURVE_CONFIG;
  const milestones = overrides.milestones ?? MILESTONE_REWARDS;

  const matchId = result.matchId?.trim();
  const alreadyProcessed = Boolean(matchId && prev.processedMatchIds.includes(matchId));

  if (alreadyProcessed) {
    return {
      nextProgression: prev,
      summary: {
        matchId: matchId || 'unknown',
        xpBreakdown: {
          completionXp: 0,
          victoryBonusXp: 0,
          eliminationXp: 0,
          topThreeBonusXp: 0,
          totalXp: 0,
        },
        scrapBreakdown: {
          completionScrap: 0,
          eliminationScrap: 0,
          victoryBonusScrap: 0,
          performanceBonusScrap: 0,
          totalScrap: 0,
        },
        previousLevel: prev.level,
        newLevel: prev.level,
        previousXp: prev.xp,
        previousXpToNext: prev.xpToNext,
        newXp: prev.xp,
        newXpToNext: prev.xpToNext,
        levelsGained: 0,
        unlockedMilestones: [],
        scrapFromMatch: 0,
        scrapFromMilestones: 0,
        totalScrapAwarded: 0,
        alreadyProcessed: true,
      },
    };
  }

  const xpBreakdown = calculateMatchXpBreakdown(result, xpConfig);
  const computedScrapBreakdown =
    result.scrapBreakdown ??
    calculateMatchScrapBreakdown(result, overrides.scrapConfig ?? SCRAP_REWARD_CONFIG);

  const previousLevel = Math.max(curveConfig.startingLevel, Math.floor(prev.level));
  const previousXp = Math.max(0, Math.floor(prev.xp));
  const previousXpToNext = getXpRequiredForLevel(previousLevel, curveConfig);

  let newLevel = previousLevel;
  let newXp = previousXp + xpBreakdown.totalXp;
  let newXpToNext = previousXpToNext;

  while (newXp >= newXpToNext) {
    newXp -= newXpToNext;
    newLevel += 1;
    newXpToNext = getXpRequiredForLevel(newLevel, curveConfig);
  }

  const claimedLevels = new Set<number>(prev.claimedMilestoneLevels);
  const unlockedCosmetics = new Set<CosmeticId>(
    prev.unlockedCosmetics.length > 0 ? prev.unlockedCosmetics : ['default']
  );
  unlockedCosmetics.add('default');

  const unlockedMilestones: MilestoneRewardDefinition[] = [];
  let scrapFromMilestones = 0;

  for (const milestone of milestones) {
    if (milestone.level <= newLevel && !claimedLevels.has(milestone.level)) {
      claimedLevels.add(milestone.level);
      unlockedMilestones.push(milestone);
      if (milestone.type === 'currency' && milestone.scrapAmount) {
        scrapFromMilestones += Math.max(0, Math.round(milestone.scrapAmount));
      }
      if (milestone.type === 'cosmetic' && milestone.cosmeticId) {
        unlockedCosmetics.add(milestone.cosmeticId);
      }
    }
  }

  const scrapFromMatch = Math.max(0, Math.round(result.scrapEarned));
  const scrapBreakdown: MatchScrapBreakdown = result.scrapBreakdown
    ? result.scrapBreakdown
    : {
        ...computedScrapBreakdown,
        totalScrap: scrapFromMatch,
      };
  const totalScrapAwarded = scrapFromMatch + scrapFromMilestones;
  const safeElims = Math.max(0, Math.floor(result.eliminations));
  const safeSurvivalSec = Math.max(0, Math.floor(result.survivalSec));

  const bestPlacement =
    prev.bestPlacement === null
      ? result.placement
      : Math.min(prev.bestPlacement, result.placement);

  const updatedProcessedIds = matchId
    ? [matchId, ...prev.processedMatchIds].slice(0, 50)
    : prev.processedMatchIds;

  const nextProgression: PlayerProgression = {
    ...prev,
    level: newLevel,
    xp: newXp,
    xpToNext: newXpToNext,
    totalXpEarned: Math.max(0, prev.totalXpEarned) + xpBreakdown.totalXp,
    scrap: Math.max(0, prev.scrap) + totalScrapAwarded,
    totalScrapEarned: Math.max(0, prev.totalScrapEarned ?? 0) + totalScrapAwarded,
    matchesPlayed: Math.max(0, prev.matchesPlayed) + 1,
    wins: Math.max(0, prev.wins) + (result.victory ? 1 : 0),
    defeats: Math.max(0, prev.defeats ?? 0) + (result.victory ? 0 : 1),
    totalEliminations: Math.max(0, prev.totalEliminations) + safeElims,
    totalPlaytimeSec: Math.max(0, prev.totalPlaytimeSec) + safeSurvivalSec,
    bestPlacement,
    claimedMilestoneLevels: Array.from(claimedLevels).sort((a, b) => a - b),
    unlockedCosmetics: Array.from(unlockedCosmetics),
    processedMatchIds: updatedProcessedIds,
  };

  return {
    nextProgression,
    summary: {
      matchId: matchId || `match_${Date.now()}`,
      xpBreakdown,
      scrapBreakdown,
      previousLevel,
      newLevel,
      previousXp,
      previousXpToNext,
      newXp,
      newXpToNext,
      levelsGained: newLevel - previousLevel,
      unlockedMilestones,
      scrapFromMatch,
      scrapFromMilestones,
      totalScrapAwarded,
      alreadyProcessed: false,
    },
  };
}

export interface DirectRewardGrant {
  xp?: number;
  scrap?: number;
  cosmeticId?: CosmeticId;
}

export interface DirectRewardResult {
  nextProgression: PlayerProgression;
  xpAwarded: number;
  scrapAwarded: number;
  cosmeticUnlocked: CosmeticId | null;
  previousLevel: number;
  newLevel: number;
  levelsGained: number;
  unlockedMilestones: MilestoneRewardDefinition[];
}

/**
 * Centralized reward distributor used by missions, achievements, and bonus claims.
 * Applies XP through the exact same leveling curve and grants level milestones automatically.
 */
export function grantProgressionRewards(
  prev: PlayerProgression,
  reward: DirectRewardGrant,
  overrides: ProgressionConfigOverrides = {}
): DirectRewardResult {
  const curveConfig = overrides.curveConfig ?? LEVEL_CURVE_CONFIG;
  const milestones = overrides.milestones ?? MILESTONE_REWARDS;

  const xpAwarded = Math.max(0, Math.round(reward.xp ?? 0));
  const baseScrapAwarded = Math.max(0, Math.round(reward.scrap ?? 0));

  const previousLevel = Math.max(curveConfig.startingLevel, Math.floor(prev.level));
  let newLevel = previousLevel;
  let newXp = Math.max(0, Math.floor(prev.xp)) + xpAwarded;
  let newXpToNext = getXpRequiredForLevel(previousLevel, curveConfig);

  while (newXp >= newXpToNext) {
    newXp -= newXpToNext;
    newLevel += 1;
    newXpToNext = getXpRequiredForLevel(newLevel, curveConfig);
  }

  const claimedLevels = new Set<number>(prev.claimedMilestoneLevels);
  const unlockedCosmetics = new Set<CosmeticId>(
    prev.unlockedCosmetics.length > 0 ? prev.unlockedCosmetics : ['default']
  );
  unlockedCosmetics.add('default');

  const unlockedMilestones: MilestoneRewardDefinition[] = [];
  let scrapFromMilestones = 0;

  for (const milestone of milestones) {
    if (milestone.level <= newLevel && !claimedLevels.has(milestone.level)) {
      claimedLevels.add(milestone.level);
      unlockedMilestones.push(milestone);
      if (milestone.type === 'currency' && milestone.scrapAmount) {
        scrapFromMilestones += Math.max(0, Math.round(milestone.scrapAmount));
      }
      if (milestone.type === 'cosmetic' && milestone.cosmeticId) {
        unlockedCosmetics.add(milestone.cosmeticId);
      }
    }
  }

  let cosmeticUnlocked: CosmeticId | null = null;
  if (reward.cosmeticId && reward.cosmeticId in COSMETIC_DEFINITIONS) {
    if (!unlockedCosmetics.has(reward.cosmeticId)) {
      cosmeticUnlocked = reward.cosmeticId;
    }
    unlockedCosmetics.add(reward.cosmeticId);
  }

  const scrapAwarded = baseScrapAwarded + scrapFromMilestones;

  const nextProgression: PlayerProgression = {
    ...prev,
    level: newLevel,
    xp: newXp,
    xpToNext: newXpToNext,
    totalXpEarned: Math.max(0, prev.totalXpEarned) + xpAwarded,
    scrap: Math.max(0, prev.scrap) + scrapAwarded,
    totalScrapEarned: Math.max(0, prev.totalScrapEarned ?? 0) + scrapAwarded,
    claimedMilestoneLevels: Array.from(claimedLevels).sort((a, b) => a - b),
    unlockedCosmetics: Array.from(unlockedCosmetics),
  };

  return {
    nextProgression,
    xpAwarded,
    scrapAwarded,
    cosmeticUnlocked,
    previousLevel,
    newLevel,
    levelsGained: newLevel - previousLevel,
    unlockedMilestones,
  };
}

export function formatPlaytime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}
