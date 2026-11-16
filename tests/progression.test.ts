import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyMatchProgression,
  calculateMatchXpBreakdown,
  getEffectiveTankVisual,
  getXpRequiredForLevel,
  LEVEL_CURVE_CONFIG,
  MILESTONE_REWARDS,
  XP_REWARD_CONFIG,
} from '../src/data/progression.ts';
import {
  applyMatchResultToProgression,
  createDefaultProgression,
  CURRENT_SAVE_VERSION,
  equipPlayerCosmetic,
  loadProgression,
  loadProgressionSafe,
  PROGRESSION_BACKUP_KEY,
  PROGRESSION_KEY,
  saveProgression,
  StorageLike,
  updatePlayerDisplayName,
} from '../src/data/storage.ts';
import { TANK_DEFINITIONS, TANK_LIST } from '../src/data/tanks.ts';
import { MatchResult } from '../src/types/game.ts';

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

function makeMatchResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    matchId: 'match_test_1',
    victory: false,
    reason: 'eliminated',
    placement: 5,
    totalTanks: 8,
    eliminations: 0,
    damageDealt: 120,
    survivalSec: 45,
    scrapEarned: 35,
    arenaId: 'training_grounds',
    tankId: 'assault',
    winnerName: 'Viper',
    ...overrides,
  };
}

describe('Tankbound Arena Progression & Leveling System', () => {
  it('1. Creates a valid default local player profile', () => {
    const storage = new MemoryStorage();
    const outcome = loadProgressionSafe(storage);

    assert.equal(outcome.status, 'new');
    assert.equal(outcome.progression.saveVersion, CURRENT_SAVE_VERSION);
    assert.equal(outcome.progression.playerName, 'Commander');
    assert.equal(outcome.progression.level, 1);
    assert.equal(outcome.progression.xp, 0);
    assert.equal(outcome.progression.xpToNext, getXpRequiredForLevel(1));
    assert.equal(outcome.progression.totalXpEarned, 0);
    assert.equal(outcome.progression.matchesPlayed, 0);
    assert.equal(outcome.progression.wins, 0);
    assert.equal(outcome.progression.totalEliminations, 0);
    assert.equal(outcome.progression.totalPlaytimeSec, 0);
    assert.deepEqual(outcome.progression.unlockedCosmetics, ['default']);
    assert.equal(outcome.progression.equippedCosmetic, 'default');
    assert.equal(storage.setCalls, 0);
  });

  it('2. Awards XP correctly for defeats, top-3 finishes, eliminations, and victories', () => {
    // Defeat outside top 3 with 0 eliminations -> completion XP only (50)
    const defeatOuter = calculateMatchXpBreakdown(
      makeMatchResult({ victory: false, placement: 6, eliminations: 0 })
    );
    assert.deepEqual(defeatOuter, {
      completionXp: 50,
      victoryBonusXp: 0,
      eliminationXp: 0,
      topThreeBonusXp: 0,
      totalXp: 50,
    });

    // Defeat inside top 3 (2nd place, 2 elims) -> 50 + 0 + 40 + 30 = 120 XP (no victory bonus)
    const defeatTop3 = calculateMatchXpBreakdown(
      makeMatchResult({ victory: false, reason: 'time_outscored', placement: 2, eliminations: 2 })
    );
    assert.deepEqual(defeatTop3, {
      completionXp: 50,
      victoryBonusXp: 0,
      eliminationXp: 40,
      topThreeBonusXp: 30,
      totalXp: 120,
    });

    // Victory (1st place, 3 elims) -> 50 + 100 + 60 + 30 = 240 XP
    const victoryBreakdown = calculateMatchXpBreakdown(
      makeMatchResult({ victory: true, reason: 'last_standing', placement: 1, eliminations: 3 })
    );
    assert.deepEqual(victoryBreakdown, {
      completionXp: 50,
      victoryBonusXp: 100,
      eliminationXp: 60,
      topThreeBonusXp: 30,
      totalXp: 240,
    });

    // Configurable custom XP rewards
    const custom = calculateMatchXpBreakdown(
      makeMatchResult({ victory: true, placement: 1, eliminations: 2 }),
      { ...XP_REWARD_CONFIG, matchCompletionXp: 75, victoryBonusXp: 150, eliminationXp: 25 }
    );
    assert.equal(custom.totalXp, 75 + 150 + 50 + 30);
  });

  it('3. Uses a strictly increasing configurable XP curve', () => {
    for (let lvl = 1; lvl < 20; lvl++) {
      const curr = getXpRequiredForLevel(lvl);
      const next = getXpRequiredForLevel(lvl + 1);
      assert.ok(next > curr, `Expected level ${lvl + 1} XP (${next}) > level ${lvl} XP (${curr})`);
    }

    const customReq = getXpRequiredForLevel(2, {
      ...LEVEL_CURVE_CONFIG,
      baseXp: 200,
      linearStep: 100,
      quadraticStep: 0,
    });
    assert.equal(customReq, 300);
  });

  it('4. Supports multiple level-ups from a single match with exact XP carryover', () => {
    const start = createDefaultProgression();
    // Lv1->2 needs 100 XP, Lv2->3 needs 160 XP (total 260 XP).
    // Victory with 6 eliminations = 50 + 100 + 120 + 30 = 300 XP -> Level 3 with 40 XP carried over!
    const { nextProgression, summary } = applyMatchProgression(
      start,
      makeMatchResult({
        matchId: 'multi_lvl_match',
        victory: true,
        reason: 'last_standing',
        placement: 1,
        eliminations: 6,
        survivalSec: 92,
        scrapEarned: 210,
      })
    );

    assert.equal(summary.previousLevel, 1);
    assert.equal(summary.newLevel, 3);
    assert.equal(summary.levelsGained, 2);
    assert.equal(summary.xpBreakdown.totalXp, 300);
    assert.equal(nextProgression.level, 3);
    assert.equal(nextProgression.xp, 40);
    assert.equal(nextProgression.xpToNext, getXpRequiredForLevel(3));
    assert.equal(nextProgression.totalXpEarned, 300);
    assert.equal(nextProgression.totalPlaytimeSec, 92);
    assert.equal(nextProgression.wins, 1);
    assert.equal(nextProgression.matchesPlayed, 1);
    assert.equal(nextProgression.totalEliminations, 6);
  });

  it('5. Grants level milestone rewards (Lv 2, 3, 5, 7, 10) once and keeps cosmetics visual-only', () => {
    let prog = createDefaultProgression();
    // Grant enough eliminations in one match to jump from Lv 1 straight past Lv 10:
    // Sum of Lv1..Lv9 XP = 100+160+240+340+460+600+760+940+1140 = 4740 XP.
    // 230 elims * 20 = 4600 + 50 + 100 + 30 = 4780 XP -> Level 10 with 40 XP carryover!
    const res1 = applyMatchProgression(
      prog,
      makeMatchResult({
        matchId: 'milestone_sweep',
        victory: true,
        placement: 1,
        eliminations: 230,
        scrapEarned: 50,
      })
    );
    prog = res1.nextProgression;

    assert.equal(prog.level, 10);
    assert.equal(prog.xp, 40);
    assert.deepEqual(prog.claimedMilestoneLevels, [2, 3, 5, 7, 10]);
    assert.equal(res1.summary.unlockedMilestones.length, MILESTONE_REWARDS.length);
    // Lv2 (+100) + Lv5 (+250) = +350 milestone scrap + 50 match scrap = 400 total scrap
    assert.equal(res1.summary.scrapFromMilestones, 350);
    assert.equal(prog.scrap, 400);
    assert.ok(prog.unlockedCosmetics.includes('brass_trim'));
    assert.ok(prog.unlockedCosmetics.includes('cobalt_strike'));
    assert.ok(prog.unlockedCosmetics.includes('apex_obsidian'));

    // Next match should NOT re-grant any milestone rewards
    const res2 = applyMatchProgression(
      prog,
      makeMatchResult({
        matchId: 'post_milestone_match',
        victory: false,
        placement: 4,
        eliminations: 1,
        scrapEarned: 50,
      })
    );
    assert.equal(res2.summary.unlockedMilestones.length, 0);
    assert.equal(res2.summary.scrapFromMilestones, 0);
    assert.equal(res2.nextProgression.scrap, 450);

    // Verify cosmetics are strictly visual-only and never alter tank combat stats
    for (const tank of TANK_LIST) {
      const beforeStats = JSON.stringify(tank.stats);
      const beforeActive = JSON.stringify(tank.activeAbility);
      const beforePassive = JSON.stringify(tank.passiveAbility);
      const skinnedVisual = getEffectiveTankVisual(tank, 'apex_obsidian');
      assert.notEqual(skinnedVisual.accentColor, undefined);
      assert.equal(JSON.stringify(TANK_DEFINITIONS[tank.id].stats), beforeStats);
      assert.equal(JSON.stringify(TANK_DEFINITIONS[tank.id].activeAbility), beforeActive);
      assert.equal(JSON.stringify(TANK_DEFINITIONS[tank.id].passiveAbility), beforePassive);
    }
  });

  it('6. Prevents duplicate XP and stats across repeated result processing or restarts', () => {
    const storage = new MemoryStorage();
    let prog = loadProgression(storage);
    const match = makeMatchResult({
      matchId: 'match_unique_42',
      victory: true,
      placement: 1,
      eliminations: 3,
      survivalSec: 80,
      scrapEarned: 165,
    });

    const first = applyMatchResultToProgression(prog, match, storage);
    prog = first.progression;
    assert.equal(first.summary.alreadyProcessed, false);
    assert.equal(first.summary.xpBreakdown.totalXp, 240);
    assert.equal(prog.level, 2);
    assert.equal(prog.xp, 140);
    assert.equal(prog.matchesPlayed, 1);
    assert.equal(prog.wins, 1);
    assert.equal(prog.scrap, 165 + 100); // +100 from Lv2 milestone

    // Re-applying the exact same matchId must be a complete no-op
    const duplicate = applyMatchResultToProgression(prog, match, storage);
    assert.equal(duplicate.summary.alreadyProcessed, true);
    assert.equal(duplicate.summary.xpBreakdown.totalXp, 0);
    assert.equal(duplicate.summary.levelsGained, 0);
    assert.equal(duplicate.progression.xp, 140);
    assert.equal(duplicate.progression.matchesPlayed, 1);
    assert.equal(duplicate.progression.wins, 1);
    assert.equal(duplicate.progression.scrap, 265);

    // Simulating a restart that begins a new match (new matchId) awards XP once for the new match
    const newMatch = makeMatchResult({
      matchId: 'match_unique_43',
      victory: false,
      placement: 5,
      eliminations: 1,
      survivalSec: 40,
      scrapEarned: 50,
    });
    const afterRestart = applyMatchResultToProgression(duplicate.progression, newMatch, storage);
    assert.equal(afterRestart.summary.alreadyProcessed, false);
    assert.equal(afterRestart.summary.xpBreakdown.totalXp, 70); // 50 + 20
    assert.equal(afterRestart.progression.level, 3); // 140 + 70 = 210 >= 160 -> Lv3 with 50 XP
    assert.equal(afterRestart.progression.xp, 50);
    assert.equal(afterRestart.progression.matchesPlayed, 2);
  });

  it('7. Persists profile edits, cosmetics, and progression across simulated reopen', () => {
    const storage = new MemoryStorage();
    let prog = loadProgression(storage);
    prog = updatePlayerDisplayName(prog, '  Iron Wolf  ', storage);
    assert.equal(prog.playerName, 'Iron Wolf');

    const res = applyMatchResultToProgression(
      prog,
      makeMatchResult({
        matchId: 'persist_match_1',
        victory: true,
        placement: 1,
        eliminations: 6,
        survivalSec: 110,
        scrapEarned: 210,
      }),
      storage
    );
    prog = res.progression;
    assert.equal(prog.level, 3);
    assert.ok(prog.unlockedCosmetics.includes('brass_trim'));

    prog = equipPlayerCosmetic(prog, 'brass_trim', storage);
    assert.equal(prog.equippedCosmetic, 'brass_trim');

    // Simulate closing and reopening the game with a fresh loadProgression(storage)
    const reopened = loadProgression(storage);
    assert.equal(reopened.saveVersion, CURRENT_SAVE_VERSION);
    assert.equal(reopened.playerName, 'Iron Wolf');
    assert.equal(reopened.level, 3);
    assert.equal(reopened.xp, 40);
    assert.equal(reopened.totalXpEarned, 300);
    assert.equal(reopened.matchesPlayed, 1);
    assert.equal(reopened.wins, 1);
    assert.equal(reopened.totalEliminations, 6);
    assert.equal(reopened.totalPlaytimeSec, 110);
    assert.equal(reopened.equippedCosmetic, 'brass_trim');
    assert.deepEqual(reopened.claimedMilestoneLevels, [2, 3]);
    assert.ok(reopened.processedMatchIds.includes('persist_match_1'));
  });

  it('8. Handles corrupted save data without overwriting stored data and migrates v1 saves', () => {
    const storage = new MemoryStorage();
    // Corrupt primary with no backup: must NOT overwrite primary key on load failure
    storage.rawSet(PROGRESSION_KEY, '{not valid json!!!');
    const callsBefore = storage.setCalls;
    const corruptOutcome = loadProgressionSafe(storage);

    assert.equal(corruptOutcome.status, 'corrupt_fallback');
    assert.equal(corruptOutcome.progression.level, 1);
    assert.equal(storage.setCalls, callsBefore);
    assert.equal(storage.getItem(PROGRESSION_KEY), '{not valid json!!!');

    // Backup recovery when primary is corrupted
    const valid = createDefaultProgression();
    valid.playerName = 'Ace';
    valid.level = 4;
    saveProgression(valid, storage);
    storage.rawSet(PROGRESSION_KEY, 'CORRUPTED_STRING');

    const recoveredOutcome = loadProgressionSafe(storage);
    assert.equal(recoveredOutcome.status, 'recovered_backup');
    assert.equal(recoveredOutcome.progression.playerName, 'Ace');
    assert.equal(recoveredOutcome.progression.level, 4);
    assert.ok(storage.getItem(PROGRESSION_BACKUP_KEY) !== null);

    // v1 legacy save migration preserves existing data and upgrades to CURRENT_SAVE_VERSION
    const v1Storage = new MemoryStorage();
    v1Storage.rawSet(
      PROGRESSION_KEY,
      JSON.stringify({
        playerName: 'Veteran',
        level: 2,
        xp: 50,
        xpToNext: 100,
        unlockedTanks: ['assault'],
        selectedTank: 'fortress',
        selectedArena: 'wasteland',
        scrap: 320,
        matchesPlayed: 4,
        wins: 2,
        totalEliminations: 11,
        bestPlacement: 1,
      })
    );
    const migrated = loadProgression(v1Storage);
    assert.equal(migrated.saveVersion, CURRENT_SAVE_VERSION);
    assert.equal(migrated.playerName, 'Veteran');
    assert.equal(migrated.level, 2);
    assert.equal(migrated.xp, 50);
    assert.equal(migrated.xpToNext, getXpRequiredForLevel(2));
    assert.equal(migrated.scrap, 320);
    assert.equal(migrated.matchesPlayed, 4);
    assert.equal(migrated.wins, 2);
    assert.equal(migrated.totalEliminations, 11);
    assert.equal(migrated.selectedTank, 'fortress');
    assert.equal(migrated.selectedArena, 'wasteland');
  });
});
