import { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Hexagon,
  Lock,
  Palette,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  Stamp,
  Star,
} from 'lucide-react';
import {
  areCustomizationsEqual,
  createDefaultTankCustomization,
  CUSTOM_PAINT_STUDIO_COST,
  DECAL_COLOR_SWATCHES,
  DECAL_POSITION_OPTIONS,
  getTankPresets,
  normalizeHexColor,
  PAINT_COLOR_SWATCHES,
  TANK_DECAL_LIST,
  TANK_DECAL_MAP,
  TANK_PRESET_MAP,
} from '../data/customization';
import {
  getLockedItemsInCustomization,
  isDecalUnlocked,
  isPaintColorUnlocked,
  isPresetUnlocked,
  isSpecialCosmeticUnlocked,
} from '../data/economy';
import { COSMETIC_LIST } from '../data/progression';
import {
  CosmeticId,
  PlayerProgression,
  PurchaseOutcome,
  TankCustomization,
  TankDecalCategory,
  TankDecalId,
  TankDefinition,
} from '../types/game';
import { TankDecalIcon } from './TankDecalSvg';
import { TankPreviewSvg } from './TankPreviewSvg';

type CustomizeSubTab = 'presets' | 'paint' | 'decals' | 'skins';
type PaintZone = 'primaryColor' | 'secondaryColor' | 'turretColor' | 'barrelColor';

interface TankCustomizationPanelProps {
  tank: TankDefinition;
  progression: PlayerProgression;
  draft: TankCustomization;
  appliedCustomization: TankCustomization | null;
  onChangeDraft: (next: TankCustomization) => void;
  onApply: () => void;
  onReset: () => void;
  onPurchasePreset: (presetId: string) => PurchaseOutcome;
  onPurchasePaintColor: (hex: string) => PurchaseOutcome;
  onPurchaseCustomPaint: () => PurchaseOutcome;
  onPurchaseDecal: (decalId: TankDecalId) => PurchaseOutcome;
  onPurchaseCosmetic: (cosmeticId: CosmeticId) => PurchaseOutcome;
  onEquipCosmetic: (cosmeticId: CosmeticId) => void;
}

const PAINT_ZONES: Array<{ key: PaintZone; label: string; shortLabel: string }> = [
  { key: 'primaryColor', label: 'Primary Hull', shortLabel: 'Primary' },
  { key: 'secondaryColor', label: 'Secondary Trim', shortLabel: 'Secondary' },
  { key: 'turretColor', label: 'Turret Dome', shortLabel: 'Turret' },
  { key: 'barrelColor', label: 'Main Barrel', shortLabel: 'Barrel' },
];

const DECAL_CATEGORIES: Array<'All' | TankDecalCategory> = [
  'All',
  'Insignia',
  'Star',
  'Number',
  'Stripes',
  'Geometric',
  'Special',
];

export function TankCustomizationPanel({
  tank,
  progression,
  draft,
  appliedCustomization,
  onChangeDraft,
  onApply,
  onReset,
  onPurchasePreset,
  onPurchasePaintColor,
  onPurchaseCustomPaint,
  onPurchaseDecal,
  onPurchaseCosmetic,
  onEquipCosmetic,
}: TankCustomizationPanelProps) {
  const [subTab, setSubTab] = useState<CustomizeSubTab>('presets');
  const [activeZone, setActiveZone] = useState<PaintZone>('primaryColor');
  const [decalCategory, setDecalCategory] = useState<'All' | TankDecalCategory>('All');
  const [shopFeedback, setShopFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const cosmeticId = progression.equippedCosmetic;

  const defaultLook = useMemo(
    () => createDefaultTankCustomization(tank, cosmeticId),
    [tank, cosmeticId]
  );
  const effectiveApplied = appliedCustomization ?? defaultLook;
  const presets = useMemo(() => getTankPresets(tank.id), [tank.id]);

  const hasUnappliedChanges = !areCustomizationsEqual(draft, effectiveApplied);
  const isDefaultLook =
    areCustomizationsEqual(draft, defaultLook) && appliedCustomization === null;

  const lockedItems = useMemo(
    () => getLockedItemsInCustomization(progression, tank, draft),
    [progression, tank, draft]
  );

  const filteredDecals = useMemo(() => {
    if (decalCategory === 'All') return TANK_DECAL_LIST;
    return TANK_DECAL_LIST.filter((d) => d.id === 'none' || d.category === decalCategory);
  }, [decalCategory]);

  const currentZoneHex = normalizeHexColor(draft[activeZone], defaultLook[activeZone]);
  const currentDecalHex = normalizeHexColor(draft.decalColor, defaultLook.decalColor);

  const activeZoneSwatch = PAINT_COLOR_SWATCHES.find(
    (s) => s.hex.toUpperCase() === currentZoneHex
  );
  const activeZoneUnlocked = isPaintColorUnlocked(progression, currentZoneHex, tank);

  const activeDecalSwatch = DECAL_COLOR_SWATCHES.find(
    (s) => s.hex.toUpperCase() === currentDecalHex
  );
  const activeDecalColorUnlocked = isPaintColorUnlocked(progression, currentDecalHex, tank);

  const activeDecalDef = TANK_DECAL_MAP[draft.decalId];
  const activeDecalUnlocked = isDecalUnlocked(progression, draft.decalId);

  const matchingPreset = useMemo(
    () =>
      presets.find(
        (p) =>
          (draft.presetId && draft.presetId === p.id) ||
          areCustomizationsEqual(draft, p.customization)
      ) ?? null,
    [draft, presets]
  );

  const reportPurchase = (outcome: PurchaseOutcome, itemName: string) => {
    if (outcome.success) {
      setShopFeedback({
        type: 'success',
        text: `Unlocked ${itemName} (-${outcome.cost} Scrap)`,
      });
    } else if (outcome.reason === 'insufficient_scrap') {
      const missing = Math.max(0, outcome.cost - outcome.remainingScrap);
      setShopFeedback({
        type: 'error',
        text: `Need ${missing} more Scrap to unlock ${itemName}.`,
      });
    }
  };

  const cyclePreset = (dir: -1 | 1) => {
    if (presets.length === 0) return;
    const activeIdx = presets.findIndex((p) =>
      areCustomizationsEqual(draft, p.customization)
    );
    const nextIdx =
      activeIdx === -1
        ? 0
        : (activeIdx + dir + presets.length) % presets.length;
    onChangeDraft({ ...presets[nextIdx].customization });
  };

  const cyclePaintSwatch = (dir: -1 | 1) => {
    const idx = PAINT_COLOR_SWATCHES.findIndex(
      (s) => s.hex.toUpperCase() === currentZoneHex
    );
    const nextIdx =
      idx === -1
        ? 0
        : (idx + dir + PAINT_COLOR_SWATCHES.length) % PAINT_COLOR_SWATCHES.length;
    onChangeDraft({
      ...draft,
      [activeZone]: PAINT_COLOR_SWATCHES[nextIdx].hex.toUpperCase(),
      presetId: null,
    });
  };

  const cycleDecal = (dir: -1 | 1) => {
    const idx = TANK_DECAL_LIST.findIndex((d) => d.id === draft.decalId);
    const nextIdx =
      idx === -1
        ? 0
        : (idx + dir + TANK_DECAL_LIST.length) % TANK_DECAL_LIST.length;
    onChangeDraft({
      ...draft,
      decalId: TANK_DECAL_LIST[nextIdx].id,
      presetId: null,
    });
  };

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Sub-Section Switcher */}
      <div
        role="tablist"
        aria-label="Customization categories"
        className="grid grid-cols-4 gap-1.5 bg-[#141714] p-1 rounded-xl border border-[#F3EFE6]/12"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'presets'}
          onClick={() => setSubTab('presets')}
          className={`min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition ${
            subTab === 'presets'
              ? 'bg-[#E08E26] text-[#141714] font-bold shadow'
              : 'text-[#F3EFE6]/75 hover:text-[#F3EFE6] hover:bg-[#1E221D]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Presets
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'paint'}
          onClick={() => setSubTab('paint')}
          className={`min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition ${
            subTab === 'paint'
              ? 'bg-[#E08E26] text-[#141714] font-bold shadow'
              : 'text-[#F3EFE6]/75 hover:text-[#F3EFE6] hover:bg-[#1E221D]'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          Paint
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'decals'}
          onClick={() => setSubTab('decals')}
          className={`min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition ${
            subTab === 'decals'
              ? 'bg-[#E08E26] text-[#141714] font-bold shadow'
              : 'text-[#F3EFE6]/75 hover:text-[#F3EFE6] hover:bg-[#1E221D]'
          }`}
        >
          <Stamp className="w-3.5 h-3.5" />
          Decals
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'skins'}
          onClick={() => setSubTab('skins')}
          className={`min-h-[44px] rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition ${
            subTab === 'skins'
              ? 'bg-[#E08E26] text-[#141714] font-bold shadow'
              : 'text-[#F3EFE6]/75 hover:text-[#F3EFE6] hover:bg-[#1E221D]'
          }`}
        >
          <Star className="w-3.5 h-3.5" />
          Skins
        </button>
      </div>

      {shopFeedback && (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-semibold border flex items-center justify-between gap-2 shrink-0 ${
            shopFeedback.type === 'success'
              ? 'bg-[#1A2B1D] border-[#22C55E]/50 text-[#86EFAC]'
              : 'bg-[#2B1B1B] border-red-400/45 text-red-300'
          }`}
        >
          <span>{shopFeedback.text}</span>
          <button
            type="button"
            onClick={() => setShopFeedback(null)}
            className="text-[11px] font-mono opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Category Body */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-3">
        {subTab === 'presets' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#F3EFE6]/60">
                {tank.name} Signature Looks (Visual Only)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => cyclePreset(-1)}
                  aria-label="Previous preset"
                  className="min-w-[44px] min-h-[44px] rounded-lg bg-[#141714] border border-[#F3EFE6]/15 flex items-center justify-center hover:border-[#E08E26]/65 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => cyclePreset(1)}
                  aria-label="Next preset"
                  className="min-w-[44px] min-h-[44px] rounded-lg bg-[#141714] border border-[#F3EFE6]/15 flex items-center justify-center hover:border-[#E08E26]/65 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Standard Factory Look Option */}
            <button
              type="button"
              onClick={() => onChangeDraft({ ...defaultLook })}
              className={`w-full min-h-[54px] text-left rounded-xl p-3 border transition flex items-center justify-between gap-3 ${
                areCustomizationsEqual(draft, defaultLook)
                  ? 'bg-[#252B23] border-[#E08E26]'
                  : 'bg-[#141714] border-[#F3EFE6]/12 hover:border-[#F3EFE6]/30'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-bold text-[#F3EFE6] leading-tight">
                    Factory Standard
                  </span>
                  <span className="text-[10px] font-mono uppercase text-[#86EFAC]">
                    Owned
                  </span>
                </div>
                <div className="text-[11px] text-[#F3EFE6]/60 mt-0.5 truncate">
                  Original {tank.name} combat livery
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {[
                  defaultLook.primaryColor,
                  defaultLook.secondaryColor,
                  defaultLook.turretColor,
                  defaultLook.barrelColor,
                ].map((hex, i) => (
                  <span
                    key={`std-${i}`}
                    className="w-4 h-4 rounded border border-black/50"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </button>

            {/* 3 Tank-Specific Presets (Shop + Preview) */}
            {presets.map((preset) => {
              const active = areCustomizationsEqual(draft, preset.customization);
              const unlocked = isPresetUnlocked(progression, preset.id);
              const cost = preset.scrapCost ?? 0;
              const affordable = progression.scrap >= cost;

              return (
                <div
                  key={preset.id}
                  className={`rounded-xl p-3 border transition space-y-2 ${
                    active
                      ? 'bg-[#252B23] border-[#E08E26] shadow'
                      : 'bg-[#141714] border-[#F3EFE6]/12 hover:border-[#F3EFE6]/30'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onChangeDraft({ ...preset.customization })}
                    className="w-full text-left flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-display text-base font-bold text-[#F3EFE6] leading-tight truncate">
                          {preset.name}
                        </span>
                        {unlocked ? (
                          <span className="text-[10px] font-mono uppercase text-[#86EFAC] font-bold">
                            Owned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1E221D] border border-sky-400/35 text-[10px] font-mono font-bold text-sky-300">
                            <Lock className="w-2.5 h-2.5" />
                            {cost} Scrap
                          </span>
                        )}
                        {active && (
                          <span className="text-[10px] font-mono uppercase text-[#E08E26] font-bold">
                            Previewing
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#F3EFE6]/60 mt-0.5 leading-snug">
                        {preset.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="w-7 h-7 rounded-md bg-[#1B1F1A] border border-[#F3EFE6]/15 flex items-center justify-center">
                        <TankDecalIcon
                          decalId={preset.customization.decalId}
                          color={preset.customization.decalColor}
                          size={18}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-0.5">
                        {[
                          preset.customization.primaryColor,
                          preset.customization.secondaryColor,
                          preset.customization.turretColor,
                          preset.customization.barrelColor,
                        ].map((hex, idx) => (
                          <span
                            key={`${preset.id}-c-${idx}`}
                            className="w-3.5 h-3.5 rounded-[3px] border border-black/50"
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </button>

                  {!unlocked && (
                    <div className="flex items-center justify-end pt-1 border-t border-[#F3EFE6]/10">
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => {
                          const outcome = onPurchasePreset(preset.id);
                          reportPurchase(outcome, preset.name);
                          if (outcome.success) {
                            onChangeDraft({ ...preset.customization });
                          }
                        }}
                        className={`min-h-[38px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                          affordable
                            ? 'bg-sky-400 text-[#141714] hover:bg-sky-300'
                            : 'bg-[#1E221D] border border-[#F3EFE6]/12 text-[#F3EFE6]/45 cursor-not-allowed'
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {affordable ? `Unlock Preset · ${cost} Scrap` : `Need ${cost - progression.scrap} Scrap`}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {subTab === 'paint' && (
          <div className="space-y-3">
            {/* Paint Zone Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#F3EFE6]/60">
                  Select Component Zone
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => cyclePaintSwatch(-1)}
                    aria-label="Previous color swatch"
                    className="min-w-[36px] min-h-[36px] rounded-lg bg-[#141714] border border-[#F3EFE6]/15 flex items-center justify-center hover:border-[#E08E26]/65 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cyclePaintSwatch(1)}
                    aria-label="Next color swatch"
                    className="min-w-[36px] min-h-[36px] rounded-lg bg-[#141714] border border-[#F3EFE6]/15 flex items-center justify-center hover:border-[#E08E26]/65 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PAINT_ZONES.map((zone) => {
                  const selected = activeZone === zone.key;
                  const hex = normalizeHexColor(draft[zone.key], defaultLook[zone.key]);
                  return (
                    <button
                      key={zone.key}
                      type="button"
                      onClick={() => setActiveZone(zone.key)}
                      className={`min-h-[48px] px-2.5 py-1.5 rounded-xl border text-left flex items-center gap-2 transition ${
                        selected
                          ? 'bg-[#252B23] border-[#E08E26]'
                          : 'bg-[#141714] border-[#F3EFE6]/12 hover:border-[#F3EFE6]/30'
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-md border border-black/60 shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#F3EFE6] leading-tight truncate">
                          {zone.shortLabel}
                        </div>
                        <div className="text-[10px] font-mono text-[#F3EFE6]/50 truncate">
                          {hex}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Swatches */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#F3EFE6]/60 mb-1.5">
                <span>
                  Armor Swatches · {PAINT_ZONES.find((z) => z.key === activeZone)?.label}
                </span>
                <span className="text-[10px] text-sky-300">Locked paints preview live</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5 sm:gap-2">
                {PAINT_COLOR_SWATCHES.map((swatch) => {
                  const active = swatch.hex.toUpperCase() === currentZoneHex;
                  const unlocked = isPaintColorUnlocked(progression, swatch.hex, tank);
                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      title={
                        unlocked
                          ? `${swatch.name} (Owned)`
                          : `${swatch.name} (${swatch.scrapCost} Scrap)`
                      }
                      aria-label={`${swatch.name} (${swatch.hex})`}
                      onClick={() =>
                        onChangeDraft({
                          ...draft,
                          [activeZone]: swatch.hex.toUpperCase(),
                          presetId: null,
                        })
                      }
                      className={`relative min-h-[46px] w-full rounded-lg border-2 flex items-center justify-center transition ${
                        active
                          ? 'border-[#F3EFE6] scale-105 shadow-md'
                          : 'border-[#161815] hover:border-[#F3EFE6]/50'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    >
                      {active ? (
                        <Check className="w-4 h-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] stroke-[3]" />
                      ) : !unlocked ? (
                        <Lock className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]" />
                      ) : null}
                      {!unlocked && (
                        <span className="absolute -bottom-1 right-0.5 px-1 rounded bg-[#141714]/95 border border-sky-400/50 text-[9px] font-mono font-bold text-sky-300 leading-tight">
                          {swatch.scrapCost}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Inline Purchase Callout when previewing a locked swatch */}
              {!activeZoneUnlocked && activeZoneSwatch && activeZoneSwatch.scrapCost > 0 && (
                <div className="mt-2.5 bg-[#141714] border border-sky-400/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-5 h-5 rounded border border-white/25 shrink-0"
                      style={{ backgroundColor: activeZoneSwatch.hex }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#F3EFE6] truncate">
                        {activeZoneSwatch.name} (Locked Paint)
                      </div>
                      <div className="text-[11px] font-mono text-sky-300">
                        Unlock permanently for {activeZoneSwatch.scrapCost} Scrap
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={progression.scrap < activeZoneSwatch.scrapCost}
                    onClick={() =>
                      reportPurchase(
                        onPurchasePaintColor(activeZoneSwatch.hex),
                        activeZoneSwatch.name
                      )
                    }
                    className={`min-h-[40px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
                      progression.scrap >= activeZoneSwatch.scrapCost
                        ? 'bg-sky-400 text-[#141714] hover:bg-sky-300'
                        : 'bg-[#1E221D] border border-[#F3EFE6]/15 text-[#F3EFE6]/45 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {progression.scrap >= activeZoneSwatch.scrapCost
                      ? `Buy · ${activeZoneSwatch.scrapCost}`
                      : `Need ${activeZoneSwatch.scrapCost - progression.scrap}`}
                  </button>
                </div>
              )}
            </div>

            {/* Custom Color Picker (Workshop Custom Paint Studio) */}
            <div className="bg-[#141714] border border-[#F3EFE6]/12 rounded-xl p-2.5 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F3EFE6]">
                  <span>Custom Zone Color Studio</span>
                  {progression.customPaintUnlocked ? (
                    <span className="text-[10px] font-mono uppercase text-[#86EFAC]">Owned</span>
                  ) : (
                    <span className="text-[10px] font-mono text-sky-300">
                      {CUSTOM_PAINT_STUDIO_COST} Scrap
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#F3EFE6]/55">
                  {progression.customPaintUnlocked
                    ? `Pick any custom hex for ${PAINT_ZONES.find((z) => z.key === activeZone)?.label}`
                    : 'Unlock full RGB color spectrum for all paint zones'}
                </div>
              </div>

              {progression.customPaintUnlocked ? (
                <label className="min-h-[44px] px-3 rounded-lg bg-[#1E221D] border border-[#F3EFE6]/20 hover:border-[#E08E26]/65 flex items-center gap-2 cursor-pointer transition shrink-0">
                  <input
                    type="color"
                    aria-label="Custom zone color picker"
                    value={currentZoneHex}
                    onChange={(e) =>
                      onChangeDraft({
                        ...draft,
                        [activeZone]: normalizeHexColor(e.target.value, currentZoneHex),
                        presetId: null,
                      })
                    }
                    className="w-7 h-7 bg-transparent border-0 p-0 cursor-pointer"
                  />
                  <span className="font-mono text-xs text-[#F3EFE6] tabular-nums">
                    {currentZoneHex}
                  </span>
                </label>
              ) : (
                <button
                  type="button"
                  disabled={progression.scrap < CUSTOM_PAINT_STUDIO_COST}
                  onClick={() =>
                    reportPurchase(onPurchaseCustomPaint(), 'Custom Paint Studio')
                  }
                  className={`min-h-[42px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
                    progression.scrap >= CUSTOM_PAINT_STUDIO_COST
                      ? 'bg-sky-400 text-[#141714] hover:bg-sky-300'
                      : 'bg-[#1E221D] border border-[#F3EFE6]/15 text-[#F3EFE6]/45 cursor-not-allowed'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Unlock · {CUSTOM_PAINT_STUDIO_COST}
                </button>
              )}
            </div>
          </div>
        )}

        {subTab === 'decals' && (
          <div className="space-y-3">
            {/* Placement Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#F3EFE6]/60">
                  Decal Placement
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => cycleDecal(-1)}
                    aria-label="Previous decal"
                    className="min-w-[36px] min-h-[36px] rounded-lg bg-[#141714] border border-[#F3EFE6]/15 flex items-center justify-center hover:border-[#E08E26]/65 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleDecal(1)}
                    aria-label="Next decal"
                    className="min-w-[36px] min-h-[36px] rounded-lg bg-[#141714] border border-[#F3EFE6]/15 flex items-center justify-center hover:border-[#E08E26]/65 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {DECAL_POSITION_OPTIONS.map((pos) => {
                  const active = draft.decalPosition === pos.id;
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() =>
                        onChangeDraft({
                          ...draft,
                          decalPosition: pos.id,
                          presetId: null,
                        })
                      }
                      className={`min-h-[44px] px-2 rounded-lg border text-xs font-semibold transition ${
                        active
                          ? 'bg-[#252B23] border-[#E08E26] text-[#F3EFE6]'
                          : 'bg-[#141714] border-[#F3EFE6]/12 text-[#F3EFE6]/70 hover:border-[#F3EFE6]/30'
                      }`}
                    >
                      {pos.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1.5">
              {DECAL_CATEGORIES.map((cat) => {
                const active = decalCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setDecalCategory(cat)}
                    className={`min-h-[36px] px-2.5 rounded-lg border text-[11px] font-semibold transition ${
                      active
                        ? 'bg-[#E08E26]/20 border-[#E08E26] text-[#FDE68A]'
                        : 'bg-[#141714] border-[#F3EFE6]/12 text-[#F3EFE6]/65 hover:text-[#F3EFE6]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Decal Selector Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {filteredDecals.map((decal) => {
                const active = draft.decalId === decal.id;
                const unlocked = isDecalUnlocked(progression, decal.id);
                const cost = decal.scrapCost ?? 0;

                return (
                  <button
                    key={decal.id}
                    type="button"
                    title={decal.description}
                    onClick={() =>
                      onChangeDraft({
                        ...draft,
                        decalId: decal.id,
                        presetId: null,
                      })
                    }
                    className={`relative min-h-[60px] p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                      active
                        ? 'bg-[#252B23] border-[#E08E26] shadow'
                        : 'bg-[#141714] border-[#F3EFE6]/12 hover:border-[#F3EFE6]/30'
                    }`}
                  >
                    {!unlocked && (
                      <span className="absolute top-1 right-1 inline-flex items-center gap-0.5 px-1 rounded bg-[#1E221D] border border-sky-400/40 text-[9px] font-mono font-bold text-sky-300">
                        <Lock className="w-2 h-2" />
                        {cost}
                      </span>
                    )}
                    <TankDecalIcon
                      decalId={decal.id}
                      color={decal.id === 'none' ? '#F3EFE6' : draft.decalColor}
                      size={22}
                    />
                    <span className="text-[10px] font-semibold text-[#F3EFE6]/85 truncate w-full text-center">
                      {decal.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Inline Decal Unlock Bar */}
            {!activeDecalUnlocked && activeDecalDef && (activeDecalDef.scrapCost ?? 0) > 0 && (
              <div className="bg-[#141714] border border-sky-400/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#1E221D] border border-[#F3EFE6]/15 flex items-center justify-center shrink-0">
                    <TankDecalIcon decalId={activeDecalDef.id} color={draft.decalColor} size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#F3EFE6] truncate">
                      {activeDecalDef.name} (Locked Decal)
                    </div>
                    <div className="text-[11px] font-mono text-sky-300">
                      Unlock permanently for {activeDecalDef.scrapCost} Scrap
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={progression.scrap < (activeDecalDef.scrapCost ?? 0)}
                  onClick={() =>
                    reportPurchase(onPurchaseDecal(activeDecalDef.id), activeDecalDef.name)
                  }
                  className={`min-h-[40px] px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
                    progression.scrap >= (activeDecalDef.scrapCost ?? 0)
                      ? 'bg-sky-400 text-[#141714] hover:bg-sky-300'
                      : 'bg-[#1E221D] border border-[#F3EFE6]/15 text-[#F3EFE6]/45 cursor-not-allowed'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {progression.scrap >= (activeDecalDef.scrapCost ?? 0)
                    ? `Buy · ${activeDecalDef.scrapCost}`
                    : `Need ${(activeDecalDef.scrapCost ?? 0) - progression.scrap}`}
                </button>
              </div>
            )}

            {/* Decal Color */}
            <div className="space-y-2 bg-[#141714] border border-[#F3EFE6]/12 rounded-xl p-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {DECAL_COLOR_SWATCHES.map((swatch) => {
                    const active =
                      swatch.hex.toUpperCase() === currentDecalHex;
                    const unlocked = isPaintColorUnlocked(progression, swatch.hex, tank);
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        title={
                          unlocked
                            ? swatch.name
                            : `${swatch.name} (${swatch.scrapCost} Scrap)`
                        }
                        aria-label={`Decal color ${swatch.name}`}
                        onClick={() =>
                          onChangeDraft({
                            ...draft,
                            decalColor: swatch.hex.toUpperCase(),
                            presetId: null,
                          })
                        }
                        className={`relative w-9 h-9 rounded-lg border-2 flex items-center justify-center transition ${
                          active
                            ? 'border-[#E08E26] scale-105'
                            : 'border-[#2A2E29] hover:border-[#F3EFE6]/50'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {active ? (
                          <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] stroke-[3]" />
                        ) : !unlocked ? (
                          <Lock className="w-3 h-3 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {progression.customPaintUnlocked && (
                  <label className="min-h-[40px] px-2.5 rounded-lg bg-[#1E221D] border border-[#F3EFE6]/18 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="color"
                      aria-label="Custom decal color"
                      value={currentDecalHex}
                      onChange={(e) =>
                        onChangeDraft({
                          ...draft,
                          decalColor: normalizeHexColor(e.target.value, draft.decalColor),
                          presetId: null,
                        })
                      }
                      className="w-6 h-6 bg-transparent border-0 p-0 cursor-pointer"
                    />
                    <span className="text-[11px] font-mono text-[#F3EFE6]/85">Custom</span>
                  </label>
                )}
              </div>

              {!activeDecalColorUnlocked && activeDecalSwatch && activeDecalSwatch.scrapCost > 0 && (
                <div className="pt-2 border-t border-[#F3EFE6]/10 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-sky-300">
                    {activeDecalSwatch.name} Decal Ink · {activeDecalSwatch.scrapCost} Scrap
                  </span>
                  <button
                    type="button"
                    disabled={progression.scrap < activeDecalSwatch.scrapCost}
                    onClick={() =>
                      reportPurchase(
                        onPurchasePaintColor(activeDecalSwatch.hex),
                        activeDecalSwatch.name
                      )
                    }
                    className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                      progression.scrap >= activeDecalSwatch.scrapCost
                        ? 'bg-sky-400 text-[#141714] hover:bg-sky-300'
                        : 'bg-[#1E221D] border border-[#F3EFE6]/15 text-[#F3EFE6]/45 cursor-not-allowed'
                    }`}
                  >
                    <ShoppingCart className="w-3 h-3" />
                    Buy · {activeDecalSwatch.scrapCost}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {subTab === 'skins' && (
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#F3EFE6]/60">
              Special Appearances &amp; Workshop Skins (All Tanks · Visual Only)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COSMETIC_LIST.map((skin) => {
                const unlocked = isSpecialCosmeticUnlocked(progression, skin.id);
                const equipped = progression.equippedCosmetic === skin.id;
                const cost = skin.scrapCost ?? 0;
                const isShopSkin = !unlocked && cost > 0;
                const affordable = progression.scrap >= cost;

                return (
                  <div
                    key={skin.id}
                    className={`rounded-xl p-2.5 border flex items-center gap-2.5 transition ${
                      equipped
                        ? 'bg-[#252B23] border-[#E08E26]'
                        : unlocked
                        ? 'bg-[#141714] border-[#F3EFE6]/15'
                        : 'bg-[#141714]/80 border-[#F3EFE6]/10'
                    }`}
                  >
                    <TankPreviewSvg
                      tank={tank}
                      cosmeticId={skin.id}
                      size={48}
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#F3EFE6] truncate">
                        {skin.name}
                      </div>
                      <div className="text-[10px] text-[#F3EFE6]/60 line-clamp-2 leading-snug mt-0.5">
                        {skin.description}
                      </div>
                      <div className="mt-1.5">
                        {equipped ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E08E26] text-[#141714] text-[10px] font-mono font-bold uppercase">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                            Equipped
                          </span>
                        ) : unlocked ? (
                          <button
                            type="button"
                            onClick={() => onEquipCosmetic(skin.id)}
                            className="min-h-[32px] px-2.5 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#86EFAC] text-[11px] font-bold hover:bg-[#22C55E]/25 transition"
                          >
                            Equip Base Skin
                          </button>
                        ) : isShopSkin ? (
                          <button
                            type="button"
                            disabled={!affordable}
                            onClick={() => {
                              const outcome = onPurchaseCosmetic(skin.id);
                              reportPurchase(outcome, skin.name);
                              if (outcome.success) {
                                onEquipCosmetic(skin.id);
                              }
                            }}
                            className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition ${
                              affordable
                                ? 'bg-sky-400 text-[#141714] hover:bg-sky-300'
                                : 'bg-[#1E221D] border border-[#F3EFE6]/15 text-[#F3EFE6]/45 cursor-not-allowed'
                            }`}
                          >
                            <Hexagon className="w-3 h-3" />
                            {affordable ? `Buy · ${cost} Scrap` : `Need ${cost - progression.scrap} Scrap`}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1E221D] text-[10px] font-mono text-[#F3EFE6]/60">
                            <Lock className="w-2.5 h-2.5" />
                            {skin.unlockSourceLabel ?? `Level ${skin.unlockLevel}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Apply / Reset Footer */}
      <div className="pt-2 border-t border-[#F3EFE6]/10 space-y-2 shrink-0">
        {lockedItems.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#141714] border border-sky-400/35 px-3 py-1.5 text-[11px] text-sky-300">
            <span className="truncate">
              Locked preview: {lockedItems.join(', ')}
            </span>
            {matchingPreset && !isPresetUnlocked(progression, matchingPreset.id) && (
              <button
                type="button"
                disabled={progression.scrap < (matchingPreset.scrapCost ?? 0)}
                onClick={() => {
                  const outcome = onPurchasePreset(matchingPreset.id);
                  reportPurchase(outcome, matchingPreset.name);
                }}
                className="px-2.5 py-1 rounded bg-sky-400 text-[#141714] font-bold disabled:opacity-45 shrink-0"
              >
                Unlock · {matchingPreset.scrapCost} Scrap
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`text-[11px] font-mono uppercase tracking-wider ${
              lockedItems.length > 0
                ? 'text-sky-300 font-bold'
                : hasUnappliedChanges
                ? 'text-[#E08E26] font-bold'
                : appliedCustomization
                ? 'text-emerald-400'
                : 'text-[#F3EFE6]/50'
            }`}
          >
            {lockedItems.length > 0
              ? 'Unlock Preview Items to Apply'
              : hasUnappliedChanges
              ? 'Unapplied Preview'
              : appliedCustomization
              ? 'Saved Customization'
              : 'Factory Default'}
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onReset}
              disabled={isDefaultLook}
              className="min-h-[44px] px-3 rounded-xl bg-[#141714] border border-[#F3EFE6]/18 text-xs font-semibold flex items-center gap-1.5 text-[#F3EFE6]/80 hover:border-[#F3EFE6]/45 disabled:opacity-40 disabled:cursor-not-allowed transition whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Customization
            </button>

            <button
              type="button"
              onClick={onApply}
              disabled={lockedItems.length > 0 || (!hasUnappliedChanges && appliedCustomization !== null)}
              className={`min-h-[44px] px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                hasUnappliedChanges && lockedItems.length === 0
                  ? 'bg-[#22C55E] text-[#141714] hover:bg-[#4ADE80] shadow'
                  : 'bg-[#272D25] border border-[#F3EFE6]/20 text-[#F3EFE6]/85 hover:bg-[#31382E]'
              }`}
            >
              <Check className="w-4 h-4 stroke-[2.6]" />
              {hasUnappliedChanges ? 'Apply & Save' : 'Applied'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

