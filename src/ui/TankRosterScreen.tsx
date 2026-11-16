import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Play, Shield, Wrench, Zap } from 'lucide-react';
import { TankPreviewSvg } from '../components/TankPreviewSvg';
import {
  getEffectiveTankMaxHp,
  getEffectiveTankMoveSpeed,
  getEffectiveTankProjectileRange,
  getEffectiveTankReloadSec,
  TANK_DEFINITIONS,
  TANK_LIST,
} from '../data/tanks';
import { PlayerProgression, TankId } from '../types/game';

interface TankRosterScreenProps {
  progression: PlayerProgression;
  onSelectTank: (tankId: TankId) => void;
  onOpenGarage: () => void;
  onBack: () => void;
  onStartBattle: (tankId?: TankId) => void;
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-20 text-[#F3EFE6]/65 font-medium">{label}</span>
      <div className="flex-1 h-2 bg-[#141714] rounded-sm overflow-hidden border border-[#F3EFE6]/10">
        <div
          className="h-full bg-[#E08E26] transition-all duration-200"
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className="w-7 text-right font-mono tabular-nums text-[#F3EFE6]/85">
        {value}/10
      </span>
    </div>
  );
}

export function TankRosterScreen({
  progression,
  onSelectTank,
  onOpenGarage,
  onBack,
  onStartBattle,
}: TankRosterScreenProps) {
  const [inspectedId, setInspectedId] = useState<TankId>(progression.selectedTank);
  useEffect(() => {
    setInspectedId(progression.selectedTank);
  }, [progression.selectedTank]);

  const inspectedTank = TANK_DEFINITIONS[inspectedId] || TANK_DEFINITIONS.assault;
  const effectiveMaxHp = getEffectiveTankMaxHp(inspectedTank);
  const effectiveMoveSpeed = getEffectiveTankMoveSpeed(inspectedTank);
  const effectiveRange = getEffectiveTankProjectileRange(inspectedTank);
  const effectiveReloadSec = getEffectiveTankReloadSec(inspectedTank);
  const isSelected = progression.selectedTank === inspectedTank.id;

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
              Tank Collection
            </h1>
            <p className="text-[11px] text-[#F3EFE6]/55 mt-0.5">
              All 6 combat tanks ready for deployment
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenGarage}
          className="min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-[#1E221D] border border-[#F3EFE6]/20 text-xs sm:text-sm font-semibold flex items-center gap-2 hover:border-[#E08E26]/65 hover:bg-[#262C24] transition whitespace-nowrap"
        >
          <Wrench className="w-4 h-4 text-[#E08E26]" />
          Open Garage
        </button>
      </header>

      {/* Main Content */}
      <main className="screen-transition flex-1 w-full max-w-6xl mx-auto px-4 sm:px-7 py-3.5 sm:py-5 grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* All 6 Tank Cards */}
        <section className="landscape:col-span-7 lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {TANK_LIST.map((tank) => {
            const selected = progression.selectedTank === tank.id;
            const focused = inspectedTank.id === tank.id;

            return (
              <button
                key={tank.id}
                type="button"
                onClick={() => {
                  setInspectedId(tank.id);
                  onSelectTank(tank.id);
                }}
                aria-pressed={selected}
                className={`text-left rounded-xl p-3 border transition flex flex-col items-center gap-2 ${
                  selected
                    ? 'bg-[#252B23] border-[#E08E26] shadow-lg'
                    : focused
                    ? 'bg-[#212620] border-[#F3EFE6]/35'
                    : 'bg-[#1B1F1A]/95 border-[#F3EFE6]/12 hover:border-[#F3EFE6]/30'
                }`}
              >
                <div className="relative">
                  <TankPreviewSvg tank={tank} size={78} />
                  {selected && (
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#22C55E] text-[#141714] flex items-center justify-center shadow">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div className="w-full text-center">
                  <div className="font-display text-lg font-bold leading-tight truncate text-[#F3EFE6]">
                    {tank.name}
                  </div>
                  <div className="text-[11px] text-[#F3EFE6]/60 truncate">
                    {tank.role}
                  </div>
                  <div
                    className={`mt-1 text-[10px] font-mono uppercase tracking-wider font-semibold ${
                      selected ? 'text-[#22C55E]' : 'text-[#F3EFE6]/45'
                    }`}
                  >
                    {selected ? 'Selected' : 'Select'}
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        {/* Detailed Inspector */}
        <aside className="landscape:col-span-5 lg:col-span-5 bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5">
          <div className="flex items-center gap-3.5">
            <TankPreviewSvg tank={inspectedTank} size={86} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-[#E08E26] font-medium truncate">
                {inspectedTank.role} · {effectiveMaxHp} HP
              </div>
              <h2 className="font-display text-3xl font-extrabold text-[#F3EFE6] leading-tight truncate">
                {inspectedTank.name}
              </h2>
              <p className="text-xs text-[#F3EFE6]/75 mt-1 leading-relaxed">
                {inspectedTank.description}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[#F3EFE6]/10">
            <StatBar label="Armor" value={inspectedTank.ratings.armor} />
            <StatBar label="Firepower" value={inspectedTank.ratings.firepower} />
            <StatBar label="Mobility" value={inspectedTank.ratings.mobility} />
            <StatBar label="Range" value={inspectedTank.ratings.range} />
          </div>

          {/* Numeric Combat, Magazine & Reload Specifications */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F3EFE6]/10 text-xs font-mono tabular-nums">
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Health</div>
              <div className="font-bold text-[#F3EFE6]">{effectiveMaxHp} HP</div>
            </div>
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Move Speed</div>
              <div className="font-bold text-[#F3EFE6]">{effectiveMoveSpeed}</div>
            </div>
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Proj. Range</div>
              <div className="font-bold text-[#F3EFE6]">{effectiveRange}</div>
            </div>
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Magazine</div>
              <div className="font-bold text-[#E08E26]">
                {inspectedTank.stats.magazineCapacity} Rounds
              </div>
            </div>
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Reload</div>
              <div className="font-bold text-emerald-400">
                {effectiveReloadSec.toFixed(2)}s
              </div>
            </div>
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Damage</div>
              <div className="font-bold text-[#F3EFE6]">
                {inspectedTank.stats.projectileDamage}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[#F3EFE6]/10 text-xs">
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg p-2.5">
              <div className="flex items-center justify-between font-semibold text-[#E08E26]">
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Active: {inspectedTank.activeAbility.name}
                </span>
                <span className="font-mono tabular-nums text-[#F3EFE6]/65">
                  {inspectedTank.activeAbility.cooldownSec}s CD
                </span>
              </div>
              <p className="text-[#F3EFE6]/75 mt-1 leading-relaxed">
                {inspectedTank.activeAbility.description}
              </p>
            </div>

            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg p-2.5">
              <div className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                <Shield className="w-3.5 h-3.5" />
                Passive: {inspectedTank.passiveAbility.name}
              </div>
              <p className="text-[#F3EFE6]/75 mt-1 leading-relaxed">
                {inspectedTank.passiveAbility.description}
              </p>
            </div>
          </div>

          <div className="pt-1 flex items-center gap-2.5">
            {!isSelected ? (
              <button
                type="button"
                onClick={() => onSelectTank(inspectedTank.id)}
                className="min-h-[46px] flex-1 px-4 rounded-xl bg-[#272D25] border border-[#F3EFE6]/25 text-sm font-semibold hover:bg-[#31382E] transition whitespace-nowrap"
              >
                Select Tank
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenGarage}
                className="min-h-[46px] flex-1 px-4 rounded-xl bg-[#272D25] border border-[#F3EFE6]/25 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#31382E] transition whitespace-nowrap"
              >
                <Wrench className="w-4 h-4 text-[#E08E26]" />
                Inspect in Garage
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onSelectTank(inspectedTank.id);
                onStartBattle(inspectedTank.id);
              }}
              className="min-h-[46px] flex-1 px-5 rounded-xl bg-[#E08E26] text-[#141714] font-display text-lg font-extrabold tracking-wide flex items-center justify-center gap-2 hover:bg-[#EE9B32] transition whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" />
              Play Match
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
