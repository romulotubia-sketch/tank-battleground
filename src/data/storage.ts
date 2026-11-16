import {
  ArenaId,
  GameSettings,
  GraphicsQuality,
  MatchResult,
  PlayerProgression,
  TankId,
} from '../types/game';
import { TANK_DEFINITIONS, TANK_LIST } from './tanks';

const PROGRESSION_KEY = 'tankbound_arena_progression_v1';
const SETTINGS_KEY = 'tankbound_arena_settings_v1';

export const DEFAULT_PROGRESSION: PlayerProgression = {
  playerName: 'Commander',
  level: 1,
  xp: 0,
  xpToNext: 100,
  unlockedTanks: ['assault', 'fortress', 'scout', 'artillery', 'tesla', 'phantom'],
  selectedTank: 'assault',
  selectedArena: 'training_grounds',
  scrap: 0,
  matchesPlayed: 0,
  wins: 0,
  totalEliminations: 0,
  bestPlacement: null,
};

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
  autoFireOnAim: false,
  lowDetailMode: false,
  matchDurationSec: 150,
  landscapePromptEnabled: true,
};

export function loadProgression(): PlayerProgression {
  try {
    const raw = localStorage.getItem(PROGRESSION_KEY);
    if (!raw) return { ...DEFAULT_PROGRESSION };
    const parsed = JSON.parse(raw) as Partial<PlayerProgression>;
    const unlocked: TankId[] = Array.isArray(parsed.unlockedTanks)
      ? parsed.unlockedTanks.filter((id): id is TankId => Boolean(TANK_DEFINITIONS[id]?.implemented))
      : ['assault', 'fortress', 'scout', 'artillery', 'tesla', 'phantom'];
    for (const def of TANK_LIST) {
      if (def.implemented && !unlocked.includes(def.id)) {
        unlocked.push(def.id);
      }
    }

    const selectedTank: TankId =
      parsed.selectedTank &&
      unlocked.includes(parsed.selectedTank) &&
      TANK_DEFINITIONS[parsed.selectedTank]?.implemented
        ? parsed.selectedTank
        : 'assault';

    const validArenas: ArenaId[] = ['training_grounds', 'industrial_zone', 'wasteland'];
    const selectedArena: ArenaId =
      parsed.selectedArena && validArenas.includes(parsed.selectedArena)
        ? parsed.selectedArena
        : 'training_grounds';

    const rawName = typeof parsed.playerName === 'string' ? parsed.playerName.trim() : '';

    return {
      playerName: rawName.length > 0 ? rawName.slice(0, 20) : DEFAULT_PROGRESSION.playerName,
      level: typeof parsed.level === 'number' && parsed.level >= 1 ? Math.floor(parsed.level) : 1,
      xp: typeof parsed.xp === 'number' && parsed.xp >= 0 ? Math.floor(parsed.xp) : 0,
      xpToNext:
        typeof parsed.xpToNext === 'number' && parsed.xpToNext > 0
          ? Math.floor(parsed.xpToNext)
          : 100,
      unlockedTanks: unlocked,
      selectedTank,
      selectedArena,
      scrap: typeof parsed.scrap === 'number' ? Math.max(0, parsed.scrap) : 0,
      matchesPlayed: typeof parsed.matchesPlayed === 'number' ? Math.max(0, parsed.matchesPlayed) : 0,
      wins: typeof parsed.wins === 'number' ? Math.max(0, parsed.wins) : 0,
      totalEliminations:
        typeof parsed.totalEliminations === 'number' ? Math.max(0, parsed.totalEliminations) : 0,
      bestPlacement:
        typeof parsed.bestPlacement === 'number' ? parsed.bestPlacement : null,
    };
  } catch {
    return { ...DEFAULT_PROGRESSION };
  }
}

export function saveProgression(progression: PlayerProgression): void {
  try {
    localStorage.setItem(PROGRESSION_KEY, JSON.stringify(progression));
  } catch {
    // Ignore quota/storage errors in restricted environments
  }
}

export function applyMatchResultToProgression(
  prev: PlayerProgression,
  result: MatchResult
): PlayerProgression {
  const bestPlacement =
    prev.bestPlacement === null
      ? result.placement
      : Math.min(prev.bestPlacement, result.placement);

  const next: PlayerProgression = {
    ...prev,
    scrap: prev.scrap + result.scrapEarned,
    matchesPlayed: prev.matchesPlayed + 1,
    wins: prev.wins + (result.victory ? 1 : 0),
    totalEliminations: prev.totalEliminations + result.eliminations,
    bestPlacement,
  };
  saveProgression(next);
  return next;
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;

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

export function saveSettings(settings: GameSettings): void {
  try {
    const normalized: GameSettings = {
      ...settings,
      lowDetailMode: settings.graphicsQuality === 'low',
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage errors
  }
}

export function resetSettingsToDefault(): GameSettings {
  const defaults: GameSettings = { ...DEFAULT_SETTINGS };
  saveSettings(defaults);
  return defaults;
}

export function resetAllLocalData(): {
  progression: PlayerProgression;
  settings: GameSettings;
} {
  try {
    localStorage.removeItem(PROGRESSION_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // Ignore storage errors
  }
  return {
    progression: { ...DEFAULT_PROGRESSION },
    settings: { ...DEFAULT_SETTINGS },
  };
}
