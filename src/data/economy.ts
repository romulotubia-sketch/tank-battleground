import {
  CosmeticId,
  PlayerProgression,
  PurchaseOutcome,
  TankCustomization,
  TankDecalId,
  TankDefinition,
  TankId,
} from '../types/game';
import {
  createDefaultTankCustomization,
  CUSTOM_PAINT_STUDIO_COST,
  DECAL_COLOR_SWATCHES,
  getDecalCost,
  getPaintColorCost,
  getPresetCost,
  normalizeHexColor,
  PAINT_COLOR_SWATCHES,
  STARTER_DECAL_IDS,
  STARTER_PAINT_COLORS,
  TANK_DECAL_MAP,
  TANK_PRESET_MAP,
} from './customization';
import { COSMETIC_DEFINITIONS } from './progression';
import { TANK_DEFINITIONS } from './tanks';

function failPurchase(
  progression: PlayerProgression,
  reason: PurchaseOutcome['reason'],
  cost = 0
): PurchaseOutcome {
  return {
    success: false,
    reason,
    cost,
    remainingScrap: Math.max(0, Math.floor(progression.scrap)),
    nextProgression: progression,
  };
}

function getSafeScrap(progression: PlayerProgression): number {
  return Math.max(0, Math.floor(progression.scrap));
}

function getSafeScrapSpent(progression: PlayerProgression): number {
  return Math.max(0, Math.floor(progression.totalScrapSpent ?? 0));
}

export function isTankUnlocked(progression: PlayerProgression, tankId: TankId): boolean {
  const def = TANK_DEFINITIONS[tankId];
  if (!def || !def.implemented) return false;
  return def.isStarter || progression.unlockedTanks.includes(tankId);
}

export function isDecalUnlocked(
  progression: PlayerProgression,
  decalId: TankDecalId
): boolean {
  const def = TANK_DECAL_MAP[decalId];
  if (!def) return false;
  if ((def.scrapCost ?? 0) <= 0) return true;
  if (STARTER_DECAL_IDS.includes(decalId)) return true;
  if (progression.unlockedDecals.includes(decalId)) return true;

  // Presets already purchased unlock their included decal visually for reuse cleanly
  for (const presetId of progression.unlockedPresets) {
    if (TANK_PRESET_MAP[presetId]?.customization.decalId === decalId) {
      return true;
    }
  }
  return false;
}

export function isPresetUnlocked(
  progression: PlayerProgression,
  presetId: string
): boolean {
  const preset = TANK_PRESET_MAP[presetId];
  if (!preset) return false;
  if ((preset.scrapCost ?? 0) <= 0) return true;
  return progression.unlockedPresets.includes(presetId);
}

export function isSpecialCosmeticUnlocked(
  progression: PlayerProgression,
  cosmeticId: CosmeticId
): boolean {
  if (cosmeticId === 'default') return true;
  return progression.unlockedCosmetics.includes(cosmeticId);
}

export function isPaintColorUnlocked(
  progression: PlayerProgression,
  rawHex: string,
  tank?: TankDefinition
): boolean {
  const hex = normalizeHexColor(rawHex, '#000000');
  if (STARTER_PAINT_COLORS.includes(hex)) return true;
  if (progression.unlockedPaintColors.some((c) => c.toUpperCase() === hex)) {
    return true;
  }

  // Always allow the active tank's own factory colors and any unlocked preset/skin colors
  if (tank) {
    const def = createDefaultTankCustomization(tank, progression.equippedCosmetic);
    if (
      def.primaryColor === hex ||
      def.secondaryColor === hex ||
      def.turretColor === hex ||
      def.barrelColor === hex ||
      def.decalColor === hex
    ) {
      return true;
    }
  }

  for (const presetId of progression.unlockedPresets) {
    const c = TANK_PRESET_MAP[presetId]?.customization;
    if (
      c &&
      (c.primaryColor.toUpperCase() === hex ||
        c.secondaryColor.toUpperCase() === hex ||
        c.turretColor.toUpperCase() === hex ||
        c.barrelColor.toUpperCase() === hex ||
        c.decalColor.toUpperCase() === hex)
    ) {
      return true;
    }
  }

  // If this hex is a priced shop swatch not yet unlocked, require purchase
  const catalogMatch =
    PAINT_COLOR_SWATCHES.some((s) => s.hex.toUpperCase() === hex && s.scrapCost > 0) ||
    DECAL_COLOR_SWATCHES.some((s) => s.hex.toUpperCase() === hex && s.scrapCost > 0);
  if (catalogMatch) {
    return false;
  }

  return progression.customPaintUnlocked;
}

export function getLockedItemsInCustomization(
  progression: PlayerProgression,
  tank: TankDefinition,
  draft: TankCustomization
): string[] {
  const locked: string[] = [];

  if (draft.presetId && !isPresetUnlocked(progression, draft.presetId)) {
    const preset = TANK_PRESET_MAP[draft.presetId];
    if (preset) {
      locked.push(`${preset.name} (${preset.scrapCost ?? 0} Scrap)`);
      return locked;
    }
  }

  const zones: Array<[string, string]> = [
    ['Primary paint', draft.primaryColor],
    ['Secondary paint', draft.secondaryColor],
    ['Turret paint', draft.turretColor],
    ['Barrel paint', draft.barrelColor],
    ['Decal color', draft.decalColor],
  ];
  for (const [label, hex] of zones) {
    if (!isPaintColorUnlocked(progression, hex, tank)) {
      const cost = getPaintColorCost(hex);
      locked.push(cost > 0 ? `${label} (${cost} Scrap)` : `${label} (Custom Studio)`);
    }
  }

  if (!isDecalUnlocked(progression, draft.decalId)) {
    const decal = TANK_DECAL_MAP[draft.decalId];
    locked.push(`${decal?.name ?? draft.decalId} (${getDecalCost(draft.decalId)} Scrap)`);
  }

  return locked;
}

/**
 * Purchases an unowned combat tank with Scrap.
 * Prevents duplicate purchases, negative Scrap, and preserves existing unlocked tanks.
 */
export function purchaseTankWithScrap(
  progression: PlayerProgression,
  tankId: TankId
): PurchaseOutcome {
  const def = TANK_DEFINITIONS[tankId];
  if (!def || !def.implemented) {
    return failPurchase(progression, 'not_found');
  }
  if (isTankUnlocked(progression, tankId)) {
    return failPurchase(progression, 'already_unlocked', 0);
  }

  const cost = Math.max(0, Math.floor(def.unlockCost));
  const currentScrap = getSafeScrap(progression);
  if (currentScrap < cost) {
    return failPurchase(progression, 'insufficient_scrap', cost);
  }

  const nextScrap = currentScrap - cost;
  const unlockedTanks = Array.from(new Set([...progression.unlockedTanks, tankId]));
  const nextProgression: PlayerProgression = {
    ...progression,
    scrap: nextScrap,
    totalScrapSpent: getSafeScrapSpent(progression) + cost,
    unlockedTanks,
  };

  return {
    success: true,
    reason: 'purchased',
    cost,
    remainingScrap: nextScrap,
    nextProgression,
  };
}

/**
 * Purchases a paint swatch or decal color with Scrap.
 */
export function purchasePaintColorWithScrap(
  progression: PlayerProgression,
  rawHex: string
): PurchaseOutcome {
  const hex = normalizeHexColor(rawHex, '');
  if (!hex) {
    return failPurchase(progression, 'not_found');
  }

  const swatch =
    PAINT_COLOR_SWATCHES.find((s) => s.hex.toUpperCase() === hex) ??
    DECAL_COLOR_SWATCHES.find((s) => s.hex.toUpperCase() === hex);
  if (!swatch) {
    return failPurchase(progression, 'not_found');
  }

  if (
    swatch.scrapCost <= 0 ||
    progression.unlockedPaintColors.some((c) => c.toUpperCase() === hex)
  ) {
    return failPurchase(progression, 'already_unlocked', 0);
  }

  const cost = Math.max(0, Math.floor(swatch.scrapCost));
  const currentScrap = getSafeScrap(progression);
  if (currentScrap < cost) {
    return failPurchase(progression, 'insufficient_scrap', cost);
  }

  const nextScrap = currentScrap - cost;
  const nextColors = Array.from(
    new Set([...progression.unlockedPaintColors.map((c) => c.toUpperCase()), hex])
  );
  const nextProgression: PlayerProgression = {
    ...progression,
    scrap: nextScrap,
    totalScrapSpent: getSafeScrapSpent(progression) + cost,
    unlockedPaintColors: nextColors,
  };

  return {
    success: true,
    reason: 'purchased',
    cost,
    remainingScrap: nextScrap,
    nextProgression,
  };
}

/**
 * Unlocks the full Custom Paint Studio hex picker with Scrap.
 */
export function purchaseCustomPaintStudioWithScrap(
  progression: PlayerProgression
): PurchaseOutcome {
  if (progression.customPaintUnlocked) {
    return failPurchase(progression, 'already_unlocked', 0);
  }
  const cost = CUSTOM_PAINT_STUDIO_COST;
  const currentScrap = getSafeScrap(progression);
  if (currentScrap < cost) {
    return failPurchase(progression, 'insufficient_scrap', cost);
  }
  const nextScrap = currentScrap - cost;
  const nextProgression: PlayerProgression = {
    ...progression,
    scrap: nextScrap,
    totalScrapSpent: getSafeScrapSpent(progression) + cost,
    customPaintUnlocked: true,
  };
  return {
    success: true,
    reason: 'purchased',
    cost,
    remainingScrap: nextScrap,
    nextProgression,
  };
}

/**
 * Purchases a tank decal permanently with Scrap.
 */
export function purchaseDecalWithScrap(
  progression: PlayerProgression,
  decalId: TankDecalId
): PurchaseOutcome {
  const decal = TANK_DECAL_MAP[decalId];
  if (!decal) {
    return failPurchase(progression, 'not_found');
  }
  if ((decal.scrapCost ?? 0) <= 0 || progression.unlockedDecals.includes(decalId)) {
    return failPurchase(progression, 'already_unlocked', 0);
  }

  const cost = Math.max(0, Math.floor(decal.scrapCost ?? 0));
  const currentScrap = getSafeScrap(progression);
  if (currentScrap < cost) {
    return failPurchase(progression, 'insufficient_scrap', cost);
  }

  const nextScrap = currentScrap - cost;
  const nextProgression: PlayerProgression = {
    ...progression,
    scrap: nextScrap,
    totalScrapSpent: getSafeScrapSpent(progression) + cost,
    unlockedDecals: Array.from(new Set([...progression.unlockedDecals, decalId])),
  };

  return {
    success: true,
    reason: 'purchased',
    cost,
    remainingScrap: nextScrap,
    nextProgression,
  };
}

/**
 * Purchases a tank cosmetic preset permanently with Scrap (and unlocks its colors & decal).
 */
export function purchasePresetWithScrap(
  progression: PlayerProgression,
  presetId: string
): PurchaseOutcome {
  const preset = TANK_PRESET_MAP[presetId];
  if (!preset) {
    return failPurchase(progression, 'not_found');
  }
  if ((preset.scrapCost ?? 0) <= 0 || progression.unlockedPresets.includes(presetId)) {
    return failPurchase(progression, 'already_unlocked', 0);
  }

  const cost = Math.max(0, Math.floor(preset.scrapCost ?? 0));
  const currentScrap = getSafeScrap(progression);
  if (currentScrap < cost) {
    return failPurchase(progression, 'insufficient_scrap', cost);
  }

  const nextScrap = currentScrap - cost;
  const nextPresets = Array.from(new Set([...progression.unlockedPresets, presetId]));
  const nextDecals = Array.from(
    new Set([...progression.unlockedDecals, preset.customization.decalId])
  );

  const nextProgression: PlayerProgression = {
    ...progression,
    scrap: nextScrap,
    totalScrapSpent: getSafeScrapSpent(progression) + cost,
    unlockedPresets: nextPresets,
    unlockedDecals: nextDecals,
  };

  return {
    success: true,
    reason: 'purchased',
    cost,
    remainingScrap: nextScrap,
    nextProgression,
  };
}

/**
 * Purchases a Scrap-shop Special Appearance skin permanently.
 */
export function purchaseSpecialCosmeticWithScrap(
  progression: PlayerProgression,
  cosmeticId: CosmeticId
): PurchaseOutcome {
  const def = COSMETIC_DEFINITIONS[cosmeticId];
  if (!def) {
    return failPurchase(progression, 'not_found');
  }
  if (isSpecialCosmeticUnlocked(progression, cosmeticId)) {
    return failPurchase(progression, 'already_unlocked', 0);
  }
  if (!def.scrapCost || def.scrapCost <= 0) {
    return failPurchase(progression, 'not_purchasable', 0);
  }

  const cost = Math.max(0, Math.floor(def.scrapCost));
  const currentScrap = getSafeScrap(progression);
  if (currentScrap < cost) {
    return failPurchase(progression, 'insufficient_scrap', cost);
  }

  const nextScrap = currentScrap - cost;
  const nextProgression: PlayerProgression = {
    ...progression,
    scrap: nextScrap,
    totalScrapSpent: getSafeScrapSpent(progression) + cost,
    unlockedCosmetics: Array.from(new Set([...progression.unlockedCosmetics, cosmeticId])),
  };

  return {
    success: true,
    reason: 'purchased',
    cost,
    remainingScrap: nextScrap,
    nextProgression,
  };
}

export const REWARDED_AD_BONUS_SCRAP = 35;

/**
 * Grants an optional rewarded-advertisement Scrap bonus idempotently.
 * Never grants duplicate Scrap for the same grantId.
 */
export function applyRewardedAdScrap(
  progression: PlayerProgression,
  grantId: string,
  amount: number = REWARDED_AD_BONUS_SCRAP
): { granted: boolean; amountAwarded: number; nextProgression: PlayerProgression } {
  const cleanId = grantId.trim();
  const safeAmount = Math.max(0, Math.floor(amount));
  if (!cleanId || safeAmount <= 0) {
    return { granted: false, amountAwarded: 0, nextProgression: progression };
  }

  const processed = progression.processedRewardedAdIds ?? [];
  if (processed.includes(cleanId)) {
    return { granted: false, amountAwarded: 0, nextProgression: progression };
  }

  const nextScrap = getSafeScrap(progression) + safeAmount;
  const nextEarned = Math.max(nextScrap, Math.floor(progression.totalScrapEarned ?? 0) + safeAmount);
  const nextProcessed = [cleanId, ...processed].slice(0, 50);

  return {
    granted: true,
    amountAwarded: safeAmount,
    nextProgression: {
      ...progression,
      scrap: nextScrap,
      totalScrapEarned: nextEarned,
      processedRewardedAdIds: nextProcessed,
    },
  };
}

