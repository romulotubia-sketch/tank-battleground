import { useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Play,
  RotateCcw,
  RotateCw,
  Shield,
  Zap,
} from 'lucide-react';
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

interface GarageScreenProps {
  progression: PlayerProgression;
  onSelectTank: (tankId: TankId) => void;
  onOpenCollection: () => void;
  onBack: () => void;
  onStartBattle: (tankId?: TankId) => void;
}

export function GarageScreen({
  progression,
  onSelectTank,
  onOpenCollection,
  onBack,
  onStartBattle,
}: GarageScreenProps) {
  const [inspectedId, setInspectedId] = useState<TankId>(progression.selectedTank);
  const [hullAngleDeg, setHullAngleDeg] = useState(-24);
  const [turretOffsetDeg, setTurretOffsetDeg] = useState(0);
  const dragStartRef = useRef<{ x: number; startAngle: number } | null>(null);

  const tank = TANK_DEFINITIONS[inspectedId] || TANK_DEFINITIONS.assault;
  const isSelected = progression.selectedTank === tank.id;

  const effectiveMaxHp = getEffectiveTankMaxHp(tank);
  const effectiveSpeed = getEffectiveTankMoveSpeed(tank);
  const effectiveRange = getEffectiveTankProjectileRange(tank);
  const effectiveReload = getEffectiveTankReloadSec(tank);

  const currentIdx = TANK_LIST.findIndex((t) => t.id === tank.id);
  const cycleTank = (dir: -1 | 1) => {
    const nextIdx = (currentIdx + dir + TANK_LIST.length) % TANK_LIST.length;
    setInspectedId(TANK_LIST[nextIdx].id);
  };

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
              Garage
            </h1>
            <p className="text-[11px] text-[#F3EFE6]/55 mt-0.5">
              Drag tank preview to rotate hull · Swivel turret independently
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCollection}
          className="min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-[#1E221D] border border-[#F3EFE6]/20 text-xs sm:text-sm font-semibold flex items-center gap-2 hover:border-[#E08E26]/65 hover:bg-[#262C24] transition whitespace-nowrap"
        >
          <Layers className="w-4 h-4 text-[#E08E26]" />
          Tank Collection
        </button>
      </header>

      {/* Main Garage Bay */}
      <main className="screen-transition flex-1 w-full max-w-6xl mx-auto px-4 sm:px-7 py-3.5 sm:py-5 grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        {/* Left: Large Interactive Inspection Bay */}
        <section className="landscape:col-span-6 lg:col-span-6 bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => cycleTank(-1)}
              aria-label="Previous tank"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-[#141714] border border-[#F3EFE6]/18 flex items-center justify-center hover:border-[#E08E26]/60 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="text-center min-w-0">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#E08E26]">
                {tank.role}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F3EFE6] leading-none truncate">
                {tank.name}
              </h2>
            </div>

            <button
              type="button"
              onClick={() => cycleTank(1)}
              aria-label="Next tank"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-[#141714] border border-[#F3EFE6]/18 flex items-center justify-center hover:border-[#E08E26]/60 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Interactive Rotation Stage */}
          <div
            role="region"
            aria-label={`${tank.name} rotatable preview`}
            className="touch-none-game relative flex-1 min-h-[195px] sm:min-h-[250px] rounded-xl bg-[#141714] border border-[#F3EFE6]/12 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragStartRef.current = { x: e.clientX, startAngle: hullAngleDeg };
            }}
            onPointerMove={(e) => {
              if (!dragStartRef.current) return;
              const dx = e.clientX - dragStartRef.current.x;
              setHullAngleDeg(dragStartRef.current.startAngle + dx * 0.75);
            }}
            onPointerUp={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
              dragStartRef.current = null;
            }}
            onPointerCancel={() => {
              dragStartRef.current = null;
            }}
          >
            {/* Turntable Bay Rings */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute w-52 h-52 sm:w-64 sm:h-64 rounded-full border border-dashed border-[#E08E26]/25"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full border border-[#F3EFE6]/10"
            />

            <TankPreviewSvg
              tank={tank}
              size={200}
              hullAngleDeg={hullAngleDeg}
              turretAngleDeg={hullAngleDeg + turretOffsetDeg}
              className="pointer-events-none drop-shadow-2xl"
            />

            {isSelected && (
              <span className="pointer-events-none absolute top-3 left-3 inline-flex items-center gap-1 rounded-md bg-[#22C55E] text-[#141714] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                Selected
              </span>
            )}
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-[10px] font-mono text-[#F3EFE6]/45 tabular-nums">
              Hull {Math.round(((hullAngleDeg % 360) + 360) % 360)}° · Turret{' '}
              {Math.round((((hullAngleDeg + turretOffsetDeg) % 360) + 360) % 360)}°
            </span>
          </div>

          {/* Rotation & Turret Inspection Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setHullAngleDeg((a) => a - 45)}
                className="min-h-[42px] px-3 rounded-lg bg-[#141714] border border-[#F3EFE6]/18 text-xs font-semibold flex items-center gap-1.5 hover:border-[#E08E26]/60 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                -45°
              </button>
              <button
                type="button"
                onClick={() => setHullAngleDeg((a) => a + 45)}
                className="min-h-[42px] px-3 rounded-lg bg-[#141714] border border-[#F3EFE6]/18 text-xs font-semibold flex items-center gap-1.5 hover:border-[#E08E26]/60 transition"
              >
                <RotateCw className="w-3.5 h-3.5" />
                +45°
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTurretOffsetDeg((o) => (o + 45) % 360)}
                className="min-h-[42px] px-3 rounded-lg bg-[#141714] border border-[#F3EFE6]/18 text-xs font-semibold hover:border-[#E08E26]/60 transition whitespace-nowrap"
              >
                Aim Turret +45°
              </button>
              <button
                type="button"
                onClick={() => {
                  setHullAngleDeg(-24);
                  setTurretOffsetDeg(0);
                }}
                className="min-h-[42px] px-3 rounded-lg bg-[#141714] border border-[#F3EFE6]/18 text-xs font-medium text-[#F3EFE6]/75 hover:text-[#F3EFE6] transition"
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        {/* Right: Centralized Stats, Abilities & Select CTA */}
        <aside className="landscape:col-span-6 lg:col-span-6 bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5">
          <div>
            <p className="text-xs sm:text-sm text-[#F3EFE6]/75 leading-relaxed">
              {tank.description}
            </p>

            {/* Required Centralized Combat Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mt-3.5 font-mono tabular-nums text-xs">
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl px-3 py-2">
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Health</div>
                <div className="text-sm font-bold text-[#F3EFE6] mt-0.5">
                  {effectiveMaxHp} HP
                </div>
              </div>
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl px-3 py-2">
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Move Speed</div>
                <div className="text-sm font-bold text-[#F3EFE6] mt-0.5">
                  {effectiveSpeed}
                </div>
              </div>
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl px-3 py-2">
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Proj. Range</div>
                <div className="text-sm font-bold text-[#F3EFE6] mt-0.5">
                  {effectiveRange}
                </div>
              </div>
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl px-3 py-2">
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Magazine</div>
                <div className="text-sm font-bold text-[#E08E26] mt-0.5">
                  {tank.stats.magazineCapacity} Rounds
                </div>
              </div>
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl px-3 py-2">
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Reload</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  {effectiveReload.toFixed(2)}s
                </div>
              </div>
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl px-3 py-2">
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Shell Damage</div>
                <div className="text-sm font-bold text-[#F3EFE6] mt-0.5">
                  {tank.stats.projectileDamage}
                </div>
              </div>
            </div>

            {/* Abilities */}
            <div className="flex flex-col gap-2.5 mt-3.5 text-xs">
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="flex items-center justify-between font-semibold text-[#E08E26]">
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Active: {tank.activeAbility.name}
                  </span>
                  <span className="font-mono tabular-nums text-[#F3EFE6]/65">
                    {tank.activeAbility.cooldownSec}s CD
                  </span>
                </div>
                <p className="text-[#F3EFE6]/75 mt-1 leading-relaxed">
                  {tank.activeAbility.description}
                </p>
              </div>

              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                  <Shield className="w-3.5 h-3.5" />
                  Passive: {tank.passiveAbility.name}
                </div>
                <p className="text-[#F3EFE6]/75 mt-1 leading-relaxed">
                  {tank.passiveAbility.description}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onSelectTank(tank.id)}
              className={`min-h-[48px] flex-1 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition whitespace-nowrap ${
                isSelected
                  ? 'bg-[#22C55E]/20 border-2 border-[#22C55E] text-[#86EFAC]'
                  : 'bg-[#272D25] border border-[#F3EFE6]/25 text-[#F3EFE6] hover:bg-[#31382E]'
              }`}
            >
              <Check className="w-4 h-4" />
              {isSelected ? 'Selected' : 'SELECT'}
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectTank(tank.id);
                onStartBattle(tank.id);
              }}
              className="min-h-[48px] flex-1 px-5 rounded-xl bg-[#E08E26] text-[#141714] font-display text-xl font-extrabold tracking-wide flex items-center justify-center gap-2 hover:bg-[#EE9B32] transition whitespace-nowrap"
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
