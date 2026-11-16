import { ArrowLeft, Check, Compass, Play, Shield } from 'lucide-react';
import { ArenaPreviewSvg } from '../components/ArenaPreviewSvg';
import { ARENA_DEFINITIONS, ARENA_LIST } from '../game/arenas/arenaLayouts';
import { ArenaId } from '../types/game';

interface ArenaSelectionScreenProps {
  selectedArena: ArenaId;
  onSelectArena: (arenaId: ArenaId) => void;
  onBack: () => void;
  onStartBattle: () => void;
}

export function ArenaSelectionScreen({
  selectedArena,
  onSelectArena,
  onBack,
  onStartBattle,
}: ArenaSelectionScreenProps) {
  const activeArena =
    ARENA_DEFINITIONS[selectedArena] || ARENA_DEFINITIONS.training_grounds;

  const destructibleCount = activeArena.obstacles.filter(
    (o) => o.type === 'brick' || o.type === 'crate'
  ).length;
  const steelCount = activeArena.obstacles.filter((o) => o.type === 'steel').length;
  const barrelCount = activeArena.obstacles.filter((o) => o.type === 'barrel').length;
  const bushCount = activeArena.obstacles.filter((o) => o.type === 'bush').length;

  return (
    <div className="w-full h-full overflow-y-auto bg-[#141714] tactical-bg-grid text-[#F3EFE6] flex flex-col">
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-7 py-3 flex items-center justify-between gap-3 border-b border-[#F3EFE6]/12 shrink-0 bg-[#141714]/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3.5 rounded-xl border border-[#F3EFE6]/20 bg-[#1E221D] flex items-center gap-1.5 text-sm font-semibold hover:bg-[#282D26] transition whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-wide leading-none">
              Arena Selection
            </h1>
            <p className="text-[11px] text-[#F3EFE6]/55 mt-0.5">
              Choose your combat theatre · 8-Tank Free-For-All
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-[#E08E26]">
          <Compass className="w-4 h-4" />
          Selected: {activeArena.name}
        </span>
      </header>

      {/* Main Arena Selector */}
      <main className="screen-transition flex-1 w-full max-w-6xl mx-auto px-4 sm:px-7 py-3.5 sm:py-5 grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        {/* Left: 3 Arena Cards */}
        <section className="landscape:col-span-5 lg:col-span-5 flex flex-col gap-2.5 sm:gap-3">
          {ARENA_LIST.map((arena) => {
            const selected = arena.id === activeArena.id;
            return (
              <button
                key={arena.id}
                type="button"
                onClick={() => onSelectArena(arena.id)}
                aria-pressed={selected}
                className={`text-left rounded-2xl p-3.5 sm:p-4 border transition flex items-center gap-3.5 ${
                  selected
                    ? 'bg-[#252B23] border-[#E08E26] shadow-lg'
                    : 'bg-[#1B1F1A]/95 border-[#F3EFE6]/12 hover:border-[#F3EFE6]/32'
                }`}
              >
                <div className="w-24 sm:w-28 shrink-0">
                  <ArenaPreviewSvg arena={arena} className="rounded-lg" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10px] font-mono uppercase tracking-wider font-semibold"
                      style={{ color: arena.themeAccent }}
                    >
                      {arena.subtitle}
                    </span>
                    {selected && (
                      <span className="inline-flex items-center gap-1 rounded bg-[#22C55E] text-[#141714] px-2 py-0.5 text-[10px] font-bold uppercase">
                        <Check className="w-3 h-3 stroke-[3]" />
                        Selected
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-2xl font-extrabold text-[#F3EFE6] leading-tight mt-0.5 truncate">
                    {arena.name}
                  </h2>
                  <p className="text-xs text-[#F3EFE6]/70 mt-1 line-clamp-2 leading-snug">
                    {arena.identity}
                  </p>
                </div>
              </button>
            );
          })}
        </section>

        {/* Right: Large Tactical Map Preview & Arena Characteristics */}
        <section className="landscape:col-span-7 lg:col-span-7 bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <div
                  className="text-xs font-mono uppercase tracking-wider font-semibold"
                  style={{ color: activeArena.themeAccent }}
                >
                  {activeArena.subtitle} · {activeArena.identity}
                </div>
                <h2 className="font-display text-3xl font-extrabold text-[#F3EFE6] leading-none mt-0.5">
                  {activeArena.name}
                </h2>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#F3EFE6]/60">
                {activeArena.width} × {activeArena.height} · 8 Spawns
              </span>
            </div>

            <ArenaPreviewSvg arena={activeArena} className="rounded-xl shadow-lg" />

            <p className="text-xs sm:text-sm text-[#F3EFE6]/80 mt-3 leading-relaxed">
              {activeArena.description}
            </p>

            {/* Gameplay Characteristics */}
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              {activeArena.features.map((feature) => (
                <div
                  key={feature}
                  className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-3 py-2 flex items-center gap-2 text-[#F3EFE6]/85"
                >
                  <Shield className="w-3.5 h-3.5 text-[#E08E26] shrink-0" />
                  <span className="truncate">{feature}</span>
                </div>
              ))}
            </div>

            {/* Tactical Composition Readout */}
            <div className="grid grid-cols-4 gap-2 mt-3 pt-2.5 border-t border-[#F3EFE6]/10 text-center font-mono tabular-nums text-xs">
              <div>
                <div className="font-bold text-[#F3EFE6]">{steelCount}</div>
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Steel Cover</div>
              </div>
              <div>
                <div className="font-bold text-[#F3EFE6]">{destructibleCount}</div>
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Destructibles</div>
              </div>
              <div>
                <div className="font-bold text-emerald-400">{bushCount}</div>
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Brush Zones</div>
              </div>
              <div>
                <div className="font-bold text-red-400">{barrelCount}</div>
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Fuel Barrels</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[48px] px-5 rounded-xl bg-[#272D25] border border-[#F3EFE6]/20 text-sm font-semibold hover:bg-[#31382E] transition whitespace-nowrap"
            >
              Confirm &amp; Back
            </button>
            <button
              type="button"
              onClick={onStartBattle}
              className="min-h-[48px] flex-1 px-6 rounded-xl bg-[#E08E26] text-[#141714] font-display text-xl font-extrabold tracking-wide flex items-center justify-center gap-2 hover:bg-[#EE9B32] transition whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              Play {activeArena.name}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
