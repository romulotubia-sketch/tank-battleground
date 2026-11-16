import { ArenaId, GameSettings, HUDStateSnapshot, MatchResult, TankId } from '../types/game';

/**
 * Mutable input state read directly by Phaser at 60fps.
 * Updating this never triggers React re-renders.
 */
export interface PlayerInputState {
  moveX: number; // -1..1
  moveY: number; // -1..1
  aimX: number; // -1..1 (touch joystick)
  aimY: number; // -1..1
  aimActive: boolean;
  mouseWorldX: number;
  mouseWorldY: number;
  mouseAimActive: boolean;
  firing: boolean;
  firePressed: boolean;
  abilityPressed: boolean;
  reloadPressed: boolean;
}

export interface MatchLaunchConfig {
  tankId: TankId;
  arenaId: ArenaId;
  settings: GameSettings;
}

type HudListener = (snapshot: HUDStateSnapshot) => void;
type MatchEndListener = (result: MatchResult) => void;
type CommandListener = (cmd: 'PAUSE' | 'RESUME' | 'RESTART') => void;
type SettingsListener = (settings: GameSettings) => void;

class GameBridgeBus {
  readonly input: PlayerInputState = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    aimActive: false,
    mouseWorldX: 0,
    mouseWorldY: 0,
    mouseAimActive: false,
    firing: false,
    firePressed: false,
    abilityPressed: false,
    reloadPressed: false,
  };

  private hudListeners = new Set<HudListener>();
  private matchEndListeners = new Set<MatchEndListener>();
  private commandListeners = new Set<CommandListener>();
  private settingsListeners = new Set<SettingsListener>();
  private lastHudSnapshot: HUDStateSnapshot | null = null;
  private activeLaunchConfig: MatchLaunchConfig | null = null;

  setLaunchConfig(config: MatchLaunchConfig): void {
    this.activeLaunchConfig = config;
  }

  getLaunchConfig(): MatchLaunchConfig | null {
    return this.activeLaunchConfig;
  }

  resetInput(): void {
    this.input.moveX = 0;
    this.input.moveY = 0;
    this.input.aimX = 0;
    this.input.aimY = 0;
    this.input.aimActive = false;
    this.input.mouseAimActive = false;
    this.input.firing = false;
    this.input.firePressed = false;
    this.input.abilityPressed = false;
    this.input.reloadPressed = false;
  }

  getLastHudSnapshot(): HUDStateSnapshot | null {
    return this.lastHudSnapshot;
  }

  clearLastHudSnapshot(): void {
    this.lastHudSnapshot = null;
  }

  onHudUpdate(cb: HudListener): () => void {
    this.hudListeners.add(cb);
    if (this.lastHudSnapshot) {
      cb(this.lastHudSnapshot);
    }
    return () => this.hudListeners.delete(cb);
  }

  emitHudUpdate(snapshot: HUDStateSnapshot): void {
    this.lastHudSnapshot = snapshot;
    this.hudListeners.forEach((cb) => cb(snapshot));
  }

  onMatchEnd(cb: MatchEndListener): () => void {
    this.matchEndListeners.add(cb);
    return () => this.matchEndListeners.delete(cb);
  }

  emitMatchEnd(result: MatchResult): void {
    this.matchEndListeners.forEach((cb) => cb(result));
  }

  onCommand(cb: CommandListener): () => void {
    this.commandListeners.add(cb);
    return () => this.commandListeners.delete(cb);
  }

  sendCommand(cmd: 'PAUSE' | 'RESUME' | 'RESTART'): void {
    this.commandListeners.forEach((cb) => cb(cmd));
  }

  onSettingsChange(cb: SettingsListener): () => void {
    this.settingsListeners.add(cb);
    return () => this.settingsListeners.delete(cb);
  }

  emitSettingsChange(settings: GameSettings): void {
    this.settingsListeners.forEach((cb) => cb(settings));
  }
}

export const gameBridge = new GameBridgeBus();
