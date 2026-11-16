import Phaser from 'phaser';
import { ensureProceduralTextures } from '../../assets/ProceduralTextureGenerator';
import { POWERUP_DEFINITIONS } from '../../data/powerups';
import { TANK_DEFINITIONS, TANK_LIST } from '../../data/tanks';
import { platformBridge } from '../../services/bridge/PlaygamaBridgeAdapter';
import {
  ActiveBuffSnapshot,
  AIPersonality,
  ArenaDefinition,
  HUDStateSnapshot,
  MatchResult,
  TankId,
} from '../../types/game';
import { activateTankAbility, fireTankWeapon } from '../abilities/AbilitySystem';
import { AIController } from '../ai/AIController';
import { ARENA_DEFINITIONS, ARENA_HEIGHT, ARENA_WIDTH } from '../arenas/arenaLayouts';
import { ObstacleEntity } from '../entities/ObstacleEntity';
import { TankEntity } from '../entities/TankEntity';
import { gameBridge, MatchLaunchConfig } from '../GameBridge';
import { PowerupManager } from '../powerups/PowerupManager';
import { ProjectilePool } from '../projectiles/ProjectilePool';
import { EffectsPool } from '../systems/EffectsPool';
import { soundFX } from '../systems/SoundFX';

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
  private paused = false;
  private hudPushTimer = 0;
  private killFeedText: string | null = null;
  private killFeedTimer = 0;
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
    R: Phaser.Input.Keyboard.Key;
    SHIFT: Phaser.Input.Keyboard.Key;
    P: Phaser.Input.Keyboard.Key;
    ESC: Phaser.Input.Keyboard.Key;
  };

  private unsubCommand?: () => void;
  private unsubSettings?: () => void;
  private handleWindowBlur = () => {
    gameBridge.input.firing = false;
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
        showTouchControls: 'always',
        autoFireOnAim: false,
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
    this.paused = false;
    this.hudPushTimer = 0;
    this.killFeedText = null;
    this.killFeedTimer = 0;
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
    this.tanks = [];
    this.obstacles = [];
    this.aiMap.clear();
  }

  create(): void {
    ensureProceduralTextures(this);
    soundFX.configure(
      this.launchConfig.settings.soundEnabled,
      this.launchConfig.settings.soundVolume
    );

    this.drawArenaGround();

    this.effects = new EffectsPool(this, this.launchConfig.settings.lowDetailMode);
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
      pSpawn.angle
    );
    this.tanks.push(this.playerTank);

    // Bot roster: mostly assault/varied classes for authentic battleground mix
    const botClasses: TankId[] = ['assault', 'assault', 'scout', 'fortress', 'artillery', 'tesla', 'phantom'];
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
        BOT_PERSONALITIES[i - 1]
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
      if (cmd === 'PAUSE') this.setPaused(true);
      else if (cmd === 'RESUME') this.setPaused(false);
      else if (cmd === 'RESTART') {
        gameBridge.resetInput();
        const nextConfig = gameBridge.getLaunchConfig() ?? this.launchConfig;
        this.scene.restart(nextConfig);
      }
    });

    this.unsubSettings = gameBridge.onSettingsChange((nextSettings) => {
      if (!this.sceneActive) return;
      this.launchConfig = { ...this.launchConfig, settings: nextSettings };
      soundFX.configure(nextSettings.soundEnabled, nextSettings.soundVolume);
      this.effects.setLowDetail(nextSettings.lowDetailMode);
    });

    window.addEventListener('blur', this.handleWindowBlur);

    const cleanupBridgeListeners = () => {
      this.sceneActive = false;
      if (this.unsubCommand) {
        this.unsubCommand();
        this.unsubCommand = undefined;
      }
      if (this.unsubSettings) {
        this.unsubSettings();
        this.unsubSettings = undefined;
      }
      window.removeEventListener('blur', this.handleWindowBlur);
      this.time.paused = false;
      this.tweens.resumeAll();
      gameBridge.resetInput();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupBridgeListeners);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanupBridgeListeners);

    platformBridge.notifyGameplayStart();
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
    g.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(this.arena.groundGridColor).color, 0.55);
    const step = 80;
    for (let x = step; x < w; x += step) {
      g.lineBetween(x, 0, x, h);
    }
    for (let y = step; y < h; y += step) {
      g.lineBetween(0, y, w, y);
    }

    // Center tactical ring motif
    g.lineStyle(2.5, Phaser.Display.Color.HexStringToColor(this.arena.groundGridColor).color, 0.7);
    g.strokeCircle(w / 2, h / 2, 130);

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
        R: Phaser.Input.Keyboard.KeyCodes.R,
        SHIFT: Phaser.Input.Keyboard.KeyCodes.SHIFT,
        P: Phaser.Input.Keyboard.KeyCodes.P,
        ESC: Phaser.Input.Keyboard.KeyCodes.ESC,
      }) as NonNullable<ArenaScene['keys']>;
      this.keys = keys;

      keys.P.on('down', () => this.setPaused(!this.paused));
      keys.ESC.on('down', () => this.setPaused(!this.paused));
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

  private setPaused(value: boolean): void {
    if (this.matchEnded) return;
    this.paused = value;
    this.time.paused = value;
    if (value) {
      this.tweens.pauseAll();
      gameBridge.resetInput();
    } else {
      this.tweens.resumeAll();
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

    if (this.pendingDefeatTimer !== null) {
      this.pendingDefeatTimer -= dt;
      if (this.pendingDefeatTimer <= 0) {
        this.finishMatch('eliminated');
        return;
      }
    }

    // 1. Player controls
    this.updatePlayerTank(dt);

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
      this.handleTankEliminated
    );

    // 5. Update powerups
    this.powerups.update(
      dt,
      this.arena.width,
      this.arena.height,
      this.tanks,
      this.obstacles,
      this.projectiles,
      this.effects
    );

    // 6. Update tank timers & visual state
    const playerRadar = this.playerTank.alive && this.playerTank.hasBuff('radar');
    for (const tank of this.tanks) {
      tank.updateTimersAndVisuals(dt, playerRadar, false);
    }

    // 7. Update pooled effects
    this.effects.update(dt);

    // 8. Check win/timer end conditions
    const aliveTanks = this.tanks.filter((t) => t.alive);
    if (this.playerTank.alive && aliveTanks.length === 1) {
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
    let shouldAutoFire = false;
    const maxRange = this.playerTank.getEffectiveProjectileRange();
    if (inp.aimActive && Math.hypot(inp.aimX, inp.aimY) > 0.15) {
      const aimMag = Math.min(1, Math.hypot(inp.aimX, inp.aimY));
      const aimAngle = Math.atan2(inp.aimY, inp.aimX);
      this.playerTank.aimTurretToward(aimAngle, dt);
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
      this.playerTank.aimTurretToward(aimAngle, dt);
      this.lastAimDistance = Phaser.Math.Clamp(Math.hypot(dx, dy), 95, maxRange);
      this.manualAimHoldTimer = 2.5;
    } else if (hasFireInput) {
      this.manualAimHoldTimer = Math.max(this.manualAimHoldTimer, 1.5);
    } else if (this.manualAimHoldTimer <= 0 && Math.hypot(mx, my) > 0.2) {
      // Smoothly align turret forward only after manual aim/fire pause
      this.playerTank.aimTurretToward(Math.atan2(my, mx), dt * 0.55);
    }

    // Update Artillery Shell Barrage aiming reticle when ready
    const barrageTarget = this.computeArtilleryTargetPoint(inp.mouseAimActive);
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
      if (
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
    if (this.matchEnded) return;
    const blastRadius = 125;
    this.effects.spawnDestruction(bx, by, 0xf97316, blastRadius);
    soundFX.playExplosion();
    if (!this.launchConfig.settings.lowDetailMode) {
      this.cameras.main.shake(150, 0.008);
    }

    const attacker = this.tanks.find((t) => t.id === attackerId);

    for (const tank of this.tanks) {
      if (!tank.alive) continue;
      const dist = Math.hypot(tank.x - bx, tank.y - by);
      if (dist <= blastRadius + tank.radius) {
        const falloff = 1 - Math.min(0.6, dist / (blastRadius + tank.radius));
        const dmg = Math.round(52 * falloff);
        const res = tank.takeDamage(dmg);
        if (attacker && tank.id !== attacker.id) attacker.damageDealt += res.actualDamage;
        if (res.killed) this.handleTankEliminated(tank, attackerId);
      }
    }

    // Chain-react adjacent destructibles & barrels
    for (const obs of this.obstacles) {
      if (!obs.alive || !obs.destructible) continue;
      if (Math.hypot(obs.x - bx, obs.y - by) <= blastRadius) {
        const destroyed = obs.damage(45, this);
        if (destroyed && obs.type === 'barrel') {
          this.time.delayedCall(90, () => this.handleBarrelExplosion(obs.x, obs.y, attackerId));
        }
      }
    }
  };

  private handleTankEliminated = (victim: TankEntity, attackerId: string): void => {
    const remainingAfter = this.tanks.filter((t) => t.alive).length;
    victim.eliminatedAtRank = remainingAfter + 1;

    const attacker = this.tanks.find((t) => t.id === attackerId);
    if (attacker && attacker.id !== victim.id) {
      attacker.eliminations += 1;
      this.killFeedText = `${attacker.displayName} eliminated ${victim.displayName}`;
    } else {
      this.killFeedText = `${victim.displayName} destroyed`;
    }
    this.killFeedTimer = 3.0;

    this.effects.spawnDestruction(victim.x, victim.y, 0xef4444, 72);
    soundFX.playExplosion();

    if (victim.isPlayer && this.pendingDefeatTimer === null && !this.matchEnded) {
      this.playerEliminatedAtSec = this.elapsedMatchSec;
      this.pendingDefeatTimer = 0.85;
    }
    this.emitHudSnapshot();
  };

  private finishMatch(trigger: 'last_standing' | 'time_highest_hp' | 'eliminated'): void {
    if (this.matchEnded) return;
    this.matchEnded = true;
    gameBridge.resetInput();
    platformBridge.notifyGameplayStop();

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

    const placementRewards = [120, 85, 65, 50, 35, 25, 18, 12];
    const scrapEarned =
      (placementRewards[placement - 1] ?? 12) + this.playerTank.eliminations * 15;

    soundFX.playMatchEnd(victory);
    if (victory) platformBridge.notifyHappyTime();

    const totalDuration = this.launchConfig.settings?.matchDurationSec || 150;
    const rawSurvival = this.playerEliminatedAtSec ?? this.elapsedMatchSec;
    const survivalSec = Math.min(totalDuration, Math.max(0, Math.floor(rawSurvival)));

    const result: MatchResult = {
      victory,
      reason,
      placement,
      totalTanks: this.tanks.length,
      eliminations: this.playerTank.eliminations,
      damageDealt: this.playerTank.damageDealt,
      survivalSec,
      scrapEarned,
      arenaId: this.arena.id,
      tankId: this.playerTank.definition.id,
      winnerName,
    };

    gameBridge.emitMatchEnd(result);
  }

  private emitHudSnapshot(): void {
    if (!this.sceneActive || !this.playerTank) return;
    const aliveCount = this.tanks.filter((t) => t.alive).length;
    const activeBuffs: ActiveBuffSnapshot[] = [];
    this.playerTank.buffs.forEach((buff) => {
      const def = POWERUP_DEFINITIONS[buff.id];
      activeBuffs.push({
        id: buff.id,
        name: def.name,
        shortLabel: def.shortLabel,
        remainingSec: buff.remainingSec,
        totalSec: buff.totalSec,
        color: def.color,
      });
    });

    const isPreparing = this.prepRemainingSec > 0;
    const prepLabel = isPreparing
      ? String(Math.max(1, Math.ceil(this.prepRemainingSec)))
      : this.goBannerTimer > 0
      ? 'GO!'
      : null;

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
      isConcealed: this.playerTank.concealed,
      radarActive: !isPreparing && this.playerTank.hasBuff('radar'),
      isPaused: this.paused,
      isPreparing,
      prepLabel,
      killFeedText: this.killFeedText,
    };

    gameBridge.emitHudUpdate(snapshot);
  }
}
