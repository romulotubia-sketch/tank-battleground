import { platformBridge } from '../services/bridge/PlaygamaBridgeAdapter';
import {
  ActiveMissionProgress,
  AchievementProgress,
  ArenaId,
  CosmeticId,
  DecalPosition,
  GameSettings,
  GraphicsQuality,
  MatchProgressionSummary,
  MatchResult,
  MissionsState,
  PeriodTrackingData,
  PermanentTrackingData,
  PlayerProgression,
  PurchaseOutcome,
  SaveFeedbackEvent,
  TankCustomization,
  TankDecalId,
  TankId,
} from '../types/game';
import {
  DECAL_POSITION_OPTIONS,
  normalizeHexColor,
  STARTER_DECAL_IDS,
  STARTER_PAINT_COLORS,
  TANK_DECAL_MAP,
  TANK_PRESET_MAP,
} from './customization';
import {
  applyRewardedAdScrap,
  purchaseCustomPaintStudioWithScrap,
  purchaseDecalWithScrap,
  purchasePaintColorWithScrap,
  purchasePresetWithScrap,
  purchaseSpecialCosmeticWithScrap,
  purchaseTankWithScrap,
  REWARDED_AD_BONUS_SCRAP,
} from './economy';
import {
  ACHIEVEMENT_DEFINITIONS,
  ALL_MISSION_DEFINITIONS,
  createEmptyPeriodTracking,
  createEmptyPermanentTracking,
  createInitialAchievementsRecord,
  createInitialMissionsState,
  ensureMissionPeriodsCurrent,
  MISSIONS_SAVE_VERSION,
  MissionServiceOptions,
} from './missions';
import {
  applyMatchProgression,
  COSMETIC_DEFINITIONS,
  getXpRequiredForLevel,
  ProgressionConfigOverrides,
} from './progression';
import { TANK_DEFINITIONS, TANK_LIST } from './tanks';

export const PROGRESSION_KEY = 'tankbound_arena_progression_v1';
export const PROGRESSION_BACKUP_KEY = 'tankbound_arena_progression_backup_v1';
export const MISSIONS_KEY = 'tankbound_arena_missions_v1';
export const MISSIONS_BACKUP_KEY = 'tankbound_arena_missions_backup_v1';
export const SETTINGS_KEY = 'tankbound_arena_settings_v1';
export const CURRENT_SAVE_VERSION = 4;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const sessionFallbackMap = new Map<string, string>();
const sessionFallbackStorage: StorageLike = {
  getItem(key: string) {
    return sessionFallbackMap.has(key) ? sessionFallbackMap.get(key)! : null;
  },
  setItem(key: string, value: string) {
    sessionFallbackMap.set(key, value);
  },
  removeItem(key: string) {
    sessionFallbackMap.delete(key);
  },
};

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      const testKey = '__tankbound_storage_probe__';
      globalThis.localStorage.setItem(testKey, '1');
      globalThis.localStorage.removeItem(testKey);
      return globalThis.localStorage;
    }
  } catch {
    // Sandboxed iframe or private mode blocked localStorage — use safe in-memory fallback
    return sessionFallbackStorage;
  }
  return sessionFallbackStorage;
}

type SaveListener = (event: SaveFeedbackEvent) => void;
const saveListeners = new Set<SaveListener>();

export function subscribeSaveEvents(listener: SaveListener): () => void {
  saveListeners.add(listener);
  return () => {
    saveListeners.delete(listener);
  };
}

function emitSaveEvent(event: SaveFeedbackEvent): void {
  for (const listener of saveListeners) {
    try {
      listener(event);
    } catch {
      // Never break save flow due to UI listener errors
    }
  }
}

export function createDefaultProgression(): PlayerProgression {
  const level = 1;
  const starterTanks = TANK_LIST.filter((t) => t.isStarter && t.implemented).map((t) => t.id);
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    playerName: 'Commander',
    level,
    xp: 0,
    xpToNext: getXpRequiredForLevel(level),
    totalXpEarned: 0,
    unlockedTanks: starterTanks.length > 0 ? starterTanks : ['assault'],
    selectedTank: 'assault',
    selectedArena: 'training_grounds',
    scrap: 0,
    totalScrapEarned: 0,
    totalScrapSpent: 0,
    matchesPlayed: 0,
    wins: 0,
    defeats: 0,
    totalEliminations: 0,
    totalPlaytimeSec: 0,
    bestPlacement: null,
    claimedMilestoneLevels: [],
    unlockedCosmetics: ['default'],
    equippedCosmetic: 'default',
    unlockedPaintColors: [...STARTER_PAINT_COLORS],
    unlockedDecals: [...STARTER_DECAL_IDS],
    unlockedPresets: [],
    customPaintUnlocked: false,
    tankCustomizations: {},
    processedMatchIds: [],
    processedRewardedAdIds: [],
  };
}

export const DEFAULT_PROGRESSION: PlayerProgression = createDefaultProgression();

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  soundVolume: 0.65,
  musicEnabled: true,
  musicVolume: 0.4,
  graphicsQuality: 'high',
  screenShakeEnabled: true,
  vibrationEnabled: true,
  controlSensitivity: 1.0,
  showTouchControls: 'always',
  autoFireOnAim: true,
  lowDetailMode: false,
  matchDurationSec: 150,
  landscapePromptEnabled: true,
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function estimateCumulativeXpForLevel(level: number, currentXp: number): number {
  let sum = Math.max(0, currentXp);
  for (let l = 1; l < level; l++) {
    sum += getXpRequiredForLevel(l);
  }
  return sum;
}

const VALID_DECAL_POSITIONS: DecalPosition[] = DECAL_POSITION_OPTIONS.map((p) => p.id);

function normalizeTankCustomizationEntry(
  tankId: TankId,
  raw: unknown
): TankCustomization | null {
  if (!isPlainRecord(raw)) return null;
  const def = TANK_DEFINITIONS[tankId];
  if (!def) return null;
  const decalId: TankDecalId =
    typeof raw.decalId === 'string' && raw.decalId in TANK_DECAL_MAP
      ? (raw.decalId as TankDecalId)
      : 'none';
  const decalPosition: DecalPosition =
    typeof raw.decalPosition === 'string' &&
    VALID_DECAL_POSITIONS.includes(raw.decalPosition as DecalPosition)
      ? (raw.decalPosition as DecalPosition)
      : 'turret_top';
  const presetId =
    typeof raw.presetId === 'string' && raw.presetId in TANK_PRESET_MAP
      ? raw.presetId
      : null;

  return {
    primaryColor: normalizeHexColor(
      typeof raw.primaryColor === 'string' ? raw.primaryColor : undefined,
      def.visual.hullPrimary
    ),
    secondaryColor: normalizeHexColor(
      typeof raw.secondaryColor === 'string' ? raw.secondaryColor : undefined,
      def.visual.hullSecondary
    ),
    turretColor: normalizeHexColor(
      typeof raw.turretColor === 'string' ? raw.turretColor : undefined,
      def.visual.turretColor
    ),
    barrelColor: normalizeHexColor(
      typeof raw.barrelColor === 'string' ? raw.barrelColor : undefined,
      def.visual.barrelColor ?? def.visual.hullSecondary
    ),
    decalId,
    decalPosition,
    decalColor: normalizeHexColor(
      typeof raw.decalColor === 'string' ? raw.decalColor : undefined,
      def.visual.accentColor
    ),
    presetId,
  };
}

function normalizeProgression(parsed: Record<string, unknown>): PlayerProgression {
  const defaults = createDefaultProgression();
  const parsedVersion =
    typeof parsed.saveVersion === 'number' && Number.isFinite(parsed.saveVersion)
      ? Math.floor(parsed.saveVersion)
      : 1;

  const rawUnlocked = Array.isArray(parsed.unlockedTanks)
    ? Array.from(
        new Set(
          parsed.unlockedTanks.filter(
            (id): id is TankId =>
              typeof id === 'string' && Boolean(TANK_DEFINITIONS[id as TankId]?.implemented)
          )
        )
      )
    : [...defaults.unlockedTanks];

  for (const def of TANK_LIST) {
    if (def.implemented && def.isStarter && !rawUnlocked.includes(def.id)) {
      rawUnlocked.push(def.id);
    }
  }

  // Preserve legacy active tank unlock on pre-v3 saves (v1/v2 saves could select any tank)
  if (
    parsedVersion < 3 &&
    typeof parsed.selectedTank === 'string' &&
    TANK_DEFINITIONS[parsed.selectedTank as TankId]?.implemented &&
    !rawUnlocked.includes(parsed.selectedTank as TankId)
  ) {
    rawUnlocked.push(parsed.selectedTank as TankId);
  }

  const selectedTank: TankId =
    typeof parsed.selectedTank === 'string' &&
    rawUnlocked.includes(parsed.selectedTank as TankId) &&
    TANK_DEFINITIONS[parsed.selectedTank as TankId]?.implemented
      ? (parsed.selectedTank as TankId)
      : defaults.selectedTank;

  const validArenas: ArenaId[] = ['training_grounds', 'industrial_zone', 'wasteland'];
  const selectedArena: ArenaId =
    typeof parsed.selectedArena === 'string' && validArenas.includes(parsed.selectedArena as ArenaId)
      ? (parsed.selectedArena as ArenaId)
      : defaults.selectedArena;

  const rawName = typeof parsed.playerName === 'string' ? parsed.playerName.trim() : '';
  const playerName = rawName.length > 0 ? rawName.slice(0, 20) : defaults.playerName;

  const level =
    typeof parsed.level === 'number' && Number.isFinite(parsed.level) && parsed.level >= 1
      ? Math.floor(parsed.level)
      : defaults.level;

  const xp =
    typeof parsed.xp === 'number' && Number.isFinite(parsed.xp) && parsed.xp >= 0
      ? Math.floor(parsed.xp)
      : defaults.xp;

  const xpToNext = getXpRequiredForLevel(level);

  const totalXpEarned =
    typeof parsed.totalXpEarned === 'number' &&
    Number.isFinite(parsed.totalXpEarned) &&
    parsed.totalXpEarned >= 0
      ? Math.floor(parsed.totalXpEarned)
      : estimateCumulativeXpForLevel(level, xp);

  const claimedMilestoneLevels = Array.isArray(parsed.claimedMilestoneLevels)
    ? Array.from(
        new Set(
          parsed.claimedMilestoneLevels.filter(
            (lvl): lvl is number => typeof lvl === 'number' && Number.isFinite(lvl) && lvl >= 1
          )
        )
      ).sort((a, b) => a - b)
    : [];

  const unlockedCosmeticsSet = new Set<CosmeticId>(['default']);
  if (Array.isArray(parsed.unlockedCosmetics)) {
    for (const item of parsed.unlockedCosmetics) {
      if (typeof item === 'string' && item in COSMETIC_DEFINITIONS) {
        unlockedCosmeticsSet.add(item as CosmeticId);
      }
    }
  }
  const unlockedCosmetics = Array.from(unlockedCosmeticsSet);

  const equippedCosmetic: CosmeticId =
    typeof parsed.equippedCosmetic === 'string' &&
    unlockedCosmetics.includes(parsed.equippedCosmetic as CosmeticId)
      ? (parsed.equippedCosmetic as CosmeticId)
      : 'default';

  const processedMatchIds = Array.isArray(parsed.processedMatchIds)
    ? parsed.processedMatchIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .slice(0, 50)
    : [];

  const processedRewardedAdIds = Array.isArray(parsed.processedRewardedAdIds)
    ? parsed.processedRewardedAdIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .slice(0, 50)
    : [];

  const unlockedPaintSet = new Set<string>(STARTER_PAINT_COLORS);
  if (Array.isArray(parsed.unlockedPaintColors)) {
    for (const hex of parsed.unlockedPaintColors) {
      if (typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex.trim())) {
        unlockedPaintSet.add(hex.trim().toUpperCase());
      }
    }
  }

  const unlockedDecalSet = new Set<TankDecalId>(STARTER_DECAL_IDS);
  if (Array.isArray(parsed.unlockedDecals)) {
    for (const id of parsed.unlockedDecals) {
      if (typeof id === 'string' && id in TANK_DECAL_MAP) {
        unlockedDecalSet.add(id as TankDecalId);
      }
    }
  }

  const unlockedPresetSet = new Set<string>();
  if (Array.isArray(parsed.unlockedPresets)) {
    for (const id of parsed.unlockedPresets) {
      if (typeof id === 'string' && id in TANK_PRESET_MAP) {
        unlockedPresetSet.add(id);
      }
    }
  }

  const customPaintUnlocked = Boolean(parsed.customPaintUnlocked);

  const tankCustomizations: Partial<Record<TankId, TankCustomization>> = {};
  if (isPlainRecord(parsed.tankCustomizations)) {
    for (const def of TANK_LIST) {
      const normalizedCustom = normalizeTankCustomizationEntry(
        def.id,
        parsed.tankCustomizations[def.id]
      );
      if (normalizedCustom) {
        tankCustomizations[def.id] = normalizedCustom;
      }
    }
  }

  const scrap =
    typeof parsed.scrap === 'number' && Number.isFinite(parsed.scrap)
      ? Math.max(0, Math.floor(parsed.scrap))
      : 0;

  const totalScrapEarned =
    typeof parsed.totalScrapEarned === 'number' &&
    Number.isFinite(parsed.totalScrapEarned) &&
    parsed.totalScrapEarned >= 0
      ? Math.floor(parsed.totalScrapEarned)
      : scrap;

  const totalScrapSpent =
    typeof parsed.totalScrapSpent === 'number' &&
    Number.isFinite(parsed.totalScrapSpent) &&
    parsed.totalScrapSpent >= 0
      ? Math.floor(parsed.totalScrapSpent)
      : 0;

  const wins =
    typeof parsed.wins === 'number' && Number.isFinite(parsed.wins)
      ? Math.max(0, Math.floor(parsed.wins))
      : 0;

  const rawMatchesPlayed =
    typeof parsed.matchesPlayed === 'number' && Number.isFinite(parsed.matchesPlayed)
      ? Math.max(0, Math.floor(parsed.matchesPlayed))
      : 0;

  const defeats =
    typeof parsed.defeats === 'number' && Number.isFinite(parsed.defeats) && parsed.defeats >= 0
      ? Math.floor(parsed.defeats)
      : Math.max(0, rawMatchesPlayed - wins);

  const matchesPlayed = Math.max(rawMatchesPlayed, wins + defeats);

  return {
    saveVersion: CURRENT_SAVE_VERSION,
    playerName,
    level,
    xp,
    xpToNext,
    totalXpEarned,
    unlockedTanks: rawUnlocked,
    selectedTank,
    selectedArena,
    scrap,
    totalScrapEarned,
    totalScrapSpent,
    matchesPlayed,
    wins,
    defeats,
    totalEliminations:
      typeof parsed.totalEliminations === 'number' && Number.isFinite(parsed.totalEliminations)
        ? Math.max(0, Math.floor(parsed.totalEliminations))
        : 0,
    totalPlaytimeSec:
      typeof parsed.totalPlaytimeSec === 'number' && Number.isFinite(parsed.totalPlaytimeSec)
        ? Math.max(0, Math.floor(parsed.totalPlaytimeSec))
        : 0,
    bestPlacement:
      typeof parsed.bestPlacement === 'number' &&
      Number.isFinite(parsed.bestPlacement) &&
      parsed.bestPlacement >= 1
        ? Math.floor(parsed.bestPlacement)
        : null,
    claimedMilestoneLevels,
    unlockedCosmetics,
    equippedCosmetic,
    unlockedPaintColors: Array.from(unlockedPaintSet),
    unlockedDecals: Array.from(unlockedDecalSet),
    unlockedPresets: Array.from(unlockedPresetSet),
    customPaintUnlocked,
    tankCustomizations,
    processedMatchIds,
    processedRewardedAdIds,
  };
}

export type LoadStatus = 'loaded' | 'new' | 'recovered_backup' | 'corrupt_fallback' | 'storage_error';

export interface LoadProgressionOutcome {
  progression: PlayerProgression;
  status: LoadStatus;
}

function tryParseProgressionRaw(raw: string | null): PlayerProgression | null {
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!isPlainRecord(parsed)) return null;
  return normalizeProgression(parsed);
}

/**
 * Loads player progression safely without ever overwriting stored data on load failure.
 */
export function loadProgressionSafe(
  storage: StorageLike | null = getDefaultStorage()
): LoadProgressionOutcome {
  if (!storage) {
    return { progression: createDefaultProgression(), status: 'storage_error' };
  }

  let rawPrimary: string | null = null;
  try {
    rawPrimary = storage.getItem(PROGRESSION_KEY);
  } catch {
    return { progression: createDefaultProgression(), status: 'storage_error' };
  }

  if (rawPrimary === null) {
    // Check if backup exists before assuming new player
    try {
      const backup = tryParseProgressionRaw(storage.getItem(PROGRESSION_BACKUP_KEY));
      if (backup) {
        return { progression: backup, status: 'recovered_backup' };
      }
    } catch {
      // Ignore backup read errors
    }
    return { progression: createDefaultProgression(), status: 'new' };
  }

  try {
    const primary = tryParseProgressionRaw(rawPrimary);
    if (primary) {
      return { progression: primary, status: 'loaded' };
    }
  } catch {
    // Corrupted primary JSON — fall through to backup without overwriting primary
  }

  try {
    const backup = tryParseProgressionRaw(storage.getItem(PROGRESSION_BACKUP_KEY));
    if (backup) {
      return { progression: backup, status: 'recovered_backup' };
    }
  } catch {
    // Ignore backup errors
  }

  // IMPORTANT: Do NOT call saveProgression() here so valid/corrupt user data is never overwritten on load failures.
  return { progression: createDefaultProgression(), status: 'corrupt_fallback' };
}

export function loadProgression(
  storage: StorageLike | null = getDefaultStorage()
): PlayerProgression {
  return loadProgressionSafe(storage).progression;
}

export function saveProgression(
  progression: PlayerProgression,
  storage: StorageLike | null = getDefaultStorage()
): boolean {
  if (!storage) {
    emitSaveEvent({ status: 'error', scope: 'progression', timestampMs: Date.now() });
    return false;
  }
  try {
    const normalized = normalizeProgression({
      ...progression,
      saveVersion: CURRENT_SAVE_VERSION,
      xpToNext: getXpRequiredForLevel(progression.level),
    } as unknown as Record<string, unknown>);
    const serialized = JSON.stringify(normalized);
    // Validate JSON round-trip before writing so interrupted/invalid serializations never corrupt disk
    JSON.parse(serialized);
    storage.setItem(PROGRESSION_KEY, serialized);
    try {
      storage.setItem(PROGRESSION_BACKUP_KEY, serialized);
    } catch {
      // Backup write is best-effort
    }
    if (storage !== sessionFallbackStorage) {
      platformBridge.syncSaveKey(PROGRESSION_KEY, serialized);
    }
    emitSaveEvent({ status: 'saved', scope: 'progression', timestampMs: Date.now() });
    return true;
  } catch {
    emitSaveEvent({ status: 'error', scope: 'progression', timestampMs: Date.now() });
    return false;
  }
}

export function applyMatchResultToProgression(
  prev: PlayerProgression,
  result: MatchResult,
  storage: StorageLike | null = getDefaultStorage(),
  overrides?: ProgressionConfigOverrides
): { progression: PlayerProgression; summary: MatchProgressionSummary } {
  const { nextProgression, summary } = applyMatchProgression(prev, result, overrides);
  if (!summary.alreadyProcessed) {
    saveProgression(nextProgression, storage);
  }
  return { progression: nextProgression, summary };
}

export function updatePlayerDisplayName(
  prev: PlayerProgression,
  rawName: string,
  storage: StorageLike | null = getDefaultStorage()
): PlayerProgression {
  const trimmed = rawName.trim().slice(0, 20);
  if (!trimmed) return prev;
  const next: PlayerProgression = {
    ...prev,
    playerName: trimmed,
  };
  saveProgression(next, storage);
  return next;
}

export function equipPlayerCosmetic(
  prev: PlayerProgression,
  cosmeticId: CosmeticId,
  storage: StorageLike | null = getDefaultStorage()
): PlayerProgression {
  if (cosmeticId !== 'default' && !prev.unlockedCosmetics.includes(cosmeticId)) {
    return prev;
  }
  const next: PlayerProgression = {
    ...prev,
    equippedCosmetic: cosmeticId,
  };
  saveProgression(next, storage);
  return next;
}

export function buyTankWithScrap(
  prev: PlayerProgression,
  tankId: TankId,
  storage: StorageLike | null = getDefaultStorage()
): PurchaseOutcome {
  const outcome = purchaseTankWithScrap(prev, tankId);
  if (outcome.success) {
    saveProgression(outcome.nextProgression, storage);
  }
  return outcome;
}

export function buyPaintColorWithScrap(
  prev: PlayerProgression,
  hex: string,
  storage: StorageLike | null = getDefaultStorage()
): PurchaseOutcome {
  const outcome = purchasePaintColorWithScrap(prev, hex);
  if (outcome.success) {
    saveProgression(outcome.nextProgression, storage);
  }
  return outcome;
}

export function buyCustomPaintStudioWithScrap(
  prev: PlayerProgression,
  storage: StorageLike | null = getDefaultStorage()
): PurchaseOutcome {
  const outcome = purchaseCustomPaintStudioWithScrap(prev);
  if (outcome.success) {
    saveProgression(outcome.nextProgression, storage);
  }
  return outcome;
}

export function buyDecalWithScrap(
  prev: PlayerProgression,
  decalId: TankDecalId,
  storage: StorageLike | null = getDefaultStorage()
): PurchaseOutcome {
  const outcome = purchaseDecalWithScrap(prev, decalId);
  if (outcome.success) {
    saveProgression(outcome.nextProgression, storage);
  }
  return outcome;
}

export function buyPresetWithScrap(
  prev: PlayerProgression,
  presetId: string,
  storage: StorageLike | null = getDefaultStorage()
): PurchaseOutcome {
  const outcome = purchasePresetWithScrap(prev, presetId);
  if (outcome.success) {
    saveProgression(outcome.nextProgression, storage);
  }
  return outcome;
}

export function buySpecialCosmeticWithScrap(
  prev: PlayerProgression,
  cosmeticId: CosmeticId,
  storage: StorageLike | null = getDefaultStorage()
): PurchaseOutcome {
  const outcome = purchaseSpecialCosmeticWithScrap(prev, cosmeticId);
  if (outcome.success) {
    saveProgression(outcome.nextProgression, storage);
  }
  return outcome;
}

export function grantRewardedAdScrap(
  prev: PlayerProgression,
  grantId: string,
  amount: number = REWARDED_AD_BONUS_SCRAP,
  storage: StorageLike | null = getDefaultStorage()
): { granted: boolean; amountAwarded: number; nextProgression: PlayerProgression } {
  const res = applyRewardedAdScrap(prev, grantId, amount);
  if (res.granted) {
    saveProgression(res.nextProgression, storage);
  }
  return res;
}

export function saveTankCustomization(
  prev: PlayerProgression,
  tankId: TankId,
  customization: TankCustomization,
  storage: StorageLike | null = getDefaultStorage()
): PlayerProgression {
  if (!TANK_DEFINITIONS[tankId]?.implemented) return prev;
  const next: PlayerProgression = {
    ...prev,
    tankCustomizations: {
      ...prev.tankCustomizations,
      [tankId]: { ...customization },
    },
  };
  saveProgression(next, storage);
  return next;
}

export function resetSavedTankCustomization(
  prev: PlayerProgression,
  tankId: TankId,
  storage: StorageLike | null = getDefaultStorage()
): PlayerProgression {
  if (!(tankId in prev.tankCustomizations)) return prev;
  const updated = { ...prev.tankCustomizations };
  delete updated[tankId];
  const next: PlayerProgression = {
    ...prev,
    tankCustomizations: updated,
  };
  saveProgression(next, storage);
  return next;
}

export function loadSettings(
  storage: StorageLike | null = getDefaultStorage()
): GameSettings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    if (!isPlainRecord(parsed)) return { ...DEFAULT_SETTINGS };

    const validQualities: GraphicsQuality[] = ['low', 'medium', 'high'];
    const graphicsQuality: GraphicsQuality =
      parsed.graphicsQuality && validQualities.includes(parsed.graphicsQuality)
        ? parsed.graphicsQuality
        : parsed.lowDetailMode === true
        ? 'low'
        : DEFAULT_SETTINGS.graphicsQuality;

    return {
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
      soundVolume:
        typeof parsed.soundVolume === 'number'
          ? Math.min(1, Math.max(0, parsed.soundVolume))
          : DEFAULT_SETTINGS.soundVolume,
      musicEnabled:
        typeof parsed.musicEnabled === 'boolean'
          ? parsed.musicEnabled
          : DEFAULT_SETTINGS.musicEnabled,
      musicVolume:
        typeof parsed.musicVolume === 'number'
          ? Math.min(1, Math.max(0, parsed.musicVolume))
          : DEFAULT_SETTINGS.musicVolume,
      graphicsQuality,
      screenShakeEnabled:
        typeof parsed.screenShakeEnabled === 'boolean'
          ? parsed.screenShakeEnabled
          : DEFAULT_SETTINGS.screenShakeEnabled,
      vibrationEnabled:
        typeof parsed.vibrationEnabled === 'boolean'
          ? parsed.vibrationEnabled
          : DEFAULT_SETTINGS.vibrationEnabled,
      controlSensitivity:
        typeof parsed.controlSensitivity === 'number'
          ? Math.min(1.5, Math.max(0.6, parsed.controlSensitivity))
          : DEFAULT_SETTINGS.controlSensitivity,
      showTouchControls:
        parsed.showTouchControls === 'auto' || parsed.showTouchControls === 'always'
          ? parsed.showTouchControls
          : DEFAULT_SETTINGS.showTouchControls,
      autoFireOnAim:
        typeof parsed.autoFireOnAim === 'boolean'
          ? parsed.autoFireOnAim
          : DEFAULT_SETTINGS.autoFireOnAim,
      lowDetailMode: graphicsQuality === 'low',
      matchDurationSec:
        typeof parsed.matchDurationSec === 'number' &&
        parsed.matchDurationSec >= 60 &&
        parsed.matchDurationSec <= 300
          ? parsed.matchDurationSec
          : DEFAULT_SETTINGS.matchDurationSec,
      landscapePromptEnabled:
        typeof parsed.landscapePromptEnabled === 'boolean'
          ? parsed.landscapePromptEnabled
          : DEFAULT_SETTINGS.landscapePromptEnabled,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(
  settings: GameSettings,
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage) return;
  try {
    const normalized: GameSettings = {
      ...settings,
      lowDetailMode: settings.graphicsQuality === 'low',
    };
    const serialized = JSON.stringify(normalized);
    storage.setItem(SETTINGS_KEY, serialized);
    if (storage !== sessionFallbackStorage) {
      platformBridge.syncSaveKey(SETTINGS_KEY, serialized);
    }
    emitSaveEvent({ status: 'saved', scope: 'settings', timestampMs: Date.now() });
  } catch {
    emitSaveEvent({ status: 'error', scope: 'settings', timestampMs: Date.now() });
  }
}

export function resetSettingsToDefault(
  storage: StorageLike | null = getDefaultStorage()
): GameSettings {
  const defaults: GameSettings = { ...DEFAULT_SETTINGS };
  saveSettings(defaults, storage);
  return defaults;
}

const VALID_ARENA_IDS: ArenaId[] = ['training_grounds', 'industrial_zone', 'wasteland'];

function normalizePeriodTracking(raw: unknown): PeriodTrackingData {
  if (!isPlainRecord(raw)) return createEmptyPeriodTracking();
  const uniqueTanks = Array.isArray(raw.uniqueTanks)
    ? Array.from(
        new Set(
          raw.uniqueTanks.filter(
            (id): id is TankId =>
              typeof id === 'string' && Boolean(TANK_DEFINITIONS[id as TankId]?.implemented)
          )
        )
      )
    : [];
  const uniqueArenas = Array.isArray(raw.uniqueArenas)
    ? Array.from(
        new Set(
          raw.uniqueArenas.filter(
            (id): id is ArenaId =>
              typeof id === 'string' && VALID_ARENA_IDS.includes(id as ArenaId)
          )
        )
      )
    : [];
  return { uniqueTanks, uniqueArenas };
}

function normalizePermanentTracking(
  raw: unknown,
  seedProgression?: Partial<PlayerProgression>
): PermanentTrackingData {
  const base = createEmptyPermanentTracking();
  if (!isPlainRecord(raw)) {
    if (seedProgression) {
      base.eliminations = Math.max(0, seedProgression.totalEliminations ?? 0);
      base.wins = Math.max(0, seedProgression.wins ?? 0);
      base.matchesCompleted = Math.max(0, seedProgression.matchesPlayed ?? 0);
    }
    return base;
  }

  const readCount = (v: unknown, fallback = 0) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;

  const uniqueTanks = Array.isArray(raw.uniqueTanks)
    ? Array.from(
        new Set(
          raw.uniqueTanks.filter(
            (id): id is TankId =>
              typeof id === 'string' && Boolean(TANK_DEFINITIONS[id as TankId]?.implemented)
          )
        )
      )
    : [];
  const uniqueArenas = Array.isArray(raw.uniqueArenas)
    ? Array.from(
        new Set(
          raw.uniqueArenas.filter(
            (id): id is ArenaId =>
              typeof id === 'string' && VALID_ARENA_IDS.includes(id as ArenaId)
          )
        )
      )
    : [];

  return {
    matchesStarted: readCount(raw.matchesStarted),
    matchesCompleted: readCount(raw.matchesCompleted, seedProgression?.matchesPlayed ?? 0),
    wins: readCount(raw.wins, seedProgression?.wins ?? 0),
    eliminations: readCount(raw.eliminations, seedProgression?.totalEliminations ?? 0),
    powerupsCollected: readCount(raw.powerupsCollected),
    abilitiesActivated: readCount(raw.abilitiesActivated),
    obstaclesDestroyed: readCount(raw.obstaclesDestroyed),
    uniqueTanks,
    uniqueArenas,
  };
}

function normalizeMissionEntries(
  raw: unknown,
  scope: 'daily' | 'weekly',
  fallbackEntries: ActiveMissionProgress[]
): ActiveMissionProgress[] {
  if (!Array.isArray(raw)) return fallbackEntries;
  const parsed: ActiveMissionProgress[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isPlainRecord(item) || typeof item.missionId !== 'string') continue;
    const def = ALL_MISSION_DEFINITIONS[item.missionId];
    if (!def || def.scope !== scope || seen.has(def.id)) continue;
    seen.add(def.id);
    const progress =
      typeof item.progress === 'number' && Number.isFinite(item.progress) && item.progress >= 0
        ? Math.min(def.target, Math.floor(item.progress))
        : 0;
    const completed = Boolean(item.completed) || progress >= def.target;
    const claimed = completed && Boolean(item.claimed);
    const claimedAtMs =
      claimed && typeof item.claimedAtMs === 'number' && Number.isFinite(item.claimedAtMs)
        ? item.claimedAtMs
        : null;
    parsed.push({
      missionId: def.id,
      progress: completed ? def.target : progress,
      completed,
      claimed,
      claimedAtMs,
    });
  }
  return parsed.length > 0 ? parsed : fallbackEntries;
}

function normalizeMissionsState(
  parsed: Record<string, unknown>,
  nowMs: number,
  options: MissionServiceOptions,
  seedProgression?: Partial<PlayerProgression>
): MissionsState {
  const fresh = createInitialMissionsState(nowMs, options, seedProgression);

  const dailyPeriodKey =
    typeof parsed.dailyPeriodKey === 'string' && parsed.dailyPeriodKey.trim().length > 0
      ? parsed.dailyPeriodKey.trim()
      : fresh.dailyPeriodKey;

  const weeklyPeriodKey =
    typeof parsed.weeklyPeriodKey === 'string' && parsed.weeklyPeriodKey.trim().length > 0
      ? parsed.weeklyPeriodKey.trim()
      : fresh.weeklyPeriodKey;

  const dailyMissions = normalizeMissionEntries(parsed.dailyMissions, 'daily', fresh.dailyMissions);
  const weeklyMissions = normalizeMissionEntries(
    parsed.weeklyMissions,
    'weekly',
    fresh.weeklyMissions
  );

  const rawAch = isPlainRecord(parsed.achievements) ? parsed.achievements : {};
  const fallbackAch = createInitialAchievementsRecord(ACHIEVEMENT_DEFINITIONS, seedProgression);
  const achievements: Record<string, AchievementProgress> = {};
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    const entry = rawAch[def.id];
    if (!isPlainRecord(entry)) {
      achievements[def.id] = fallbackAch[def.id];
      continue;
    }
    const progress =
      typeof entry.progress === 'number' && Number.isFinite(entry.progress) && entry.progress >= 0
        ? Math.min(def.target, Math.floor(entry.progress))
        : 0;
    const completed = Boolean(entry.completed) || progress >= def.target;
    const claimed = completed && Boolean(entry.claimed);
    achievements[def.id] = {
      achievementId: def.id,
      progress: completed ? def.target : progress,
      completed,
      unlockedAtMs:
        completed && typeof entry.unlockedAtMs === 'number' && Number.isFinite(entry.unlockedAtMs)
          ? entry.unlockedAtMs
          : completed
          ? nowMs
          : null,
      claimed,
      claimedAtMs:
        claimed && typeof entry.claimedAtMs === 'number' && Number.isFinite(entry.claimedAtMs)
          ? entry.claimedAtMs
          : null,
    };
  }

  const processedEventIds = Array.isArray(parsed.processedEventIds)
    ? parsed.processedEventIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .slice(0, 250)
    : [];

  const normalized: MissionsState = {
    saveVersion: MISSIONS_SAVE_VERSION,
    dailyPeriodKey,
    dailyMissions,
    dailyTracking: normalizePeriodTracking(parsed.dailyTracking),
    weeklyPeriodKey,
    weeklyMissions,
    weeklyTracking: normalizePeriodTracking(parsed.weeklyTracking),
    achievements,
    permanentTracking: normalizePermanentTracking(parsed.permanentTracking, seedProgression),
    processedEventIds,
  };

  return ensureMissionPeriodsCurrent(normalized, nowMs, options).state;
}

function tryParseMissionsRaw(
  raw: string | null,
  nowMs: number,
  options: MissionServiceOptions,
  seedProgression?: Partial<PlayerProgression>
): MissionsState | null {
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!isPlainRecord(parsed)) return null;
  return normalizeMissionsState(parsed, nowMs, options, seedProgression);
}

export interface LoadMissionsOutcome {
  missions: MissionsState;
  status: LoadStatus;
}

/**
 * Loads missions & achievements safely without overwriting corrupt storage data.
 * Automatically refreshes expired daily/weekly missions while keeping permanent achievements intact.
 */
export function loadMissionsSafe(
  storage: StorageLike | null = getDefaultStorage(),
  nowMs: number = Date.now(),
  seedProgression?: Partial<PlayerProgression>,
  options: MissionServiceOptions = {}
): LoadMissionsOutcome {
  if (!storage) {
    return {
      missions: createInitialMissionsState(nowMs, options, seedProgression),
      status: 'storage_error',
    };
  }

  let rawPrimary: string | null = null;
  try {
    rawPrimary = storage.getItem(MISSIONS_KEY);
  } catch {
    return {
      missions: createInitialMissionsState(nowMs, options, seedProgression),
      status: 'storage_error',
    };
  }

  if (rawPrimary === null) {
    try {
      const backup = tryParseMissionsRaw(
        storage.getItem(MISSIONS_BACKUP_KEY),
        nowMs,
        options,
        seedProgression
      );
      if (backup) {
        return { missions: backup, status: 'recovered_backup' };
      }
    } catch {
      // Ignore backup errors
    }
    return {
      missions: createInitialMissionsState(nowMs, options, seedProgression),
      status: 'new',
    };
  }

  try {
    const primary = tryParseMissionsRaw(rawPrimary, nowMs, options, seedProgression);
    if (primary) {
      return { missions: primary, status: 'loaded' };
    }
  } catch {
    // Corrupted primary JSON — fall through to backup without overwriting primary
  }

  try {
    const backup = tryParseMissionsRaw(
      storage.getItem(MISSIONS_BACKUP_KEY),
      nowMs,
      options,
      seedProgression
    );
    if (backup) {
      return { missions: backup, status: 'recovered_backup' };
    }
  } catch {
    // Ignore backup errors
  }

  return {
    missions: createInitialMissionsState(nowMs, options, seedProgression),
    status: 'corrupt_fallback',
  };
}

export function loadMissions(
  storage: StorageLike | null = getDefaultStorage(),
  nowMs: number = Date.now(),
  seedProgression?: Partial<PlayerProgression>,
  options: MissionServiceOptions = {}
): MissionsState {
  return loadMissionsSafe(storage, nowMs, seedProgression, options).missions;
}

export function saveMissions(
  missions: MissionsState,
  storage: StorageLike | null = getDefaultStorage()
): boolean {
  if (!storage) {
    emitSaveEvent({ status: 'error', scope: 'missions', timestampMs: Date.now() });
    return false;
  }
  try {
    const payload: MissionsState = {
      ...missions,
      saveVersion: MISSIONS_SAVE_VERSION,
    };
    const serialized = JSON.stringify(payload);
    JSON.parse(serialized);
    storage.setItem(MISSIONS_KEY, serialized);
    try {
      storage.setItem(MISSIONS_BACKUP_KEY, serialized);
    } catch {
      // Best-effort backup
    }
    if (storage !== sessionFallbackStorage) {
      platformBridge.syncSaveKey(MISSIONS_KEY, serialized);
    }
    emitSaveEvent({ status: 'saved', scope: 'missions', timestampMs: Date.now() });
    return true;
  } catch {
    emitSaveEvent({ status: 'error', scope: 'missions', timestampMs: Date.now() });
    return false;
  }
}

/**
 * Hydrates local storage from Playgama platform storage if running inside Playgama
 * and local save keys do not yet exist (never overwrites existing local progress).
 */
export async function hydrateFromPlatformStorage(
  storage: StorageLike | null = getDefaultStorage()
): Promise<{
  progression: PlayerProgression | null;
  missions: MissionsState | null;
}> {
  if (!storage || !platformBridge.supportsPlatformStorage) {
    return { progression: null, missions: null };
  }
  const remote = await platformBridge.loadSaveKeys([PROGRESSION_KEY, MISSIONS_KEY]);
  let hydratedProgression: PlayerProgression | null = null;
  let hydratedMissions: MissionsState | null = null;

  if (!storage.getItem(PROGRESSION_KEY) && remote[PROGRESSION_KEY]) {
    const parsed = tryParseProgressionRaw(remote[PROGRESSION_KEY]);
    if (parsed) {
      saveProgression(parsed, storage);
      hydratedProgression = parsed;
    }
  }

  if (!storage.getItem(MISSIONS_KEY) && remote[MISSIONS_KEY]) {
    const seed = hydratedProgression ?? loadProgression(storage);
    const parsedMissions = tryParseMissionsRaw(remote[MISSIONS_KEY], Date.now(), {}, seed);
    if (parsedMissions) {
      saveMissions(parsedMissions, storage);
      hydratedMissions = parsedMissions;
    }
  }

  return {
    progression: hydratedProgression,
    missions: hydratedMissions,
  };
}

export function resetAllLocalData(
  storage: StorageLike | null = getDefaultStorage()
): {
  progression: PlayerProgression;
  settings: GameSettings;
  missions: MissionsState;
} {
  if (storage) {
    try {
      storage.removeItem(PROGRESSION_KEY);
      storage.removeItem(PROGRESSION_BACKUP_KEY);
      storage.removeItem(MISSIONS_KEY);
      storage.removeItem(MISSIONS_BACKUP_KEY);
      storage.removeItem(SETTINGS_KEY);
    } catch {
      // Ignore storage errors
    }
  }
  return {
    progression: createDefaultProgression(),
    settings: { ...DEFAULT_SETTINGS },
    missions: createInitialMissionsState(),
  };
}
