/**
 * Playgama Bridge Integration Adapter
 *
 * Prepared architectural boundary for future Playgama SDK integration
 * (platform lifecycle, gameplay signaling, cloud storage sync, and future ad hooks).
 * Currently operates strictly offline/locally without advertising calls.
 */

export interface PlatformBridgeAdapter {
  readonly isInitialized: boolean;
  readonly platformId: string;
  init(): Promise<void>;
  notifyGameReady(): void;
  notifyGameplayStart(): void;
  notifyGameplayStop(): void;
  notifyHappyTime(): void;
}

class LocalOfflineBridgeAdapter implements PlatformBridgeAdapter {
  private initialized = false;

  get isInitialized(): boolean {
    return this.initialized;
  }

  get platformId(): string {
    return 'local_offline';
  }

  async init(): Promise<void> {
    this.initialized = true;
  }

  notifyGameReady(): void {
    // Future hook: bridge.platform.sendMessage('game_ready')
  }

  notifyGameplayStart(): void {
    // Future hook: bridge.platform.sendMessage('gameplay_started')
  }

  notifyGameplayStop(): void {
    // Future hook: bridge.platform.sendMessage('gameplay_stopped')
  }

  notifyHappyTime(): void {
    // Future hook: bridge.platform.sendMessage('player_got_achievement')
  }
}

export const platformBridge: PlatformBridgeAdapter = new LocalOfflineBridgeAdapter();
