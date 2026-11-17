import Phaser from 'phaser';
import {
  ensurePlayerTankTextures,
  ensureProceduralTextures,
} from '../../assets/ProceduralTextureGenerator';
import { MINE_SYSTEM_CONFIG, POWERUP_DEFINITIONS } from '../../data/powerups';
import { calculateMatchScrapBreakdown } from '../../data/progression';
import { TANK_DEFINITIONS, TANK_LIST } from '../../data/tanks';
import { platformBridge } from '../../services/bridge/PlaygamaBridgeAdapter';
import {
  AIPersonality,
  ArenaDefinition,
  HUDStateSnapshot,
  MatchResult,
  TankId,
} from '../../types/game';
import { activateTankAbility, deployTankMine, fireTankWeapon } from '../abilities/AbilitySystem';
import { AIController } from '../ai/AIController';
import { ARENA_DEFINITIONS, ARENA_HEIGHT, ARENA_WIDTH } from '../arenas/arenaLayouts';
import { ObstacleEntity } from '../entities/ObstacleEntity';
import { TankEntity } from '../entities/TankEntity';
import { gameBridge, MatchLaunchConfig } from '../GameBridge';
import { PowerupManager } from '../powerups/PowerupManager';
import { ProjectilePool } from '../projectiles/ProjectilePool';
import { EffectsPool } from '../systems/EffectsPool';
import { soundFX } from '../systems/SoundFX';
import { triggerHaptic } from '../../utils/haptics';

const BOT_CALLSIGNS = [
  'Viper',
  'Anvil',
  'Kestrel',
  'Brimstone',
  'Cobalt',
  'Riptide',
  'Nomad',
  'Bastion',
  'Switchblade',
  'Goliath',
];

const BOT_PERSONALITIES: AIPersonality[] = [
  'aggressive',
  'tactical',
  'mobile',
  'defensive',
  'opportunistic',
  'aggressive',
  'tactical',
];

export class ArenaScene extends Phaser.Scene {
  private launchConfig!: MatchLaunchConfig;
  private arena!: ArenaDefinition;

  private tanks: TankEntity[] = [];
  private playerTank!: TankEntity;
  private aiMap = new Map<string, AIController>();
  private obstacles: ObstacleEntity[] = [];

  private effects!: EffectsPool;
  private projectiles!: ProjectilePool;
  private powerups!: PowerupManager;

  private matchTimeLeft = 150;
  private elapsedMatchSec = 0;
  private matchEnded = false;
  private matchId = '';
  private paused = false;
  private hudPushTimer = 0;
  private killFeedText: string | null = null;
  private killFeedTimer = 0;
  private recentPickupName: string | null = null;
  private recentPickupColor: string | null = null;
  private recentPickupTimer = 0;
  private pendingDefeatTimer: number | null = null;
  private manualAimHoldTimer = 0;
  private playerEliminatedAtSec: number | null = null;
  private prepRemainingSec = 3.0;
  private lastPrepStep = 3;
  private goBannerTimer = 0;
  private emptyFeedbackTimer = 0;
  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private lastAimDistance = 420;
  private sceneActive = true;
  private eventSeq = 0;
  private matchStartEmitted = false;

  private keys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    UP: Phaser.Input.Keyboard.Key;
    DOWN: Phaser.Input.Keyboard.Key;
    LEFT: Phaser.Input.Keyboard.Key;
    RIGHT: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    F: Phaser.Input.Keyboard.Key;
    Q: Phaser.Input.Keyboard.Key;
    R: Phaser.Input.Keyboard.Key;
    SHIFT: Phaser.Input.Keyboard.Key;
    P: Phaser.Input.Keyboard.Key;
    ESC: Phaser.Input.Keyboard.Key;
  };

  private unsubCommand?: () => void;
  private unsubSettings?: () => void;
  private unsubPlatform?: () => void;
  private pausedByUser = false;
  private pausedByPlatform = false;
  private handleWindowBlur = () => {
    gameBridge.resetInput();
    soundFX.updateMovementAudio(0, false);
  };
  private handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      gameBridge.resetInput();
      soundFX.updateMovementAudio(0, false);
    }
  };

  constructor() {
    super({ key: 'ArenaScene' });
  }

  init(data?: MatchLaunchConfig): void {
    const safeData: MatchLaunchConfig = data ?? gameBridge.getLaunchConfig() ?? {
      tankId: 'assault',
      arenaId: 'training_grounds',
      settings: {
        soundEnabled: true,
        soundVolume: 0.65,
        musicEnabled: true,
        musicVolume: 0.4,
        graphicsQuality: 'high',
        screenShakeEnabled: true,
        vibrationEnabled: true,
        controlSensitivity: 1.0,
        showTouchControls: 'always',
        autoFireOnAim: true,
        lowDetailMode: false,
        matchDurationSec: 150,
        landscapePromptEnabled: true,
      },
    };
    this.launchConfig = safeData;
    this.sceneActive = true;
    this.arena = ARENA_DEFINITIONS[safeData.arenaId] || ARENA_DEFINITIONS.training_grounds;
    this.matchTimeLeft = safeData.settings?.matchDurationSec || 150;
    this.elapsedMatchSec = 0;
    this.matchEnded = false;
    this.matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.paused = false;
    this.pausedByUser = false;
    this.pausedByPlatform = false;
    this.hudPushTimer = 0;
    this.killFeedText = null;
    this.killFeedTimer = 0;
    this.recentPickupName = null;
    this.recentPickupColor = null;
    this.recentPickupTimer = 0;
    this.pendingDefeatTimer = null;
    this.manualAimHoldTimer = 0;
    this.playerEliminatedAtSec = null;
    this.prepRemainingSec = 3.0;
    this.lastPrepStep = 3;
    this.goBannerTimer = 0;
    this.emptyFeedbackTimer = 0;
    this.mouseScreenX = 0;
    this.mouseScreenY = 0;
    this.lastAimDistance = 420;
    this.eventSeq = 0;
    this.matchStartEmitted = false;
    this.tanks = [];
    this.obstacles = [];
    this.aiMap.clear();
  }

  create(): void {
    const playerCosmetic = this.launchConfig.cosmeticId ?? 'default';
    ensureProceduralTextures(this, playerCosmetic);
    const playerTex = ensurePlayerTankTextures(
      this,
      this.launchConfig.tankId,
      playerCosmetic,
      this.launchConfig.customization ?? null
    );
    soundFX.configure(
      this.launchConfig.settings.soundEnabled,
      this.launchConfig.settings.soundVolume,
      this.launchConfig.settings.musicEnabled ?? true,
      this.launchConfig.settings.musicVolume ?? 0.4
    );
    soundFX.setMusicMode('battle');

    this.drawArenaGround();

    const quality =
      this.launchConfig.settings.graphicsQuality ??
      (this.launchConfig.settings.lowDetailMode ? 'low' : 'high');
    this.effects = new EffectsPool(this, quality);
    this.projectiles = new ProjectilePool(this, 120);
    this.powerups = new PowerupManager(this);

    // Spawn obstacles
    this.arena.obstacles.forEach((obs, idx) => {
      this.obstacles.push(new ObstacleEntity(this, idx + 1, obs));
    });

    // Spawn 1 Player + 7 AI opponents distributed across the expanded arena
    const allSpawns = [...this.arena.spawns];
    const cornerIndices = [0, 2, 4, 6].filter((idx) => idx < allSpawns.length);
    const chosenCornerIdx =
      cornerIndices.length > 0
        ? cornerIndices[Math.floor(Math.random() * cornerIndices.length)]
        : 0;
    const pSpawn = allSpawns.splice(chosenCornerIdx, 1)[0];
    const shuffledBotSpawns = Phaser.Utils.Array.Shuffle(allSpawns);
    const shuffledNames = Phaser.Utils.Array.Shuffle([...BOT_CALLSIGNS]);

    const playerDef = TANK_DEFINITIONS[this.launchConfig.tankId] || TANK_DEFINITIONS.assault;
    this.playerTank = new TankEntity(
      this,
      'player',
      'YOU',
      true,
      playerDef,
      pSpawn.x,
      pSpawn.y,
      pSpawn.angle,
      'tactical',
      playerCosmetic,
      playerTex
    );
    this.tanks.push(this.playerTank);

    // Bot roster: all six implemented tank classes represented across the 7 AI opponents
    const botClasses: TankId[] = ['assault', 'scout', 'fortress', 'artillery', 'tesla', 'phantom', 'assault'];
    const shuffledPersonalities = Phaser.Utils.Array.Shuffle([...BOT_PERSONALITIES]);
    for (let i = 1; i < 8; i++) {
      const sp = shuffledBotSpawns[i - 1];
      const botTankId = botClasses[i - 1] ?? TANK_LIST[i % TANK_LIST.length].id;
      const botDef = TANK_DEFINITIONS[botTankId];
      const botId = `bot_${i}`;
      const botTank = new TankEntity(
        this,
        botId,
        shuffledNames[i - 1],
        false,
        botDef,
        sp.x,
        sp.y,
        sp.angle,
        shuffledPersonalities[i - 1] ?? 'tactical'
      );
      botTank.abilityCooldownTimer = 5.5 + Math.random() * 4.0;
      // Hide all enemy tanks immediately during the 3-second preparation phase
      botTank.hideAllVisuals();
      this.tanks.push(botTank);
      this.aiMap.set(botId, new AIController());
    }

    // Configure camera bounds & smooth player tracking for the expanded arena
    this.cameras.main.setBounds(0, 0, this.arena.width, this.arena.height);
    this.cameras.main.startFollow(this.playerTank.hullSprite, true, 0.14, 0.14);
    this.cameras.main.centerOn(this.playerTank.x, this.playerTank.y);

    this.setupInputs();
    this.unsubCommand = gameBridge.onCommand((cmd) => {
      if (!this.sceneActive) return;
      if (cmd === 'PAUSE') this.setPaused(true, 'user');
      else if (cmd === 'RESUME') this.setPaused(false, 'user');
      else if (cmd === 'RESTART') {
        gameBridge.resetInput();
        const nextConfig = gameBridge.getLaunchConfig() ?? this.launchConfig;
        this.scene.restart(nextConfig);
      }
    });

    this.unsubPlatform = platformBridge.subscribeState((state) => {
      if (!this.sceneActive || this.matchEnded) return;
      const shouldLock = state.isPlatformPaused || state.isAdPlaying || !state.isPageVisible;
      this.setPaused(shouldLock, 'platform');
    });

    this.unsubSettings = gameBridge.onSettingsChange((nextSettings) => {
      if (!this.sceneActive) return;
      this.launchConfig = { ...this.launchConfig, settings: nextSettings };
      soundFX.configure(
        nextSettings.soundEnabled,
        nextSettings.soundVolume,
        nextSettings.musicEnabled,
        nextSettings.musicVolume
      );
      const nextQuality =
        nextSettings.graphicsQuality ?? (nextSettings.lowDetailMode ? 'low' : 'high');
      this.effects.setGraphicsQuality(nextQuality);
    });

    window.addEventListener('blur', this.handleWindowBlur);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    const cleanupBridgeListeners = () => {
      this.sceneActive = false;
      soundFX.stopAllLoops();
      platformBridge.notifyGameplayStop();
      if (this.unsubCommand) {
        this.unsubCommand();
        this.unsubCommand = undefined;
      }
      if (this.unsubPlatform) {
        this.unsubPlatform();
        this.unsubPlatform = undefined;
      }
      if (this.unsubSettings) {
        this.unsubSettings();
        this.unsubSettings = undefined;
      }
      window.removeEventListener('blur', this.handleWindowBlur);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      }
      this.powerups?.clear();
      this.projectiles?.clearAll();
      this.input?.removeAllListeners();
      this.input?.keyboard?.removeAllKeys(true);
      this.time.paused = false;
      this.tweens.resumeAll();
      gameBridge.resetInput();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupBridgeListeners);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanupBridgeListeners);

    if (!this.paused) {
      platformBridge.notifyGameplayStart();
    }
    platformBridge.trackEvent('match_started', {
      tank_id: this.launchConfig.tankId,
      arena_id: this.arena.id,
    });
    soundFX.playCountdown(false);
    this.emitHudSnapshot();
  }

  private drawArenaGround(): void {
    const w = this.arena.width;
    const h = this.arena.height;
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(this.arena.groundColor).color, 1);
    g.fillRect(0, 0, w, h);

    // Subtle hand-drawn grid lines
    g.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(this.arena.groundGridColor).color, 0.5);
    const step = 80;
    for (let x = step; x < w; x += step) {
      g.lineBetween(x, 0, x, h);
    }
    for (let y = step; y < h; y += step) {
      g.lineBetween(0, y, w, y);
    }

    // Distinct visual-only environmental terrain decoration (never affects movement or hitboxes)
    if (this.arena.id === 'training_grounds') {
      // Military proving yard lane pads & central range ring
      g.fillStyle(0xb8a782, 0.45);
      g.fillRect(740, 340, 600, 520);
      g.lineStyle(3, 0x8f7f5f, 0.65);
      g.strokeRect(740, 340, 600, 520);
      g.lineStyle(2.5, 0x8f7f5f, 0.7);
      g.strokeCircle(w / 2, h / 2, 135);
      g.lineStyle(1.5, 0xe08e26, 0.42);
      g.strokeCircle(w / 2, h / 2, 95);
    } else if (this.arena.id === 'industrial_zone') {
      // Warehouse floor slabs & hazard lane bays
      g.fillStyle(0x7c8387, 0.42);
      g.fillRect(290, 250, 390, 700);
      g.fillRect(1400, 250, 390, 700);
      g.lineStyle(3, 0xeab308, 0.35);
      g.strokeRect(290, 250, 390, 700);
      g.strokeRect(1400, 250, 390, 700);
      // Central refinery platform ring
      g.fillStyle(0x757c80, 0.5);
      g.fillCircle(w / 2, h / 2, 150);
      g.lineStyle(3, 0x4b5563, 0.75);
      g.strokeCircle(w / 2, h / 2, 150);
      g.lineStyle(2, 0x38bdf8, 0.32);
      g.strokeCircle(w / 2, h / 2, 118);
    } else if (this.arena.id === 'wasteland') {
      // Uneven-looking desert patches, dry lakebed cracks, and scorched dune ridges (purely visual)
      const sandPatches: Array<[number, number, number, number, number]> = [
        [360, 240, 140, 0xb88b5d, 0.48],
        [1710, 960, 155, 0xb88b5d, 0.48],
        [1040, 600, 195, 0xb28355, 0.42],
        [560, 600, 115, 0x9b7249, 0.45],
        [1520, 600, 115, 0x9b7249, 0.45],
        [1420, 240, 120, 0xd1a97c, 0.38],
        [660, 950, 130, 0xd1a97c, 0.38],
      ];
      for (const [px, py, pr, col, alpha] of sandPatches) {
        g.fillStyle(col, alpha);
        g.fillCircle(px, py, pr);
      }
      // Dry canyon earth fissures & wind-carved dune streaks
      g.lineStyle(2, 0x7c5836, 0.42);
      const cracks: Array<[number, number, number, number, number, number]> = [
        [240, 340, 310, 385, 395, 368],
        [1680, 260, 1755, 315, 1840, 290],
        [890, 410, 945, 455, 1005, 438],
        [1120, 740, 1185, 795, 1245, 775],
        [290, 860, 365, 915, 430, 895],
        [1640, 850, 1715, 815, 1790, 845],
      ];
      for (const [x1, y1, x2, y2, x3, y3] of cracks) {
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.lineTo(x3, y3);
        g.strokePath();
      }
      // Scattered small desert pebbles (cosmetic flecks)
      g.fillStyle(0x6e4e30, 0.38);
      for (let i = 0; i < 36; i++) {
        const px = 90 + ((i * 293) % (w - 180));
        const py = 90 + ((i * 197) % (h - 180));
        g.fillCircle(px, py, 3 + (i % 3));
      }
    }

    // Arena steel/ink border wall
    g.lineStyle(18, Phaser.Display.Color.HexStringToColor(this.arena.borderColor).color, 1);
    g.strokeRect(4, 4, w - 8, h - 8);
    g.lineStyle(3, 0x161815, 1);
    g.strokeRect(12, 12, w - 24, h - 24);
  }

  private setupInputs(): void {
    if (this.input.keyboard) {
      const keys = this.input.keyboard.addKeys({
        W: Phaser.Input.Keyboard.KeyCodes.W,
        A: Phaser.Input.Keyboard.KeyCodes.A,
        S: Phaser.Input.Keyboard.KeyCodes.S,
        D: Phaser.Input.Keyboard.KeyCodes.D,
        UP: Phaser.Input.Keyboard.KeyCodes.UP,
        DOWN: Phaser.Input.Keyboard.KeyCodes.DOWN,
        LEFT: Phaser.Input.Keyboard.KeyCodes.LEFT,
        RIGHT: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
        E: Phaser.Input.Keyboard.KeyCodes.E,
        F: Phaser.Input.Keyboard.KeyCodes.F,
        Q: Phaser.Input.Keyboard.KeyCodes.Q,
        R: Phaser.Input.Keyboard.KeyCodes.R,
        SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
        P: Phaser.Input.Keyboard.KeyCodes.P,
        ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
      }) as NonNullable<ArenaScene['keys']>;
      this.keys = keys;

      keys.P.on('down', () => this.setPaused(!this.pausedByUser, 'user'));
      keys.ESC.on('down', () => this.setPaused(!this.pausedByUser, 'user'));
      keys.E.on('down', () => {
        if (!this.paused && !this.matchEnded && this.prepRemainingSec <= 0) {
          gameBridge.input.abilityPressed = true;
        }
      });
      keys.SHIFT.on('down', () => {
        if (!this.paused && !this.matchEnded && this.prepRemainingSec <= 0) {
          gameBridge.input.abilityPressed = true;
        }
      });
      keys.R.on('down', () => {
        if (!this.paused && !this.matchEnded && this.prepRemainingSec <= 0) {
          gameBridge.input.reloadPressed = true;
        }
      });
      keys.F.on('down', () => {
        if (!this.paused && !this.matchEnded && this.prepRemainingSec <= 0) {
          gameBridge.input.deployMinePressed = true;
        }
      });
      keys.Q.on('down', () => {
        if (!this.paused && !this.matchEnded && this.prepRemainingSec <= 0) {
          gameBridge.input.deployMinePressed = true;
        }
      });
    }

    // Desktop mouse aiming & firing directly on canvas
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) return;
      this.mouseScreenX = pointer.x;
      this.mouseScreenY = pointer.y;
      if (this.prepRemainingSec > 0) return;
      gameBridge.input.mouseWorldX = pointer.worldX;
      gameBridge.input.mouseWorldY = pointer.worldY;
      gameBridge.input.mouseAimActive = true;
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) return;
      this.mouseScreenX = pointer.x;
      this.mouseScreenY = pointer.y;
      if (this.prepRemainingSec > 0) return;
      gameBridge.input.mouseWorldX = pointer.worldX;
      gameBridge.input.mouseWorldY = pointer.worldY;
      gameBridge.input.mouseAimActive = true;
      gameBridge.input.firePressed = true;
      gameBridge.input.firing = true;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) return;
      gameBridge.input.firing = false;
    });

    this.input.on('pointerupoutside', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch) return;
      gameBridge.input.firing = false;
    });
  }

  private setPaused(value: boolean, source: 'user' | 'platform' = 'user'): void {
    if (this.matchEnded) return;
    if (source === 'user') {
      this.pausedByUser = value;
    } else {
      this.pausedByPlatform = value;
    }
    const nextPaused = this.pausedByUser || this.pausedByPlatform;
    if (this.paused === nextPaused) return;
    this.paused = nextPaused;
    this.time.paused = nextPaused;
    if (nextPaused) {
      this.tweens.pauseAll();
      gameBridge.resetInput();
      soundFX.updateMovementAudio(0, false);
      platformBridge.notifyGameplayStop();
    } else {
      this.tweens.resumeAll();
      platformBridge.notifyGameplayStart();
    }
    this.emitHudSnapshot();
  }

  update(_time: number, deltaMs: number): void {
    if (!this.sceneActive || this.paused || this.matchEnded) return;

    const dt = Math.min(deltaMs / 1000, 0.05);

    // Three-second preparation phase (3, 2, 1, GO!): player visible, enemies hidden, all tanks stationary, combat & match timer paused
    if (this.prepRemainingSec > 0) {
      this.prepRemainingSec = Math.max(0, this.prepRemainingSec - dt);
      if (this.prepRemainingSec <= 0.001) this.prepRemainingSec = 0;
      gameBridge.input.firing = false;
      gameBridge.input.firePressed = false;
      gameBridge.input.abilityPressed = false;
      gameBridge.input.reloadPressed = false;
      gameBridge.input.deployMinePressed = false;

      // Keep enemy tanks hidden and player stationary at spawn
      for (const tank of this.tanks) {
        tank.updateTimersAndVisuals(0, false, true);
      }

      if (this.prepRemainingSec > 0) {
        const currentStep = Math.ceil(this.prepRemainingSec);
        if (currentStep !== this.lastPrepStep) {
          this.lastPrepStep = currentStep;
          soundFX.playCountdown(false);
          this.emitHudSnapshot();
        }
        return;
      }

      // Countdown reached GO! Reveal all enemy tanks and enable gameplay simultaneously
      this.lastPrepStep = 0;
      this.goBannerTimer = 0.75;
      for (const tank of this.tanks) {
        if (tank.alive) {
          tank.updateTimersAndVisuals(0, false, false);
        }
      }
      soundFX.playCountdown(true);
      this.effects.spawnRing(this.playerTank.x, this.playerTank.y, 58, 0xe08e26, 0.35);
      if (!this.matchStartEmitted) {
        this.matchStartEmitted = true;
        gameBridge.emitGameplayEvent({
          eventId: `${this.matchId}:started`,
          type: 'match_started',
          matchId: this.matchId,
          tankId: this.playerTank.definition.id,
          arenaId: this.arena.id,
        });
      }
      this.emitHudSnapshot();
    }

    if (this.goBannerTimer > 0) {
      this.goBannerTimer = Math.max(0, this.goBannerTimer - dt);
      if (this.goBannerTimer === 0) {
        this.emitHudSnapshot();
      }
    }

    if (this.pendingDefeatTimer === null) {
      this.elapsedMatchSec += dt;
      this.matchTimeLeft = Math.max(0, this.matchTimeLeft - dt);
    }

    if (this.killFeedTimer > 0) {
      this.killFeedTimer -= dt;
      if (this.killFeedTimer <= 0) this.killFeedText = null;
    }

    if (this.recentPickupTimer > 0) {
      this.recentPickupTimer -= dt;
      if (this.recentPickupTimer <= 0) {
        this.recentPickupName = null;
        this.recentPickupColor = null;
      }
    }

    if (this.pendingDefeatTimer !== null) {
      this.pendingDefeatTimer -= dt;
      if (this.pendingDefeatTimer <= 0) {
        this.finishMatch('eliminated');
        return;
      }
    }

    // 1. Player controls & movement audio
    this.updatePlayerTank(dt);
    const playerSpd = Math.hypot(this.playerTank.vx, this.playerTank.vy);
    const playerMaxSpd = Math.max(1, this.playerTank.getEffectiveMoveSpeed());
    soundFX.updateMovementAudio(playerSpd / playerMaxSpd, this.playerTank.alive);

    // 2. AI opponents
    for (const tank of this.tanks) {
      if (tank.isPlayer || !tank.alive) continue;
      const ai = this.aiMap.get(tank.id);
      if (!ai) continue;

      const decision = ai.update(
        dt,
        tank,
        this.tanks,
        this.obstacles,
        this.powerups.getActivePowerups(),
        this.projectiles,
        this.arena.width,
        this.arena.height
      );

      tank.updateMovement(
        dt,
        decision.moveX,
        decision.moveY,
        this.obstacles,
        this.arena.width,
        this.arena.height,
        this.effects
      );
      tank.aimTurretToward(decision.aimAngle, dt);
      if (decision.shouldFire) {
        fireTankWeapon(tank, this.projectiles, this.effects);
      }
      if (decision.shouldUseAbility) {
        activateTankAbility(
          tank,
          this.tanks,
          this.projectiles,
          this.effects,
          this.handleTankEliminated,
          {
            targetX: decision.abilityTargetX,
            targetY: decision.abilityTargetY,
            arenaWidth: this.arena.width,
            arenaHeight: this.arena.height,
          }
        );
      }
      if (decision.shouldDeployMine) {
        deployTankMine(
          tank,
          this.tanks,
          this.obstacles,
          this.projectiles,
          this.effects,
          this.arena.width,
          this.arena.height
        );
      }
    }

    // 3. Tank-vs-Tank separation so tanks never overlap
    this.resolveTankPairCollisions();

    // 4. Update projectiles & mines
    this.projectiles.update(
      dt,
      this.tanks,
      this.obstacles,
      this.arena.width,
      this.arena.height,
      this.effects,
      this.handleBarrelExplosion,
      this.handleTankEliminated,
      this.handleObstacleDestroyed
    );

    // 4b. Ambient water shimmer / bush sway & priming explosive barrel fuses
    const isLowQuality =
      this.launchConfig.settings.graphicsQuality === 'low' ||
      this.launchConfig.settings.lowDetailMode;
    for (const obs of this.obstacles) {
      if (!obs.alive) continue;
      obs.updateHitFlash(dt);
      if (!isLowQuality && (obs.type === 'water' || obs.type === 'bush')) {
        obs.updateAmbient(this.elapsedMatchSec);
      }
      if (!obs.isPriming) continue;
      const blast = obs.updateFuse(dt, this.effects);
      if (blast) {
        this.handleObstacleDestroyed(obs, blast.attackerId);
        this.handleBarrelExplosion(blast.x, blast.y, blast.attackerId);
      }
    }

    // 5. Update powerups
    this.powerups.update(
      dt,
      this.arena.width,
      this.arena.height,
      this.tanks,
      this.obstacles,
      this.arena.spawns,
      this.effects,
      (collector, id, result) => {
        if (collector.isPlayer && result.applied) {
          const def = POWERUP_DEFINITIONS[id];
          this.recentPickupName =
            id === 'repair_kit' && result.healedAmount > 0
              ? `${def.name} (+${result.healedAmount} HP)`
              : id === 'mine_kit'
              ? `${def.name} (+${result.minesAdded})`
              : def.name;
          this.recentPickupColor = def.color;
          this.recentPickupTimer = 2.2;
          gameBridge.emitGameplayEvent({
            eventId: `${this.matchId}:pwr:${++this.eventSeq}`,
            type: 'powerup_collected',
            matchId: this.matchId,
            powerupId: id,
          });
          this.emitHudSnapshot();
        }
      }
    );

    // 6. Update tank timers & visual state
    const playerRadar =
      this.prepRemainingSec <= 0 && this.playerTank.alive && this.playerTank.hasBuff('radar');
    const playerRadarRadius = playerRadar ? this.playerTank.effectsManager.getRadarRadius() : 0;
    for (const tank of this.tanks) {
      tank.updateTimersAndVisuals(
        dt,
        playerRadar,
        false,
        this.effects,
        this.playerTank.x,
        this.playerTank.y,
        playerRadarRadius
      );
    }

    // 7. Update pooled effects
    this.effects.update(dt);

    // 8. Check win/timer end conditions
    let aliveCount = 0;
    for (const t of this.tanks) {
      if (t.alive) aliveCount += 1;
    }
    if (this.playerTank.alive && aliveCount === 1) {
      this.finishMatch('last_standing');
      return;
    }

    if (this.matchTimeLeft <= 0) {
      this.finishMatch(this.playerTank.alive ? 'time_highest_hp' : 'eliminated');
      return;
    }

    // 9. Throttled HUD updates (~10Hz)
    this.hudPushTimer -= dt;
    if (this.hudPushTimer <= 0) {
      this.hudPushTimer = 0.1;
      this.emitHudSnapshot();
    }
  }

  private updatePlayerTank(dt: number): void {
    if (!this.playerTank.alive) return;

    const inp = gameBridge.input;
    let mx = inp.moveX;
    let my = inp.moveY;

    if (this.keys) {
      let kx = 0;
      let ky = 0;
      if (this.keys.A.isDown || this.keys.LEFT.isDown) kx -= 1;
      if (this.keys.D.isDown || this.keys.RIGHT.isDown) kx += 1;
      if (this.keys.W.isDown || this.keys.UP.isDown) ky -= 1;
      if (this.keys.S.isDown || this.keys.DOWN.isDown) ky += 1;
      if (kx !== 0 || ky !== 0) {
        const km = Math.hypot(kx, ky);
        mx = kx / km;
        my = ky / km;
      }
    }

    this.playerTank.updateMovement(
      dt,
      mx,
      my,
      this.obstacles,
      this.arena.width,
      this.arena.height,
      this.effects
    );

    this.manualAimHoldTimer = Math.max(0, this.manualAimHoldTimer - dt);

    const spaceDown = Boolean(this.keys?.SPACE.isDown);
    const spaceJustDown = Boolean(this.keys && Phaser.Input.Keyboard.JustDown(this.keys.SPACE));
    const hasFireInput = inp.firing || inp.firePressed || spaceDown || spaceJustDown;

    // Independent turret aiming (holds manual aim briefly so touch players can move thumb from Aim stick to Fire)
    const sensitivity = this.launchConfig.settings.controlSensitivity ?? 1.0;
    let shouldAutoFire = false;
    const maxRange = this.playerTank.getEffectiveProjectileRange();
    if (inp.aimActive && Math.hypot(inp.aimX, inp.aimY) > 0.15) {
      inp.mouseAimActive = false;
      const aimMag = Math.min(1, Math.hypot(inp.aimX, inp.aimY));
      const aimAngle = Math.atan2(inp.aimY, inp.aimX);
      this.playerTank.aimTurretToward(aimAngle, dt, sensitivity);
      this.lastAimDistance = Phaser.Math.Linear(140, maxRange * 0.92, (aimMag - 0.15) / 0.85);
      this.manualAimHoldTimer = 2.5;
      if (this.launchConfig.settings.autoFireOnAim && aimMag > 0.72) {
        shouldAutoFire = true;
      }
    } else if (inp.mouseAimActive) {
      const worldPt = this.cameras.main.getWorldPoint(this.mouseScreenX, this.mouseScreenY);
      const dx = worldPt.x - this.playerTank.x;
      const dy = worldPt.y - this.playerTank.y;
      const aimAngle = Math.atan2(dy, dx);
      this.playerTank.aimTurretToward(aimAngle, dt, sensitivity);
      this.lastAimDistance = Phaser.Math.Clamp(Math.hypot(dx, dy), 95, maxRange);
      this.manualAimHoldTimer = 2.5;
    } else if (hasFireInput) {
      this.manualAimHoldTimer = Math.max(this.manualAimHoldTimer, 1.5);
    } else if (this.manualAimHoldTimer <= 0 && Math.hypot(mx, my) > 0.2) {
      // Smoothly align turret forward only after manual aim/fire pause
      this.playerTank.aimTurretToward(Math.atan2(my, mx), dt * 0.55, sensitivity);
    }

    // Update Artillery Shell Barrage aiming reticle when ready
    const useMouseForBarrage = !inp.aimActive && inp.mouseAimActive;
    const barrageTarget = this.computeArtilleryTargetPoint(useMouseForBarrage);
    const showReticle =
      this.playerTank.definition.id === 'artillery' &&
      this.prepRemainingSec <= 0 &&
      this.playerTank.abilityCooldownTimer <= 0 &&
      this.playerTank.abilityActiveTimer <= 0;
    this.playerTank.updateBarrageReticle(showReticle, barrageTarget.x, barrageTarget.y);

    this.emptyFeedbackTimer = Math.max(0, this.emptyFeedbackTimer - dt);

    if (inp.reloadPressed) {
      inp.reloadPressed = false;
      if (this.playerTank.startReload()) {
        soundFX.playReloadStart();
        this.effects.spawnFloatingLabel(this.playerTank.x, this.playerTank.y, 'RELOADING', '#FACC15');
        this.emitHudSnapshot();
      }
    }

    if (hasFireInput || shouldAutoFire) {
      const fireStatus = fireTankWeapon(this.playerTank, this.projectiles, this.effects);
      if (fireStatus === 'fired') {
        triggerHaptic(this.launchConfig.settings.vibrationEnabled, 12);
      } else if (
        (fireStatus === 'empty' || fireStatus === 'reloading') &&
        (inp.firePressed || spaceJustDown || this.emptyFeedbackTimer <= 0)
      ) {
        this.emptyFeedbackTimer = 0.55;
        soundFX.playEmptyClick();
        if (fireStatus === 'reloading') {
          this.effects.spawnFloatingLabel(this.playerTank.x, this.playerTank.y, 'RELOADING...', '#FACC15');
        } else {
          this.effects.spawnFloatingLabel(this.playerTank.x, this.playerTank.y, 'EMPTY!', '#EF4444');
        }
      }
    }
    inp.firePressed = false;

    if (inp.abilityPressed) {
      inp.abilityPressed = false;
      if (
        activateTankAbility(
          this.playerTank,
          this.tanks,
          this.projectiles,
          this.effects,
          this.handleTankEliminated,
          {
            targetX: barrageTarget.x,
            targetY: barrageTarget.y,
            arenaWidth: this.arena.width,
            arenaHeight: this.arena.height,
          }
        )
      ) {
        triggerHaptic(this.launchConfig.settings.vibrationEnabled, 22);
        gameBridge.emitGameplayEvent({
          eventId: `${this.matchId}:ability:${++this.eventSeq}`,
          type: 'ability_activated',
          matchId: this.matchId,
          tankId: this.playerTank.definition.id,
        });
        this.emitHudSnapshot();
      }
    }

    if (inp.deployMinePressed) {
      inp.deployMinePressed = false;
      if (
        deployTankMine(
          this.playerTank,
          this.tanks,
          this.obstacles,
          this.projectiles,
          this.effects,
          this.arena.width,
          this.arena.height
        )
      ) {
        this.emitHudSnapshot();
      }
    }
  }

  private computeArtilleryTargetPoint(useMouseWorld: boolean): { x: number; y: number } {
    const maxRange = this.playerTank.getEffectiveProjectileRange();
    let rawX: number;
    let rawY: number;

    if (useMouseWorld) {
      const worldPt = this.cameras.main.getWorldPoint(this.mouseScreenX, this.mouseScreenY);
      const dx = worldPt.x - this.playerTank.x;
      const dy = worldPt.y - this.playerTank.y;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Phaser.Math.Clamp(dist, 95, maxRange);
      const ang = dist > 0.01 ? Math.atan2(dy, dx) : this.playerTank.turretAngle;
      rawX = this.playerTank.x + Math.cos(ang) * clampedDist;
      rawY = this.playerTank.y + Math.sin(ang) * clampedDist;
    } else {
      const clampedDist = Phaser.Math.Clamp(this.lastAimDistance, 110, maxRange);
      rawX = this.playerTank.x + Math.cos(this.playerTank.turretAngle) * clampedDist;
      rawY = this.playerTank.y + Math.sin(this.playerTank.turretAngle) * clampedDist;
    }

    return {
      x: Phaser.Math.Clamp(rawX, 32, this.arena.width - 32),
      y: Phaser.Math.Clamp(rawY, 32, this.arena.height - 32),
    };
  }

  private resolveTankPairCollisions(): void {
    for (let i = 0; i < this.tanks.length; i++) {
      const a = this.tanks[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.tanks.length; j++) {
        const b = this.tanks[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.radius + b.radius;
        const dist = Math.hypot(dx, dy);
        if (dist < minDist && dist > 0.001) {
          const push = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
      a.resolveBoundsAndObstacles(this.obstacles, this.arena.width, this.arena.height);
    }
  }

  private handleBarrelExplosion = (bx: number, by: number, attackerId: string): void => {
    if (!this.sceneActive || this.matchEnded) return;
    const blastRadius = 125;
    this.effects.spawnDestruction(bx, by, 0xf97316, blastRadius);
    soundFX.playExplosion();
    const allowShake =
      (this.launchConfig.settings.screenShakeEnabled ?? true) &&
      this.launchConfig.settings.graphicsQuality !== 'low' &&
      !this.launchConfig.settings.lowDetailMode;
    if (allowShake) {
      this.cameras.main.shake(120, 0.006);
    }

    const attacker = this.tanks.find((t) => t.id === attackerId);

    for (const tank of this.tanks) {
      if (!tank.alive) continue;
      const dist = Math.hypot(tank.x - bx, tank.y - by);
      if (dist <= blastRadius + tank.radius) {
        const falloff = 1 - Math.min(0.6, dist / (blastRadius + tank.radius));
        const dmg = Math.round(52 * falloff);
        const res = tank.takeDamage(dmg, 'explosion');
        if (attacker && tank.id !== attacker.id) attacker.damageDealt += res.actualDamage;
        if ((tank.isPlayer || attacker?.isPlayer) && res.actualDamage > 0) {
          this.effects.spawnDamageNumber(tank.x, tank.y, res.actualDamage, 'explosion');
          if (tank.isPlayer) {
            triggerHaptic(this.launchConfig.settings.vibrationEnabled, 30);
          }
        }
        if (res.killed) this.handleTankEliminated(tank, attackerId);
      }
    }

    // Chain-react adjacent destructibles & prime nearby barrels with visible warning
    for (const obs of this.obstacles) {
      if (!obs.alive || !obs.destructible) continue;
      if (Math.hypot(obs.x - bx, obs.y - by) <= blastRadius) {
        const destroyed = obs.damage(45, this, attackerId);
        if (destroyed) {
          this.handleObstacleDestroyed(obs, attackerId);
          if (obs.type === 'barrel') {
            this.time.delayedCall(90, () => this.handleBarrelExplosion(obs.x, obs.y, attackerId));
          }
        }
      }
    }
  };

  private handleObstacleDestroyed = (obs: ObstacleEntity, attackerId: string): void => {
    if (attackerId !== 'player') return;
    gameBridge.emitGameplayEvent({
      eventId: `${this.matchId}:obs:${obs.id}`,
      type: 'obstacle_destroyed',
      matchId: this.matchId,
      obstacleId: obs.id,
      obstacleType: obs.type,
    });
  };

  private handleTankEliminated = (victim: TankEntity, attackerId: string): void => {
    const remainingAfter = this.tanks.filter((t) => t.alive).length;
    victim.eliminatedAtRank = remainingAfter + 1;

    const attacker = this.tanks.find((t) => t.id === attackerId);
    if (attacker && attacker.id !== victim.id) {
      attacker.eliminations += 1;
      this.killFeedText = `${attacker.displayName} eliminated ${victim.displayName}`;
      if (attacker.isPlayer && !victim.isPlayer) {
        gameBridge.emitGameplayEvent({
          eventId: `${this.matchId}:elim:${victim.id}`,
          type: 'tank_elimination',
          matchId: this.matchId,
          victimId: victim.id,
        });
      }
    } else {
      this.killFeedText = `${victim.displayName} destroyed`;
    }
    this.killFeedTimer = 3.0;

    const playerInvolved = victim.isPlayer || Boolean(attacker?.isPlayer);
    this.effects.spawnDestruction(victim.x, victim.y, 0xef4444, 72);
    soundFX.playElimination(playerInvolved);
    const allowShake =
      (this.launchConfig.settings.screenShakeEnabled ?? true) &&
      this.launchConfig.settings.graphicsQuality !== 'low' &&
      !this.launchConfig.settings.lowDetailMode;
    if (playerInvolved && allowShake) {
      this.cameras.main.shake(105, 0.0045);
    }
    if (playerInvolved) {
      triggerHaptic(this.launchConfig.settings.vibrationEnabled, victim.isPlayer ? [45, 35, 60] : 28);
    }

    if (victim.isPlayer && this.pendingDefeatTimer === null && !this.matchEnded) {
      soundFX.updateMovementAudio(0, false);
      this.playerEliminatedAtSec = this.elapsedMatchSec;
      this.pendingDefeatTimer = 0.85;
    }
    this.emitHudSnapshot();
  };

  private finishMatch(trigger: 'last_standing' | 'time_highest_hp' | 'eliminated'): void {
    if (this.matchEnded) return;
    this.matchEnded = true;
    gameBridge.resetInput();
    soundFX.stopAllLoops();
    platformBridge.notifyGameplayStop();

    this.powerups.clear();
    this.projectiles.clearAll();
    for (const t of this.tanks) {
      t.clearTemporaryEffects();
    }
    this.recentPickupName = null;
    this.recentPickupColor = null;
    this.recentPickupTimer = 0;

    // Rank all tanks: alive tanks sorted by HP desc then eliminations desc; dead tanks by eliminatedAtRank
    const ranked = [...this.tanks].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (a.alive && b.alive) {
        if (b.hp !== a.hp) return b.hp - a.hp;
        return b.eliminations - a.eliminations;
      }
      return (a.eliminatedAtRank ?? 8) - (b.eliminatedAtRank ?? 8);
    });

    const placement = ranked.findIndex((t) => t.isPlayer) + 1;
    const victory = placement === 1;
    const winnerName = ranked[0]?.displayName ?? 'Unknown';

    let reason: MatchResult['reason'] = trigger;
    if (trigger === 'time_highest_hp' && !victory) {
      reason = 'time_outscored';
    }

    const scrapBreakdown = calculateMatchScrapBreakdown({
      victory,
      placement,
      eliminations: this.playerTank.eliminations,
      damageDealt: this.playerTank.damageDealt,
    });
    const scrapEarned = scrapBreakdown.totalScrap;

    soundFX.playMatchEnd(victory);
    if (victory) platformBridge.notifyHappyTime();

    const totalDuration = this.launchConfig.settings?.matchDurationSec || 150;
    const rawSurvival = this.playerEliminatedAtSec ?? this.elapsedMatchSec;
    const survivalSec = Math.min(totalDuration, Math.max(0, Math.floor(rawSurvival)));

    const result: MatchResult = {
      matchId: this.matchId || `match_${Date.now()}`,
      victory,
      reason,
      placement,
      totalTanks: this.tanks.length,
      eliminations: this.playerTank.eliminations,
      damageDealt: this.playerTank.damageDealt,
      survivalSec,
      scrapEarned,
      scrapBreakdown,
      arenaId: this.arena.id,
      tankId: this.playerTank.definition.id,
      winnerName,
    };

    gameBridge.emitGameplayEvent({
      eventId: `${this.matchId}:completed`,
      type: 'match_completed',
      matchId: result.matchId,
      tankId: result.tankId,
      arenaId: result.arenaId,
      placement: result.placement,
      survivalSec: result.survivalSec,
    });
    if (result.victory) {
      gameBridge.emitGameplayEvent({
        eventId: `${this.matchId}:victory`,
        type: 'match_victory',
        matchId: result.matchId,
        tankId: result.tankId,
        arenaId: result.arenaId,
      });
    }

    gameBridge.emitMatchEnd(result);
  }

  private emitHudSnapshot(): void {
    if (!this.sceneActive || !this.playerTank) return;
    const aliveCount = this.tanks.filter((t) => t.alive).length;
    const activeBuffs = this.playerTank.effectsManager.toHudSnapshots();

    const isPreparing = this.prepRemainingSec > 0;
    const prepLabel = isPreparing
      ? String(Math.max(1, Math.ceil(this.prepRemainingSec)))
      : this.goBannerTimer > 0
      ? 'GO!'
      : null;

    const radarActive = !isPreparing && this.playerTank.alive && this.playerTank.hasBuff('radar');
    const radarRemainingSec = radarActive
      ? this.playerTank.effectsManager.getRemainingSec('radar')
      : 0;
    const radarRadius = radarActive ? this.playerTank.effectsManager.getRadarRadius() : 0;
    let radarDetectedCount = 0;
    if (radarActive && radarRadius > 0) {
      for (const t of this.tanks) {
        if (!t.alive || t.isPlayer) continue;
        if (Math.hypot(t.x - this.playerTank.x, t.y - this.playerTank.y) <= radarRadius) {
          radarDetectedCount += 1;
        }
      }
    }

    const snapshot: HUDStateSnapshot = {
      tankId: this.playerTank.definition.id,
      tankName: this.playerTank.definition.name,
      hp: Math.ceil(this.playerTank.hp),
      maxHp: this.playerTank.maxHp,
      shieldHp: Math.ceil(this.playerTank.shieldHp),
      ammo: this.playerTank.ammo,
      maxAmmo: this.playerTank.maxAmmo,
      isReloading: this.playerTank.isReloading,
      reloadRemainingSec: this.playerTank.magazineReloadTimer,
      reloadTotalSec:
        this.playerTank.magazineReloadTotal || this.playerTank.getEffectiveReloadDurationSec(),
      aliveCount,
      totalTanks: this.tanks.length,
      eliminations: this.playerTank.eliminations,
      timeRemainingSec: Math.ceil(this.matchTimeLeft),
      abilityCooldownSec: this.playerTank.abilityCooldownTimer,
      abilityTotalCooldownSec: this.playerTank.definition.activeAbility.cooldownSec,
      abilityActiveSec: this.playerTank.abilityActiveTimer,
      abilityName: this.playerTank.definition.activeAbility.name,
      activeBuffs,
      mineCharges: this.playerTank.mineCharges,
      maxMineCharges: MINE_SYSTEM_CONFIG.maxCarriedCharges,
      activeMineCount: this.projectiles.getActiveMineCount(this.playerTank.id),
      isConcealed: this.playerTank.concealed,
      isPhased: this.playerTank.phaseCloaked,
      isSlowed: this.playerTank.isSlowed,
      slowRemainingSec: this.playerTank.slowRemainingSec,
      radarActive,
      radarRemainingSec,
      radarDetectedCount,
      recentPickupName: this.recentPickupName,
      recentPickupColor: this.recentPickupColor,
      isPaused: this.paused,
      isPreparing,
      prepLabel,
      killFeedText: this.killFeedText,
    };

    gameBridge.emitHudUpdate(snapshot);
  }
}
