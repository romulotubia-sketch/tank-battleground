import { BookOpen, Layers, Maximize2, Minimize2, Play, Settings, ShieldAlert } from 'lucide-react';
import { TankPreviewSvg } from '../components/TankPreviewSvg';
import { ARENA_DEFINITIONS, ARENA_LIST } from '../game/arenas/arenaLayouts';
import {
  getEffectiveTankMaxHp,
  getEffectiveTankMoveSpeed,
  getEffectiveTankProjectileRange,
  getEffectiveTankReloadSec,
  TANK_DEFINITIONS,
} from '../data/tanks';
import { ArenaId, PlayerProgression, ScreenId } from '../types/game';
import {
  enterLandscapeFullscreen,
  exitLandscapeFullscreen,
  useViewportOrientation,
} from '../utils/orientation';

interface MainMenuProps {
  progression: PlayerProgression;
  onNavigate: (screen: ScreenId) => void;
  onSelectArena: (arenaId: ArenaId) => void;
  onStartBattle: () => void;
}

export function MainMenu({
  progression,
  onNavigate,
  onSelectArena,
  onStartBattle,
}: MainMenuProps) {
  const activeTank = TANK_DEFINITIONS[progression.selectedTank] || TANK_DEFINITIONS.assault;
  const activeArena = ARENA_DEFINITIONS[progression.selectedArena] || ARENA_DEFINITIONS.training_grounds;
  const { isCompactLandscape, isFullscreen, canFullscreen } = useViewportOrientation();

  return (
    <div className="w-full h-full overflow-y-auto bg-[#161915] text-[#F3EFE6] flex flex-col">
      {/* Top Bar */}
      <header
        className={`w-full max-w-6xl mx-auto px-4 sm:px-8 flex items-center justify-between gap-4 border-b border-[#F3EFE6]/10 shrink-0 ${
          isCompactLandscape ? 'py-2' : 'py-3.5'
        }`}
      >
        <span className="font-display text-2xl sm:text-3xl font-extrabold tracking-wide text-[#F3EFE6] whitespace-nowrap shrink-0">
          Tankbound Arena
        </span>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#F3EFE6]/75">
          <button
            type="button"
            onClick={() => onNavigate('TANK_SELECT')}
            className="hover:text-[#F3EFE6] transition whitespace-nowrap shrink-0"
          >
            Tank Selection
          </button>
          <button
            type="button"
            onClick={() => onNavigate('TANK_COLLECTION')}
            className="hover:text-[#F3EFE6] transition whitespace-nowrap shrink-0"
          >
            Tank Collection
          </button>
          <button
            type="button"
            onClick={() => onNavigate('HOW_TO_PLAY')}
            className="hover:text-[#F3EFE6] transition whitespace-nowrap shrink-0"
          >
            How to Play
          </button>
          <button
            type="button"
            onClick={() => onNavigate('SETTINGS')}
            className="hover:text-[#F3EFE6] transition whitespace-nowrap shrink-0"
          >
            Settings
          </button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0 text-sm font-mono tabular-nums">
          <span className="text-[#E08E26] font-bold whitespace-nowrap">
            {progression.scrap} Scrap
          </span>
          {canFullscreen && (
            <button
              type="button"
              onClick={() => {
                if (isFullscreen) exitLandscapeFullscreen();
                else enterLandscapeFullscreen();
              }}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter landscape fullscreen'}
              title={isFullscreen ? 'Exit Fullscreen' : 'Landscape Fullscreen'}
              className="min-w-[40px] min-h-[40px] px-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-[#F3EFE6]/15 text-xs font-sans font-medium text-[#F3EFE6]/85 hover:bg-[#232721] transition whitespace-nowrap"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {isFullscreen ? 'Exit Full' : 'Landscape'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('SETTINGS')}
            aria-label="Settings"
            className="md:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-[#F3EFE6]/15 hover:bg-[#232721]"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 items-center ${
          isCompactLandscape ? 'py-3 gap-4' : 'py-4 sm:py-8 gap-5 lg:gap-8'
        }`}
      >
        {/* Left Column: Primary Staging & Launch */}
        <section
          className={`landscape:col-span-7 lg:col-span-7 flex flex-col justify-between ${
            isCompactLandscape ? 'gap-3' : 'gap-4 sm:gap-6'
          }`}
        >
          <div>
            <p className="text-xs sm:text-sm font-medium text-[#F3EFE6]/65 tracking-wide">
              8-Tank Free-for-All · Top-Down Arcade Combat
            </p>
            <h1
              className={`font-display font-extrabold tracking-tight text-[#F3EFE6] leading-[1.02] mt-1 text-balance ${
                isCompactLandscape
                  ? 'text-3xl sm:text-4xl'
                  : 'text-4xl sm:text-5xl lg:text-6xl'
              }`}
            >
              Roll Out Into the Battleground
            </h1>
            {!isCompactLandscape && (
              <p className="text-sm sm:text-base text-[#F3EFE6]/75 mt-2.5 max-w-xl leading-relaxed">
                Outmaneuver seven AI commanders across destructible arenas. Rotate your turret independently, trigger unique tank abilities, and claim supply drops.
              </p>
            )}
          </div>

          {/* Arena Selector */}
          <div
            className={`bg-[#1E221D] border border-[#F3EFE6]/12 rounded-xl ${
              isCompactLandscape ? 'p-2.5' : 'p-3.5 sm:p-4'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-[#F3EFE6]/70">Battleground Arena</span>
              <span className="text-xs text-[#F3EFE6]/55">{activeArena.subtitle}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ARENA_LIST.map((arena) => {
                const selected = arena.id === activeArena.id;
                return (
                  <button
                    key={arena.id}
                    type="button"
                    onClick={() => onSelectArena(arena.id)}
                    className={`min-h-[42px] px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition border whitespace-nowrap truncate ${
                      selected
                        ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                        : 'bg-[#161915] text-[#F3EFE6]/80 border-[#F3EFE6]/15 hover:border-[#F3EFE6]/35'
                    }`}
                  >
                    {arena.name}
                  </button>
                );
              })}
            </div>
            {!isCompactLandscape && (
              <p className="text-xs text-[#F3EFE6]/65 mt-2.5 leading-relaxed">
                {activeArena.description}
              </p>
            )}
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onStartBattle}
              className="min-h-[46px] sm:min-h-[50px] px-6 sm:px-7 py-2.5 rounded-xl bg-[#E08E26] text-[#141714] font-display text-lg sm:text-xl font-extrabold tracking-wide flex items-center justify-center gap-2 hover:bg-[#EE9B32] active:scale-[0.98] transition shadow-lg whitespace-nowrap shrink-0"
            >
              <Play className="w-5 h-5 fill-current" />
              Play Match
            </button>

            <button
              type="button"
              onClick={() => onNavigate('TANK_SELECT')}
              className="min-h-[46px] sm:min-h-[50px] px-4 sm:px-5 py-2.5 rounded-xl bg-[#252A23] border border-[#F3EFE6]/20 text-[#F3EFE6] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#2E342C] transition whitespace-nowrap shrink-0"
            >
              <ShieldAlert className="w-4 h-4 text-[#E08E26]" />
              Tank Selection
            </button>

            <button
              type="button"
              onClick={() => onNavigate('TANK_COLLECTION')}
              className="min-h-[46px] sm:min-h-[50px] px-4 sm:px-5 py-2.5 rounded-xl bg-[#252A23] border border-[#F3EFE6]/20 text-[#F3EFE6] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#2E342C] transition whitespace-nowrap shrink-0"
            >
              <Layers className="w-4 h-4" />
              Tank Collection
            </button>

            <button
              type="button"
              onClick={() => onNavigate('HOW_TO_PLAY')}
              className="min-h-[46px] sm:min-h-[50px] px-4 py-2.5 rounded-xl bg-transparent border border-[#F3EFE6]/15 text-[#F3EFE6]/85 font-medium text-xs sm:text-sm flex items-center justify-center gap-2 hover:bg-[#252A23] transition whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-4 h-4" />
              How to Play
            </button>

            <button
              type="button"
              onClick={() => onNavigate('SETTINGS')}
              className="hidden sm:flex min-h-[46px] sm:min-h-[50px] px-4 py-2.5 rounded-xl bg-transparent border border-[#F3EFE6]/15 text-[#F3EFE6]/85 font-medium text-xs sm:text-sm items-center justify-center gap-2 hover:bg-[#252A23] transition whitespace-nowrap shrink-0"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </section>

        {/* Right Column: Active Tank Loadout & Career Summary */}
        <aside
          className={`landscape:col-span-5 lg:col-span-5 bg-[#1E221D] border border-[#F3EFE6]/15 rounded-xl flex flex-col ${
            isCompactLandscape ? 'p-3.5 gap-2.5' : 'p-5 gap-4'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-xs font-medium text-[#F3EFE6]/60 block truncate">
                Selected Vehicle · {activeTank.role}
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F3EFE6] truncate">
                {activeTank.name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('TANK_SELECT')}
              className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[#F3EFE6]/20 text-xs font-semibold text-[#F3EFE6]/85 hover:bg-[#292E27] transition whitespace-nowrap shrink-0"
            >
              Change Tank
            </button>
          </div>

          <div
            className={`flex items-center gap-3.5 bg-[#161915] border border-[#F3EFE6]/10 rounded-lg ${
              isCompactLandscape ? 'p-2.5' : 'p-3.5'
            }`}
          >
            <TankPreviewSvg
              tank={activeTank}
              size={isCompactLandscape ? 70 : 92}
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              {!isCompactLandscape && (
                <p className="text-xs text-[#F3EFE6]/75 leading-relaxed">
                  {activeTank.description}
                </p>
              )}
              <div className="text-xs text-[#E08E26] font-semibold">
                Active: {activeTank.activeAbility.name} · {activeTank.activeAbility.cooldownSec}s cooldown
              </div>
              <div className="mt-0.5 text-xs text-[#F3EFE6]/70">
                Passive: {activeTank.passiveAbility.name}
              </div>
              <div className="mt-1 text-[11px] font-mono tabular-nums text-[#F3EFE6]/65">
                {getEffectiveTankMaxHp(activeTank)} HP · {getEffectiveTankMoveSpeed(activeTank)} Spd ·{' '}
                {getEffectiveTankProjectileRange(activeTank)} Rng ·{' '}
                {activeTank.stats.magazineCapacity} Ammo ·{' '}
                {getEffectiveTankReloadSec(activeTank).toFixed(2)}s Reload
              </div>
            </div>
          </div>

          {/* Career Record */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#F3EFE6]/10 text-center">
            <div>
              <div className="font-mono text-base sm:text-lg font-bold tabular-nums text-[#F3EFE6]">
                {progression.matchesPlayed}
              </div>
              <div className="text-[11px] text-[#F3EFE6]/55">Matches</div>
            </div>
            <div>
              <div className="font-mono text-base sm:text-lg font-bold tabular-nums text-[#22C55E]">
                {progression.wins}
              </div>
              <div className="text-[11px] text-[#F3EFE6]/55">Victories</div>
            </div>
            <div>
              <div className="font-mono text-base sm:text-lg font-bold tabular-nums text-[#F3EFE6]">
                {progression.totalEliminations}
              </div>
              <div className="text-[11px] text-[#F3EFE6]/55">Elims</div>
            </div>
            <div>
              <div className="font-mono text-base sm:text-lg font-bold tabular-nums text-[#E08E26]">
                {progression.bestPlacement ? `#${progression.bestPlacement}` : '—'}
              </div>
              <div className="text-[11px] text-[#F3EFE6]/55">Best Rank</div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
