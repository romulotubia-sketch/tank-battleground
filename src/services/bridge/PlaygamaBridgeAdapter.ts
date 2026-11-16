import {
  EVENT_NAME,
  INTERSTITIAL_STATE,
  PLATFORM_ID,
  PLATFORM_MESSAGE,
  REWARDED_STATE,
  VISIBILITY_STATE,
} from '@playgama/bridge/constants';
import {
  BridgeRuntimeState,
  InterstitialOutcome,
  InterstitialTrigger,
  RewardedAdOutcome,
} from '../../types/game';

export interface PlaygamaSdkLike {
  version?: string;
  isInitialized?: boolean;
  initialize?: (options?: Record<string, unknown>) => Promise<void>;
  setGameLoadingProgress?: (percent: number) => void;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
  platform?: {
    id?: string;
    language?: string;
    isAudioEnabled?: boolean;
    isPaused?: boolean;
    isPlatformStorageAvailable?: boolean;
    sendMessage?: (message: string, options?: Record<string, unknown>) => Promise<unknown> | void;
    on?: (event: string, listener: (...args: unknown[]) => void) => void;
    off?: (event: string, listener: (...args: unknown[]) => void) => void;
  };
  advertisement?: {
    isInterstitialSupported?: boolean;
    interstitialState?: string;
    isRewardedSupported?: boolean;
    rewardedState?: string;
    minimumDelayBetweenInterstitial?: number;
    setMinimumDelayBetweenInterstitial?: (seconds: number) => void;
    preloadInterstitial?: (placement?: string | null) => void;
    showInterstitial?: (placement?: string | null) => void;
    preloadRewarded?: (placement?: string | null) => void;
    showRewarded?: (placement?: string | null) => void;
    on?: (event: string, listener: (...args: unknown[]) => void) => void;
    off?: (event: string, listener: (...args: unknown[]) => void) => void;
  };
  storage?: {
    defaultType?: string;
    isSupported?: (storageType?: string) => boolean;
    get?: (keys: string | string[], tryParseJson?: boolean) => Promise<unknown>;
    set?: (keys: string | string[], values: unknown | unknown[]) => Promise<void>;
    delete?: (keys: string | string[]) => Promise<void>;
    flush?: () => Promise<void>;
  };
  analytics?: {
    send?: (eventName: string, data?: Record<string, unknown>) => void;
  };
}

const LOCAL_ONLY_PLATFORM_IDS = new Set<string>([
  'local_offline',
  PLATFORM_ID.MOCK,
  PLATFORM_ID.STANDALONE,
]);

const INTERSTITIAL_MIN_COOLDOWN_MS = 90_000;
const INTERSTITIAL_MATCHES_INTERVAL = 2;
const INIT_TIMEOUT_MS = 1800;
const AD_COMPLETION_TIMEOUT_MS = 45_000;

function resolveGlobalSdk(): PlaygamaSdkLike | null {
  try {
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        bridge?: unknown;
        playgamaBridge?: unknown;
      };
      const candidate = win.bridge ?? win.playgamaBridge;
      if (candidate && typeof candidate === 'object') {
        return candidate as PlaygamaSdkLike;
      }
    }
    if (typeof globalThis !== 'undefined' && 'bridge' in globalThis) {
      const candidate = (globalThis as { bridge?: unknown }).bridge;
      if (candidate && typeof candidate === 'object') {
        return candidate as PlaygamaSdkLike;
      }
    }
  } catch {
    // Restricted global scope
  }
  return null;
}

function sanitizeAnalyticsData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const blockedKeys = new Set([
    'playerName',
    'player_name',
    'name',
    'email',
    'userId',
    'user_id',
    'token',
  ]);
  const safe: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (blockedKeys.has(key)) continue;
    if (
      typeof val === 'string' ||
      typeof val === 'number' ||
      typeof val === 'boolean' ||
      val === null
    ) {
      safe[key] = val;
    }
  }
  return safe;
}

export interface PlatformBridgeAdapter {
  readonly isInitialized: boolean;
  readonly platformId: string;
  readonly isPlaygamaPlatform: boolean;
  readonly supportsPlatformStorage: boolean;
  readonly isRewardedAdSupported: boolean;
  readonly isInterstitialAdSupported: boolean;
  readonly isAdPlaying: boolean;
  readonly isPlatformPaused: boolean;
  readonly isAudioEnabled: boolean;
  getState(): BridgeRuntimeState;
  subscribeState(listener: (state: BridgeRuntimeState) => void): () => void;
  init(): Promise<void>;
  notifyGameReady(): void;
  notifyGameplayStart(): void;
  notifyGameplayStop(): void;
  notifyHappyTime(): void;
  recordCompletedMatch(): void;
  showRewardedAd(grantId?: string): Promise<RewardedAdOutcome>;
  maybeShowInterstitial(
    trigger: InterstitialTrigger,
    options?: { inActiveMatch?: boolean }
  ): Promise<InterstitialOutcome>;
  trackEvent(eventName: string, data?: Record<string, unknown>): void;
  syncSaveKey(key: string, serializedValue: string): void;
  loadSaveKeys(keys: string[]): Promise<Record<string, string>>;
  flushStorage(): Promise<void>;
}

export interface AdapterOptions {
  getSdk?: () => PlaygamaSdkLike | null;
  now?: () => number;
  initTimeoutMs?: number;
  adTimeoutMs?: number;
  interstitialCooldownMs?: number;
  interstitialMatchesInterval?: number;
}

export class PlaygamaCompatibleBridgeAdapter implements PlatformBridgeAdapter {
  private readonly getSdkFn: () => PlaygamaSdkLike | null;
  private readonly nowFn: () => number;
  private readonly initTimeoutMs: number;
  private readonly adTimeoutMs: number;
  private readonly interstitialCooldownMs: number;
  private readonly interstitialMatchesInterval: number;

  private initialized = false;
  private initPending = false;
  private initPromise: Promise<void> | null = null;
  private sdkReady = false;
  private listenersAttached = false;
  private gameReadySent = false;
  private gameplayActive = false;

  private detectedPlatformId = 'local_offline';
  private platformPaused = false;
  private audioEnabled = true;
  private pageVisible = true;
  private adPlaying = false;

  private completedMatchesTotal = 0;
  private completedMatchesSinceAd = 0;
  private lastInterstitialAtMs = 0;
  private rewardedRequestInFlight = false;
  private interstitialRequestInFlight = false;

  private stateListeners = new Set<(state: BridgeRuntimeState) => void>();

  constructor(options: AdapterOptions = {}) {
    this.getSdkFn = options.getSdk ?? resolveGlobalSdk;
    this.nowFn = options.now ?? (() => Date.now());
    this.initTimeoutMs = options.initTimeoutMs ?? INIT_TIMEOUT_MS;
    this.adTimeoutMs = options.adTimeoutMs ?? AD_COMPLETION_TIMEOUT_MS;
    this.interstitialCooldownMs = options.interstitialCooldownMs ?? INTERSTITIAL_MIN_COOLDOWN_MS;
    this.interstitialMatchesInterval =
      options.interstitialMatchesInterval ?? INTERSTITIAL_MATCHES_INTERVAL;

    if (typeof document !== 'undefined') {
      this.pageVisible = document.visibilityState !== 'hidden';
    }
  }

  private getSdk(): PlaygamaSdkLike | null {
    return this.getSdkFn();
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get platformId(): string {
    return this.detectedPlatformId;
  }

  get isPlaygamaPlatform(): boolean {
    return (
      this.sdkReady &&
      this.detectedPlatformId.length > 0 &&
      !LOCAL_ONLY_PLATFORM_IDS.has(this.detectedPlatformId)
    );
  }

  private canAccessSdkModules(sdk: PlaygamaSdkLike | null): sdk is PlaygamaSdkLike {
    if (!sdk) return false;
    // Real Playgama SDK exposes boolean isInitialized and logs SDK_NOT_INITIALIZED if any module getter is read while false.
    if (typeof sdk.isInitialized === 'boolean') {
      return sdk.isInitialized;
    }
    // Plain-object mocks in unit tests without initialize/isInitialized
    return typeof sdk.initialize !== 'function' || this.sdkReady;
  }

  get supportsPlatformStorage(): boolean {
    const sdk = this.getSdk();
    if (!this.canAccessSdkModules(sdk)) return false;
    if (!sdk.storage?.get || !sdk.storage?.set) return false;
    const pid = sdk.platform?.id ?? this.detectedPlatformId;
    if (LOCAL_ONLY_PLATFORM_IDS.has(pid)) return false;

    try {
      if (typeof sdk.storage.isSupported === 'function') {
        return Boolean(sdk.storage.isSupported(sdk.storage.defaultType));
      }
      if (typeof sdk.platform?.isPlatformStorageAvailable === 'boolean') {
        return sdk.platform.isPlatformStorageAvailable;
      }
      return Boolean(pid && !LOCAL_ONLY_PLATFORM_IDS.has(pid));
    } catch {
      return false;
    }
  }

  get isRewardedAdSupported(): boolean {
    if (!this.sdkReady) return false;
    const sdk = this.getSdk();
    if (!this.canAccessSdkModules(sdk)) return false;
    try {
      return Boolean(sdk.advertisement?.isRewardedSupported);
    } catch {
      return false;
    }
  }

  get isInterstitialAdSupported(): boolean {
    if (!this.sdkReady) return false;
    const sdk = this.getSdk();
    if (!this.canAccessSdkModules(sdk)) return false;
    try {
      return Boolean(sdk.advertisement?.isInterstitialSupported);
    } catch {
      return false;
    }
  }

  get isAdPlaying(): boolean {
    return this.adPlaying;
  }

  get isPlatformPaused(): boolean {
    return this.platformPaused;
  }

  get isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  getState(): BridgeRuntimeState {
    return {
      isInitialized: this.initialized,
      isInitPending: this.initPending,
      platformId: this.detectedPlatformId,
      isPlaygamaPlatform: this.isPlaygamaPlatform,
      isPlatformPaused: this.platformPaused,
      isAudioEnabled: this.audioEnabled,
      isPageVisible: this.pageVisible,
      isAdPlaying: this.adPlaying,
      isRewardedSupported: this.isRewardedAdSupported,
      isInterstitialSupported: this.isInterstitialAdSupported,
      supportsPlatformStorage: this.supportsPlatformStorage,
    };
  }

  subscribeState(listener: (state: BridgeRuntimeState) => void): () => void {
    this.stateListeners.add(listener);
    try {
      listener(this.getState());
    } catch {
      // Ignore UI callback error
    }
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private emitState(): void {
    const snap = this.getState();
    this.stateListeners.forEach((listener) => {
      try {
        listener(snap);
      } catch {
        // Never allow subscriber error to disrupt bridge lifecycle
      }
    });
  }

  private attachSdkListeners(sdk: PlaygamaSdkLike): void {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    const platformEmitter = sdk.platform?.on ? sdk.platform : sdk;

    try {
      platformEmitter?.on?.(EVENT_NAME.PAUSE_STATE_CHANGED, (paused: unknown) => {
        this.platformPaused = Boolean(paused);
        this.emitState();
      });
      platformEmitter?.on?.(EVENT_NAME.AUDIO_STATE_CHANGED, (enabled: unknown) => {
        this.audioEnabled = Boolean(enabled);
        this.emitState();
      });
      platformEmitter?.on?.(EVENT_NAME.VISIBILITY_STATE_CHANGED, (visibility: unknown) => {
        this.pageVisible = visibility !== VISIBILITY_STATE.HIDDEN;
        this.emitState();
      });
    } catch {
      // Safe fallback when mock/minimal SDK doesn't expose EventEmitter
    }

    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        this.pageVisible = document.visibilityState !== 'hidden';
        if (!this.pageVisible) {
          void this.flushStorage();
        }
        this.emitState();
      });
    }
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPending = true;
    this.emitState();

    this.initPromise = (async () => {
      const sdk = this.getSdk();
      if (sdk) {
        try {
          if (typeof sdk.initialize === 'function' && !sdk.isInitialized) {
            await Promise.race([
              Promise.resolve(sdk.initialize()),
              new Promise<void>((resolve) => {
                setTimeout(resolve, this.initTimeoutMs);
              }),
            ]);
          }
          this.sdkReady = sdk.isInitialized !== false;
          if (!this.sdkReady || !this.canAccessSdkModules(sdk)) {
            this.sdkReady = false;
            this.detectedPlatformId = 'local_offline';
          } else {
            this.detectedPlatformId = sdk.platform?.id || 'playgama';
            if (typeof sdk.platform?.isAudioEnabled === 'boolean') {
              this.audioEnabled = sdk.platform.isAudioEnabled;
            }
            if (typeof sdk.platform?.isPaused === 'boolean') {
              this.platformPaused = sdk.platform.isPaused;
            }
            try {
              sdk.advertisement?.setMinimumDelayBetweenInterstitial?.(60);
            } catch {
              // Ignore optional delay configuration errors
            }
            try {
              sdk.setGameLoadingProgress?.(100);
            } catch {
              // Ignore optional loading progress error
            }
            this.attachSdkListeners(sdk);
          }
        } catch {
          this.sdkReady = false;
          this.detectedPlatformId = 'local_offline';
        }
      } else {
        this.sdkReady = false;
        this.detectedPlatformId = 'local_offline';
      }

      this.initialized = true;
      this.initPending = false;
      this.emitState();
    })();

    return this.initPromise;
  }

  notifyGameReady(): void {
    if (this.gameReadySent) return;
    this.gameReadySent = true;
    const sdk = this.getSdk();
    if (!this.sdkReady || !this.canAccessSdkModules(sdk)) return;
    try {
      void sdk.platform?.sendMessage?.(PLATFORM_MESSAGE.GAME_READY);
    } catch {
      // Ignore bridge messaging errors
    }
  }

  notifyGameplayStart(): void {
    if (this.gameplayActive) return;
    this.gameplayActive = true;
    const sdk = this.getSdk();
    if (!this.sdkReady || !this.canAccessSdkModules(sdk)) return;
    try {
      void sdk.platform?.sendMessage?.(PLATFORM_MESSAGE.GAMEPLAY_STARTED);
    } catch {
      // Ignore bridge messaging errors
    }
  }

  notifyGameplayStop(): void {
    if (!this.gameplayActive) return;
    this.gameplayActive = false;
    const sdk = this.getSdk();
    if (!this.sdkReady || !this.canAccessSdkModules(sdk)) return;
    try {
      void sdk.platform?.sendMessage?.(PLATFORM_MESSAGE.GAMEPLAY_STOPPED);
    } catch {
      // Ignore bridge messaging errors
    }
  }

  notifyHappyTime(): void {
    const sdk = this.getSdk();
    if (!this.sdkReady || !this.canAccessSdkModules(sdk)) return;
    try {
      void sdk.platform?.sendMessage?.(PLATFORM_MESSAGE.PLAYER_GOT_ACHIEVEMENT);
    } catch {
      // Ignore bridge messaging errors
    }
  }

  recordCompletedMatch(): void {
    this.completedMatchesTotal += 1;
    this.completedMatchesSinceAd += 1;
  }

  async showRewardedAd(grantId?: string): Promise<RewardedAdOutcome> {
    if (!this.initialized) {
      await this.init();
    }

    const sdk = this.getSdk();
    if (!this.sdkReady || !sdk?.advertisement?.showRewarded || !this.isRewardedAdSupported) {
      return { status: 'unavailable', granted: false, grantId };
    }

    if (this.rewardedRequestInFlight || this.interstitialRequestInFlight) {
      return { status: 'failed', granted: false, grantId };
    }

    this.rewardedRequestInFlight = true;
    this.adPlaying = true;
    this.emitState();
    this.trackEvent('advertisement_requested', { ad_type: 'rewarded' });

    return new Promise<RewardedAdOutcome>((resolve) => {
      let settled = false;
      let sawRewarded = false;
      let timerId: ReturnType<typeof setTimeout> | null = null;

      const finish = (outcome: RewardedAdOutcome) => {
        if (settled) return;
        settled = true;
        if (timerId !== null) clearTimeout(timerId);
        try {
          sdk.advertisement?.off?.(EVENT_NAME.REWARDED_STATE_CHANGED, onState);
        } catch {
          // Ignore
        }
        this.rewardedRequestInFlight = false;
        this.adPlaying = false;
        this.emitState();
        this.trackEvent('advertisement_completed', {
          ad_type: 'rewarded',
          status: outcome.status,
          granted: outcome.granted,
        });
        resolve(outcome);
      };

      const onState = (rawState: unknown) => {
        const state = typeof rawState === 'string' ? rawState : '';
        if (state === REWARDED_STATE.REWARDED) {
          sawRewarded = true;
          return;
        }
        if (state === REWARDED_STATE.CLOSED) {
          finish({
            status: sawRewarded ? 'rewarded' : 'skipped',
            granted: sawRewarded,
            grantId,
          });
          return;
        }
        if (state === REWARDED_STATE.FAILED) {
          finish({ status: 'failed', granted: false, grantId });
        }
      };

      try {
        sdk.advertisement?.on?.(EVENT_NAME.REWARDED_STATE_CHANGED, onState);
      } catch {
        // Ignore if event emitter unavailable
      }

      timerId = setTimeout(() => {
        finish({ status: 'failed', granted: false, grantId });
      }, this.adTimeoutMs);

      try {
        sdk.advertisement?.showRewarded?.();
      } catch {
        finish({ status: 'failed', granted: false, grantId });
      }
    });
  }

  async maybeShowInterstitial(
    trigger: InterstitialTrigger,
    options: { inActiveMatch?: boolean } = {}
  ): Promise<InterstitialOutcome> {
    if (options.inActiveMatch) {
      return { shown: false, reason: 'in_match' };
    }
    if (this.rewardedRequestInFlight || this.interstitialRequestInFlight) {
      return { shown: false, reason: 'busy' };
    }
    if (!this.initialized) {
      await this.init();
    }

    const sdk = this.getSdk();
    if (!this.sdkReady || !sdk?.advertisement?.showInterstitial || !this.isInterstitialAdSupported) {
      return { shown: false, reason: 'unavailable' };
    }

    const nowMs = this.nowFn();
    // Skip very first match so new players enter gameplay seamlessly, and enforce cooldown + match spacing
    const enoughMatches =
      this.completedMatchesTotal >= 2 &&
      this.completedMatchesSinceAd >= this.interstitialMatchesInterval;
    const cooldownElapsed =
      this.lastInterstitialAtMs === 0 ||
      nowMs - this.lastInterstitialAtMs >= this.interstitialCooldownMs;

    if (!enoughMatches || !cooldownElapsed) {
      return { shown: false, reason: 'cooldown' };
    }

    this.interstitialRequestInFlight = true;
    this.adPlaying = true;
    this.emitState();
    this.trackEvent('advertisement_requested', { ad_type: 'interstitial', trigger });

    return new Promise<InterstitialOutcome>((resolve) => {
      let settled = false;
      let timerId: ReturnType<typeof setTimeout> | null = null;

      const finish = (outcome: InterstitialOutcome) => {
        if (settled) return;
        settled = true;
        if (timerId !== null) clearTimeout(timerId);
        try {
          sdk.advertisement?.off?.(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState);
        } catch {
          // Ignore
        }
        this.interstitialRequestInFlight = false;
        this.adPlaying = false;
        this.completedMatchesSinceAd = 0;
        this.lastInterstitialAtMs = this.nowFn();
        this.emitState();
        this.trackEvent('advertisement_completed', {
          ad_type: 'interstitial',
          trigger,
          status: outcome.reason,
        });
        resolve(outcome);
      };

      const onState = (rawState: unknown) => {
        const state = typeof rawState === 'string' ? rawState : '';
        if (state === INTERSTITIAL_STATE.CLOSED) {
          finish({ shown: true, reason: 'completed' });
        } else if (state === INTERSTITIAL_STATE.FAILED) {
          finish({ shown: false, reason: 'failed' });
        }
      };

      try {
        sdk.advertisement?.on?.(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, onState);
      } catch {
        // Ignore
      }

      timerId = setTimeout(() => {
        finish({ shown: false, reason: 'failed' });
      }, this.adTimeoutMs);

      try {
        sdk.advertisement?.showInterstitial?.();
      } catch {
        finish({ shown: false, reason: 'failed' });
      }
    });
  }

  trackEvent(eventName: string, data?: Record<string, unknown>): void {
    const sdk = this.getSdk();
    if (!this.sdkReady || !this.canAccessSdkModules(sdk) || !sdk.analytics?.send) return;
    try {
      sdk.analytics.send(eventName, sanitizeAnalyticsData(data));
    } catch {
      // Analytics errors must never disrupt gameplay
    }
  }

  syncSaveKey(key: string, serializedValue: string): void {
    const sdk = this.getSdk();
    if (!this.canAccessSdkModules(sdk) || !sdk.storage?.set || !this.supportsPlatformStorage) return;
    try {
      void Promise.resolve(sdk.storage.set([key], [serializedValue]))
        .then(() => sdk.storage?.flush?.())
        .catch(() => {
          // Best-effort platform cloud mirror
        });
    } catch {
      // Ignore sync bridge errors
    }
  }

  async loadSaveKeys(keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const sdk = this.getSdk();
    if (
      !this.canAccessSdkModules(sdk) ||
      !sdk.storage?.get ||
      !this.supportsPlatformStorage ||
      keys.length === 0
    ) {
      return result;
    }
    try {
      const raw = await sdk.storage.get(keys, false);
      if (Array.isArray(raw)) {
        keys.forEach((key, idx) => {
          const val = raw[idx];
          if (typeof val === 'string' && val.trim().length > 0) {
            result[key] = val;
          } else if (val && typeof val === 'object') {
            result[key] = JSON.stringify(val);
          }
        });
      } else if (raw && typeof raw === 'object') {
        const record = raw as Record<string, unknown>;
        for (const key of keys) {
          const val = record[key];
          if (typeof val === 'string' && val.trim().length > 0) {
            result[key] = val;
          } else if (val && typeof val === 'object') {
            result[key] = JSON.stringify(val);
          }
        }
      }
    } catch {
      // Fall back cleanly to local storage
    }
    return result;
  }

  async flushStorage(): Promise<void> {
    const sdk = this.getSdk();
    if (!this.canAccessSdkModules(sdk) || !sdk.storage?.flush || !this.supportsPlatformStorage) return;
    try {
      await sdk.storage.flush();
    } catch {
      // Ignore best-effort flush failure
    }
  }
}

export function createPlaygamaBridgeAdapter(
  options: AdapterOptions = {}
): PlaygamaCompatibleBridgeAdapter {
  return new PlaygamaCompatibleBridgeAdapter(options);
}

export const platformBridge: PlatformBridgeAdapter = new PlaygamaCompatibleBridgeAdapter();
