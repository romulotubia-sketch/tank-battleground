import {
  ArenaId,
  GameSettings,
  MatchResult,
  PlayerProgression,
  TankId,
} from '../types/game';
import { TANK_DEFINITIONS, TANK_LIST } from './tanks';

const PROGRESSION_KEY = 'tankbound_arena_progression_v1';
const SETTINGS_KEY = 'tankbound_arena_settings_v1';

export const DEFAULT_PROGRESSION: PlayerProgression = {
  unlockedTanks: ['assault', 'fortress', 'scout', 'artillery'],
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
      : ['assault', 'fortress', 'scout', 'artillery'];
    for (const def of TANK_LIST) {
      if (def.implemented && (def.isStarter || def.unlockCost === 0) && !unlocked.includes(def.id)) {
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

    return {
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
    return {
      soundEnabled:
        typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
      soundVolume:
        typeof parsed.soundVolume === 'number'
          ? Math.min(1, Math.max(0, parsed.soundVolume))
          : DEFAULT_SETTINGS.soundVolume,
      showTouchControls:
        parsed.showTouchControls === 'auto' || parsed.showTouchControls === 'always'
          ? parsed.showTouchControls
          : DEFAULT_SETTINGS.showTouchControls,
      autoFireOnAim:
        typeof parsed.autoFireOnAim === 'boolean'
          ? parsed.autoFireOnAim
          : DEFAULT_SETTINGS.autoFireOnAim,
      lowDetailMode:
        typeof parsed.lowDetailMode === 'boolean'
          ? parsed.lowDetailMode
          : DEFAULT_SETTINGS.lowDetailMode,
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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
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
