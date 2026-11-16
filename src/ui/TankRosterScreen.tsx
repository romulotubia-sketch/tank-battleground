import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Lock, Play, Shield, Zap } from 'lucide-react';
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
  mode: 'select' | 'collection';
  progression: PlayerProgression;
  onSelectTank: (tankId: TankId) => void;
  onUnlockTank: (tankId: TankId) => void;
  onBack: () => void;
  onStartBattle: (tankId?: TankId) => void;
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-20 text-[#F3EFE6]/65 font-medium">{label}</span>
      <div className="flex-1 h-2 bg-[#161915] rounded-sm overflow-hidden border border-[#F3EFE6]/10">
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
  mode,
  progression,
  onSelectTank,
  onUnlockTank,
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

  const isUnlocked = progression.unlockedTanks.includes(inspectedTank.id);
  const isSelected = progression.selectedTank === inspectedTank.id;
  const canAfford = progression.scrap >= inspectedTank.unlockCost;

  return (
    <div className="w-full h-full overflow-y-auto bg-[#161915] text-[#F3EFE6] flex flex-col">
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 border-b border-[#F3EFE6]/10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3 rounded-lg border border-[#F3EFE6]/20 flex items-center gap-1.5 text-sm font-medium hover:bg-[#232721] transition whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-wide">
            {mode === 'collection' ? 'Tank Collection' : 'Tank Selection'}
          </h1>
        </div>

        <div className="flex items-center gap-4 text-sm font-mono tabular-nums">
          <span className="text-[#E08E26] font-bold">{progression.scrap} Scrap</span>
          <span className="hidden sm:inline text-[#F3EFE6]/60">
            {TANK_LIST.filter((t) => t.implemented).length} Active ·{' '}
            {TANK_LIST.filter((t) => !t.implemented).length} Upcoming
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-3 sm:py-6 grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* Roster Grid */}
        <section className="landscape:col-span-7 lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {TANK_LIST.map((tank) => {
            if (!tank.implemented) {
              return (
                <div
                  key={tank.id}
                  aria-disabled="true"
                  className="text-left rounded-xl p-3 border bg-[#191C18] border-[#F3EFE6]/10 opacity-60 flex flex-col items-center gap-2 select-none"
                >
                  <div className="relative">
                    <TankPreviewSvg
                      tank={tank}
                      size={76}
                      className="opacity-45 grayscale-[60%]"
                    />
                    <span className="absolute top-0 right-0 w-6 h-6 rounded-full bg-[#141714] border border-[#F3EFE6]/25 flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5 text-[#F3EFE6]/65" />
                    </span>
                  </div>

                  <div className="w-full text-center">
                    <div className="font-display text-lg font-bold leading-tight truncate text-[#F3EFE6]/70">
                      {tank.name}
                    </div>
                    <div className="text-[11px] text-[#F3EFE6]/45 truncate">
                      Coming Soon
                    </div>
                  </div>
                </div>
              );
            }

            const unlocked = progression.unlockedTanks.includes(tank.id);
            const selected = progression.selectedTank === tank.id;
            const focused = inspectedTank.id === tank.id;

            return (
              <button
                key={tank.id}
                type="button"
                onClick={() => {
                  setInspectedId(tank.id);
                  if (unlocked) onSelectTank(tank.id);
                }}
                className={`text-left rounded-xl p-3 border transition flex flex-col items-center gap-2 ${
                  focused
                    ? 'bg-[#252B23] border-[#E08E26]'
                    : 'bg-[#1E221D] border-[#F3EFE6]/12 hover:border-[#F3EFE6]/30'
                }`}
              >
                <div className="relative">
                  <TankPreviewSvg
                    tank={tank}
                    size={76}
                    className={unlocked ? '' : 'opacity-55 grayscale-[35%]'}
                  />
                  {!unlocked && (
                    <span className="absolute top-0 right-0 w-6 h-6 rounded-full bg-[#141714] border border-[#F3EFE6]/25 flex items-center justify-center">
                      <Lock className="w-3.5 h-3.5 text-[#F3EFE6]/75" />
                    </span>
                  )}
                  {selected && (
                    <span className="absolute top-0 right-0 w-6 h-6 rounded-full bg-[#22C55E] text-[#141714] flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div className="w-full text-center">
                  <div className="font-display text-lg font-bold leading-tight truncate">
                    {tank.name}
                  </div>
                  <div className="text-[11px] text-[#F3EFE6]/60 truncate">
                    {unlocked
                      ? selected
                        ? 'Deployed'
                        : 'Unlocked'
                      : `${tank.unlockCost} Scrap`}
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        {/* Detailed Inspector */}
        <aside className="landscape:col-span-5 lg:col-span-5 bg-[#1E221D] border border-[#F3EFE6]/15 rounded-xl p-4 sm:p-5 flex flex-col gap-3.5 sm:gap-4">
          <div className="flex items-center gap-4">
            <TankPreviewSvg tank={inspectedTank} size={88} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-[#F3EFE6]/60 font-medium">
                {inspectedTank.role} · {effectiveMaxHp} HP
              </div>
              <h2 className="font-display text-3xl font-extrabold text-[#F3EFE6] leading-tight">
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
            <div className="bg-[#161915] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Health</div>
              <div className="font-bold text-[#F3EFE6]">
                {effectiveMaxHp} HP
                {effectiveMaxHp > inspectedTank.stats.maxHp && (
                  <span className="text-[10px] font-normal text-emerald-400 block">
                    (Base {inspectedTank.stats.maxHp})
                  </span>
                )}
              </div>
            </div>
            <div className="bg-[#161915] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Damage</div>
              <div className="font-bold text-[#F3EFE6]">{inspectedTank.stats.projectileDamage}</div>
            </div>
            <div className="bg-[#161915] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Speed / Range</div>
              <div className="font-bold text-[#F3EFE6]">
                {effectiveMoveSpeed} / {effectiveRange}
                {effectiveMoveSpeed > inspectedTank.stats.moveSpeed && (
                  <span className="text-[10px] font-normal text-emerald-400 block">
                    (Base {inspectedTank.stats.moveSpeed} spd)
                  </span>
                )}
                {effectiveRange > inspectedTank.stats.projectileRange && (
                  <span className="text-[10px] font-normal text-emerald-400 block">
                    (Base {inspectedTank.stats.projectileRange} rng)
                  </span>
                )}
              </div>
            </div>
            <div className="bg-[#161915] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Magazine</div>
              <div className="font-bold text-[#E08E26]">
                {inspectedTank.stats.magazineCapacity} Rounds
              </div>
            </div>
            <div className="col-span-2 bg-[#161915] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Reload Duration</div>
              <div className="font-bold text-emerald-400">
                {effectiveReloadSec.toFixed(2)}s
                {inspectedTank.passiveAbility.reloadDurationMultiplier &&
                  inspectedTank.passiveAbility.reloadDurationMultiplier < 1 && (
                    <span className="text-[11px] font-normal text-[#F3EFE6]/55 ml-1.5">
                      (Base {inspectedTank.stats.reloadDurationSec.toFixed(2)}s)
                    </span>
                  )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2 border-t border-[#F3EFE6]/10 text-xs">
            <div className="bg-[#161915] border border-[#F3EFE6]/10 rounded-lg p-3">
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

            <div className="bg-[#161915] border border-[#F3EFE6]/10 rounded-lg p-3">
              <div className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                <Shield className="w-3.5 h-3.5" />
                Passive: {inspectedTank.passiveAbility.name}
              </div>
              <p className="text-[#F3EFE6]/75 mt-1 leading-relaxed">
                {inspectedTank.passiveAbility.description}
              </p>
            </div>
          </div>

          {/* Action Bar */}
          <div className="pt-1 flex items-center gap-3">
            {isUnlocked ? (
              <>
                {!isSelected && (
                  <button
                    type="button"
                    onClick={() => onSelectTank(inspectedTank.id)}
                    className="min-h-[46px] flex-1 px-4 rounded-xl bg-[#2B3229] border border-[#F3EFE6]/25 text-sm font-semibold hover:bg-[#343C31] transition whitespace-nowrap"
                  >
                    Select Tank
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
                  Deploy Into Battle
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={!canAfford}
                onClick={() => onUnlockTank(inspectedTank.id)}
                className={`min-h-[46px] w-full px-5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition whitespace-nowrap ${
                  canAfford
                    ? 'bg-[#E08E26] text-[#141714] hover:bg-[#EE9B32]'
                    : 'bg-[#161915] border border-[#F3EFE6]/15 text-[#F3EFE6]/50 cursor-not-allowed'
                }`}
              >
                <Lock className="w-4 h-4" />
                {canAfford
                  ? `Unlock for ${inspectedTank.unlockCost} Scrap`
                  : `Requires ${inspectedTank.unlockCost} Scrap (${
                      inspectedTank.unlockCost - progression.scrap
                    } more needed)`}
              </button>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
