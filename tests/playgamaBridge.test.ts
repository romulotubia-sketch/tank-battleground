import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EVENT_NAME,
  INTERSTITIAL_STATE,
  PLATFORM_ID,
  PLATFORM_MESSAGE,
  REWARDED_STATE,
  VISIBILITY_STATE,
} from '@playgama/bridge/constants';
import { applyRewardedAdScrap, REWARDED_AD_BONUS_SCRAP } from '../src/data/economy.ts';
import {
  createDefaultProgression,
  grantRewardedAdScrap,
  loadProgression,
  StorageLike,
} from '../src/data/storage.ts';
import {
  createPlaygamaBridgeAdapter,
  PlaygamaSdkLike,
} from '../src/services/bridge/PlaygamaBridgeAdapter.ts';

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
}

class MockEventBus {
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  on(event: string, listener: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach((fn) => fn(...args));
  }
}

function createFakePlaygamaSdk(overrides: {
  platformId?: string;
  isRewardedSupported?: boolean;
  isInterstitialSupported?: boolean;
  isPlatformStorageAvailable?: boolean;
  throwOnInit?: boolean;
  initDelayMs?: number;
  throwOnAnalytics?: boolean;
} = {}) {
  const bus = new MockEventBus();
  const sentMessages: string[] = [];
  const analyticsEvents: Array<{ eventName: string; data?: Record<string, unknown> }> = [];
  const storageMap = new Map<string, unknown>();
  let initCalls = 0;
  let flushCalls = 0;
  let minDelayConfigured: number | null = null;
  let loadingProgress: number | null = null;
  let showRewardedHandler: (() => void) | null = null;
  let showInterstitialHandler: (() => void) | null = null;

  const sdk: PlaygamaSdkLike = {
    version: '2.4.2-mock',
    isInitialized: false,
    async initialize() {
      initCalls += 1;
      if (overrides.throwOnInit) {
        throw new Error('SDK init failed');
      }
      if (overrides.initDelayMs && overrides.initDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, overrides.initDelayMs));
      }
      sdk.isInitialized = true;
    },
    setGameLoadingProgress(percent: number) {
      loadingProgress = percent;
    },
    on: (ev, fn) => bus.on(ev, fn),
    off: (ev, fn) => bus.off(ev, fn),
    platform: {
      id: overrides.platformId ?? 'playgama',
      language: 'en',
      isAudioEnabled: true,
      isPaused: false,
      isPlatformStorageAvailable: overrides.isPlatformStorageAvailable ?? true,
      sendMessage(message: string) {
        sentMessages.push(message);
        return Promise.resolve();
      },
      on: (ev, fn) => bus.on(ev, fn),
      off: (ev, fn) => bus.off(ev, fn),
    },
    advertisement: {
      isRewardedSupported: overrides.isRewardedSupported ?? true,
      isInterstitialSupported: overrides.isInterstitialSupported ?? true,
      setMinimumDelayBetweenInterstitial(seconds: number) {
        minDelayConfigured = seconds;
      },
      showRewarded() {
        showRewardedHandler?.();
      },
      showInterstitial() {
        showInterstitialHandler?.();
      },
      on: (ev, fn) => bus.on(ev, fn),
      off: (ev, fn) => bus.off(ev, fn),
    },
    storage: {
      async get(keys: string | string[]) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        return keyList.map((k) => (storageMap.has(k) ? storageMap.get(k) : null));
      },
      async set(keys: string | string[], values: unknown | unknown[]) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        const valList = Array.isArray(values) ? values : [values];
        keyList.forEach((k, idx) => {
          storageMap.set(k, valList[idx]);
        });
      },
      async flush() {
        flushCalls += 1;
      },
    },
    analytics: {
      send(eventName: string, data?: Record<string, unknown>) {
        if (overrides.throwOnAnalytics) {
          throw new Error('Analytics offline');
        }
        analyticsEvents.push({ eventName, data });
      },
    },
  };

  return {
    sdk,
    bus,
    sentMessages,
    analyticsEvents,
    storageMap,
    getInitCalls: () => initCalls,
    getFlushCalls: () => flushCalls,
    getMinDelayConfigured: () => minDelayConfigured,
    getLoadingProgress: () => loadingProgress,
    setShowRewardedHandler(fn: () => void) {
      showRewardedHandler = fn;
    },
    setShowInterstitialHandler(fn: () => void) {
      showInterstitialHandler = fn;
    },
  };
}

describe('Stage 16: Playgama Bridge SDK Integration', () => {
  it('1. Initializes asynchronously once (deduplicated) and sends GAME_READY only once', async () => {
    const fake = createFakePlaygamaSdk({ initDelayMs: 10 });
    const adapter = createPlaygamaBridgeAdapter({ getSdk: () => fake.sdk });

    await Promise.all([adapter.init(), adapter.init(), adapter.init()]);
    assert.equal(fake.getInitCalls(), 1);
    assert.equal(adapter.isInitialized, true);
    assert.equal(adapter.isPlaygamaPlatform, true);
    assert.equal(fake.getMinDelayConfigured(), 60);
    assert.equal(fake.getLoadingProgress(), 100);

    adapter.notifyGameReady();
    adapter.notifyGameReady();
    assert.deepEqual(fake.sentMessages, [PLATFORM_MESSAGE.GAME_READY]);
  });

  it('2. Falls back cleanly to local_offline when SDK is absent or initialization fails', async () => {
    const noSdk = createPlaygamaBridgeAdapter({ getSdk: () => null });
    await noSdk.init();
    assert.equal(noSdk.isInitialized, true);
    assert.equal(noSdk.platformId, 'local_offline');
    assert.equal(noSdk.isPlaygamaPlatform, false);
    assert.equal(noSdk.isRewardedAdSupported, false);
    assert.equal(noSdk.isInterstitialAdSupported, false);
    assert.equal(noSdk.supportsPlatformStorage, false);

    const failing = createFakePlaygamaSdk({ throwOnInit: true });
    const failedAdapter = createPlaygamaBridgeAdapter({ getSdk: () => failing.sdk });
    await failedAdapter.init();
    assert.equal(failedAdapter.isInitialized, true);
    assert.equal(failedAdapter.platformId, 'local_offline');
    assert.equal(failedAdapter.isPlaygamaPlatform, false);
  });

  it('3. Treats local/mock Playgama environments as local-only and never simulates rewarded ads', async () => {
    const mockSdk = createFakePlaygamaSdk({
      platformId: PLATFORM_ID.MOCK,
      isRewardedSupported: false,
      isInterstitialSupported: false,
      isPlatformStorageAvailable: false,
    });
    const adapter = createPlaygamaBridgeAdapter({ getSdk: () => mockSdk.sdk });
    await adapter.init();

    assert.equal(adapter.isPlaygamaPlatform, false);
    assert.equal(adapter.isRewardedAdSupported, false);
    assert.equal(adapter.supportsPlatformStorage, false);

    const outcome = await adapter.showRewardedAd('test_grant_1');
    assert.equal(outcome.status, 'unavailable');
    assert.equal(outcome.granted, false);
  });

  it('4. Grants rewarded ad ONLY when REWARDED fires before CLOSED, never on skip or failure', async () => {
    const fake = createFakePlaygamaSdk();
    const adapter = createPlaygamaBridgeAdapter({ getSdk: () => fake.sdk });
    await adapter.init();

    // Case A: Skipped/closed without REWARDED -> not granted
    fake.setShowRewardedHandler(() => {
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.OPENED);
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.CLOSED);
    });
    const skipped = await adapter.showRewardedAd('grant_skip');
    assert.equal(skipped.status, 'skipped');
    assert.equal(skipped.granted, false);

    // Case B: Failed -> not granted and clears adPlaying lock
    fake.setShowRewardedHandler(() => {
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.FAILED);
    });
    const failed = await adapter.showRewardedAd('grant_fail');
    assert.equal(failed.status, 'failed');
    assert.equal(failed.granted, false);
    assert.equal(adapter.isAdPlaying, false);

    // Case C: Completed REWARDED then CLOSED -> granted === true
    let adPlayingDuringShow = false;
    fake.setShowRewardedHandler(() => {
      adPlayingDuringShow = adapter.isAdPlaying;
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.OPENED);
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.REWARDED);
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.CLOSED);
    });
    const rewarded = await adapter.showRewardedAd('grant_ok');
    assert.equal(adPlayingDuringShow, true);
    assert.equal(rewarded.status, 'rewarded');
    assert.equal(rewarded.granted, true);
    assert.equal(adapter.isAdPlaying, false);
  });

  it('5. Enforces idempotent rewarded Scrap grants and preserves existing save progress', () => {
    const storage = new MemoryStorage();
    const base = {
      ...createDefaultProgression(),
      scrap: 100,
      totalScrapEarned: 100,
    };

    const first = grantRewardedAdScrap(base, 'results:match_42', REWARDED_AD_BONUS_SCRAP, storage);
    assert.equal(first.granted, true);
    assert.equal(first.amountAwarded, 35);
    assert.equal(first.nextProgression.scrap, 135);
    assert.equal(first.nextProgression.totalScrapEarned, 135);

    // Duplicate claim with same grantId must be rejected cleanly
    const duplicate = applyRewardedAdScrap(first.nextProgression, 'results:match_42', REWARDED_AD_BONUS_SCRAP);
    assert.equal(duplicate.granted, false);
    assert.equal(duplicate.amountAwarded, 0);
    assert.equal(duplicate.nextProgression.scrap, 135);

    // Persists across reload
    const reloaded = loadProgression(storage);
    assert.equal(reloaded.scrap, 135);
    assert.equal(reloaded.processedRewardedAdIds?.includes('results:match_42'), true);
  });

  it('6. Enforces interstitial safety: never in-match, skips initial match, respects match cadence & cooldown', async () => {
    let nowMs = 100_000;
    const fake = createFakePlaygamaSdk();
    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => fake.sdk,
      now: () => nowMs,
      interstitialCooldownMs: 90_000,
      interstitialMatchesInterval: 2,
    });
    await adapter.init();

    fake.setShowInterstitialHandler(() => {
      fake.bus.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, INTERSTITIAL_STATE.OPENED);
      fake.bus.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, INTERSTITIAL_STATE.CLOSED);
    });

    // Never during active gameplay
    adapter.recordCompletedMatch();
    adapter.recordCompletedMatch();
    const inMatchRes = await adapter.maybeShowInterstitial('match_complete', { inActiveMatch: true });
    assert.equal(inMatchRes.shown, false);
    assert.equal(inMatchRes.reason, 'in_match');

    // Fresh adapter: skips very first completed match cleanly
    const freshAdapter = createPlaygamaBridgeAdapter({
      getSdk: () => fake.sdk,
      now: () => nowMs,
      interstitialCooldownMs: 90_000,
      interstitialMatchesInterval: 2,
    });
    await freshAdapter.init();
    freshAdapter.recordCompletedMatch();
    const firstMatchRes = await freshAdapter.maybeShowInterstitial('match_complete');
    assert.equal(firstMatchRes.shown, false);
    assert.equal(firstMatchRes.reason, 'cooldown');

    // Second completed match unlocks first natural post-match interstitial
    freshAdapter.recordCompletedMatch();
    const eligibleRes = await freshAdapter.maybeShowInterstitial('match_complete');
    assert.equal(eligibleRes.shown, true);
    assert.equal(eligibleRes.reason, 'completed');
    assert.equal(freshAdapter.isAdPlaying, false);

    // Immediately afterwards blocked by cooldown & match count
    freshAdapter.recordCompletedMatch();
    nowMs += 30_000;
    const tooSoonRes = await freshAdapter.maybeShowInterstitial('return_to_menu');
    assert.equal(tooSoonRes.shown, false);
    assert.equal(tooSoonRes.reason, 'cooldown');

    // After 2 matches and >= 90s cooldown, interstitial is eligible again
    freshAdapter.recordCompletedMatch();
    nowMs += 90_000;
    const nextRes = await freshAdapter.maybeShowInterstitial('return_to_menu');
    assert.equal(nextRes.shown, true);
  });

  it('7. Propagates platform pause, audio, and visibility events reactively + gameplay/achievement messages', async () => {
    const fake = createFakePlaygamaSdk();
    const adapter = createPlaygamaBridgeAdapter({ getSdk: () => fake.sdk });
    await adapter.init();

    const observedStates: Array<{ paused: boolean; audio: boolean; visible: boolean }> = [];
    const unsub = adapter.subscribeState((s) => {
      observedStates.push({
        paused: s.isPlatformPaused,
        audio: s.isAudioEnabled,
        visible: s.isPageVisible,
      });
    });

    fake.bus.emit(EVENT_NAME.PAUSE_STATE_CHANGED, true);
    fake.bus.emit(EVENT_NAME.AUDIO_STATE_CHANGED, false);
    fake.bus.emit(EVENT_NAME.VISIBILITY_STATE_CHANGED, VISIBILITY_STATE.HIDDEN);
    fake.bus.emit(EVENT_NAME.PAUSE_STATE_CHANGED, false);
    fake.bus.emit(EVENT_NAME.AUDIO_STATE_CHANGED, true);
    fake.bus.emit(EVENT_NAME.VISIBILITY_STATE_CHANGED, VISIBILITY_STATE.VISIBLE);

    const last = observedStates[observedStates.length - 1];
    assert.deepEqual(last, { paused: false, audio: true, visible: true });
    assert.equal(observedStates.some((s) => s.paused && !s.audio && !s.visible), true);
    unsub();

    adapter.notifyGameplayStart();
    adapter.notifyGameplayStart(); // idempotent
    adapter.notifyHappyTime();
    adapter.notifyGameplayStop();
    adapter.notifyGameplayStop(); // idempotent

    assert.deepEqual(fake.sentMessages, [
      PLATFORM_MESSAGE.GAMEPLAY_STARTED,
      PLATFORM_MESSAGE.PLAYER_GOT_ACHIEVEMENT,
      PLATFORM_MESSAGE.GAMEPLAY_STOPPED,
    ]);
  });

  it('8. Sanitizes analytics events against PII and isolates SDK analytics errors', async () => {
    const fake = createFakePlaygamaSdk();
    const adapter = createPlaygamaBridgeAdapter({ getSdk: () => fake.sdk });
    await adapter.init();

    adapter.trackEvent('match_victory', {
      arena_id: 'training_grounds',
      tank_id: 'assault',
      eliminations: 4,
      playerName: 'Commander',
      email: 'secret@example.com',
      userId: 'u_123',
      token: 'tok_abc',
    });

    assert.equal(fake.analyticsEvents.length, 1);
    assert.deepEqual(fake.analyticsEvents[0].data, {
      arena_id: 'training_grounds',
      tank_id: 'assault',
      eliminations: 4,
    });

    const brokenFake = createFakePlaygamaSdk({ throwOnAnalytics: true });
    const safeAdapter = createPlaygamaBridgeAdapter({ getSdk: () => brokenFake.sdk });
    await safeAdapter.init();
    assert.doesNotThrow(() => {
      safeAdapter.trackEvent('match_started', { tank_id: 'scout' });
    });
  });

  it('9. Mirrors and reads platform storage arrays safely', async () => {
    const fake = createFakePlaygamaSdk({ isPlatformStorageAvailable: true });
    const adapter = createPlaygamaBridgeAdapter({ getSdk: () => fake.sdk });
    await adapter.init();

    adapter.syncSaveKey('tankbound_arena_progression_v1', '{"scrap":420}');
    await new Promise((resolve) => setTimeout(resolve, 10));

    const loaded = await adapter.loadSaveKeys(['tankbound_arena_progression_v1', 'missing_key']);
    assert.equal(loaded.tankbound_arena_progression_v1, '{"scrap":420}');
    assert.equal(loaded.missing_key, undefined);
    assert.equal(fake.getFlushCalls() >= 1, true);
  });

  it('10. Never accesses Playgama SDK module getters (platform/storage/advertisement/analytics) before initialize() completes', async () => {
    const preInitAccesses: string[] = [];
    let initialized = false;
    const bus = new MockEventBus();

    const strictSdk: PlaygamaSdkLike = {
      get isInitialized() {
        return initialized;
      },
      async initialize() {
        await new Promise((resolve) => setTimeout(resolve, 10));
        initialized = true;
      },
      get platform() {
        if (!initialized) preInitAccesses.push('platform');
        return {
          id: 'playgama',
          isAudioEnabled: true,
          isPaused: false,
          isPlatformStorageAvailable: false,
          sendMessage: () => Promise.resolve(),
          on: (ev: string, fn: (...args: unknown[]) => void) => bus.on(ev, fn),
          off: (ev: string, fn: (...args: unknown[]) => void) => bus.off(ev, fn),
        };
      },
      get storage() {
        if (!initialized) preInitAccesses.push('storage');
        return {
          get: async () => [],
          set: async () => undefined,
          flush: async () => undefined,
        };
      },
      get advertisement() {
        if (!initialized) preInitAccesses.push('advertisement');
        return {
          isRewardedSupported: false,
          isInterstitialSupported: false,
          setMinimumDelayBetweenInterstitial: () => undefined,
          on: (ev: string, fn: (...args: unknown[]) => void) => bus.on(ev, fn),
          off: (ev: string, fn: (...args: unknown[]) => void) => bus.off(ev, fn),
        };
      },
      get analytics() {
        if (!initialized) preInitAccesses.push('analytics');
        return {
          send: () => undefined,
        };
      },
    };

    const adapter = createPlaygamaBridgeAdapter({ getSdk: () => strictSdk });

    // Simulate pre-init React render & lifecycle calls
    const initialState = adapter.getState();
    assert.equal(initialState.supportsPlatformStorage, false);
    assert.equal(initialState.isRewardedSupported, false);
    assert.equal(initialState.isInterstitialSupported, false);

    const unsub = adapter.subscribeState(() => undefined);
    adapter.syncSaveKey('k', 'v');
    adapter.trackEvent('game_started');
    await adapter.loadSaveKeys(['k']);
    await adapter.flushStorage();

    assert.deepEqual(preInitAccesses, []);

    await adapter.init();
    unsub();
    assert.equal(adapter.isInitialized, true);
    assert.deepEqual(preInitAccesses, []);
  });
});
