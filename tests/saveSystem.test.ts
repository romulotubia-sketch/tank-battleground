import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getTankPresets, PAINT_COLOR_SWATCHES, TANK_DECAL_LIST } from '../src/data/customization.ts';
import {
  isDecalUnlocked,
  isPaintColorUnlocked,
  isPresetUnlocked,
  isSpecialCosmeticUnlocked,
  isTankUnlocked,
} from '../src/data/economy.ts';
import {
  applyGameplayEvent,
  claimMissionOrAchievementReward,
} from '../src/data/missions.ts';
import { calculateMatchScrapBreakdown } from '../src/data/progression.ts';
import {
  applyMatchResultToProgression,
  buyDecalWithScrap,
  buyPaintColorWithScrap,
  buyPresetWithScrap,
  buySpecialCosmeticWithScrap,
  buyTankWithScrap,
  createDefaultProgression,
  CURRENT_SAVE_VERSION,
  hydrateFromPlatformStorage,
  loadMissions,
  loadProgression,
  loadProgressionSafe,
  MISSIONS_KEY,
  PROGRESSION_BACKUP_KEY,
  PROGRESSION_KEY,
  saveMissions,
  saveProgression,
  saveTankCustomization,
  StorageLike,
  subscribeSaveEvents,
} from '../src/data/storage.ts';
import { TANK_DEFINITIONS } from '../src/data/tanks.ts';
import { platformBridge } from '../src/services/bridge/PlaygamaBridgeAdapter.ts';
import { MatchResult, SaveFeedbackEvent, TankCustomization } from '../src/types/game.ts';

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  public setCalls = 0;

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.setCalls += 1;
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  rawSet(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function makeMatch(overrides: Partial<MatchResult> = {}): MatchResult {
  const base: MatchResult = {
    matchId: 'save_match_1',
    victory: true,
    reason: 'last_standing',
    placement: 1,
    totalTanks: 8,
    eliminations: 3,
    damageDealt: 280,
    survivalSec: 75,
    scrapEarned: 0,
    arenaId: 'training_grounds',
    tankId: 'assault',
    winnerName: 'Commander',
    ...overrides,
  };
  const breakdown = calculateMatchScrapBreakdown(base);
  return {
    ...base,
    scrapEarned: breakdown.totalScrap,
    scrapBreakdown: breakdown,
  };
}

describe('Stage 14: Save System & Progression Persistence', () => {
  it('1. Preserves existing pre-v4 player progress on migration without resetting unlocks', () => {
    const storage = new MemoryStorage();
    storage.rawSet(
      PROGRESSION_KEY,
      JSON.stringify({
        saveVersion: 3,
        playerName: 'IronCommander',
        level: 4,
        xp: 80,
        xpToNext: 340,
        totalXpEarned: 580,
        unlockedTanks: ['assault', 'scout', 'fortress'],
        selectedTank: 'scout',
        selectedArena: 'wasteland',
        scrap: 240,
        matchesPlayed: 10,
        wins: 6,
        totalEliminations: 27,
        totalPlaytimeSec: 650,
        bestPlacement: 1,
        claimedMilestoneLevels: [2, 3],
        unlockedCosmetics: ['default', 'brass_trim', 'arctic_chrome'],
        equippedCosmetic: 'arctic_chrome',
        unlockedPaintColors: ['#5B7048', '#2E6B4E'],
        unlockedDecals: ['none', 'chevron', 'iron_crosshair'],
        unlockedPresets: ['scout_night_recon'],
        customPaintUnlocked: true,
        tankCustomizations: {
          scout: {
            primaryColor: '#2E6B4E',
            secondaryColor: '#3E4F30',
            turretColor: '#2E6B4E',
            barrelColor: '#3E4F30',
            decalId: 'iron_crosshair',
            decalPosition: 'turret_top',
            decalColor: '#FACC15',
            presetId: null,
          },
        },
        processedMatchIds: ['old_match_1'],
      })
    );

    const migrated = loadProgression(storage);
    assert.equal(migrated.saveVersion, CURRENT_SAVE_VERSION);
    assert.equal(migrated.playerName, 'IronCommander');
    assert.equal(migrated.scrap, 240);
    assert.equal(migrated.totalScrapEarned, 240);
    assert.equal(migrated.totalScrapSpent, 0);
    assert.equal(migrated.matchesPlayed, 10);
    assert.equal(migrated.wins, 6);
    assert.equal(migrated.defeats, 4);
    assert.deepEqual(migrated.unlockedTanks, ['assault', 'scout', 'fortress']);
    assert.equal(migrated.selectedTank, 'scout');
    assert.equal(migrated.equippedCosmetic, 'arctic_chrome');
    assert.equal(migrated.customPaintUnlocked, true);
    assert.equal(isDecalUnlocked(migrated, 'iron_crosshair'), true);
    assert.equal(isPresetUnlocked(migrated, 'scout_night_recon'), true);
    assert.equal(migrated.tankCustomizations.scout?.decalId, 'iron_crosshair');
  });

  it('2-6. Tracks Scrap earned/spent, wins/defeats, unlocks, and customization across full reopen cycle', () => {
    const storage = new MemoryStorage();
    let prog = loadProgression(storage);
    let missions = loadMissions(storage, Date.now(), prog);

    // Match 1: Victory
    const winRes = applyMatchResultToProgression(prog, makeMatch({ matchId: 'm_win_1', victory: true }), storage);
    prog = winRes.progression;
    const winScrap = winRes.summary.totalScrapAwarded;

    // Match 2: Defeat
    const lossRes = applyMatchResultToProgression(
      prog,
      makeMatch({ matchId: 'm_loss_2', victory: false, reason: 'eliminated', placement: 6, eliminations: 1 }),
      storage
    );
    prog = lossRes.progression;
    const lossScrap = lossRes.summary.totalScrapAwarded;

    assert.equal(prog.matchesPlayed, 2);
    assert.equal(prog.wins, 1);
    assert.equal(prog.defeats, 1);
    assert.equal(prog.totalScrapEarned, winScrap + lossScrap);
    assert.equal(prog.scrap, winScrap + lossScrap);

    // Claim achievement scrap via gameplay event -> missions
    const evOutcome = applyGameplayEvent(missions, {
      eventId: 'ev_kill_1',
      type: 'tank_elimination',
      matchId: 'm_win_1',
      victimId: 'bot_1',
    });
    missions = evOutcome.nextState;
    saveMissions(missions, storage);

    const achClaim = claimMissionOrAchievementReward(prog, missions, 'achievement', 'ach_first_elim');
    assert.equal(achClaim.outcome.claimed, true);
    prog = achClaim.nextProgression;
    missions = achClaim.nextMissions;
    saveProgression(prog, storage);
    saveMissions(missions, storage);

    // Grant extra scrap via match so player can buy tank + cosmetics
    const bonusMatch = applyMatchResultToProgression(
      prog,
      makeMatch({ matchId: 'm_bonus_3', victory: true, eliminations: 20, damageDealt: 1000 }),
      storage
    );
    prog = bonusMatch.progression;
    const earnedBeforeSpend = prog.totalScrapEarned;

    // Purchase Scout tank (90 Scrap)
    const tankBuy = buyTankWithScrap(prog, 'scout', storage);
    assert.equal(tankBuy.success, true);
    prog = tankBuy.nextProgression;

    // Purchase Paint Swatch, Decal, Preset, Workshop Skin
    const paidSwatch = PAINT_COLOR_SWATCHES.find((s) => s.scrapCost > 0)!;
    const paidDecal = TANK_DECAL_LIST.find((d) => (d.scrapCost ?? 0) > 0)!;
    const scoutPreset = getTankPresets('scout')[0];

    const paintBuy = buyPaintColorWithScrap(prog, paidSwatch.hex, storage);
    assert.equal(paintBuy.success, true);
    prog = paintBuy.nextProgression;

    const decalBuy = buyDecalWithScrap(prog, paidDecal.id, storage);
    assert.equal(decalBuy.success, true);
    prog = decalBuy.nextProgression;

    const presetBuy = buyPresetWithScrap(prog, scoutPreset.id, storage);
    assert.equal(presetBuy.success, true);
    prog = presetBuy.nextProgression;

    const skinBuy = buySpecialCosmeticWithScrap(prog, 'arctic_chrome', storage);
    assert.equal(skinBuy.success, true);
    prog = skinBuy.nextProgression;

    const expectedSpent =
      TANK_DEFINITIONS.scout.unlockCost +
      paidSwatch.scrapCost +
      (paidDecal.scrapCost ?? 0) +
      (scoutPreset.scrapCost ?? 0) +
      120;
    assert.equal(prog.totalScrapSpent, expectedSpent);
    assert.equal(prog.totalScrapEarned, earnedBeforeSpend);
    assert.equal(prog.scrap, earnedBeforeSpend - expectedSpent);

    // Select Scout & Save custom look
    prog = { ...prog, selectedTank: 'scout', equippedCosmetic: 'arctic_chrome' };
    const customLook: TankCustomization = {
      primaryColor: paidSwatch.hex.toUpperCase(),
      secondaryColor: '#3E4F30',
      turretColor: '#5B7048',
      barrelColor: '#333B46',
      decalId: paidDecal.id,
      decalPosition: 'hull_front',
      decalColor: '#F3EFE6',
      presetId: null,
    };
    prog = saveTankCustomization(prog, 'scout', customLook, storage);

    // Reopen / Reload from storage
    const reopened = loadProgression(storage);
    const reopenedMissions = loadMissions(storage, Date.now(), reopened);

    assert.equal(reopened.scrap, earnedBeforeSpend - expectedSpent);
    assert.equal(reopened.totalScrapEarned, earnedBeforeSpend);
    assert.equal(reopened.totalScrapSpent, expectedSpent);
    assert.equal(reopened.matchesPlayed, 3);
    assert.equal(reopened.wins, 2);
    assert.equal(reopened.defeats, 1);
    assert.equal(isTankUnlocked(reopened, 'scout'), true);
    assert.equal(reopened.selectedTank, 'scout');
    assert.equal(reopened.equippedCosmetic, 'arctic_chrome');
    assert.equal(isSpecialCosmeticUnlocked(reopened, 'arctic_chrome'), true);
    assert.equal(isPaintColorUnlocked(reopened, paidSwatch.hex, TANK_DEFINITIONS.scout), true);
    assert.equal(isDecalUnlocked(reopened, paidDecal.id), true);
    assert.equal(isPresetUnlocked(reopened, scoutPreset.id), true);
    assert.deepEqual(reopened.tankCustomizations.scout, customLook);
    assert.equal(reopenedMissions.achievements.ach_first_elim?.completed, true);
    assert.equal(reopenedMissions.achievements.ach_first_elim?.claimed, true);

    // Reloading must NEVER duplicate match rewards
    const duplicateCheck = applyMatchResultToProgression(
      reopened,
      makeMatch({ matchId: 'm_win_1', victory: true }),
      storage
    );
    assert.equal(duplicateCheck.summary.alreadyProcessed, true);
    assert.equal(duplicateCheck.progression.scrap, reopened.scrap);
    assert.equal(duplicateCheck.progression.matchesPlayed, 3);
  });

  it('7-9. Guards invalid values, interrupted primary saves, and emits save events without crashing', () => {
    const events: SaveFeedbackEvent[] = [];
    const unsubscribe = subscribeSaveEvents((ev) => events.push(ev));

    const storage = new MemoryStorage();
    const valid = createDefaultProgression();
    valid.playerName = 'Guardian';
    valid.scrap = 300;
    valid.wins = 4;
    valid.defeats = 2;
    valid.matchesPlayed = 6;
    assert.equal(saveProgression(valid, storage), true);
    assert.ok(events.some((e) => e.scope === 'progression' && e.status === 'saved'));

    // Simulate interrupted primary write leaving truncated JSON while backup remains intact
    storage.rawSet(PROGRESSION_KEY, '{"saveVersion":4,"scrap":30');
    const callsBeforeLoad = storage.setCalls;
    const recovered = loadProgressionSafe(storage);
    assert.equal(recovered.status, 'recovered_backup');
    assert.equal(recovered.progression.playerName, 'Guardian');
    assert.equal(recovered.progression.scrap, 300);
    assert.equal(storage.setCalls, callsBeforeLoad);

    // Simulate invalid negative / duplicate / broken values in storage
    const badStorage = new MemoryStorage();
    badStorage.rawSet(
      PROGRESSION_KEY,
      JSON.stringify({
        saveVersion: 4,
        playerName: '   ',
        level: -5,
        xp: -20,
        scrap: -999,
        totalScrapEarned: -10,
        totalScrapSpent: -40,
        matchesPlayed: 2,
        wins: 5,
        defeats: -3,
        unlockedTanks: ['assault', 'assault', 'nonexistent_tank'],
        selectedTank: 'phantom', // locked!
        equippedCosmetic: 'nonexistent_skin',
      })
    );
    const sanitized = loadProgression(badStorage);
    assert.equal(sanitized.playerName, 'Commander');
    assert.equal(sanitized.level, 1);
    assert.equal(sanitized.xp, 0);
    assert.equal(sanitized.scrap, 0);
    assert.equal(sanitized.totalScrapEarned, 0);
    assert.equal(sanitized.totalScrapSpent, 0);
    assert.equal(sanitized.wins, 5);
    assert.equal(sanitized.defeats, 0);
    assert.equal(sanitized.matchesPlayed, 5);
    assert.deepEqual(sanitized.unlockedTanks, ['assault']);
    assert.equal(sanitized.selectedTank, 'assault');
    assert.equal(sanitized.equippedCosmetic, 'default');
    assert.ok(badStorage.getItem(PROGRESSION_BACKUP_KEY) === null);

    unsubscribe();
  });

  it('10. Playgama storage compatibility handles missing SDK gracefully and hydrates empty local saves safely', async () => {
    assert.equal(platformBridge.supportsPlatformStorage, false);
    const localOnly = new MemoryStorage();
    const res = await hydrateFromPlatformStorage(localOnly);
    assert.equal(res.progression, null);
    assert.equal(res.missions, null);

    // Mock Playgama global bridge.storage cleanly for cloud-restore verification
    const remoteProg = createDefaultProgression();
    remoteProg.playerName = 'CloudTanker';
    remoteProg.scrap = 550;
    remoteProg.unlockedTanks = ['assault', 'fortress'];
    const remoteSerialized = JSON.stringify(remoteProg);

    (globalThis as { bridge?: unknown }).bridge = {
      platform: { id: 'playgama' },
      storage: {
        isSupported: () => true,
        get: async (keys: string[]) =>
          keys.map((k) => (k === PROGRESSION_KEY ? remoteSerialized : null)),
        set: async () => undefined,
      },
    };

    try {
      assert.equal(platformBridge.supportsPlatformStorage, true);
      const emptyLocal = new MemoryStorage();
      const hydrated = await hydrateFromPlatformStorage(emptyLocal);
      assert.ok(hydrated.progression !== null);
      assert.equal(hydrated.progression?.playerName, 'CloudTanker');
      assert.equal(hydrated.progression?.scrap, 550);
      assert.equal(isTankUnlocked(hydrated.progression!, 'fortress'), true);

      // Existing local data must NEVER be overwritten by remote hydration
      const existingLocal = new MemoryStorage();
      const localSave = createDefaultProgression();
      localSave.playerName = 'LocalAce';
      localSave.scrap = 999;
      saveProgression(localSave, existingLocal);

      const skipped = await hydrateFromPlatformStorage(existingLocal);
      assert.equal(skipped.progression, null);
      assert.equal(loadProgression(existingLocal).playerName, 'LocalAce');
      assert.equal(loadProgression(existingLocal).scrap, 999);
      assert.equal(existingLocal.getItem(MISSIONS_KEY), null);
    } finally {
      delete (globalThis as { bridge?: unknown }).bridge;
    }
  });
});
