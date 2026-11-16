import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTOM_PAINT_STUDIO_COST,
  DECAL_COLOR_SWATCHES,
  getTankPresets,
  PAINT_COLOR_SWATCHES,
  TANK_COSMETIC_PRESETS,
  TANK_DECAL_LIST,
} from '../src/data/customization.ts';
import {
  getLockedItemsInCustomization,
  isDecalUnlocked,
  isPaintColorUnlocked,
  isPresetUnlocked,
  isSpecialCosmeticUnlocked,
  isTankUnlocked,
} from '../src/data/economy.ts';
import {
  calculateMatchScrapBreakdown,
  COSMETIC_DEFINITIONS,
  SCRAP_REWARD_CONFIG,
} from '../src/data/progression.ts';
import {
  applyMatchResultToProgression,
  buyCustomPaintStudioWithScrap,
  buyDecalWithScrap,
  buyPaintColorWithScrap,
  buyPresetWithScrap,
  buySpecialCosmeticWithScrap,
  buyTankWithScrap,
  createDefaultProgression,
  CURRENT_SAVE_VERSION,
  loadProgression,
  PROGRESSION_KEY,
  saveProgression,
  saveTankCustomization,
  StorageLike,
} from '../src/data/storage.ts';
import { TANK_DEFINITIONS, TANK_LIST } from '../src/data/tanks.ts';
import { MatchResult, TankCustomization } from '../src/types/game.ts';

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  rawSet(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function makeMatchResult(overrides: Partial<MatchResult> = {}): MatchResult {
  const base: MatchResult = {
    matchId: 'econ_match_1',
    victory: false,
    reason: 'eliminated',
    placement: 5,
    totalTanks: 8,
    eliminations: 1,
    damageDealt: 120,
    survivalSec: 55,
    scrapEarned: 0,
    arenaId: 'training_grounds',
    tankId: 'assault',
    winnerName: 'Viper',
    ...overrides,
  };
  if (overrides.scrapEarned === undefined) {
    const breakdown = calculateMatchScrapBreakdown(base);
    return {
      ...base,
      scrapEarned: breakdown.totalScrap,
      scrapBreakdown: breakdown,
    };
  }
  return base;
}

describe('Stage 13: Expand Existing Scrap Economy', () => {
  it('1. Uses existing progression.scrap as the single currency with zero extra currency fields', () => {
    const fresh = createDefaultProgression();
    assert.equal(fresh.scrap, 0);
    assert.equal('coins' in fresh, false);
    assert.equal('gold' in fresh, false);
    assert.equal('gems' in fresh, false);
    assert.deepEqual(fresh.unlockedTanks, ['assault']);
    assert.equal(fresh.selectedTank, 'assault');
  });

  it('2. Calculates match Scrap breakdown accurately for completion, eliminations, victory, and performance bonus', () => {
    // Victory: 1st place (25 placement perf), 4 elims (40), 350 damage (7 dmg perf = 32 perf total), +20 completion, +35 victory = 127
    const winBreakdown = calculateMatchScrapBreakdown({
      victory: true,
      eliminations: 4,
      placement: 1,
      damageDealt: 350,
    });
    assert.deepEqual(winBreakdown, {
      completionScrap: SCRAP_REWARD_CONFIG.matchCompletionScrap,
      eliminationScrap: 40,
      victoryBonusScrap: SCRAP_REWARD_CONFIG.victoryBonusScrap,
      performanceBonusScrap: 25 + 7,
      totalScrap: 20 + 40 + 35 + 32,
    });

    // Defeat: 6th place (0 placement perf), 0 elims (0), 40 damage (0 dmg perf), +20 completion, 0 victory = 20
    const lossBreakdown = calculateMatchScrapBreakdown({
      victory: false,
      eliminations: 0,
      placement: 6,
      damageDealt: 40,
    });
    assert.deepEqual(lossBreakdown, {
      completionScrap: 20,
      eliminationScrap: 0,
      victoryBonusScrap: 0,
      performanceBonusScrap: 0,
      totalScrap: 20,
    });
  });

  it('3. Awards match Scrap once, never duplicates rewards, and abandoned matches never grant rewards', () => {
    const storage = new MemoryStorage();
    let prog = loadProgression(storage);

    // Simulate an abandoned match (player exited mid-match, so ArenaScene never finishes or calls progression service)
    assert.equal(prog.scrap, 0);
    assert.equal(prog.matchesPlayed, 0);

    const winResult = makeMatchResult({
      matchId: 'match_scrap_once',
      victory: true,
      reason: 'last_standing',
      placement: 1,
      eliminations: 3,
      damageDealt: 250,
    });
    const expectedScrap = calculateMatchScrapBreakdown(winResult).totalScrap;

    const first = applyMatchResultToProgression(prog, winResult, storage);
    prog = first.progression;
    assert.equal(first.summary.alreadyProcessed, false);
    assert.equal(first.summary.scrapFromMatch, expectedScrap);
    assert.equal(prog.scrap, expectedScrap + first.summary.scrapFromMilestones);

    const scrapAfterFirst = prog.scrap;
    const duplicate = applyMatchResultToProgression(prog, winResult, storage);
    assert.equal(duplicate.summary.alreadyProcessed, true);
    assert.equal(duplicate.summary.totalScrapAwarded, 0);
    assert.equal(duplicate.progression.scrap, scrapAfterFirst);
  });

  it('4. Tank Shop unlocks locked tanks with Scrap, prevents duplicates & insufficient funds, and preserves combat stats', () => {
    const storage = new MemoryStorage();
    let prog = createDefaultProgression();
    assert.equal(isTankUnlocked(prog, 'assault'), true);
    assert.equal(isTankUnlocked(prog, 'scout'), false);
    assert.equal(isTankUnlocked(prog, 'fortress'), false);

    // Insufficient Scrap must fail cleanly without changing balance or unlocks
    prog.scrap = 50;
    const failedBuy = buyTankWithScrap(prog, 'scout', storage); // scout costs 90
    assert.equal(failedBuy.success, false);
    assert.equal(failedBuy.reason, 'insufficient_scrap');
    assert.equal(failedBuy.nextProgression.scrap, 50);
    assert.equal(isTankUnlocked(failedBuy.nextProgression, 'scout'), false);

    // Sufficient Scrap unlocks Scout immediately
    prog.scrap = 250;
    saveProgression(prog, storage);
    const beforeScoutStats = JSON.stringify(TANK_DEFINITIONS.scout.stats);
    const beforeScoutActive = JSON.stringify(TANK_DEFINITIONS.scout.activeAbility);

    const boughtScout = buyTankWithScrap(prog, 'scout', storage);
    assert.equal(boughtScout.success, true);
    assert.equal(boughtScout.cost, TANK_DEFINITIONS.scout.unlockCost);
    assert.equal(boughtScout.remainingScrap, 250 - TANK_DEFINITIONS.scout.unlockCost);
    prog = boughtScout.nextProgression;
    assert.equal(isTankUnlocked(prog, 'scout'), true);
    assert.equal(isTankUnlocked(prog, 'assault'), true);

    // Tank combat stats & abilities remain completely untouched
    assert.equal(JSON.stringify(TANK_DEFINITIONS.scout.stats), beforeScoutStats);
    assert.equal(JSON.stringify(TANK_DEFINITIONS.scout.activeAbility), beforeScoutActive);

    // Duplicate purchase prevented without charging Scrap
    const duplicateScout = buyTankWithScrap(prog, 'scout', storage);
    assert.equal(duplicateScout.success, false);
    assert.equal(duplicateScout.reason, 'already_unlocked');
    assert.equal(duplicateScout.nextProgression.scrap, prog.scrap);

    // Persist across reopen
    const reopened = loadProgression(storage);
    assert.equal(reopened.scrap, prog.scrap);
    assert.equal(isTankUnlocked(reopened, 'scout'), true);
    assert.equal(isTankUnlocked(reopened, 'phantom'), false);
  });

  it('5. Cosmetic Shop sells paints, decals, presets, Custom Studio, and special skins cleanly with Scrap', () => {
    const storage = new MemoryStorage();
    let prog = createDefaultProgression();
    prog.scrap = 600;
    saveProgression(prog, storage);

    const paidSwatch = PAINT_COLOR_SWATCHES.find((s) => s.scrapCost > 0)!;
    const paidDecalColor = DECAL_COLOR_SWATCHES.find((s) => s.scrapCost > 0)!;
    const paidDecal = TANK_DECAL_LIST.find((d) => (d.scrapCost ?? 0) > 0)!;
    const assaultPreset = getTankPresets('assault')[0];

    // Locked items prevent applying unowned customization
    const lockedDraft: TankCustomization = {
      primaryColor: paidSwatch.hex,
      secondaryColor: '#3E4F30',
      turretColor: '#5B7048',
      barrelColor: '#3E4F30',
      decalId: paidDecal.id,
      decalPosition: 'turret_top',
      decalColor: paidDecalColor.hex,
      presetId: null,
    };
    assert.ok(getLockedItemsInCustomization(prog, TANK_DEFINITIONS.assault, lockedDraft).length >= 3);

    // Purchase swatch
    const buyPaint = buyPaintColorWithScrap(prog, paidSwatch.hex, storage);
    assert.equal(buyPaint.success, true);
    prog = buyPaint.nextProgression;
    assert.equal(isPaintColorUnlocked(prog, paidSwatch.hex, TANK_DEFINITIONS.assault), true);

    // Duplicate swatch blocked
    const dupPaint = buyPaintColorWithScrap(prog, paidSwatch.hex, storage);
    assert.equal(dupPaint.success, false);
    assert.equal(dupPaint.reason, 'already_unlocked');

    // Purchase decal & decal ink
    const buyDecalColor = buyPaintColorWithScrap(prog, paidDecalColor.hex, storage);
    assert.equal(buyDecalColor.success, true);
    prog = buyDecalColor.nextProgression;

    const buyDecal = buyDecalWithScrap(prog, paidDecal.id, storage);
    assert.equal(buyDecal.success, true);
    prog = buyDecal.nextProgression;
    assert.equal(isDecalUnlocked(prog, paidDecal.id), true);

    // Now all items in lockedDraft are owned
    assert.equal(
      getLockedItemsInCustomization(prog, TANK_DEFINITIONS.assault, lockedDraft).length,
      0
    );

    // Purchase preset
    assert.equal(isPresetUnlocked(prog, assaultPreset.id), false);
    const buyPreset = buyPresetWithScrap(prog, assaultPreset.id, storage);
    assert.equal(buyPreset.success, true);
    prog = buyPreset.nextProgression;
    assert.equal(isPresetUnlocked(prog, assaultPreset.id), true);

    // Purchase Custom Paint Studio
    assert.equal(prog.customPaintUnlocked, false);
    const buyStudio = buyCustomPaintStudioWithScrap(prog, storage);
    assert.equal(buyStudio.success, true);
    assert.equal(buyStudio.cost, CUSTOM_PAINT_STUDIO_COST);
    prog = buyStudio.nextProgression;
    assert.equal(prog.customPaintUnlocked, true);

    // Purchase Workshop Special Skin
    assert.equal(isSpecialCosmeticUnlocked(prog, 'arctic_chrome'), false);
    const buySkin = buySpecialCosmeticWithScrap(prog, 'arctic_chrome', storage);
    assert.equal(buySkin.success, true);
    assert.equal(buySkin.cost, COSMETIC_DEFINITIONS.arctic_chrome.scrapCost);
    prog = buySkin.nextProgression;
    assert.equal(isSpecialCosmeticUnlocked(prog, 'arctic_chrome'), true);

    // Milestone-only cosmetic cannot be bought in Scrap shop
    const tryMilestoneBuy = buySpecialCosmeticWithScrap(prog, 'apex_obsidian', storage);
    assert.equal(tryMilestoneBuy.success, false);
    assert.equal(tryMilestoneBuy.reason, 'not_purchasable');

    // Save customized tank look & verify persistence after simulated reopen
    prog = saveTankCustomization(prog, 'assault', lockedDraft, storage);
    const reopened = loadProgression(storage);
    assert.equal(reopened.scrap, prog.scrap);
    assert.equal(reopened.customPaintUnlocked, true);
    assert.equal(isPresetUnlocked(reopened, assaultPreset.id), true);
    assert.equal(isSpecialCosmeticUnlocked(reopened, 'arctic_chrome'), true);
    assert.deepEqual(reopened.tankCustomizations.assault, lockedDraft);
  });

  it('6. Preserves existing unlocks & progression when migrating legacy pre-v3 saves', () => {
    const legacyStorage = new MemoryStorage();
    legacyStorage.rawSet(
      PROGRESSION_KEY,
      JSON.stringify({
        saveVersion: 2,
        playerName: 'VeteranAce',
        level: 4,
        xp: 120,
        xpToNext: 340,
        totalXpEarned: 620,
        unlockedTanks: ['assault', 'scout', 'fortress', 'artillery', 'tesla', 'phantom'],
        selectedTank: 'phantom',
        selectedArena: 'industrial_zone',
        scrap: 415,
        matchesPlayed: 12,
        wins: 5,
        totalEliminations: 34,
        totalPlaytimeSec: 780,
        bestPlacement: 1,
        claimedMilestoneLevels: [2, 3],
        unlockedCosmetics: ['default', 'brass_trim'],
        equippedCosmetic: 'brass_trim',
      })
    );

    const migrated = loadProgression(legacyStorage);
    assert.equal(migrated.saveVersion, CURRENT_SAVE_VERSION);
    assert.equal(migrated.scrap, 415);
    assert.equal(migrated.selectedTank, 'phantom');
    assert.equal(migrated.unlockedTanks.length, 6);
    for (const tank of TANK_LIST) {
      assert.equal(isTankUnlocked(migrated, tank.id), true);
    }
    assert.equal(migrated.equippedCosmetic, 'brass_trim');
    assert.ok(TANK_COSMETIC_PRESETS.length >= 18);
  });
});
