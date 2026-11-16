import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACHIEVEMENT_DEFINITIONS,
  ALL_MISSION_DEFINITIONS,
  applyGameplayEvent,
  claimMissionOrAchievementReward,
  countUnclaimedRewards,
  createInitialMissionsState,
  DAILY_MISSION_POOL,
  ensureMissionPeriodsCurrent,
  getDailyPeriodKey,
  getResetCountdowns,
  getWeeklyPeriodKey,
  MISSION_RESET_CONFIG,
  selectMissionsForPeriod,
  WEEKLY_MISSION_POOL,
} from '../src/data/missions.ts';
import { getEffectiveTankVisual } from '../src/data/progression.ts';
import {
  createDefaultProgression,
  loadMissions,
  loadMissionsSafe,
  MISSIONS_BACKUP_KEY,
  MISSIONS_KEY,
  saveMissions,
  StorageLike,
} from '../src/data/storage.ts';
import { TANK_DEFINITIONS, TANK_LIST } from '../src/data/tanks.ts';
import { ArenaId, GameplayEvent, MissionsState, TankId } from '../src/types/game.ts';

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

function manilaTimeMs(isoManilaWithoutOffset: string): number {
  return Date.parse(`${isoManilaWithoutOffset}+08:00`);
}

function buildFullMissionsState(nowMs: number): MissionsState {
  const state = createInitialMissionsState(nowMs);
  return {
    ...state,
    dailyMissions: [
      { missionId: 'daily_play_3', progress: 0, completed: false, claimed: false, claimedAtMs: null },
      { missionId: 'daily_win_1', progress: 0, completed: false, claimed: false, claimedAtMs: null },
      { missionId: 'daily_elims_5', progress: 0, completed: false, claimed: false, claimedAtMs: null },
    ],
    weeklyMissions: [
      { missionId: 'weekly_play_15', progress: 0, completed: false, claimed: false, claimedAtMs: null },
      { missionId: 'weekly_win_5', progress: 0, completed: false, claimed: false, claimedAtMs: null },
      { missionId: 'weekly_diff_tanks_5', progress: 0, completed: false, claimed: false, claimedAtMs: null },
    ],
  };
}

describe('Tankbound Arena Daily Missions, Weekly Missions & Achievements', () => {
  it('1. Generates three varied active daily missions and three active weekly missions', () => {
    const t = manilaTimeMs('2026-06-10T10:00:00');
    const state = createInitialMissionsState(t);

    assert.equal(state.dailyMissions.length, 3);
    assert.equal(state.weeklyMissions.length, 3);

    const dailyIds = state.dailyMissions.map((m) => m.missionId);
    assert.equal(new Set(dailyIds).size, 3);
    const dailyMetrics = dailyIds.map((id) => ALL_MISSION_DEFINITIONS[id].metric);
    assert.equal(new Set(dailyMetrics).size, 3);

    const weeklyIds = state.weeklyMissions.map((m) => m.missionId);
    assert.equal(new Set(weeklyIds).size, 3);
    const weeklyMetrics = weeklyIds.map((id) => ALL_MISSION_DEFINITIONS[id].metric);
    assert.equal(new Set(weeklyMetrics).size, 3);

    // Deterministic for the same period, varied across consecutive days
    const day1 = selectMissionsForPeriod('2026-06-10', DAILY_MISSION_POOL, 3);
    const day2 = selectMissionsForPeriod(
      '2026-06-11',
      DAILY_MISSION_POOL,
      3,
      day1.map((m) => m.id)
    );
    assert.equal(day1.length, 3);
    assert.equal(day2.length, 3);
    const overlap = day2.filter((m) => day1.some((d1) => d1.id === m.id));
    assert.equal(overlap.length, 0);
  });

  it('2. Tracks Daily Missions, Weekly Missions, and Achievements simultaneously from gameplay events', () => {
    const t = manilaTimeMs('2026-06-10T14:00:00');
    let state = buildFullMissionsState(t);

    const events: GameplayEvent[] = [
      {
        eventId: 'm1:started',
        type: 'match_started',
        matchId: 'm1',
        tankId: 'scout',
        arenaId: 'industrial_zone',
      },
      {
        eventId: 'm1:elim:bot_1',
        type: 'tank_elimination',
        matchId: 'm1',
        victimId: 'bot_1',
      },
      {
        eventId: 'm1:pwr:1',
        type: 'powerup_collected',
        matchId: 'm1',
        powerupId: 'rapid_fire',
      },
      {
        eventId: 'm1:ability:1',
        type: 'ability_activated',
        matchId: 'm1',
        tankId: 'scout',
      },
      {
        eventId: 'm1:obs:4',
        type: 'obstacle_destroyed',
        matchId: 'm1',
        obstacleId: 4,
        obstacleType: 'crate',
      },
      {
        eventId: 'm1:completed',
        type: 'match_completed',
        matchId: 'm1',
        tankId: 'scout',
        arenaId: 'industrial_zone',
        placement: 1,
        survivalSec: 85,
      },
      {
        eventId: 'm1:victory',
        type: 'match_victory',
        matchId: 'm1',
        tankId: 'scout',
        arenaId: 'industrial_zone',
      },
    ];

    for (const ev of events) {
      const res = applyGameplayEvent(state, ev, t);
      assert.equal(res.applied, true);
      state = res.nextState;
    }

    // Daily updates
    const dPlay = state.dailyMissions.find((m) => m.missionId === 'daily_play_3')!;
    const dWin = state.dailyMissions.find((m) => m.missionId === 'daily_win_1')!;
    const dElim = state.dailyMissions.find((m) => m.missionId === 'daily_elims_5')!;
    assert.equal(dPlay.progress, 1);
    assert.equal(dWin.progress, 1);
    assert.equal(dWin.completed, true);
    assert.equal(dElim.progress, 1);

    // Weekly updates simultaneously
    const wPlay = state.weeklyMissions.find((m) => m.missionId === 'weekly_play_15')!;
    const wWin = state.weeklyMissions.find((m) => m.missionId === 'weekly_win_5')!;
    const wTanks = state.weeklyMissions.find((m) => m.missionId === 'weekly_diff_tanks_5')!;
    assert.equal(wPlay.progress, 1);
    assert.equal(wWin.progress, 1);
    assert.equal(wTanks.progress, 1);

    // Permanent Achievements update simultaneously
    assert.equal(state.achievements.ach_first_elim.completed, true);
    assert.equal(state.achievements.ach_survivor.completed, true);
    assert.equal(state.achievements.ach_collector.progress, 1);
    assert.equal(state.achievements.ach_demolition_expert.progress, 1);
    assert.equal(state.achievements.ach_tank_enthusiast.progress, 1);
    assert.equal(state.achievements.ach_arena_explorer.progress, 1);
  });

  it('3. Tracks Tank Enthusiast (6 tanks), Arena Explorer (3 arenas), and all Achievement categories', () => {
    const t = manilaTimeMs('2026-06-10T16:00:00');
    let state = createInitialMissionsState(t);

    const tanks: TankId[] = ['assault', 'fortress', 'scout', 'artillery', 'tesla', 'phantom'];
    const arenas: ArenaId[] = ['training_grounds', 'industrial_zone', 'wasteland'];

    tanks.forEach((tankId, idx) => {
      const arenaId = arenas[idx % arenas.length];
      state = applyGameplayEvent(
        state,
        {
          eventId: `all_${idx}:completed`,
          type: 'match_completed',
          matchId: `all_${idx}`,
          tankId,
          arenaId,
          placement: 2,
          survivalSec: 60,
        },
        t
      ).nextState;
    });

    assert.equal(state.achievements.ach_tank_enthusiast.progress, 6);
    assert.equal(state.achievements.ach_tank_enthusiast.completed, true);
    assert.equal(state.achievements.ach_arena_explorer.progress, 3);
    assert.equal(state.achievements.ach_arena_explorer.completed, true);

    // Verify all 4 categories exist in config
    const categories = new Set(ACHIEVEMENT_DEFINITIONS.map((a) => a.category));
    assert.deepEqual(Array.from(categories).sort(), ['Collection', 'Combat', 'Exploration', 'Survival']);
  });

  it('4. Prevents duplicate event counting and does not advance match completion on mid-match restart', () => {
    const t = manilaTimeMs('2026-06-10T18:00:00');
    let state = buildFullMissionsState(t);

    // Duplicate elimination event with identical eventId must only count once
    const elimEvent: GameplayEvent = {
      eventId: 'dup_match:elim:bot_2',
      type: 'tank_elimination',
      matchId: 'dup_match',
      victimId: 'bot_2',
    };
    const first = applyGameplayEvent(state, elimEvent, t);
    assert.equal(first.applied, true);
    state = first.nextState;

    const dup = applyGameplayEvent(state, elimEvent, t);
    assert.equal(dup.applied, false);
    state = dup.nextState;

    assert.equal(state.dailyMissions.find((m) => m.missionId === 'daily_elims_5')!.progress, 1);

    // Restarting a match emits match_started without match_completed: must NOT count toward matches_played
    state = applyGameplayEvent(
      state,
      {
        eventId: 'restarted_early:started',
        type: 'match_started',
        matchId: 'restarted_early',
        tankId: 'assault',
        arenaId: 'training_grounds',
      },
      t
    ).nextState;
    assert.equal(state.dailyMissions.find((m) => m.missionId === 'daily_play_3')!.progress, 0);
    assert.equal(state.weeklyMissions.find((m) => m.missionId === 'weekly_play_15')!.progress, 0);
  });

  it('5. Claims completed missions and achievements once, integrates XP/Scrap/Cosmetics, and prevents duplicate claims', () => {
    const t = manilaTimeMs('2026-06-10T19:00:00');
    let state = buildFullMissionsState(t);
    let prog = createDefaultProgression();

    // Complete daily_win_1 + ach_first_elim + ach_survivor
    state = applyGameplayEvent(
      state,
      { eventId: 'c1:elim:bot_1', type: 'tank_elimination', matchId: 'c1', victimId: 'bot_1' },
      t
    ).nextState;
    state = applyGameplayEvent(
      state,
      {
        eventId: 'c1:completed',
        type: 'match_completed',
        matchId: 'c1',
        tankId: 'assault',
        arenaId: 'training_grounds',
        placement: 1,
        survivalSec: 70,
      },
      t
    ).nextState;
    state = applyGameplayEvent(
      state,
      {
        eventId: 'c1:victory',
        type: 'match_victory',
        matchId: 'c1',
        tankId: 'assault',
        arenaId: 'training_grounds',
      },
      t
    ).nextState;

    // Claiming uncompleted mission daily_play_3 must fail cleanly
    const incompleteClaim = claimMissionOrAchievementReward(prog, state, 'daily', 'daily_play_3', t);
    assert.equal(incompleteClaim.outcome.claimed, false);
    assert.equal(incompleteClaim.outcome.reason, 'not_completed');

    // Claim daily_win_1 (+90 XP, +60 Scrap) -> 90/100 XP at Level 1
    const claimDaily = claimMissionOrAchievementReward(prog, state, 'daily', 'daily_win_1', t);
    assert.equal(claimDaily.outcome.claimed, true);
    assert.equal(claimDaily.outcome.xpAwarded, 90);
    assert.equal(claimDaily.outcome.scrapAwarded, 60);
    prog = claimDaily.nextProgression;
    state = claimDaily.nextMissions;
    assert.equal(prog.xp, 90);
    assert.equal(prog.scrap, 60);

    // Duplicate claim on daily_win_1 must be rejected
    const dupDaily = claimMissionOrAchievementReward(prog, state, 'daily', 'daily_win_1', t);
    assert.equal(dupDaily.outcome.claimed, false);
    assert.equal(dupDaily.outcome.reason, 'already_claimed');
    assert.equal(dupDaily.nextProgression.scrap, 60);

    // Claim ach_survivor (+100 XP) -> 90 + 100 = 190 >= 100 -> Level 2 (+100 Lv2 Milestone Scrap = 160 Scrap!)
    const claimAch = claimMissionOrAchievementReward(prog, state, 'achievement', 'ach_survivor', t);
    assert.equal(claimAch.outcome.claimed, true);
    assert.equal(claimAch.outcome.levelsGained, 1);
    assert.equal(claimAch.nextProgression.level, 2);
    assert.equal(claimAch.nextProgression.xp, 90);
    assert.equal(claimAch.nextProgression.scrap, 160);

    // Verify achievement cosmetic unlock is visual-only
    for (let i = 0; i < 6; i++) {
      const tankId = TANK_LIST[i].id;
      state = applyGameplayEvent(
        state,
        {
          eventId: `enth_${i}:completed`,
          type: 'match_completed',
          matchId: `enth_${i}`,
          tankId,
          arenaId: 'training_grounds',
          placement: 4,
          survivalSec: 40,
        },
        t
      ).nextState;
    }
    const claimEnth = claimMissionOrAchievementReward(
      claimAch.nextProgression,
      state,
      'achievement',
      'ach_tank_enthusiast',
      t
    );
    assert.equal(claimEnth.outcome.claimed, true);
    assert.equal(claimEnth.outcome.cosmeticUnlocked, 'emerald_squad');
    assert.ok(claimEnth.nextProgression.unlockedCosmetics.includes('emerald_squad'));

    // Ensure equipping/previewing achievement cosmetics never modifies tank stats
    for (const tank of TANK_LIST) {
      const statsBefore = JSON.stringify(tank.stats);
      const vis = getEffectiveTankVisual(tank, 'emerald_squad');
      assert.equal(vis.accentColor, '#4ADE80');
      assert.equal(JSON.stringify(TANK_DEFINITIONS[tank.id].stats), statsBefore);
    }
  });

  it('6. Resets Daily Missions at Asia/Manila midnight without resetting Weekly Missions or Achievements', () => {
    // Wednesday June 10, 2026 23:55 Asia/Manila
    const beforeMidnight = manilaTimeMs('2026-06-10T23:55:00');
    // Thursday June 11, 2026 00:05 Asia/Manila (same week, next day)
    const afterMidnight = manilaTimeMs('2026-06-11T00:05:00');

    assert.equal(getDailyPeriodKey(beforeMidnight, MISSION_RESET_CONFIG), '2026-06-10');
    assert.equal(getDailyPeriodKey(afterMidnight, MISSION_RESET_CONFIG), '2026-06-11');
    assert.equal(
      getWeeklyPeriodKey(beforeMidnight, MISSION_RESET_CONFIG),
      getWeeklyPeriodKey(afterMidnight, MISSION_RESET_CONFIG)
    );

    const countdown = getResetCountdowns(beforeMidnight, MISSION_RESET_CONFIG);
    assert.equal(countdown.dailyMsLeft, 5 * 60 * 1000);

    let state = buildFullMissionsState(beforeMidnight);
    state = applyGameplayEvent(
      state,
      { eventId: 'r1:elim:bot_1', type: 'tank_elimination', matchId: 'r1', victimId: 'bot_1' },
      beforeMidnight
    ).nextState;
    state = applyGameplayEvent(
      state,
      {
        eventId: 'r1:completed',
        type: 'match_completed',
        matchId: 'r1',
        tankId: 'assault',
        arenaId: 'training_grounds',
        placement: 2,
        survivalSec: 60,
      },
      beforeMidnight
    ).nextState;

    const checked = ensureMissionPeriodsCurrent(state, afterMidnight);
    assert.equal(checked.dailyReset, true);
    assert.equal(checked.weeklyReset, false);

    // Daily refreshed & progress zeroed
    assert.equal(checked.state.dailyPeriodKey, '2026-06-11');
    assert.equal(checked.state.dailyMissions.every((m) => m.progress === 0 && !m.claimed), true);

    // Weekly progress preserved!
    assert.equal(
      checked.state.weeklyMissions.find((m) => m.missionId === 'weekly_play_15')!.progress,
      1
    );

    // Permanent achievement progress preserved!
    assert.equal(checked.state.achievements.ach_first_elim.completed, true);
  });

  it('7. Resets Weekly Missions on Asia/Manila Monday 00:00 while preserving Achievements', () => {
    // Sunday June 14, 2026 23:50 Asia/Manila
    const sundayNight = manilaTimeMs('2026-06-14T23:50:00');
    // Monday June 15, 2026 00:10 Asia/Manila
    const mondayMorning = manilaTimeMs('2026-06-15T00:10:00');

    assert.equal(getWeeklyPeriodKey(sundayNight, MISSION_RESET_CONFIG), 'W-2026-06-08');
    assert.equal(getWeeklyPeriodKey(mondayMorning, MISSION_RESET_CONFIG), 'W-2026-06-15');

    let state = buildFullMissionsState(sundayNight);
    state = applyGameplayEvent(
      state,
      { eventId: 'w1:elim:bot_1', type: 'tank_elimination', matchId: 'w1', victimId: 'bot_1' },
      sundayNight
    ).nextState;
    state = applyGameplayEvent(
      state,
      {
        eventId: 'w1:completed',
        type: 'match_completed',
        matchId: 'w1',
        tankId: 'assault',
        arenaId: 'wasteland',
        placement: 1,
        survivalSec: 80,
      },
      sundayNight
    ).nextState;

    const checked = ensureMissionPeriodsCurrent(state, mondayMorning);
    assert.equal(checked.dailyReset, true);
    assert.equal(checked.weeklyReset, true);
    assert.equal(checked.state.weeklyPeriodKey, 'W-2026-06-15');
    assert.equal(checked.state.weeklyMissions.every((m) => m.progress === 0 && !m.claimed), true);

    // Achievements remain permanently unlocked!
    assert.equal(checked.state.achievements.ach_first_elim.completed, true);
  });

  it('8. Persists missions & achievements across reopen, safely handles corrupt JSON, and recovers backup', () => {
    const storage = new MemoryStorage();
    const day1 = manilaTimeMs('2026-06-10T15:00:00');
    let state = buildFullMissionsState(day1);

    state = applyGameplayEvent(
      state,
      { eventId: 's1:elim:bot_1', type: 'tank_elimination', matchId: 's1', victimId: 'bot_1' },
      day1
    ).nextState;
    state = applyGameplayEvent(
      state,
      {
        eventId: 's1:completed',
        type: 'match_completed',
        matchId: 's1',
        tankId: 'scout',
        arenaId: 'wasteland',
        placement: 1,
        survivalSec: 90,
      },
      day1
    ).nextState;
    saveMissions(state, storage);

    // Reopen same day -> all progress & unclaimed counts restored
    const reopenedSameDay = loadMissions(storage, day1 + 60_000);
    assert.equal(reopenedSameDay.dailyMissions.find((m) => m.missionId === 'daily_play_3')!.progress, 1);
    assert.equal(reopenedSameDay.weeklyMissions.find((m) => m.missionId === 'weekly_play_15')!.progress, 1);
    assert.equal(reopenedSameDay.achievements.ach_first_elim.completed, true);
    assert.ok(countUnclaimedRewards(reopenedSameDay).achievements >= 1);

    // Reopen next day -> daily resets automatically on load, weekly & achievements remain intact
    const nextDay = manilaTimeMs('2026-06-11T09:00:00');
    const reopenedNextDay = loadMissions(storage, nextDay);
    assert.equal(reopenedNextDay.dailyPeriodKey, '2026-06-11');
    assert.equal(reopenedNextDay.dailyMissions.every((m) => m.progress === 0), true);
    assert.equal(
      reopenedNextDay.weeklyMissions.find((m) => m.missionId === 'weekly_play_15')!.progress,
      1
    );
    assert.equal(reopenedNextDay.achievements.ach_first_elim.completed, true);

    // Corrupt primary JSON with valid backup recovers cleanly from backup
    storage.rawSet(MISSIONS_KEY, '{broken_json!!');
    const recovered = loadMissionsSafe(storage, day1 + 120_000);
    assert.equal(recovered.status, 'recovered_backup');
    assert.equal(recovered.missions.achievements.ach_first_elim.completed, true);
    assert.ok(storage.getItem(MISSIONS_BACKUP_KEY) !== null);

    // Corrupt primary JSON with NO backup never overwrites primary key
    const corruptOnly = new MemoryStorage();
    corruptOnly.rawSet(MISSIONS_KEY, 'corrupt_payload');
    const callsBefore = corruptOnly.setCalls;
    const corruptRes = loadMissionsSafe(corruptOnly, day1);
    assert.equal(corruptRes.status, 'corrupt_fallback');
    assert.equal(corruptOnly.setCalls, callsBefore);
    assert.equal(corruptOnly.getItem(MISSIONS_KEY), 'corrupt_payload');
  });

  it('9. Ensures configurable pools cover required mission variety', () => {
    const dailyTitles = DAILY_MISSION_POOL.map((m) => m.title);
    const weeklyTitles = WEEKLY_MISSION_POOL.map((m) => m.title);
    assert.ok(dailyTitles.length >= 8);
    assert.ok(weeklyTitles.length >= 7);
    assert.equal(ACHIEVEMENT_DEFINITIONS.length, 11);
  });
});
