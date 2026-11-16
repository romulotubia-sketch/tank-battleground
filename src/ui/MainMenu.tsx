import {
  Award,
  BookOpen,
  ChevronRight,
  Compass,
  Crosshair,
  Layers,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Play,
  Settings,
  Shield,
  Wrench,
} from 'lucide-react';
import { ArenaPreviewSvg } from '../components/ArenaPreviewSvg';
import { TankPreviewSvg } from '../components/TankPreviewSvg';
import {
  getEffectiveTankMaxHp,
  getEffectiveTankMoveSpeed,
  getEffectiveTankProjectileRange,
  getEffectiveTankReloadSec,
  TANK_DEFINITIONS,
} from '../data/tanks';
import { ARENA_DEFINITIONS } from '../game/arenas/arenaLayouts';
import { PlayerProgression, ScreenId } from '../types/game';
import {
  enterLandscapeFullscreen,
  exitLandscapeFullscreen,
  useViewportOrientation,
} from '../utils/orientation';

interface MainMenuProps {
  progression: PlayerProgression;
  onNavigate: (screen: ScreenId) => void;
  onStartBattle: () => void;
}

export function MainMenu({ progression, onNavigate, onStartBattle }: MainMenuProps) {
  const activeTank = TANK_DEFINITIONS[progression.selectedTank] || TANK_DEFINITIONS.assault;
  const activeArena =
    ARENA_DEFINITIONS[progression.selectedArena] || ARENA_DEFINITIONS.training_grounds;
  const { isCompactLandscape, isFullscreen, canFullscreen } = useViewportOrientation();
  const xpPct = Math.max(
    0,
    Math.min(100, (progression.xp / Math.max(1, progression.xpToNext)) * 100)
  );

  return (
    <div className="relative w-full h-full overflow-y-auto bg-[#141714] tactical-bg-grid text-[#F3EFE6] flex flex-col">
      {/* Subtle GPU-light ambient backdrop glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="tactical-ambient-glow absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full bg-[#E08E26]/10 blur-3xl" />
        <div className="tactical-ambient-glow absolute -bottom-32 -right-24 w-[440px] h-[440px] rounded-full bg-[#5B7048]/12 blur-3xl" />
      </div>

      {/* Top Command Header */}
      <header
        className={`relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-7 flex items-center justify-between gap-3 border-b border-[#F3EFE6]/12 shrink-0 bg-[#141714]/75 backdrop-blur-xs ${
          isCompactLandscape ? 'py-2' : 'py-3'
        }`}
      >
        {/* Game Logo */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#E08E26] text-[#141714] flex items-center justify-center shadow shrink-0 border border-[#FEF08A]/40">
            <Crosshair className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-wider uppercase text-[#F3EFE6] leading-none truncate">
              TANKBOUND ARENA
            </h1>
            <p className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.18em] text-[#E08E26] mt-0.5 truncate">
              8-Tank Free-For-All Combat
            </p>
          </div>
        </div>

        {/* Player Profile Area + Quick Utility Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2.5 bg-[#1E221D] border border-[#F3EFE6]/15 rounded-xl px-2.5 sm:px-3.5 py-1.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#2A3027] border border-[#E08E26]/45 flex items-center justify-center font-display font-extrabold text-sm text-[#E08E26] shrink-0">
              {progression.level}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F3EFE6] leading-tight">
                <span className="truncate max-w-[95px] sm:max-w-[140px]">
                  {progression.playerName}
                </span>
                <span className="text-[10px] font-mono text-[#E08E26] tabular-nums">
                  LVL {progression.level}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-16 sm:w-20 h-1.5 rounded-full bg-[#141714] overflow-hidden border border-[#F3EFE6]/10">
                  <div
                    className="h-full bg-[#E08E26]"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
                <span className="hidden sm:inline text-[10px] font-mono tabular-nums text-[#F3EFE6]/55">
                  {progression.xp}/{progression.xpToNext} XP
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('HOW_TO_PLAY')}
            aria-label="Field Manual"
            title="How to Play"
            className="min-w-[44px] min-h-[44px] px-2.5 flex items-center justify-center gap-1.5 rounded-xl border border-[#F3EFE6]/18 bg-[#1E221D]/90 text-xs font-semibold text-[#F3EFE6]/85 hover:bg-[#272D25] transition whitespace-nowrap"
          >
            <BookOpen className="w-4 h-4 text-[#E08E26]" />
            <span className="hidden lg:inline">Guide</span>
          </button>

          {canFullscreen && (
            <button
              type="button"
              onClick={() => {
                if (isFullscreen) exitLandscapeFullscreen();
                else enterLandscapeFullscreen();
              }}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter landscape fullscreen'}
              title={isFullscreen ? 'Exit Fullscreen' : 'Landscape Fullscreen'}
              className="min-w-[44px] min-h-[44px] px-2.5 flex items-center justify-center rounded-xl border border-[#F3EFE6]/18 bg-[#1E221D]/90 text-[#F3EFE6]/85 hover:bg-[#272D25] transition"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Landscape Command Deck */}
      <main
        className={`relative z-10 screen-transition flex-1 w-full max-w-6xl mx-auto px-4 sm:px-7 grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 items-center ${
          isCompactLandscape ? 'py-2.5 gap-3' : 'py-4 sm:py-6 gap-5 lg:gap-6'
        }`}
      >
        {/* Left/Center Column: Active Loadout Staging + Large PLAY Button */}
        <section
          className={`landscape:col-span-7 lg:col-span-7 flex flex-col ${
            isCompactLandscape ? 'gap-2.5' : 'gap-4'
          }`}
        >
          {/* Active Tank & Arena Readiness Card */}
          <div className="bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-3.5 sm:p-5 shadow-xl">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center">
              {/* Selected Tank Staging */}
              <div className="sm:col-span-7 flex items-center gap-3.5 bg-[#141714]/85 border border-[#F3EFE6]/10 rounded-xl p-3">
                <TankPreviewSvg
                  tank={activeTank}
                  size={isCompactLandscape ? 74 : 96}
                  className="shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#E08E26]">
                    Active Tank · {activeTank.role}
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F3EFE6] leading-tight truncate">
                    {activeTank.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] font-mono tabular-nums text-[#F3EFE6]/70">
                    <span>{getEffectiveTankMaxHp(activeTank)} HP</span>
                    <span>·</span>
                    <span>{getEffectiveTankMoveSpeed(activeTank)} SPD</span>
                    <span>·</span>
                    <span>{activeTank.stats.magazineCapacity} RND</span>
                    <span>·</span>
                    <span>{getEffectiveTankReloadSec(activeTank).toFixed(2)}s RLD</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-[#F3EFE6]/65 truncate">
                    <span className="text-[#E08E26] font-semibold">
                      {activeTank.activeAbility.name}
                    </span>{' '}
                    · {getEffectiveTankProjectileRange(activeTank)} Rng
                  </div>
                </div>
              </div>

              {/* Selected Arena Staging */}
              <button
                type="button"
                onClick={() => onNavigate('ARENA_SELECT')}
                className="sm:col-span-5 text-left bg-[#141714]/85 border border-[#F3EFE6]/12 hover:border-[#E08E26]/65 rounded-xl p-2.5 transition group"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#F3EFE6]/60">
                    Selected Arena
                  </span>
                  <span className="text-[11px] font-semibold text-[#E08E26] flex items-center gap-0.5">
                    Change
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
                <ArenaPreviewSvg arena={activeArena} className="rounded-md" />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="font-display text-lg font-bold text-[#F3EFE6] leading-none truncate">
                    {activeArena.name}
                  </span>
                  <span className="text-[10px] font-mono text-[#F3EFE6]/60 truncate">
                    {activeArena.subtitle}
                  </span>
                </div>
              </button>
            </div>

            {/* Compact Combat Summary Strip */}
            <div className="grid grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-[#F3EFE6]/10 text-center">
              <div>
                <div className="font-mono text-sm sm:text-base font-bold tabular-nums text-[#F3EFE6]">
                  {progression.matchesPlayed}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[#F3EFE6]/50">
                  Matches
                </div>
              </div>
              <div>
                <div className="font-mono text-sm sm:text-base font-bold tabular-nums text-[#22C55E]">
                  {progression.wins}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[#F3EFE6]/50">
                  Wins
                </div>
              </div>
              <div>
                <div className="font-mono text-sm sm:text-base font-bold tabular-nums text-[#F3EFE6]">
                  {progression.totalEliminations}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[#F3EFE6]/50">
                  Elims
                </div>
              </div>
              <div>
                <div className="font-mono text-sm sm:text-base font-bold tabular-nums text-[#E08E26]">
                  {progression.bestPlacement ? `#${progression.bestPlacement}` : '—'}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-[#F3EFE6]/50">
                  Best Rank
                </div>
              </div>
            </div>
          </div>

          {/* Large Prominent PLAY Action */}
          <button
            type="button"
            onClick={onStartBattle}
            className={`w-full rounded-2xl bg-[#E08E26] text-[#141714] font-display font-extrabold tracking-wider uppercase flex items-center justify-center gap-3 hover:bg-[#EE9B32] active:scale-[0.99] transition shadow-xl border-2 border-[#FEF08A]/35 ${
              isCompactLandscape ? 'min-h-[52px] text-2xl' : 'min-h-[60px] sm:min-h-[66px] text-3xl sm:text-4xl'
            }`}
          >
            <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
            PLAY
          </button>
        </section>

        {/* Right Column: Tank-Themed Navigation Hub */}
        <nav
          aria-label="Primary menu navigation"
          className={`landscape:col-span-5 lg:col-span-5 flex flex-col ${
            isCompactLandscape ? 'gap-2' : 'gap-2.5'
          }`}
        >
          <button
            type="button"
            onClick={() => onNavigate('GARAGE')}
            className="min-h-[52px] sm:min-h-[58px] w-full px-4 py-2.5 rounded-xl bg-[#1E221D] border border-[#F3EFE6]/18 hover:border-[#E08E26]/75 hover:bg-[#252A23] transition flex items-center justify-between gap-3 text-left group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#E08E26]/15 border border-[#E08E26]/40 text-[#E08E26] flex items-center justify-center shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-xl font-bold tracking-wide text-[#F3EFE6] leading-none">
                  Garage
                </div>
                <div className="text-xs text-[#F3EFE6]/60 mt-0.5 truncate">
                  Inspect &amp; rotate {activeTank.name}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#F3EFE6]/45 group-hover:text-[#E08E26] group-hover:translate-x-0.5 transition shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('TANK_COLLECTION')}
            className="min-h-[52px] sm:min-h-[58px] w-full px-4 py-2.5 rounded-xl bg-[#1E221D] border border-[#F3EFE6]/18 hover:border-[#E08E26]/75 hover:bg-[#252A23] transition flex items-center justify-between gap-3 text-left group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#272D25] border border-[#F3EFE6]/20 text-[#F3EFE6] flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-[#E08E26]" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-xl font-bold tracking-wide text-[#F3EFE6] leading-none">
                  Tank Collection
                </div>
                <div className="text-xs text-[#F3EFE6]/60 mt-0.5 truncate">
                  Compare &amp; deploy all 6 combat tanks
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#F3EFE6]/45 group-hover:text-[#E08E26] group-hover:translate-x-0.5 transition shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('ARENA_SELECT')}
            className="min-h-[52px] sm:min-h-[58px] w-full px-4 py-2.5 rounded-xl bg-[#1E221D] border border-[#F3EFE6]/18 hover:border-[#E08E26]/75 hover:bg-[#252A23] transition flex items-center justify-between gap-3 text-left group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#272D25] border border-[#F3EFE6]/20 text-[#F3EFE6] flex items-center justify-center shrink-0">
                <MapIcon className="w-5 h-5 text-sky-400" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-xl font-bold tracking-wide text-[#F3EFE6] leading-none">
                  Arena Selection
                </div>
                <div className="text-xs text-[#F3EFE6]/60 mt-0.5 truncate">
                  Current: {activeArena.name}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-[#F3EFE6]/45 group-hover:text-[#E08E26] group-hover:translate-x-0.5 transition shrink-0" />
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('MISSIONS')}
              className="min-h-[50px] px-3.5 py-2 rounded-xl bg-[#1E221D] border border-[#F3EFE6]/18 hover:border-[#E08E26]/65 hover:bg-[#252A23] transition flex items-center gap-2.5 text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-[#272D25] border border-[#F3EFE6]/15 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4 text-[#E08E26]" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg font-bold leading-none text-[#F3EFE6]">
                  Missions
                </div>
                <div className="text-[10px] font-mono text-[#F3EFE6]/55 mt-0.5 truncate">
                  Stage 11
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('SETTINGS')}
              className="min-h-[50px] px-3.5 py-2 rounded-xl bg-[#1E221D] border border-[#F3EFE6]/18 hover:border-[#E08E26]/65 hover:bg-[#252A23] transition flex items-center gap-2.5 text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-[#272D25] border border-[#F3EFE6]/15 flex items-center justify-center shrink-0">
                <Settings className="w-4 h-4 text-[#F3EFE6]/85" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-lg font-bold leading-none text-[#F3EFE6]">
                  Settings
                </div>
                <div className="text-[10px] font-mono text-[#F3EFE6]/55 mt-0.5 truncate">
                  Audio · Graphics
                </div>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#F3EFE6]/50 px-1 pt-0.5">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#E08E26]" />
              6 Tanks · 3 Arenas · 10 Powerups
            </span>
            <span className="inline-flex items-center gap-1 font-mono">
              <Compass className="w-3.5 h-3.5" />
              FFA Arena
            </span>
          </div>
        </nav>
      </main>
    </div>
  );
}
