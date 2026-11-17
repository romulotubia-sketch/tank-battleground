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
  BridgeDiagnosticEntry,
  createPlaygamaBridgeAdapter,
  formatRewardedAdStatusMessage,
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

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

function createFakePlaygamaSdk(overrides: {
  platformId?: string;
  isRewardedSupported?: boolean;
  isInterstitialSupported?: boolean;
  isPlatformStorageAvailable?: boolean;
  throwOnInit?: boolean;
  initDelayMs?: number;
  deferredInit?: boolean;
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
  let shouldThrowOnInit = Boolean(overrides.throwOnInit);
  let resolveDeferredInit: (() => void) | null = null;
  let rejectDeferredInit: ((err: Error) => void) | null = null;

  const sdk: PlaygamaSdkLike = {
    version: '2.4.2-mock',
    isInitialized: false,
    async initialize() {
      initCalls += 1;
      if (shouldThrowOnInit) {
        throw new Error('SDK init failed');
      }
      if (overrides.deferredInit) {
        await new Promise<void>((resolve, reject) => {
          resolveDeferredInit = () => {
            sdk.isInitialized = true;
            resolve();
          };
          rejectDeferredInit = reject;
        });
        return;
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
    setThrowOnInit(val: boolean) {
      shouldThrowOnInit = val;
    },
    resolveInit() {
      resolveDeferredInit?.();
    },
    rejectInit(err: Error = new Error('Deferred init failed')) {
      rejectDeferredInit?.(err);
    },
    setShowRewardedHandler(fn: () => void) {
      showRewardedHandler = fn;
    },
    setShowInterstitialHandler(fn: () => void) {
      showInterstitialHandler = fn;
    },
  };
}

describe('Playgama Bridge SDK Integration', () => {
  it('1. Initializes asynchronously once (deduplicated) and sends GAME_READY only once', async () => {
    const fake = createFakePlaygamaSdk({ initDelayMs: 10 });
    const logs: BridgeDiagnosticEntry[] = [];
    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => fake.sdk,
      onDiagnostic: (entry) => logs.push(entry),
    });

    await Promise.all([adapter.init(), adapter.init(), adapter.init()]);
    await adapter.init();
    assert.equal(fake.getInitCalls(), 1);
    assert.equal(adapter.isInitialized, true);
    assert.equal(adapter.isPlaygamaPlatform, true);
    assert.equal(fake.getMinDelayConfigured(), 60);
    assert.equal(fake.getLoadingProgress(), 100);
    assert.equal(fake.bus.listenerCount(EVENT_NAME.PAUSE_STATE_CHANGED), 1);
    assert.equal(fake.bus.listenerCount(EVENT_NAME.REWARDED_STATE_CHANGED), 1);
    assert.equal(fake.bus.listenerCount(EVENT_NAME.INTERSTITIAL_STATE_CHANGED), 1);

    adapter.notifyGameReady();
    adapter.notifyGameReady();
    assert.deepEqual(fake.sentMessages, [PLATFORM_MESSAGE.GAME_READY]);
    assert.equal(logs.some((l) => l.event === 'sdk_init_started'), true);
    assert.equal(
      logs.some(
        (l) =>
          l.event === 'sdk_init_completed' &&
          l.details?.platformId === 'playgama' &&
          l.details?.isRewardedSupported === true &&
          l.details?.isInterstitialSupported === true
      ),
      true
    );
  });

  it('2. Falls back cleanly to local_offline when SDK is absent or initialization fails and supports safe retryInit()', async () => {
    const noSdkLogs: BridgeDiagnosticEntry[] = [];
    const noSdk = createPlaygamaBridgeAdapter({
      getSdk: () => null,
      onDiagnostic: (entry) => noSdkLogs.push(entry),
    });
    await noSdk.init();
    assert.equal(noSdk.isInitialized, true);
    assert.equal(noSdk.platformId, 'local_offline');
    assert.equal(noSdk.isPlaygamaPlatform, false);
    assert.equal(noSdk.isRewardedAdSupported, false);
    assert.equal(noSdk.isInterstitialAdSupported, false);
    assert.equal(noSdk.supportsPlatformStorage, false);
    assert.equal(noSdkLogs.some((l) => l.event === 'sdk_init_failed'), true);

    const failing = createFakePlaygamaSdk({ throwOnInit: true });
    const failedLogs: BridgeDiagnosticEntry[] = [];
    const failedAdapter = createPlaygamaBridgeAdapter({
      getSdk: () => failing.sdk,
      onDiagnostic: (entry) => failedLogs.push(entry),
    });
    await failedAdapter.init();
    assert.equal(failedAdapter.isInitialized, true);
    assert.equal(failedAdapter.platformId, 'local_offline');
    assert.equal(failedAdapter.isPlaygamaPlatform, false);
    assert.equal(failing.getInitCalls(), 1);

    // Passive init() calls must not spam repeated SDK initialization
    await failedAdapter.init();
    assert.equal(failing.getInitCalls(), 1);

    // Explicit safe retryInit() recovers once the underlying failure clears
    failing.setThrowOnInit(false);
    await failedAdapter.retryInit();
    assert.equal(failing.getInitCalls(), 2);
    assert.equal(failedAdapter.platformId, 'playgama');
    assert.equal(failedAdapter.isPlaygamaPlatform, true);
    assert.equal(failedAdapter.isRewardedAdSupported, true);
    assert.equal(failedAdapter.isInterstitialAdSupported, true);
    failedAdapter.notifyGameReady();
    assert.deepEqual(failing.sentMessages, [PLATFORM_MESSAGE.GAME_READY]);
  });

  it('3. Treats local/mock Playgama environments as local-only and never simulates rewarded ads', async () => {
    const mockSdk = createFakePlaygamaSdk({
      platformId: PLATFORM_ID.MOCK,
      isRewardedSupported: false,
      isInterstitialSupported: false,
      isPlatformStorageAvailable: false,
    });
    const logs: BridgeDiagnosticEntry[] = [];
    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => mockSdk.sdk,
      onDiagnostic: (entry) => logs.push(entry),
    });
    await adapter.init();

    assert.equal(adapter.isPlaygamaPlatform, false);
    assert.equal(adapter.isRewardedAdSupported, false);
    assert.equal(adapter.supportsPlatformStorage, false);

    const outcome = await adapter.showRewardedAd('test_grant_1');
    assert.equal(outcome.status, 'unavailable');
    assert.equal(outcome.granted, false);
    assert.equal(logs.some((l) => l.event === 'ad_unavailable' && l.details?.adType === 'rewarded'), true);
  });

  it('4. Grants rewarded ad ONLY when REWARDED fires before CLOSED, never on skip or failure', async () => {
    const fake = createFakePlaygamaSdk();
    const logs: BridgeDiagnosticEntry[] = [];
    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => fake.sdk,
      onDiagnostic: (entry) => logs.push(entry),
    });
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
    assert.equal(logs.some((l) => l.event === 'ad_request_started' && l.details?.adType === 'rewarded'), true);
    assert.equal(logs.some((l) => l.event === 'ad_completed' && l.details?.granted === true), true);
    assert.equal(logs.some((l) => l.event === 'ad_failed' && l.details?.adType === 'rewarded'), true);
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
      interstitialFailureBackoffMs: 15_000,
      interstitialMatchesInterval: 2,
      onDiagnostic: () => undefined,
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
      interstitialFailureBackoffMs: 15_000,
      interstitialMatchesInterval: 2,
      onDiagnostic: () => undefined,
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

    // Successful interstitial resets match count AND cooldown timer:
    // Even after 120s, 1 match is not enough
    freshAdapter.recordCompletedMatch();
    nowMs += 120_000;
    const oneMatchOnlyRes = await freshAdapter.maybeShowInterstitial('return_to_menu');
    assert.equal(oneMatchOnlyRes.shown, false);
    assert.equal(oneMatchOnlyRes.reason, 'cooldown');

    // Even with 2 matches, only 30s since last shown ad is blocked by 90s cooldown
    const freshCooldownCheck = createPlaygamaBridgeAdapter({
      getSdk: () => fake.sdk,
      now: () => nowMs,
      interstitialCooldownMs: 90_000,
      interstitialFailureBackoffMs: 15_000,
      interstitialMatchesInterval: 2,
      onDiagnostic: () => undefined,
    });
    await freshCooldownCheck.init();
    freshCooldownCheck.recordCompletedMatch();
    freshCooldownCheck.recordCompletedMatch();
    const firstShown = await freshCooldownCheck.maybeShowInterstitial('match_complete');
    assert.equal(firstShown.shown, true);
    freshCooldownCheck.recordCompletedMatch();
    freshCooldownCheck.recordCompletedMatch();
    nowMs += 30_000;
    const tooSoonRes = await freshCooldownCheck.maybeShowInterstitial('return_to_menu');
    assert.equal(tooSoonRes.shown, false);
    assert.equal(tooSoonRes.reason, 'cooldown');

    // After 2 matches and >= 90s cooldown, interstitial is eligible again
    nowMs += 60_000;
    const nextRes = await freshCooldownCheck.maybeShowInterstitial('return_to_menu');
    assert.equal(nextRes.shown, true);
  });

  it('7. Propagates platform pause, audio, and visibility events reactively + gameplay/achievement messages', async () => {
    const fake = createFakePlaygamaSdk();
    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => fake.sdk,
      onDiagnostic: () => undefined,
    });
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
    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => fake.sdk,
      onDiagnostic: () => undefined,
    });
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
    const safeAdapter = createPlaygamaBridgeAdapter({
      getSdk: () => brokenFake.sdk,
      onDiagnostic: () => undefined,
    });
    await safeAdapter.init();
    assert.doesNotThrow(() => {
      safeAdapter.trackEvent('match_started', { tank_id: 'scout' });
    });
  });

  it('9. Mirrors and reads platform storage arrays safely', async () => {
    const fake = createFakePlaygamaSdk({ isPlatformStorageAvailable: true });
    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => fake.sdk,
      onDiagnostic: () => undefined,
    });
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

    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => strictSdk,
      onDiagnostic: () => undefined,
    });

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

  it('11. Supports SDK initialization taking longer than 1,800 ms without timing out under default timeout', async () => {
    const slowFake = createFakePlaygamaSdk({
      platformId: PLATFORM_ID.PLAYGAMA_SANDBOX,
      initDelayMs: 1950,
    });
    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => slowFake.sdk,
      onDiagnostic: () => undefined,
    });

    await adapter.init();
    assert.equal(adapter.isInitialized, true);
    assert.equal(adapter.platformId, 'playgama_sandbox');
    assert.equal(adapter.isPlaygamaPlatform, true);
    assert.equal(adapter.isRewardedAdSupported, true);
    assert.equal(adapter.isInterstitialAdSupported, true);
    assert.equal(slowFake.getInitCalls(), 1);
  });

  it('12. Performs late initialization recovery when SDK resolves after UI fallback timeout', async () => {
    const deferredFake = createFakePlaygamaSdk({
      platformId: PLATFORM_ID.PLAYGAMA_SANDBOX,
      deferredInit: true,
    });
    const logs: BridgeDiagnosticEntry[] = [];
    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => deferredFake.sdk,
      initTimeoutMs: 30,
      onDiagnostic: (entry) => logs.push(entry),
    });

    const observedStates: Array<{ platformId: string; rewarded: boolean; interstitial: boolean }> = [];
    const unsub = adapter.subscribeState((s) => {
      observedStates.push({
        platformId: s.platformId,
        rewarded: s.isRewardedSupported,
        interstitial: s.isInterstitialSupported,
      });
    });

    // Times out at 30ms -> unblocks UI in temporary local_offline mode
    await adapter.init();
    assert.equal(adapter.isInitialized, true);
    assert.equal(adapter.platformId, 'local_offline');
    assert.equal(adapter.isPlaygamaPlatform, false);
    assert.equal(adapter.isRewardedAdSupported, false);
    assert.equal(adapter.isInterstitialAdSupported, false);
    assert.equal(logs.some((l) => l.event === 'sdk_init_timed_out'), true);

    // Calling notifyGameReady() or init() while timed out must NOT send early GAME_READY or call sdk.initialize() again
    adapter.notifyGameReady();
    await adapter.init();
    assert.equal(deferredFake.getInitCalls(), 1);
    assert.deepEqual(deferredFake.sentMessages, []);

    // SDK completes asynchronously later -> late recovery must restore Playgama Sandbox & send GAME_READY once
    deferredFake.resolveInit();
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(adapter.platformId, 'playgama_sandbox');
    assert.equal(adapter.isPlaygamaPlatform, true);
    assert.equal(adapter.isRewardedAdSupported, true);
    assert.equal(adapter.isInterstitialAdSupported, true);
    assert.deepEqual(deferredFake.sentMessages, [PLATFORM_MESSAGE.GAME_READY]);
    assert.equal(deferredFake.bus.listenerCount(EVENT_NAME.PAUSE_STATE_CHANGED), 1);
    assert.equal(deferredFake.bus.listenerCount(EVENT_NAME.REWARDED_STATE_CHANGED), 1);
    assert.equal(logs.some((l) => l.event === 'sdk_late_init_recovery'), true);
    assert.equal(
      observedStates[observedStates.length - 1]?.platformId,
      'playgama_sandbox'
    );

    // Rewarded ad works immediately after late recovery
    deferredFake.setShowRewardedHandler(() => {
      deferredFake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.REWARDED);
      deferredFake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.CLOSED);
    });
    const adOutcome = await adapter.showRewardedAd('late_recovery_grant');
    assert.equal(adOutcome.status, 'rewarded');
    assert.equal(adOutcome.granted, true);
    unsub();
  });

  it('13. Correctly detects playgama_sandbox and qa_tool platforms and exposes ad/storage capabilities', async () => {
    for (const pid of [PLATFORM_ID.PLAYGAMA_SANDBOX, PLATFORM_ID.QA_TOOL]) {
      const fake = createFakePlaygamaSdk({
        platformId: pid,
        isRewardedSupported: true,
        isInterstitialSupported: true,
        isPlatformStorageAvailable: true,
      });
      const adapter = createPlaygamaBridgeAdapter({
        getSdk: () => fake.sdk,
        onDiagnostic: () => undefined,
      });
      await adapter.init();

      assert.equal(adapter.platformId, pid);
      assert.equal(adapter.isPlaygamaPlatform, true);
      assert.equal(adapter.isRewardedAdSupported, true);
      assert.equal(adapter.isInterstitialAdSupported, true);
      assert.equal(adapter.supportsPlatformStorage, true);

      fake.setShowRewardedHandler(() => {
        fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.REWARDED);
        fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.CLOSED);
      });
      const rewardedRes = await adapter.showRewardedAd(`grant_${pid}`);
      assert.equal(rewardedRes.status, 'rewarded');
      assert.equal(rewardedRes.granted, true);

      adapter.recordCompletedMatch();
      adapter.recordCompletedMatch();
      fake.setShowInterstitialHandler(() => {
        fake.bus.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, INTERSTITIAL_STATE.CLOSED);
      });
      const interRes = await adapter.maybeShowInterstitial('match_complete');
      assert.equal(interRes.shown, true);
      assert.equal(interRes.reason, 'completed');
    }
  });

  it('14. Failed interstitials do not reset completedMatchesSinceAd or lastInterstitialAtMs while avoiding rapid retry spam', async () => {
    let nowMs = 500_000;
    const fake = createFakePlaygamaSdk({ platformId: PLATFORM_ID.PLAYGAMA_SANDBOX });
    const logs: BridgeDiagnosticEntry[] = [];
    let interCalls = 0;

    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => fake.sdk,
      now: () => nowMs,
      interstitialCooldownMs: 90_000,
      interstitialFailureBackoffMs: 15_000,
      interstitialMatchesInterval: 2,
      onDiagnostic: (entry) => logs.push(entry),
    });
    await adapter.init();

    // First, establish a real shown interstitial so lastInterstitialAtMs is non-zero
    adapter.recordCompletedMatch();
    adapter.recordCompletedMatch();
    fake.setShowInterstitialHandler(() => {
      interCalls += 1;
      fake.bus.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, INTERSTITIAL_STATE.CLOSED);
    });
    const firstSuccess = await adapter.maybeShowInterstitial('match_complete');
    assert.equal(firstSuccess.shown, true);
    assert.equal(interCalls, 1);

    // Advance past 90s cooldown and complete 2 matches -> eligible again
    nowMs += 95_000;
    adapter.recordCompletedMatch();
    adapter.recordCompletedMatch();

    // SDK returns FAILED (e.g., no-fill)
    fake.setShowInterstitialHandler(() => {
      interCalls += 1;
      fake.bus.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, INTERSTITIAL_STATE.FAILED);
    });
    const failedOutcome = await adapter.maybeShowInterstitial('match_complete');
    assert.equal(failedOutcome.shown, false);
    assert.equal(failedOutcome.reason, 'failed');
    assert.equal(interCalls, 2);

    // Rapid retry 1s later must be blocked by short failure backoff (no SDK spam)
    nowMs += 1_000;
    const rapidRetry = await adapter.maybeShowInterstitial('return_to_menu');
    assert.equal(rapidRetry.shown, false);
    assert.equal(rapidRetry.reason, 'cooldown');
    assert.equal(interCalls, 2);

    // After only 15s failure backoff (well under 90s normal cooldown!) and with NO extra matches,
    // eligibility must still be preserved because the failure did NOT reset match count or lastInterstitialAtMs.
    nowMs += 15_000;
    fake.setShowInterstitialHandler(() => {
      interCalls += 1;
      fake.bus.emit(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, INTERSTITIAL_STATE.CLOSED);
    });
    const recoveredOutcome = await adapter.maybeShowInterstitial('return_to_menu');
    assert.equal(recoveredOutcome.shown, true);
    assert.equal(recoveredOutcome.reason, 'completed');
    assert.equal(interCalls, 3);
    assert.equal(logs.some((l) => l.event === 'ad_failed' && l.details?.adType === 'interstitial'), true);
  });

  it('15. Records full rewarded diagnostics and specific outcomes for uninitialized bridge, unsupported platform, rejected requests, no ad available, and busy SDK states', async () => {
    // A. Bridge not initialized (missing SDK / rejected init / deferred timeout)
    const uninitLogs: BridgeDiagnosticEntry[] = [];
    const rejectingFake = createFakePlaygamaSdk({ platformId: PLATFORM_ID.PLAYGAMA_SANDBOX });
    rejectingFake.sdk.initialize = async () => {
      const err = new Error('Config load failed') as Error & { code?: string };
      err.name = 'BridgeError';
      err.code = 'CONFIG_LOAD_FAILED';
      throw err;
    };
    const uninitAdapter = createPlaygamaBridgeAdapter({
      getSdk: () => rejectingFake.sdk,
      onDiagnostic: (entry) => uninitLogs.push(entry),
    });
    const uninitOutcome = await uninitAdapter.showRewardedAd('grant_uninit');
    assert.equal(uninitOutcome.status, 'unavailable');
    assert.equal(uninitOutcome.granted, false);
    assert.equal(uninitOutcome.reason, 'not_initialized');
    assert.equal(uninitOutcome.errorCode, 'CONFIG_LOAD_FAILED');
    assert.equal(uninitOutcome.errorMessage, 'Config load failed');
    assert.equal(uninitOutcome.rewardCallbackReached, false);
    assert.match(formatRewardedAdStatusMessage(uninitOutcome), /not initialized/i);
    assert.match(formatRewardedAdStatusMessage(uninitOutcome), /CONFIG_LOAD_FAILED/);
    const uninitDiag = uninitLogs.find((l) => l.event === 'ad_unavailable');
    assert.equal(uninitDiag?.details?.bridgeInitialized, false);
    assert.equal(uninitDiag?.details?.isRewardedSupported, false);
    assert.equal(uninitDiag?.details?.hasShowRewarded, false);

    // B. Rewarded ads unsupported on initialized platform
    const unsupportedFake = createFakePlaygamaSdk({
      platformId: PLATFORM_ID.MOCK,
      isRewardedSupported: false,
    });
    const unsupportedLogs: BridgeDiagnosticEntry[] = [];
    const unsupportedAdapter = createPlaygamaBridgeAdapter({
      getSdk: () => unsupportedFake.sdk,
      onDiagnostic: (entry) => unsupportedLogs.push(entry),
    });
    await unsupportedAdapter.init();
    const unsupportedOutcome = await unsupportedAdapter.showRewardedAd('grant_unsupported');
    assert.equal(unsupportedOutcome.status, 'unavailable');
    assert.equal(unsupportedOutcome.granted, false);
    assert.equal(unsupportedOutcome.reason, 'unsupported');
    assert.equal(unsupportedOutcome.platformId, PLATFORM_ID.MOCK);
    assert.equal(unsupportedOutcome.rewardCallbackReached, false);
    assert.match(formatRewardedAdStatusMessage(unsupportedOutcome), /not supported/i);
    const unsupDiag = unsupportedLogs.find((l) => l.event === 'ad_unavailable');
    assert.equal(unsupDiag?.details?.bridgeInitialized, true);
    assert.equal(unsupDiag?.details?.platformId, PLATFORM_ID.MOCK);
    assert.equal(unsupDiag?.details?.isRewardedSupported, false);

    // C. Ad request rejected synchronously (preserves error name, message, and code)
    const rejectedFake = createFakePlaygamaSdk({ platformId: PLATFORM_ID.PLAYGAMA_SANDBOX });
    const rejectedLogs: BridgeDiagnosticEntry[] = [];
    const rejectedAdapter = createPlaygamaBridgeAdapter({
      getSdk: () => rejectedFake.sdk,
      onDiagnostic: (entry) => rejectedLogs.push(entry),
    });
    await rejectedAdapter.init();
    rejectedFake.setShowRewardedHandler(() => {
      const err = new Error('AdvService blocked by adblocker') as Error & { code?: string };
      err.name = 'AdInitError';
      err.code = 'ADV_BLOCKED';
      throw err;
    });
    const syncRejected = await rejectedAdapter.showRewardedAd('grant_sync_reject');
    assert.equal(syncRejected.status, 'failed');
    assert.equal(syncRejected.granted, false);
    assert.equal(syncRejected.reason, 'request_rejected');
    assert.equal(syncRejected.errorName, 'AdInitError');
    assert.equal(syncRejected.errorMessage, 'AdvService blocked by adblocker');
    assert.equal(syncRejected.errorCode, 'ADV_BLOCKED');
    assert.equal(syncRejected.rewardCallbackReached, false);
    assert.equal(rejectedAdapter.isAdPlaying, false);
    assert.match(formatRewardedAdStatusMessage(syncRejected), /ADV_BLOCKED/);
    assert.equal(
      rejectedLogs.some(
        (l) =>
          l.event === 'ad_request_rejected' &&
          l.details?.errorCode === 'ADV_BLOCKED' &&
          l.details?.errorName === 'AdInitError'
      ),
      true
    );

    // D. Ad request rejected asynchronously (returned Promise rejects)
    rejectedFake.sdk.advertisement!.showRewarded = () => {
      const err = new Error('Network fill rejected') as Error & { code?: string };
      err.code = 'E_FILL_REJECTED';
      return Promise.reject(err);
    };
    const asyncRejected = await rejectedAdapter.showRewardedAd('grant_async_reject');
    assert.equal(asyncRejected.status, 'failed');
    assert.equal(asyncRejected.granted, false);
    assert.equal(asyncRejected.reason, 'request_rejected');
    assert.equal(asyncRejected.errorCode, 'E_FILL_REJECTED');
    assert.equal(asyncRejected.errorMessage, 'Network fill rejected');

    // E. No ad available (SDK accepts request -> LOADING -> FAILED before OPENED)
    const noFillFake = createFakePlaygamaSdk({ platformId: PLATFORM_ID.PLAYGAMA_SANDBOX });
    const noFillLogs: BridgeDiagnosticEntry[] = [];
    const noFillAdapter = createPlaygamaBridgeAdapter({
      getSdk: () => noFillFake.sdk,
      onDiagnostic: (entry) => noFillLogs.push(entry),
    });
    await noFillAdapter.init();
    noFillFake.setShowRewardedHandler(() => {
      noFillFake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.LOADING);
      noFillFake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.FAILED, {
        reason: 'empty',
        message: 'No ad inventory available',
      });
    });
    const noAdOutcome = await noFillAdapter.showRewardedAd('grant_no_ad');
    assert.equal(noAdOutcome.status, 'failed');
    assert.equal(noAdOutcome.granted, false);
    assert.equal(noAdOutcome.reason, 'no_ad_available');
    assert.equal(noAdOutcome.adState, REWARDED_STATE.FAILED);
    assert.equal(noAdOutcome.errorCode, 'empty');
    assert.equal(noAdOutcome.rewardCallbackReached, false);
    assert.match(formatRewardedAdStatusMessage(noAdOutcome), /No rewarded ad/i);
    const startLog = noFillLogs.find((l) => l.event === 'ad_request_started');
    assert.equal(startLog?.details?.bridgeInitialized, true);
    assert.equal(startLog?.details?.platformId, PLATFORM_ID.PLAYGAMA_SANDBOX);
    assert.equal(startLog?.details?.isRewardedSupported, true);
    assert.equal(startLog?.details?.hasShowRewarded, true);
    assert.equal(typeof startLog?.details?.startedAtMs, 'number');
    assert.equal(noFillLogs.some((l) => l.event === 'ad_request_accepted'), true);
    const failLog = noFillLogs.find((l) => l.event === 'ad_failed');
    assert.equal(failLog?.details?.stateSequence, 'loading->failed');
    assert.equal(failLog?.details?.rewardCallbackReached, false);

    // F. Busy SDK interstitialState prevents silent SDK drop in @playgama/bridge 2.4.2
    noFillFake.sdk.advertisement!.interstitialState = INTERSTITIAL_STATE.OPENED;
    const busyOutcome = await noFillAdapter.showRewardedAd('grant_busy_interstitial');
    assert.equal(busyOutcome.status, 'failed');
    assert.equal(busyOutcome.granted, false);
    assert.equal(busyOutcome.reason, 'busy');
    assert.equal(busyOutcome.adState, 'interstitial:opened');
  });

  it('16. Prevents duplicate rewarded-ad grants for the same grantId while allowing retries after skip/failure', async () => {
    const fake = createFakePlaygamaSdk({ platformId: PLATFORM_ID.PLAYGAMA_SANDBOX });
    const logs: BridgeDiagnosticEntry[] = [];
    let showCalls = 0;
    const adapter = createPlaygamaBridgeAdapter({
      getSdk: () => fake.sdk,
      onDiagnostic: (entry) => logs.push(entry),
    });
    await adapter.init();

    // First attempt is skipped -> does NOT mark grantId as claimed, so retry is permitted
    fake.setShowRewardedHandler(() => {
      showCalls += 1;
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.LOADING);
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.OPENED);
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.CLOSED);
    });
    const skippedFirst = await adapter.showRewardedAd('match_bonus_99');
    assert.equal(skippedFirst.status, 'skipped');
    assert.equal(skippedFirst.granted, false);
    assert.equal(skippedFirst.rewardCallbackReached, false);
    assert.equal(showCalls, 1);

    // Second attempt completes REWARDED -> CLOSED -> granted === true
    fake.setShowRewardedHandler(() => {
      showCalls += 1;
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.LOADING);
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.OPENED);
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.REWARDED);
      fake.bus.emit(EVENT_NAME.REWARDED_STATE_CHANGED, REWARDED_STATE.CLOSED);
    });
    const completed = await adapter.showRewardedAd('match_bonus_99');
    assert.equal(completed.status, 'rewarded');
    assert.equal(completed.granted, true);
    assert.equal(completed.rewardCallbackReached, true);
    assert.equal(showCalls, 2);

    // Third call with same grantId must be blocked before calling SDK showRewarded again
    const duplicate = await adapter.showRewardedAd('match_bonus_99');
    assert.equal(duplicate.granted, false);
    assert.equal(duplicate.reason, 'duplicate_grant');
    assert.equal(duplicate.rewardCallbackReached, false);
    assert.equal(showCalls, 2);
    assert.equal(logs.some((l) => l.event === 'rewarded_duplicate_grant_blocked'), true);
    assert.match(formatRewardedAdStatusMessage(duplicate), /already been claimed/i);
  });
});
