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
    showInterstitial?: (placement?: string | null) => unknown;
    preloadRewarded?: (placement?: string | null) => void;
    showRewarded?: (placement?: string | null) => unknown;
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
const INTERSTITIAL_FAILURE_BACKOFF_MS = 15_000;
const INTERSTITIAL_MATCHES_INTERVAL = 2;
const INIT_TIMEOUT_MS = 6000;
const AD_COMPLETION_TIMEOUT_MS = 45_000;

export interface BridgeDiagnosticEntry {
  event: string;
  level: 'info' | 'warn';
  details?: Record<string, string | number | boolean>;
}

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

function sanitizeDiagnosticDetails(
  details?: Record<string, string | number | boolean>
): Record<string, string | number | boolean> | undefined {
  if (!details) return undefined;
  const blockedKeys = new Set([
    'playerName',
    'player_name',
    'name',
    'email',
    'userId',
    'user_id',
    'token',
    'grantId',
  ]);
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, val] of Object.entries(details)) {
    if (blockedKeys.has(key)) continue;
    safe[key] = val;
  }
  return safe;
}

interface ExtractedErrorInfo {
  errorName?: string;
  errorMessage?: string;
  errorCode?: string;
}

function extractSafeErrorInfo(err: unknown): ExtractedErrorInfo {
  if (!err) return {};
  if (typeof err === 'string') {
    const trimmed = err.trim().slice(0, 180);
    return trimmed ? { errorMessage: trimmed } : {};
  }
  if (typeof err === 'object') {
    const record = err as Record<string, unknown>;
    const info: ExtractedErrorInfo = {};
    if (typeof record.name === 'string' && record.name.trim()) {
      info.errorName = record.name.trim().slice(0, 80);
    }
    if (typeof record.message === 'string' && record.message.trim()) {
      info.errorMessage = record.message.trim().slice(0, 180);
    }
    if (typeof record.code === 'string' || typeof record.code === 'number') {
      const code = String(record.code).trim().slice(0, 80);
      if (code) info.errorCode = code;
    }
    if (!info.errorCode && typeof record.reason === 'string' && record.reason.trim()) {
      info.errorCode = record.reason.trim().slice(0, 80);
    }
    if (record.originalError && typeof record.originalError === 'object') {
      const orig = record.originalError as Record<string, unknown>;
      if (!info.errorCode && (typeof orig.code === 'string' || typeof orig.code === 'number')) {
        const code = String(orig.code).trim().slice(0, 80);
        if (code) info.errorCode = code;
      }
      if (!info.errorMessage && typeof orig.message === 'string' && orig.message.trim()) {
        info.errorMessage = orig.message.trim().slice(0, 180);
      }
      if (!info.errorName && typeof orig.name === 'string' && orig.name.trim()) {
        info.errorName = orig.name.trim().slice(0, 80);
      }
    }
    return info;
  }
  return {};
}

export function formatRewardedAdStatusMessage(
  outcome: RewardedAdOutcome,
  bonusScrap = 35
): string {
  if (outcome.granted) {
    return `+${bonusScrap} Bonus Scrap granted!`;
  }
  if (outcome.status === 'skipped' || outcome.reason === 'skipped') {
    return 'Ad closed early before completion — no bonus Scrap granted.';
  }
  if (outcome.reason === 'not_initialized') {
    const detail = outcome.errorCode || outcome.errorMessage;
    return detail
      ? `Playgama SDK is not initialized (${detail}) — rewarded ads are unavailable.`
      : 'Playgama SDK is not initialized yet — rewarded ads are unavailable.';
  }
  if (outcome.reason === 'unsupported' || outcome.reason === 'missing_api') {
    const platformLabel = outcome.platformId ? ` (${outcome.platformId})` : '';
    return `Rewarded ads are not supported on this platform${platformLabel}.`;
  }
  if (outcome.reason === 'no_ad_available') {
    const detail = outcome.errorCode || outcome.errorMessage;
    return detail
      ? `No rewarded ad available right now (${detail}) — please try again shortly.`
      : 'No rewarded ad is available right now — please try again shortly.';
  }
  if (outcome.reason === 'busy') {
    return 'Another ad request is already in progress — please wait a moment.';
  }
  if (outcome.reason === 'duplicate_grant') {
    return 'Bonus Scrap has already been claimed for this reward.';
  }
  if (outcome.reason === 'timeout') {
    return 'Rewarded ad timed out before completing — no bonus Scrap granted.';
  }
  if (outcome.reason === 'request_rejected' || outcome.reason === 'sdk_failed' || outcome.status === 'failed') {
    const detail = outcome.errorCode || outcome.errorMessage || outcome.errorName;
    return detail
      ? `Rewarded ad failed (${detail}) — no bonus Scrap granted.`
      : 'Ad failed to complete — no bonus Scrap granted.';
  }
  if (outcome.status === 'unavailable') {
    return 'Rewarded ads are not available right now.';
  }
  return 'Ad failed to complete — no bonus Scrap granted.';
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
  retryInit(): Promise<void>;
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
  interstitialFailureBackoffMs?: number;
  interstitialMatchesInterval?: number;
  onDiagnostic?: (entry: BridgeDiagnosticEntry) => void;
}

export class PlaygamaCompatibleBridgeAdapter implements PlatformBridgeAdapter {
  private readonly getSdkFn: () => PlaygamaSdkLike | null;
  private readonly nowFn: () => number;
  private readonly initTimeoutMs: number;
  private readonly adTimeoutMs: number;
  private readonly interstitialCooldownMs: number;
  private readonly interstitialFailureBackoffMs: number;
  private readonly interstitialMatchesInterval: number;
  private readonly diagnosticHandler?: (entry: BridgeDiagnosticEntry) => void;

  private initialized = false;
  private initPending = false;
  private initPromise: Promise<void> | null = null;
  private sdkInitPromise: Promise<void> | null = null;
  private sdkInitInFlight = false;
  private sdkInitTimedOut = false;
  private sdkInitFailed = false;
  private sdkReady = false;
  private listenersAttached = false;
  private attachedSdk: PlaygamaSdkLike | null = null;
  private documentVisibilityBound = false;
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
  private lastInterstitialFailureAtMs = 0;
  private rewardedRequestInFlight = false;
  private interstitialRequestInFlight = false;
  private lastInitError: ExtractedErrorInfo | null = null;
  private grantedRewardGrantIds = new Set<string>();

  private stateListeners = new Set<(state: BridgeRuntimeState) => void>();

  private readonly onPauseStateChanged = (paused: unknown) => {
    this.platformPaused = Boolean(paused);
    this.emitState();
  };

  private readonly onAudioStateChanged = (enabled: unknown) => {
    this.audioEnabled = Boolean(enabled);
    this.emitState();
  };

  private readonly onVisibilityStateChanged = (visibility: unknown) => {
    this.pageVisible = visibility !== VISIBILITY_STATE.HIDDEN;
    this.emitState();
  };

  private readonly onRewardedStateDiagnostic = (rawState: unknown) => {
    const state = typeof rawState === 'string' ? rawState : 'unknown';
    this.logDiagnostic(state === REWARDED_STATE.FAILED ? 'warn' : 'info', 'rewarded_state_changed', {
      state,
      platformId: this.detectedPlatformId,
    });
  };

  private readonly onInterstitialStateDiagnostic = (rawState: unknown) => {
    const state = typeof rawState === 'string' ? rawState : 'unknown';
    this.logDiagnostic(
      state === INTERSTITIAL_STATE.FAILED ? 'warn' : 'info',
      'interstitial_state_changed',
      {
        state,
        platformId: this.detectedPlatformId,
      }
    );
  };

  private readonly onDocumentVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    this.pageVisible = document.visibilityState !== 'hidden';
    if (!this.pageVisible) {
      void this.flushStorage();
    }
    this.emitState();
  };

  constructor(options: AdapterOptions = {}) {
    this.getSdkFn = options.getSdk ?? resolveGlobalSdk;
    this.nowFn = options.now ?? (() => Date.now());
    this.initTimeoutMs = options.initTimeoutMs ?? INIT_TIMEOUT_MS;
    this.adTimeoutMs = options.adTimeoutMs ?? AD_COMPLETION_TIMEOUT_MS;
    this.interstitialCooldownMs = options.interstitialCooldownMs ?? INTERSTITIAL_MIN_COOLDOWN_MS;
    this.interstitialFailureBackoffMs =
      options.interstitialFailureBackoffMs ?? INTERSTITIAL_FAILURE_BACKOFF_MS;
    this.interstitialMatchesInterval =
      options.interstitialMatchesInterval ?? INTERSTITIAL_MATCHES_INTERVAL;
    this.diagnosticHandler = options.onDiagnostic;

    if (typeof document !== 'undefined') {
      this.pageVisible = document.visibilityState !== 'hidden';
    }
  }

  private getSdk(): PlaygamaSdkLike | null {
    return this.getSdkFn();
  }

  private logDiagnostic(
    level: 'info' | 'warn',
    event: string,
    details?: Record<string, string | number | boolean>
  ): void {
    const safeDetails = sanitizeDiagnosticDetails(details);
    if (this.diagnosticHandler) {
      try {
        this.diagnosticHandler({ event, level, details: safeDetails });
      } catch {
        // Never allow diagnostic hooks to affect runtime behavior
      }
      return;
    }

    if (typeof console !== 'undefined') {
      const fn = level === 'warn' ? console.warn : console.info;
      if (typeof fn === 'function') {
        if (safeDetails && Object.keys(safeDetails).length > 0) {
          fn(`[PlaygamaBridge] ${event}`, safeDetails);
        } else {
          fn(`[PlaygamaBridge] ${event}`);
        }
      }
    }
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
      isSdkReady: this.sdkReady,
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

  private detachSdkListeners(sdk: PlaygamaSdkLike | null): void {
    if (!sdk) return;
    const platformEmitter = sdk.platform?.on ? sdk.platform : sdk;
    try {
      platformEmitter?.off?.(EVENT_NAME.PAUSE_STATE_CHANGED, this.onPauseStateChanged);
      platformEmitter?.off?.(EVENT_NAME.AUDIO_STATE_CHANGED, this.onAudioStateChanged);
      platformEmitter?.off?.(EVENT_NAME.VISIBILITY_STATE_CHANGED, this.onVisibilityStateChanged);
      sdk.advertisement?.off?.(EVENT_NAME.REWARDED_STATE_CHANGED, this.onRewardedStateDiagnostic);
      sdk.advertisement?.off?.(
        EVENT_NAME.INTERSTITIAL_STATE_CHANGED,
        this.onInterstitialStateDiagnostic
      );
    } catch {
      // Safe fallback when mock/minimal SDK doesn't expose off()
    }
  }

  private attachSdkListeners(sdk: PlaygamaSdkLike): void {
    if (this.listenersAttached && this.attachedSdk === sdk) return;
    if (this.attachedSdk && this.attachedSdk !== sdk) {
      this.detachSdkListeners(this.attachedSdk);
    }

    this.listenersAttached = true;
    this.attachedSdk = sdk;

    const platformEmitter = sdk.platform?.on ? sdk.platform : sdk;

    try {
      platformEmitter?.on?.(EVENT_NAME.PAUSE_STATE_CHANGED, this.onPauseStateChanged);
      platformEmitter?.on?.(EVENT_NAME.AUDIO_STATE_CHANGED, this.onAudioStateChanged);
      platformEmitter?.on?.(EVENT_NAME.VISIBILITY_STATE_CHANGED, this.onVisibilityStateChanged);
    } catch {
      // Safe fallback when mock/minimal SDK doesn't expose EventEmitter
    }

    try {
      sdk.advertisement?.on?.(EVENT_NAME.REWARDED_STATE_CHANGED, this.onRewardedStateDiagnostic);
      sdk.advertisement?.on?.(
        EVENT_NAME.INTERSTITIAL_STATE_CHANGED,
        this.onInterstitialStateDiagnostic
      );
    } catch {
      // Safe fallback when advertisement emitter is unavailable
    }

    if (
      !this.documentVisibilityBound &&
      typeof document !== 'undefined' &&
      typeof document.addEventListener === 'function'
    ) {
      this.documentVisibilityBound = true;
      document.addEventListener('visibilitychange', this.onDocumentVisibilityChange);
    }
  }

  private finalizeSdkReady(sdk: PlaygamaSdkLike, isLateRecovery: boolean): boolean {
    if (sdk.isInitialized === false) {
      return false;
    }

    this.sdkReady = true;
    if (!this.canAccessSdkModules(sdk)) {
      this.sdkReady = false;
      return false;
    }

    this.sdkInitTimedOut = false;
    this.sdkInitFailed = false;
    this.lastInitError = null;
    this.initialized = true;
    this.initPending = false;
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

    if (isLateRecovery) {
      this.logDiagnostic('info', 'sdk_late_init_recovery', {
        platformId: this.detectedPlatformId,
      });
    }

    const rewardedSupported = this.isRewardedAdSupported;
    const interstitialSupported = this.isInterstitialAdSupported;

    this.logDiagnostic('info', 'sdk_init_completed', {
      platformId: this.detectedPlatformId,
      isPlaygamaPlatform: this.isPlaygamaPlatform,
      isRewardedSupported: rewardedSupported,
      isInterstitialSupported: interstitialSupported,
      lateRecovery: isLateRecovery,
    });

    if (isLateRecovery) {
      this.notifyGameReady();
    }

    this.emitState();
    return true;
  }

  private enterOfflineFallback(options: { timedOut: boolean; failed: boolean }): void {
    this.sdkReady = false;
    this.sdkInitTimedOut = options.timedOut;
    this.sdkInitFailed = options.failed;
    this.detectedPlatformId = 'local_offline';
    this.initialized = true;
    this.initPending = false;
    this.emitState();
  }

  private tryRecoverFromReadySdk(): boolean {
    if (this.sdkReady) return true;
    const sdk = this.getSdk();
    if (sdk && sdk.isInitialized === true && this.canAccessSdkModules(sdk)) {
      return this.finalizeSdkReady(sdk, true);
    }
    return false;
  }

  async init(): Promise<void> {
    if (this.sdkReady) return;
    if (this.initPromise) return this.initPromise;
    if (this.initialized) {
      this.tryRecoverFromReadySdk();
      return;
    }

    this.initPending = true;
    this.emitState();
    this.logDiagnostic('info', 'sdk_init_started', {
      timeoutMs: this.initTimeoutMs,
    });

    this.initPromise = (async () => {
      const sdk = this.getSdk();
      if (!sdk) {
        this.lastInitError = {
          errorCode: 'SDK_NOT_FOUND',
          errorMessage: 'window.bridge is not available',
        };
        this.logDiagnostic('warn', 'sdk_init_failed', {
          reason: 'sdk_not_found',
          platformId: 'local_offline',
          ...this.lastInitError,
        });
        this.enterOfflineFallback({ timedOut: false, failed: true });
        return;
      }

      if (typeof sdk.initialize !== 'function' || sdk.isInitialized === true) {
        if (!this.finalizeSdkReady(sdk, false)) {
          this.lastInitError = {
            errorCode: 'SDK_NOT_INITIALIZED',
            errorMessage: 'SDK initialize() is missing or isInitialized remained false',
          };
          this.logDiagnostic('warn', 'sdk_init_failed', {
            reason: 'sdk_not_ready',
            platformId: 'local_offline',
            ...this.lastInitError,
          });
          this.enterOfflineFallback({ timedOut: false, failed: true });
        }
        return;
      }

      if (!this.sdkInitPromise) {
        this.sdkInitInFlight = true;
        this.sdkInitFailed = false;
        this.sdkInitPromise = Promise.resolve(sdk.initialize())
          .then(() => {
            this.sdkInitInFlight = false;
            const wasTimedOut = this.sdkInitTimedOut;
            if (!this.finalizeSdkReady(sdk, wasTimedOut)) {
              this.sdkInitPromise = null;
              this.lastInitError = {
                errorCode: 'SDK_NOT_INITIALIZED',
                errorMessage: 'SDK initialize() resolved while isInitialized remained false',
              };
              this.logDiagnostic('warn', 'sdk_init_failed', {
                reason: 'sdk_isInitialized_false',
                platformId: 'local_offline',
                ...this.lastInitError,
              });
              this.enterOfflineFallback({ timedOut: false, failed: true });
            }
          })
          .catch((err: unknown) => {
            this.sdkInitInFlight = false;
            this.sdkInitPromise = null;
            const errInfo = extractSafeErrorInfo(err);
            this.lastInitError = {
              errorCode: errInfo.errorCode ?? 'INITIALIZATION_FAILED',
              errorName: errInfo.errorName,
              errorMessage: errInfo.errorMessage ?? 'SDK initialize() rejected',
            };
            this.logDiagnostic('warn', 'sdk_init_failed', {
              reason: 'sdk_initialize_rejected',
              platformId: 'local_offline',
              ...this.lastInitError,
            });
            this.enterOfflineFallback({ timedOut: false, failed: true });
          });
      }

      let timerId: ReturnType<typeof setTimeout> | null = null;
      const timeoutResult = await Promise.race([
        this.sdkInitPromise.then(() => 'settled' as const),
        new Promise<'timeout'>((resolve) => {
          timerId = setTimeout(() => resolve('timeout'), this.initTimeoutMs);
        }),
      ]);
      if (timerId !== null) {
        clearTimeout(timerId);
      }

      if (timeoutResult === 'timeout' && !this.sdkReady) {
        this.lastInitError = {
          errorCode: 'INIT_TIMEOUT',
          errorMessage: `SDK initialization exceeded ${this.initTimeoutMs}ms UI wait threshold`,
        };
        this.logDiagnostic('warn', 'sdk_init_timed_out', {
          timeoutMs: this.initTimeoutMs,
          fallbackPlatformId: 'local_offline',
        });
        this.enterOfflineFallback({ timedOut: true, failed: false });
      }
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  async retryInit(): Promise<void> {
    if (this.sdkReady) return;
    if (this.initPromise) return this.initPromise;
    if (this.tryRecoverFromReadySdk()) return;

    if (this.sdkInitInFlight && this.sdkInitPromise) {
      let timerId: ReturnType<typeof setTimeout> | null = null;
      await Promise.race([
        this.sdkInitPromise,
        new Promise<void>((resolve) => {
          timerId = setTimeout(resolve, this.initTimeoutMs);
        }),
      ]);
      if (timerId !== null) {
        clearTimeout(timerId);
      }
      return;
    }

    this.initialized = false;
    this.sdkInitFailed = false;
    this.sdkInitTimedOut = false;
    return this.init();
  }

  notifyGameReady(): void {
    if (this.gameReadySent) return;
    const sdk = this.getSdk();
    if (!this.sdkReady || !this.canAccessSdkModules(sdk)) return;
    this.gameReadySent = true;
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
    const cleanGrantId = typeof grantId === 'string' ? grantId.trim() : '';
    if (cleanGrantId && this.grantedRewardGrantIds.has(cleanGrantId)) {
      this.logDiagnostic('warn', 'rewarded_duplicate_grant_blocked', {
        adType: 'rewarded',
        bridgeInitialized: this.sdkReady,
        platformId: this.detectedPlatformId,
        isRewardedSupported: this.isRewardedAdSupported,
        rewardCallbackReached: false,
      });
      return {
        status: 'failed',
        granted: false,
        grantId,
        reason: 'duplicate_grant',
        platformId: this.detectedPlatformId,
        rewardCallbackReached: false,
      };
    }

    if (!this.initialized) {
      await this.init();
    } else if (!this.sdkReady) {
      this.tryRecoverFromReadySdk();
    }

    const sdk = this.getSdk();
    const canReadModules = this.canAccessSdkModules(sdk);
    const bridgeInitialized = this.sdkReady && canReadModules;
    const platformId = this.detectedPlatformId;

    if (!bridgeInitialized) {
      const initErr = this.lastInitError ?? {
        errorCode: 'SDK_NOT_INITIALIZED',
        errorMessage: sdk ? 'Playgama SDK is not initialized' : 'Playgama SDK object not found',
      };
      this.logDiagnostic('warn', 'ad_unavailable', {
        adType: 'rewarded',
        reason: 'not_initialized',
        bridgeInitialized: false,
        sdkExists: Boolean(sdk),
        sdkIsInitialized: typeof sdk?.isInitialized === 'boolean' ? sdk.isInitialized : false,
        platformId,
        isRewardedSupported: false,
        hasShowRewarded: false,
        rewardCallbackReached: false,
        ...initErr,
      });
      return {
        status: 'unavailable',
        granted: false,
        grantId,
        reason: 'not_initialized',
        platformId,
        rewardCallbackReached: false,
        ...initErr,
      };
    }

    let isRewardedSupported = false;
    let hasShowRewarded = false;
    let currentRewardedState: string | undefined;
    let currentInterstitialState: string | undefined;
    try {
      const adv = sdk.advertisement;
      isRewardedSupported = Boolean(adv?.isRewardedSupported);
      hasShowRewarded = typeof adv?.showRewarded === 'function';
      currentRewardedState = adv?.rewardedState;
      currentInterstitialState = adv?.interstitialState;
    } catch (err: unknown) {
      const errInfo = extractSafeErrorInfo(err);
      this.logDiagnostic('warn', 'ad_unavailable', {
        adType: 'rewarded',
        reason: 'missing_api',
        bridgeInitialized: true,
        platformId,
        isRewardedSupported: false,
        hasShowRewarded: false,
        rewardCallbackReached: false,
        ...errInfo,
      });
      return {
        status: 'unavailable',
        granted: false,
        grantId,
        reason: 'missing_api',
        platformId,
        rewardCallbackReached: false,
        ...errInfo,
      };
    }

    if (!isRewardedSupported) {
      this.logDiagnostic('warn', 'ad_unavailable', {
        adType: 'rewarded',
        reason: 'unsupported',
        bridgeInitialized: true,
        platformId,
        isRewardedSupported: false,
        hasShowRewarded,
        rewardCallbackReached: false,
      });
      return {
        status: 'unavailable',
        granted: false,
        grantId,
        reason: 'unsupported',
        platformId,
        rewardCallbackReached: false,
      };
    }

    if (!hasShowRewarded || !sdk.advertisement?.showRewarded) {
      this.logDiagnostic('warn', 'ad_unavailable', {
        adType: 'rewarded',
        reason: 'missing_api',
        bridgeInitialized: true,
        platformId,
        isRewardedSupported: true,
        hasShowRewarded: false,
        rewardCallbackReached: false,
      });
      return {
        status: 'unavailable',
        granted: false,
        grantId,
        reason: 'missing_api',
        platformId,
        rewardCallbackReached: false,
      };
    }

    // In @playgama/bridge v2.4.2, AdvertisementModule.showRewarded() silently no-ops
    // when either rewardedState is LOADING/OPENED/REWARDED or interstitialState is LOADING/OPENED.
    const sdkRewardedBusy =
      currentRewardedState === REWARDED_STATE.LOADING ||
      currentRewardedState === REWARDED_STATE.OPENED ||
      currentRewardedState === REWARDED_STATE.REWARDED;
    const sdkInterstitialBusy =
      currentInterstitialState === INTERSTITIAL_STATE.LOADING ||
      currentInterstitialState === INTERSTITIAL_STATE.OPENED;

    if (
      this.rewardedRequestInFlight ||
      this.interstitialRequestInFlight ||
      sdkRewardedBusy ||
      sdkInterstitialBusy
    ) {
      const busyState = sdkInterstitialBusy
        ? `interstitial:${currentInterstitialState}`
        : currentRewardedState ?? 'in_flight';
      this.logDiagnostic('warn', 'ad_failed', {
        adType: 'rewarded',
        reason: 'busy',
        bridgeInitialized: true,
        platformId,
        isRewardedSupported: true,
        hasShowRewarded: true,
        adState: busyState,
        rewardCallbackReached: false,
      });
      return {
        status: 'failed',
        granted: false,
        grantId,
        reason: 'busy',
        platformId,
        adState: busyState,
        rewardCallbackReached: false,
      };
    }

    const startedAtMs = this.nowFn();
    this.rewardedRequestInFlight = true;
    this.adPlaying = true;
    this.emitState();
    this.logDiagnostic('info', 'ad_request_started', {
      adType: 'rewarded',
      bridgeInitialized: true,
      platformId,
      isRewardedSupported: true,
      hasShowRewarded: true,
      initialRewardedState: currentRewardedState ?? 'unknown',
      initialInterstitialState: currentInterstitialState ?? 'unknown',
      startedAtMs,
    });
    this.trackEvent('advertisement_requested', { ad_type: 'rewarded' });

    return new Promise<RewardedAdOutcome>((resolve) => {
      let settled = false;
      let sawOpened = false;
      let sawRewarded = false;
      let requestAccepted: boolean | null = null;
      let lastAdState = currentRewardedState ?? '';
      const stateSequence: string[] = [];
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
        if (outcome.granted && cleanGrantId) {
          this.grantedRewardGrantIds.add(cleanGrantId);
        }
        this.rewardedRequestInFlight = false;
        this.adPlaying = false;
        this.emitState();

        const finalAdState = outcome.adState ?? (lastAdState || 'unknown');
        const diagnosticPayload: Record<string, string | number | boolean> = {
          adType: 'rewarded',
          bridgeInitialized: true,
          platformId,
          isRewardedSupported: true,
          hasShowRewarded: true,
          requestAccepted: requestAccepted ?? true,
          status: outcome.status,
          granted: outcome.granted,
          adState: finalAdState,
          stateSequence: stateSequence.join('->') || 'none',
          rewardCallbackReached: outcome.rewardCallbackReached ?? sawRewarded,
          durationMs: Math.max(0, this.nowFn() - startedAtMs),
        };
        if (outcome.reason) diagnosticPayload.reason = outcome.reason;
        if (outcome.errorName) diagnosticPayload.errorName = outcome.errorName;
        if (outcome.errorMessage) diagnosticPayload.errorMessage = outcome.errorMessage;
        if (outcome.errorCode) diagnosticPayload.errorCode = outcome.errorCode;

        if (outcome.status === 'failed') {
          this.logDiagnostic('warn', 'ad_failed', diagnosticPayload);
        } else {
          this.logDiagnostic('info', 'ad_completed', diagnosticPayload);
        }
        this.trackEvent('advertisement_completed', {
          ad_type: 'rewarded',
          status: outcome.status,
          granted: outcome.granted,
          reason: outcome.reason ?? outcome.status,
        });
        resolve({
          ...outcome,
          platformId,
          adState: finalAdState,
          rewardCallbackReached: outcome.rewardCallbackReached ?? sawRewarded,
        });
      };

      const onState = (rawState: unknown, rawDetails?: unknown) => {
        let state = '';
        let eventErrorInfo: ExtractedErrorInfo = {};

        if (typeof rawState === 'string') {
          state = rawState;
        } else if (rawState && typeof rawState === 'object') {
          const obj = rawState as Record<string, unknown>;
          if (typeof obj.state === 'string') state = obj.state;
          eventErrorInfo = extractSafeErrorInfo(obj);
        }
        if (rawDetails !== undefined) {
          const detailsErr = extractSafeErrorInfo(rawDetails);
          eventErrorInfo = { ...eventErrorInfo, ...detailsErr };
        }

        if (state) {
          lastAdState = state;
          stateSequence.push(state);
        }

        const reachedRewardNow = sawRewarded || state === REWARDED_STATE.REWARDED;
        this.logDiagnostic(state === REWARDED_STATE.FAILED ? 'warn' : 'info', 'rewarded_ad_event', {
          adType: 'rewarded',
          platformId,
          state: state || 'unknown',
          rewardCallbackReached: reachedRewardNow,
          ...eventErrorInfo,
        });

        if (state === REWARDED_STATE.LOADING) {
          if (requestAccepted === null) requestAccepted = true;
          return;
        }
        if (state === REWARDED_STATE.OPENED) {
          sawOpened = true;
          if (requestAccepted === null) requestAccepted = true;
          return;
        }
        if (state === REWARDED_STATE.REWARDED) {
          sawRewarded = true;
          if (requestAccepted === null) requestAccepted = true;
          return;
        }
        if (state === REWARDED_STATE.CLOSED) {
          if (requestAccepted === null) requestAccepted = true;
          finish({
            status: sawRewarded ? 'rewarded' : 'skipped',
            granted: sawRewarded,
            grantId,
            reason: sawRewarded ? undefined : 'skipped',
            adState: state,
            rewardCallbackReached: sawRewarded,
          });
          return;
        }
        if (state === REWARDED_STATE.FAILED) {
          const failureReason = !sawOpened ? 'no_ad_available' : 'sdk_failed';
          finish({
            status: 'failed',
            granted: false,
            grantId,
            reason: failureReason,
            adState: state,
            rewardCallbackReached: sawRewarded,
            ...eventErrorInfo,
          });
        }
      };

      try {
        sdk.advertisement?.on?.(EVENT_NAME.REWARDED_STATE_CHANGED, onState);
      } catch (err: unknown) {
        const errInfo = extractSafeErrorInfo(err);
        this.logDiagnostic('warn', 'rewarded_listener_attach_failed', {
          adType: 'rewarded',
          platformId,
          ...errInfo,
        });
      }

      timerId = setTimeout(() => {
        finish({
          status: 'failed',
          granted: false,
          grantId,
          reason: 'timeout',
          adState: lastAdState || 'timeout',
          rewardCallbackReached: sawRewarded,
          errorName: 'TimeoutError',
          errorMessage: `Rewarded ad did not complete within ${this.adTimeoutMs}ms`,
          errorCode: 'AD_TIMEOUT',
        });
      }, this.adTimeoutMs);

      try {
        const maybePromise = sdk.advertisement?.showRewarded?.();
        if (
          maybePromise &&
          typeof maybePromise === 'object' &&
          typeof (maybePromise as Promise<unknown>).then === 'function'
        ) {
          if (requestAccepted === null) requestAccepted = true;
          this.logDiagnostic('info', 'ad_request_accepted', {
            adType: 'rewarded',
            platformId,
            bridgeInitialized: true,
            isRewardedSupported: true,
            hasShowRewarded: true,
            asyncResult: true,
          });
          void Promise.resolve(maybePromise).catch((err: unknown) => {
            const errInfo = extractSafeErrorInfo(err);
            requestAccepted = false;
            this.logDiagnostic('warn', 'ad_request_rejected', {
              adType: 'rewarded',
              platformId,
              bridgeInitialized: true,
              isRewardedSupported: true,
              hasShowRewarded: true,
              rewardCallbackReached: sawRewarded,
              ...errInfo,
            });
            finish({
              status: 'failed',
              granted: false,
              grantId,
              reason: 'request_rejected',
              adState: lastAdState || 'rejected',
              rewardCallbackReached: sawRewarded,
              ...errInfo,
            });
          });
        } else if (!settled) {
          if (requestAccepted === null) requestAccepted = true;
          this.logDiagnostic('info', 'ad_request_accepted', {
            adType: 'rewarded',
            platformId,
            bridgeInitialized: true,
            isRewardedSupported: true,
            hasShowRewarded: true,
            asyncResult: false,
          });
        }
      } catch (err: unknown) {
        const errInfo = extractSafeErrorInfo(err);
        requestAccepted = false;
        this.logDiagnostic('warn', 'ad_request_rejected', {
          adType: 'rewarded',
          platformId,
          bridgeInitialized: true,
          isRewardedSupported: true,
          hasShowRewarded: true,
          rewardCallbackReached: sawRewarded,
          ...errInfo,
        });
        finish({
          status: 'failed',
          granted: false,
          grantId,
          reason: 'request_rejected',
          adState: lastAdState || 'rejected',
          rewardCallbackReached: sawRewarded,
          ...errInfo,
        });
      }
    });
  }

  async maybeShowInterstitial(
    trigger: InterstitialTrigger,
    options: { inActiveMatch?: boolean } = {}
  ): Promise<InterstitialOutcome> {
    if (options.inActiveMatch || this.gameplayActive) {
      this.logDiagnostic('info', 'ad_unavailable', {
        adType: 'interstitial',
        trigger,
        reason: 'in_match',
      });
      return { shown: false, reason: 'in_match' };
    }
    if (this.rewardedRequestInFlight || this.interstitialRequestInFlight) {
      this.logDiagnostic('warn', 'ad_failed', {
        adType: 'interstitial',
        trigger,
        reason: 'busy',
      });
      return { shown: false, reason: 'busy' };
    }
    if (!this.initialized) {
      await this.init();
    } else if (!this.sdkReady) {
      this.tryRecoverFromReadySdk();
    }

    const sdk = this.getSdk();
    if (!this.sdkReady || !sdk?.advertisement?.showInterstitial || !this.isInterstitialAdSupported) {
      this.logDiagnostic('warn', 'ad_unavailable', {
        adType: 'interstitial',
        trigger,
        platformId: this.detectedPlatformId,
        sdkReady: this.sdkReady,
        isInterstitialSupported: this.isInterstitialAdSupported,
      });
      return { shown: false, reason: 'unavailable' };
    }

    const currentInterstitialState = sdk.advertisement.interstitialState;
    if (
      currentInterstitialState === INTERSTITIAL_STATE.LOADING ||
      currentInterstitialState === INTERSTITIAL_STATE.OPENED
    ) {
      this.logDiagnostic('warn', 'ad_failed', {
        adType: 'interstitial',
        trigger,
        reason: 'busy',
      });
      return { shown: false, reason: 'busy' };
    }

    const nowMs = this.nowFn();
    // Skip very first match so new players enter gameplay seamlessly, and enforce cooldown + match spacing
    const enoughMatches =
      this.completedMatchesTotal >= 2 &&
      this.completedMatchesSinceAd >= this.interstitialMatchesInterval;
    const cooldownElapsed =
      this.lastInterstitialAtMs === 0 ||
      nowMs - this.lastInterstitialAtMs >= this.interstitialCooldownMs;
    const failureBackoffElapsed =
      this.lastInterstitialFailureAtMs === 0 ||
      nowMs - this.lastInterstitialFailureAtMs >= this.interstitialFailureBackoffMs;

    if (!enoughMatches || !cooldownElapsed || !failureBackoffElapsed) {
      this.logDiagnostic('info', 'interstitial_cooldown_active', {
        trigger,
        enoughMatches,
        cooldownElapsed,
        failureBackoffElapsed,
        completedMatchesTotal: this.completedMatchesTotal,
        completedMatchesSinceAd: this.completedMatchesSinceAd,
      });
      return { shown: false, reason: 'cooldown' };
    }

    this.interstitialRequestInFlight = true;
    this.adPlaying = true;
    this.emitState();
    this.logDiagnostic('info', 'ad_request_started', {
      adType: 'interstitial',
      trigger,
      platformId: this.detectedPlatformId,
      isInterstitialSupported: this.isInterstitialAdSupported,
    });
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
        if (outcome.shown) {
          this.completedMatchesSinceAd = 0;
          this.lastInterstitialAtMs = this.nowFn();
          this.lastInterstitialFailureAtMs = 0;
          this.logDiagnostic('info', 'ad_completed', {
            adType: 'interstitial',
            trigger,
            platformId: this.detectedPlatformId,
            reason: outcome.reason,
          });
        } else {
          // Preserve match spacing & normal cooldown when interstitial fails or no-fills;
          // only record brief failure backoff to avoid rapid consecutive SDK requests.
          this.lastInterstitialFailureAtMs = this.nowFn();
          this.logDiagnostic('warn', 'ad_failed', {
            adType: 'interstitial',
            trigger,
            platformId: this.detectedPlatformId,
            reason: outcome.reason,
          });
        }
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
