import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Lock,
  Palette,
  Play,
  RotateCcw,
  RotateCw,
  Shield,
  ShoppingCart,
  Sliders,
  Zap,
} from 'lucide-react';
import { ScrapBadge } from '../components/ScrapBadge';
import { TankCustomizationPanel } from '../components/TankCustomizationPanel';
import { TankPreviewSvg } from '../components/TankPreviewSvg';
import {
  areCustomizationsEqual,
  createDefaultTankCustomization,
} from '../data/customization';
import { isTankUnlocked } from '../data/economy';
import {
  getEffectiveTankMaxHp,
  getEffectiveTankMoveSpeed,
  getEffectiveTankProjectileRange,
  getEffectiveTankReloadSec,
  TANK_DEFINITIONS,
  TANK_LIST,
} from '../data/tanks';
import {
  CosmeticId,
  PlayerProgression,
  PurchaseOutcome,
  TankCustomization,
  TankDecalId,
  TankId,
} from '../types/game';

interface GarageScreenProps {
  progression: PlayerProgression;
  sessionCustomizations?: Partial<Record<TankId, TankCustomization>>;
  onApplyCustomization: (tankId: TankId, customization: TankCustomization) => void;
  onResetCustomization: (tankId: TankId) => void;
  onSelectTank: (tankId: TankId) => void;
  onPurchaseTank: (tankId: TankId) => PurchaseOutcome;
  onPurchasePreset: (presetId: string) => PurchaseOutcome;
  onPurchasePaintColor: (hex: string) => PurchaseOutcome;
  onPurchaseCustomPaint: () => PurchaseOutcome;
  onPurchaseDecal: (decalId: TankDecalId) => PurchaseOutcome;
  onPurchaseCosmetic: (cosmeticId: CosmeticId) => PurchaseOutcome;
  onEquipCosmetic: (cosmeticId: CosmeticId) => void;
  onOpenCollection: () => void;
  onBack: () => void;
  onStartBattle: (tankId?: TankId) => void;
}

export function GarageScreen({
  progression,
  sessionCustomizations,
  onApplyCustomization,
  onResetCustomization,
  onSelectTank,
  onPurchaseTank,
  onPurchasePreset,
  onPurchasePaintColor,
  onPurchaseCustomPaint,
  onPurchaseDecal,
  onPurchaseCosmetic,
  onEquipCosmetic,
  onOpenCollection,
  onBack,
  onStartBattle,
}: GarageScreenProps) {
  const [inspectedId, setInspectedId] = useState<TankId>(progression.selectedTank);
  const [rightMode, setRightMode] = useState<'inspect' | 'customize'>('customize');
  const [hullAngleDeg, setHullAngleDeg] = useState(-24);
  const [turretOffsetDeg, setTurretOffsetDeg] = useState(0);
  const dragStartRef = useRef<{ x: number; startAngle: number } | null>(null);

  const availableTanks = TANK_LIST;

  const tank = TANK_DEFINITIONS[inspectedId] || availableTanks[0] || TANK_DEFINITIONS.assault;
  const tankUnlocked = isTankUnlocked(progression, tank.id);
  const isSelected = tankUnlocked && progression.selectedTank === tank.id;
  const appliedCustomization =
    sessionCustomizations?.[tank.id] ?? progression.tankCustomizations?.[tank.id] ?? null;

  const [draftCustomization, setDraftCustomization] = useState<TankCustomization>(() => {
    return (
      sessionCustomizations?.[inspectedId] ??
      progression.tankCustomizations?.[inspectedId] ??
      createDefaultTankCustomization(tank, progression.equippedCosmetic)
    );
  });

  useEffect(() => {
    setDraftCustomization(
      appliedCustomization ??
        createDefaultTankCustomization(tank, progression.equippedCosmetic)
    );
  }, [appliedCustomization, progression.equippedCosmetic, tank]);

  const effectiveDefault = useMemo(
    () => createDefaultTankCustomization(tank, progression.equippedCosmetic),
    [progression.equippedCosmetic, tank]
  );

  const isPreviewingUnapplied =
    rightMode === 'customize' &&
    !areCustomizationsEqual(draftCustomization, appliedCustomization ?? effectiveDefault);

  const previewCustomization =
    rightMode === 'customize' ? draftCustomization : appliedCustomization;

  const effectiveMaxHp = getEffectiveTankMaxHp(tank);
  const effectiveSpeed = getEffectiveTankMoveSpeed(tank);
  const effectiveRange = getEffectiveTankProjectileRange(tank);
  const effectiveReload = getEffectiveTankReloadSec(tank);

  const currentIdx = availableTanks.findIndex((t) => t.id === tank.id);
  const cycleTank = (dir: -1 | 1) => {
    const safeIdx = currentIdx >= 0 ? currentIdx : 0;
    const nextIdx = (safeIdx + dir + availableTanks.length) % availableTanks.length;
    setInspectedId(availableTanks[nextIdx].id);
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#141714] tactical-bg-grid text-[#F3EFE6] flex flex-col">
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-7 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#F3EFE6]/12 shrink-0 bg-[#141714]/80">
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
              Garage &amp; Cosmetic Shop
            </h1>
            <p className="text-[11px] text-[#F3EFE6]/55 mt-0.5">
              Customize paint, decals, presets &amp; skins · Drag preview to rotate hull
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ScrapBadge scrap={progression.scrap} />

          <button
            type="button"
            onClick={onOpenCollection}
            className="min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-[#1E221D] border border-[#F3EFE6]/20 text-xs sm:text-sm font-semibold flex items-center gap-2 hover:border-[#E08E26]/65 hover:bg-[#262C24] transition whitespace-nowrap"
          >
            <Layers className="w-4 h-4 text-[#E08E26]" />
            Tank Shop
          </button>
        </div>
      </header>

      {/* Main Garage Bay */}
      <main className="screen-transition flex-1 w-full max-w-6xl mx-auto px-4 sm:px-7 py-3.5 sm:py-5 grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        {/* Left: Large Interactive Inspection & Customization Turntable */}
        <section className="landscape:col-span-5 lg:col-span-5 bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3">
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
            className="touch-none-game relative flex-1 min-h-[205px] sm:min-h-[260px] rounded-xl bg-[#141714] border border-[#F3EFE6]/12 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none"
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
              cosmeticId={progression.equippedCosmetic}
              customization={previewCustomization}
              size={208}
              hullAngleDeg={hullAngleDeg}
              turretAngleDeg={hullAngleDeg + turretOffsetDeg}
              className="pointer-events-none drop-shadow-2xl"
            />

            <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
              {!tankUnlocked ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#141714]/95 border border-sky-400/50 text-sky-300 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
                  <Lock className="w-3 h-3" />
                  Locked · {tank.unlockCost} Scrap
                </span>
              ) : isSelected ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#22C55E] text-[#141714] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  Selected
                </span>
              ) : null}
              {isPreviewingUnapplied && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#E08E26] text-[#141714] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">
                  Preview
                </span>
              )}
            </div>

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
                className="min-h-[44px] px-3 rounded-lg bg-[#141714] border border-[#F3EFE6]/18 text-xs font-semibold flex items-center gap-1.5 hover:border-[#E08E26]/60 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                -45°
              </button>
              <button
                type="button"
                onClick={() => setHullAngleDeg((a) => a + 45)}
                className="min-h-[44px] px-3 rounded-lg bg-[#141714] border border-[#F3EFE6]/18 text-xs font-semibold flex items-center gap-1.5 hover:border-[#E08E26]/60 transition"
              >
                <RotateCw className="w-3.5 h-3.5" />
                +45°
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTurretOffsetDeg((o) => (o + 45) % 360)}
                className="min-h-[44px] px-3 rounded-lg bg-[#141714] border border-[#F3EFE6]/18 text-xs font-semibold hover:border-[#E08E26]/60 transition whitespace-nowrap"
              >
                Aim Turret +45°
              </button>
              <button
                type="button"
                onClick={() => {
                  setHullAngleDeg(-24);
                  setTurretOffsetDeg(0);
                }}
                className="min-h-[44px] px-3 rounded-lg bg-[#141714] border border-[#F3EFE6]/18 text-xs font-medium text-[#F3EFE6]/75 hover:text-[#F3EFE6] transition"
              >
                Center
              </button>
            </div>
          </div>
        </section>

        {/* Right: Customize / Inspect Switcher + Details + Deploy Actions */}
        <aside className="landscape:col-span-7 lg:col-span-7 bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 min-h-0">
          {/* Top Mode Tabs */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="grid grid-cols-2 gap-1.5 bg-[#141714] p-1 rounded-xl border border-[#F3EFE6]/12 w-full sm:w-auto sm:min-w-[270px]">
              <button
                type="button"
                onClick={() => setRightMode('customize')}
                className={`min-h-[44px] px-4 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
                  rightMode === 'customize'
                    ? 'bg-[#E08E26] text-[#141714] shadow'
                    : 'text-[#F3EFE6]/75 hover:text-[#F3EFE6]'
                }`}
              >
                <Palette className="w-4 h-4" />
                Customize
              </button>
              <button
                type="button"
                onClick={() => setRightMode('inspect')}
                className={`min-h-[44px] px-4 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
                  rightMode === 'inspect'
                    ? 'bg-[#E08E26] text-[#141714] shadow'
                    : 'text-[#F3EFE6]/75 hover:text-[#F3EFE6]'
                }`}
              >
                <Sliders className="w-4 h-4" />
                Specs &amp; Abilities
              </button>
            </div>

            <span className="hidden sm:inline-block text-[11px] font-mono text-[#F3EFE6]/50">
              {currentIdx + 1} / {availableTanks.length} Tanks
            </span>
          </div>

          {rightMode === 'customize' ? (
            <TankCustomizationPanel
              tank={tank}
              progression={progression}
              draft={draftCustomization}
              appliedCustomization={appliedCustomization}
              onChangeDraft={setDraftCustomization}
              onApply={() => {
                onApplyCustomization(tank.id, draftCustomization);
              }}
              onReset={() => {
                onResetCustomization(tank.id);
                setDraftCustomization(
                  createDefaultTankCustomization(tank, progression.equippedCosmetic)
                );
              }}
              onPurchasePreset={onPurchasePreset}
              onPurchasePaintColor={onPurchasePaintColor}
              onPurchaseCustomPaint={onPurchaseCustomPaint}
              onPurchaseDecal={onPurchaseDecal}
              onPurchaseCosmetic={onPurchaseCosmetic}
              onEquipCosmetic={onEquipCosmetic}
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
              <p className="text-xs sm:text-sm text-[#F3EFE6]/75 leading-relaxed">
                {tank.description}
              </p>

              {/* Centralized Combat Stats Grid */}
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
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-[#F3EFE6]/10 shrink-0">
            {!tankUnlocked ? (
              <button
                type="button"
                disabled={progression.scrap < tank.unlockCost}
                onClick={() => onPurchaseTank(tank.id)}
                className={`min-h-[48px] flex-1 px-5 rounded-xl font-display text-lg font-extrabold tracking-wide flex items-center justify-center gap-2 transition whitespace-nowrap ${
                  progression.scrap >= tank.unlockCost
                    ? 'bg-sky-400 text-[#141714] hover:bg-sky-300 shadow-lg'
                    : 'bg-[#141714] border border-[#F3EFE6]/15 text-[#F3EFE6]/45 cursor-not-allowed'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                {progression.scrap >= tank.unlockCost
                  ? `Unlock ${tank.name} · ${tank.unlockCost} Scrap`
                  : `Need ${tank.unlockCost - progression.scrap} More Scrap`}
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
