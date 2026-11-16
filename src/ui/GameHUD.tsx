import { useEffect, useState } from 'react';
import {
  Crosshair,
  Home,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Shield,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { TouchJoystick } from '../components/TouchJoystick';
import {
  getEffectiveTankMaxHp,
  getEffectiveTankReloadSec,
  TANK_DEFINITIONS,
} from '../data/tanks';
import { gameBridge } from '../game/GameBridge';
import { soundFX } from '../game/systems/SoundFX';
import { GameSettings, HUDStateSnapshot, TankId } from '../types/game';
import {
  enterLandscapeFullscreen,
  exitLandscapeFullscreen,
  useViewportOrientation,
} from '../utils/orientation';

interface GameHUDProps {
  settings: GameSettings;
  selectedTankId?: TankId;
  onToggleSound: () => void;
  onExitToMenu: () => void;
  onRestartMatch: () => void;
}

export function createInitialHud(tankId: TankId = 'assault'): HUDStateSnapshot {
  const def = TANK_DEFINITIONS[tankId] || TANK_DEFINITIONS.assault;
  const maxHp = getEffectiveTankMaxHp(def);
  return {
    tankId: def.id,
    tankName: def.name,
    hp: maxHp,
    maxHp,
    shieldHp: 0,
    ammo: def.stats.magazineCapacity,
    maxAmmo: def.stats.magazineCapacity,
    isReloading: false,
    reloadRemainingSec: 0,
    reloadTotalSec: getEffectiveTankReloadSec(def),
    aliveCount: 8,
    totalTanks: 8,
    eliminations: 0,
    timeRemainingSec: 150,
    abilityCooldownSec: 0,
    abilityTotalCooldownSec: def.activeAbility.cooldownSec,
    abilityActiveSec: 0,
    abilityName: def.activeAbility.name,
    activeBuffs: [],
    isConcealed: false,
    radarActive: false,
    isPaused: false,
    isPreparing: true,
    prepLabel: '3',
    killFeedText: null,
  };
}

function formatTime(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function GameHUD({
  settings,
  selectedTankId = 'assault',
  onToggleSound,
  onExitToMenu,
  onRestartMatch,
}: GameHUDProps) {
  const [hud, setHud] = useState<HUDStateSnapshot>(() => {
    const snap = gameBridge.getLastHudSnapshot();
    return snap && snap.tankId === selectedTankId ? snap : createInitialHud(selectedTankId);
  });
  const { isTouchDevice, isCompactLandscape, isFullscreen, canFullscreen } =
    useViewportOrientation();

  useEffect(() => {
    const snap = gameBridge.getLastHudSnapshot();
    setHud(snap && snap.tankId === selectedTankId ? snap : createInitialHud(selectedTankId));
    return gameBridge.onHudUpdate((nextSnap) => setHud(nextSnap));
  }, [selectedTankId]);

  const showControls = settings.showTouchControls === 'always' || isTouchDevice;
  const hpPct = Math.max(0, Math.min(100, (hud.hp / Math.max(1, hud.maxHp)) * 100));
  const abilityReady = hud.abilityCooldownSec <= 0.05;
  const abilityActive = hud.abilityActiveSec > 0;
  const canManualReload = !hud.isPreparing && !hud.isReloading && hud.ammo < hud.maxAmmo;
  const reloadProgressPct =
    hud.isReloading && hud.reloadTotalSec > 0
      ? Math.max(
          0,
          Math.min(100, ((hud.reloadTotalSec - hud.reloadRemainingSec) / hud.reloadTotalSec) * 100)
        )
      : 0;

  const stickSize = isCompactLandscape ? 92 : 110;
  const fireSize = isCompactLandscape ? 'w-[60px] h-[60px]' : 'w-[68px] h-[68px] sm:w-[76px] sm:h-[76px]';
  const abilitySize = isCompactLandscape ? 'w-[52px] h-[52px]' : 'w-[58px] h-[58px] sm:w-[64px] sm:h-[64px]';
  const reloadBtnSize = isCompactLandscape ? 'w-[46px] h-[46px]' : 'w-[50px] h-[50px] sm:w-[56px] sm:h-[56px]';

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between safe-area-hud sm:p-3">
      {/* Compact Top Bar */}
      <div className="flex items-start justify-between gap-2">
        {/* Player Armor, Tank Identity & Active Buffs */}
        <div className="pointer-events-auto flex flex-col gap-1 min-w-[165px] sm:min-w-[230px] bg-[#141714]/82 border border-[#F3EFE6]/20 rounded-lg px-3 py-1.5 backdrop-blur-xs">
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider font-semibold text-[#E08E26]">
            <span className="truncate">{hud.tankName}</span>
            {hud.shieldHp > 0 && (
              <span className="inline-flex items-center gap-1 text-sky-400 font-mono tabular-nums normal-case">
                <Shield className="w-3 h-3" />
                {hud.shieldHp}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="font-semibold text-[#F3EFE6]">
              HP {hud.hp}/{hud.maxHp}
            </span>
          </div>
          <div className="w-full h-2 rounded-sm bg-[#272B26] overflow-hidden border border-[#0F110F]">
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${hpPct}%`,
                backgroundColor:
                  hpPct > 50 ? '#22C55E' : hpPct > 25 ? '#E08E26' : '#EF4444',
              }}
            />
          </div>

          {/* Ammunition & Reload Indicator */}
          <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] font-mono tabular-nums">
            <span
              className={`font-bold ${
                hud.isReloading
                  ? 'text-[#FACC15]'
                  : hud.ammo === 0
                  ? 'text-red-400'
                  : 'text-[#F3EFE6]'
              }`}
            >
              AMMO {hud.ammo}/{hud.maxAmmo}
            </span>

            {hud.isReloading ? (
              <span className="text-[#FACC15] font-semibold">
                RELOAD {hud.reloadRemainingSec.toFixed(1)}s
              </span>
            ) : (
              <button
                type="button"
                disabled={!canManualReload}
                onClick={() => {
                  if (canManualReload) gameBridge.input.reloadPressed = true;
                }}
                className={`px-1.5 py-0.5 rounded border text-[10px] font-sans font-semibold transition ${
                  canManualReload
                    ? 'border-[#E08E26]/60 text-[#E08E26] hover:bg-[#E08E26]/15 active:scale-95'
                    : 'border-[#F3EFE6]/15 text-[#F3EFE6]/35 cursor-not-allowed'
                }`}
              >
                Reload (R)
              </button>
            )}
          </div>

          {hud.isReloading ? (
            <div className="w-full h-1.5 rounded-sm bg-[#272B26] overflow-hidden border border-[#0F110F]">
              <div
                className="h-full bg-[#FACC15] transition-all duration-75"
                style={{ width: `${reloadProgressPct}%` }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: hud.maxAmmo }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-xs transition-colors ${
                    i < hud.ammo
                      ? hud.ammo <= 2
                        ? 'bg-[#E08E26]'
                        : 'bg-[#F3EFE6]/85'
                      : 'bg-[#272B26]'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Active Ability Status */}
          <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] font-mono tabular-nums">
            <span className="inline-flex items-center gap-1 text-[#F3EFE6]/75 truncate">
              <Zap className="w-3 h-3 text-[#E08E26] shrink-0" />
              <span className="truncate">{hud.abilityName}</span>
            </span>
            {abilityActive ? (
              <span
                className={`font-bold whitespace-nowrap ${
                  hud.abilityName === 'Afterburner'
                    ? 'text-[#FACC15]'
                    : hud.abilityName === 'Shell Barrage'
                    ? 'text-red-400'
                    : 'text-sky-300'
                }`}
              >
                ACTIVE {hud.abilityActiveSec.toFixed(1)}s
              </span>
            ) : abilityReady ? (
              <span className="text-emerald-400 font-semibold whitespace-nowrap">
                READY (E)
              </span>
            ) : (
              <span className="text-[#F3EFE6]/55 font-semibold whitespace-nowrap">
                CD {Math.ceil(hud.abilityCooldownSec)}s
              </span>
            )}
          </div>

          {hud.activeBuffs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-mono tabular-nums">
              {hud.activeBuffs.map((b) => (
                <span key={b.id} className="font-semibold" style={{ color: b.color }}>
                  {b.shortLabel} {Math.ceil(b.remainingSec)}s
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Center Match Clock & Survivors */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2.5 sm:gap-3 bg-[#141714]/85 border border-[#F3EFE6]/20 rounded-lg px-3 py-1.5 backdrop-blur-xs text-xs sm:text-sm font-mono tabular-nums">
            <span className="font-bold text-[#F3EFE6]">
              {formatTime(hud.timeRemainingSec)}
            </span>
            <span className="text-[#F3EFE6]/35">·</span>
            <span className="inline-flex items-center gap-1 text-[#E08E26] font-bold">
              <Users className="w-3.5 h-3.5" />
              {hud.aliveCount}/{hud.totalTanks}
            </span>
            <span className="text-[#F3EFE6]/35">·</span>
            <span className="inline-flex items-center gap-1 text-[#F3EFE6]/90 font-semibold">
              <Crosshair className="w-3.5 h-3.5" />
              {hud.eliminations}
            </span>
          </div>

          {hud.killFeedText && (
            <div className="bg-[#141714]/85 border border-[#E08E26]/40 rounded px-2.5 py-0.5 text-[11px] font-medium text-[#F3EFE6]">
              {hud.killFeedText}
            </div>
          )}
          {hud.isConcealed && (
            <div className="text-[11px] font-medium text-emerald-300 bg-[#141714]/75 px-2 py-0.5 rounded">
              Concealed in brush
            </div>
          )}
        </div>

        {/* Right Fullscreen & Pause Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5">
          {canFullscreen && (
            <button
              type="button"
              onClick={() => {
                if (isFullscreen) exitLandscapeFullscreen();
                else enterLandscapeFullscreen();
              }}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Landscape fullscreen'}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#141714]/85 border border-[#F3EFE6]/25 text-[#F3EFE6] hover:bg-[#242823] active:scale-95 transition"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => gameBridge.sendCommand(hud.isPaused ? 'RESUME' : 'PAUSE')}
            aria-label="Pause match"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-[#141714]/85 border border-[#F3EFE6]/25 text-[#F3EFE6] hover:bg-[#242823] active:scale-95 transition"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Three-Second Preparation Countdown Overlay (3, 2, 1, GO!) */}
      {!hud.isPaused && hud.prepLabel && (
        <div className="pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-center px-4">
          <div className="flex flex-col items-center rounded-2xl bg-[#141714]/78 border-2 border-[#E08E26]/65 px-7 py-4 sm:px-10 sm:py-5 shadow-2xl backdrop-blur-xs">
            <span className="font-display text-xs sm:text-sm font-bold tracking-[0.22em] uppercase text-[#F3EFE6]/80">
              {hud.prepLabel === 'GO!' ? 'Combat Active' : 'Get Ready'}
            </span>
            <span
              className={`font-display font-extrabold tracking-wide leading-none mt-1 tabular-nums drop-shadow ${
                hud.prepLabel === 'GO!'
                  ? 'text-5xl sm:text-7xl text-[#4ADE80]'
                  : 'text-6xl sm:text-8xl text-[#E08E26]'
              }`}
            >
              {hud.prepLabel}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Touch Controls */}
      {showControls && !hud.isPaused && (
        <div className="flex items-end justify-between gap-3 pb-0.5 px-1 sm:px-3">
          {/* Left Movement Joystick */}
          <div className="pointer-events-auto">
            <TouchJoystick
              label="Move"
              accentColor="#E08E26"
              size={stickSize}
              onChange={(nx, ny) => {
                gameBridge.input.moveX = nx;
                gameBridge.input.moveY = ny;
              }}
            />
          </div>

          {/* Right Combat Cluster: Ability + Aim Joystick + Fire */}
          <div className="pointer-events-auto flex items-end gap-2 sm:gap-3.5">
            {/* Active Ability Button */}
            <button
              type="button"
              disabled={!abilityReady || abilityActive || hud.isPreparing}
              onPointerDown={(e) => {
                e.preventDefault();
                if (abilityReady && !abilityActive && !hud.isPreparing) {
                  gameBridge.input.abilityPressed = true;
                }
              }}
              aria-label={`Activate ${hud.abilityName}`}
              className={`touch-none-game relative ${abilitySize} rounded-full border-2 flex flex-col items-center justify-center font-display font-bold transition active:scale-95 ${
                hud.isPreparing
                  ? 'bg-[#141714]/65 border-[#F3EFE6]/20 text-[#F3EFE6]/40 cursor-not-allowed'
                  : abilityActive
                  ? hud.abilityName === 'Fortress Shield'
                    ? 'bg-sky-500 border-[#F3EFE6] text-[#141714]'
                    : hud.abilityName === 'Afterburner'
                    ? 'bg-[#FACC15] border-[#FEF08A] text-[#141714]'
                    : hud.abilityName === 'Shell Barrage'
                    ? 'bg-[#EF4444] border-[#FCA5A5] text-[#F3EFE6]'
                    : 'bg-[#E08E26] border-[#F3EFE6] text-[#141714]'
                  : abilityReady
                  ? 'bg-[#2B3329]/90 border-[#E08E26] text-[#F3EFE6]'
                  : 'bg-[#141714]/80 border-[#F3EFE6]/25 text-[#F3EFE6]/60'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span className="text-[10px] sm:text-[11px] leading-tight mt-0.5 tabular-nums">
                {abilityActive
                  ? `${Math.ceil(hud.abilityActiveSec)}s`
                  : abilityReady
                  ? 'ABILITY'
                  : `${Math.ceil(hud.abilityCooldownSec)}s`}
              </span>
            </button>

            {/* Manual Reload Button */}
            <button
              type="button"
              disabled={!canManualReload}
              onPointerDown={(e) => {
                e.preventDefault();
                if (canManualReload) {
                  gameBridge.input.reloadPressed = true;
                }
              }}
              aria-label="Reload magazine"
              className={`touch-none-game relative ${reloadBtnSize} rounded-full border-2 flex flex-col items-center justify-center font-display font-bold transition active:scale-95 ${
                hud.isReloading
                  ? 'bg-[#2E2A16]/90 border-[#FACC15] text-[#FACC15] cursor-wait'
                  : canManualReload
                  ? 'bg-[#2B3329]/90 border-[#F3EFE6]/75 text-[#F3EFE6]'
                  : 'bg-[#141714]/65 border-[#F3EFE6]/20 text-[#F3EFE6]/35 cursor-not-allowed'
              }`}
            >
              <RotateCw className={`w-3.5 h-3.5 ${hud.isReloading ? 'animate-spin' : ''}`} />
              <span className="text-[9px] sm:text-[10px] leading-tight mt-0.5 tabular-nums">
                {hud.isReloading ? `${hud.reloadRemainingSec.toFixed(1)}s` : 'RELOAD'}
              </span>
            </button>

            {/* Aiming Joystick */}
            <TouchJoystick
              label="Aim"
              accentColor="#F3EFE6"
              size={stickSize}
              onChange={(nx, ny, active) => {
                if (hud.isPreparing) {
                  gameBridge.input.aimX = 0;
                  gameBridge.input.aimY = 0;
                  gameBridge.input.aimActive = false;
                  return;
                }
                gameBridge.input.aimX = nx;
                gameBridge.input.aimY = ny;
                gameBridge.input.aimActive = active;
              }}
            />

            {/* Dedicated Fire Button */}
            <button
              type="button"
              disabled={hud.isPreparing}
              onPointerDown={(e) => {
                e.preventDefault();
                if (hud.isPreparing) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                gameBridge.input.firePressed = true;
                gameBridge.input.firing = true;
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
                gameBridge.input.firing = false;
              }}
              onPointerCancel={() => {
                gameBridge.input.firing = false;
              }}
              aria-label="Fire cannon"
              className={`touch-none-game ${fireSize} rounded-full border-2 font-display font-extrabold text-xs sm:text-sm tracking-wide flex flex-col items-center justify-center shadow-lg transition ${
                hud.isPreparing
                  ? 'bg-[#6E2A22]/65 border-[#F3EFE6]/35 text-[#F3EFE6]/50 cursor-not-allowed'
                  : hud.isReloading || hud.ammo <= 0
                  ? 'bg-[#42371B]/90 border-[#FACC15]/75 text-[#FACC15] active:scale-95'
                  : 'bg-[#C93A2B] border-[#F3EFE6]/85 text-[#F3EFE6] active:scale-95'
              }`}
            >
              <Crosshair className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5" />
              {hud.isReloading ? 'WAIT' : hud.ammo <= 0 ? 'EMPTY' : 'FIRE'}
            </button>
          </div>
        </div>
      )}

      {/* Pause Overlay */}
      {hud.isPaused && (
        <div className="pointer-events-auto fixed inset-0 z-40 bg-[#0D0F0D]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1E221D] border-2 border-[#F3EFE6]/25 rounded-xl p-6 shadow-2xl">
            <h2 className="font-display text-3xl font-extrabold tracking-wide text-[#F3EFE6] text-center">
              Match Paused
            </h2>
            <p className="text-xs text-[#F3EFE6]/65 text-center mt-1 mb-5">
              {hud.aliveCount} of {hud.totalTanks} tanks remaining · {formatTime(hud.timeRemainingSec)} left
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => gameBridge.sendCommand('RESUME')}
                className="min-h-[46px] w-full rounded-lg bg-[#E08E26] text-[#141714] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#EE9B32] transition whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                Resume Match
              </button>

              <button
                type="button"
                onClick={() => {
                  gameBridge.sendCommand('RESTART');
                  onRestartMatch();
                }}
                className="min-h-[44px] w-full rounded-lg bg-[#2B3029] border border-[#F3EFE6]/20 text-[#F3EFE6] font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#353C33] transition whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                Restart Match
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleSound();
                  soundFX.configure(!settings.soundEnabled, settings.soundVolume);
                }}
                className="min-h-[44px] w-full rounded-lg bg-[#2B3029] border border-[#F3EFE6]/20 text-[#F3EFE6] font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#353C33] transition whitespace-nowrap"
              >
                {settings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-[#E08E26]" />
                ) : (
                  <VolumeX className="w-4 h-4 text-[#F3EFE6]/60" />
                )}
                Sound: {settings.soundEnabled ? 'On' : 'Muted'}
              </button>

              <button
                type="button"
                onClick={onExitToMenu}
                className="min-h-[44px] w-full rounded-lg bg-transparent border border-[#F3EFE6]/20 text-[#F3EFE6]/80 font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#2B3029] transition whitespace-nowrap"
              >
                <Home className="w-4 h-4" />
                Return to Main Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
