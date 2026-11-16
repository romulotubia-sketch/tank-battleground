import { TankId } from '../../types/game';

/**
 * Offline Web Audio API Sound FX & Original Procedural Music Synthesizer
 * - Respects browser autoplay restrictions (AudioContext initializes only after valid user gesture)
 * - Separate SFX and Music volume/mute controls
 * - Per-sound cooldown throttling & voice cap to prevent overlapping Android audio distortion
 */

export type ImpactSoundKind = 'tank' | 'shield' | 'steel' | 'destructible' | 'wall';
export type MusicMode = 'none' | 'menu' | 'battle';

class SoundFXManager {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private soundEnabled = true;
  private soundVolume = 0.65;
  private musicEnabled = true;
  private musicVolume = 0.4;

  private unlocked = false;
  private gestureHooked = false;

  private activeVoices = 0;
  private readonly maxVoices = 14;
  private lastPlayedAt = new Map<string, number>();

  // Continuous movement tread rumble nodes (smooth gain ramp, zero per-frame allocation)
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  // Original procedural tactical music loop
  private musicMode: MusicMode = 'none';
  private musicTimer: number | null = null;
  private musicStep = 0;

  constructor() {
    this.registerGestureUnlock();
  }

  private registerGestureUnlock(): void {
    if (this.gestureHooked || typeof window === 'undefined') return;
    if (typeof window.addEventListener !== 'function') return;
    this.gestureHooked = true;

    const onGesture = () => {
      this.unlockFromUserGesture();
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });
    window.addEventListener('touchstart', onGesture, { passive: true });
  }

  unlockFromUserGesture(): void {
    this.unlocked = true;
    const ctx = this.ensureContext(true);
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.syncMusicLoop();
  }

  configure(
    soundEnabled: boolean,
    soundVolume: number,
    musicEnabled = this.musicEnabled,
    musicVolume = this.musicVolume
  ): void {
    this.soundEnabled = soundEnabled;
    this.soundVolume = Math.min(1, Math.max(0, soundVolume));
    this.musicEnabled = musicEnabled;
    this.musicVolume = Math.min(1, Math.max(0, musicVolume));

    if (this.ctx && this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(
        this.soundEnabled ? this.soundVolume : 0,
        this.ctx.currentTime,
        0.02
      );
    }
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(
        this.musicEnabled ? this.musicVolume * 0.24 : 0,
        this.ctx.currentTime,
        0.04
      );
    }

    if (!this.soundEnabled || this.soundVolume <= 0.01) {
      this.stopEngineLoop();
    }
    this.syncMusicLoop();
  }

  setMusicMode(mode: MusicMode): void {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    this.musicStep = 0;
    this.syncMusicLoop();
  }

  stopAllLoops(): void {
    this.stopEngineLoop();
    this.stopMusicTimer();
  }

  private ensureContext(fromUserGesture = false): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.unlocked && !fromUserGesture) return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.soundEnabled ? this.soundVolume : 0;
      this.sfxGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? this.musicVolume * 0.24 : 0;
      this.musicGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended' && fromUserGesture) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private canPlaySfx(tag: string, minIntervalMs = 45): AudioContext | null {
    if (!this.soundEnabled || this.soundVolume <= 0.01) return null;
    if (this.activeVoices >= this.maxVoices) return null;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prev = this.lastPlayedAt.get(tag) ?? 0;
    if (nowMs - prev < minIntervalMs) return null;

    const ctx = this.ensureContext(false);
    if (!ctx || ctx.state !== 'running') return null;

    this.lastPlayedAt.set(tag, nowMs);
    return ctx;
  }

  private playTone(
    ctx: AudioContext,
    type: OscillatorType,
    startFreq: number,
    endFreq: number | null,
    durationSec: number,
    amp: number,
    delaySec = 0,
    target: 'sfx' | 'music' = 'sfx'
  ): void {
    const dest = target === 'music' ? this.musicGain : this.sfxGain;
    if (!dest) return;
    if (target === 'sfx' && this.activeVoices >= this.maxVoices) return;

    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, startFreq), t0);
    if (endFreq !== null && endFreq !== startFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(Math.max(0.001, amp), t0 + Math.min(0.015, durationSec * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

    osc.connect(gain);
    gain.connect(dest);

    if (target === 'sfx') this.activeVoices += 1;
    osc.onended = () => {
      if (target === 'sfx') this.activeVoices = Math.max(0, this.activeVoices - 1);
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Ignore already-disconnected nodes
      }
    };

    osc.start(t0);
    osc.stop(t0 + durationSec + 0.02);
  }

  // --- Tank Movement Audio ---
  updateMovementAudio(speedRatio: number, active: boolean): void {
    const clamped = active ? Math.min(1.4, Math.max(0, speedRatio)) : 0;
    if (!this.soundEnabled || this.soundVolume <= 0.01 || clamped < 0.08) {
      if (this.ctx && this.engineGain) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
      }
      return;
    }

    const ctx = this.ensureContext(false);
    if (!ctx || ctx.state !== 'running' || !this.sfxGain) return;

    if (!this.engineOsc || !this.engineGain || !this.engineFilter) {
      this.engineOsc = ctx.createOscillator();
      this.engineOsc.type = 'triangle';
      this.engineOsc.frequency.value = 54;

      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 135;

      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0;

      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);
      this.engineOsc.start();
    }

    const now = ctx.currentTime;
    const freq = 48 + clamped * 26;
    const targetVol = 0.048 * Math.min(1, clamped);
    this.engineOsc.frequency.setTargetAtTime(freq, now, 0.08);
    this.engineGain.gain.setTargetAtTime(targetVol, now, 0.07);
  }

  private stopEngineLoop(): void {
    if (this.ctx && this.engineGain) {
      try {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      } catch {
        // Ignore
      }
    }
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {
        // Ignore
      }
      this.engineOsc = null;
    }
    if (this.engineFilter) {
      try {
        this.engineFilter.disconnect();
      } catch {
        // Ignore
      }
      this.engineFilter = null;
    }
    if (this.engineGain) {
      try {
        this.engineGain.disconnect();
      } catch {
        // Ignore
      }
      this.engineGain = null;
    }
  }

  // --- Original Procedural Music Loop ---
  private syncMusicLoop(): void {
    const shouldPlay =
      this.unlocked &&
      this.musicMode !== 'none' &&
      this.musicEnabled &&
      this.musicVolume > 0.01;

    if (!shouldPlay) {
      this.stopMusicTimer();
      return;
    }

    const ctx = this.ensureContext(false);
    if (!ctx) return;

    if (this.musicTimer === null && typeof window !== 'undefined') {
      const stepMs = this.musicMode === 'battle' ? 420 : 620;
      this.musicTimer = window.setInterval(() => {
        this.tickMusicNote();
      }, stepMs);
    }
  }

  private stopMusicTimer(): void {
    if (this.musicTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private tickMusicNote(): void {
    if (!this.musicEnabled || this.musicVolume <= 0.01 || this.musicMode === 'none') return;
    const ctx = this.ensureContext(false);
    if (!ctx || ctx.state !== 'running' || !this.musicGain) return;

    // Original minor-pentatonic tactical pulse (D minor: D2, F2, G2, A2, C3, D3)
    const battleBass = [73.42, 73.42, 87.31, 73.42, 98.0, 110.0, 87.31, 130.81];
    const battlePad = [293.66, 0, 349.23, 0, 392.0, 0, 440.0, 349.23];
    const menuPad = [146.83, 220.0, 174.61, 261.63, 196.0, 220.0, 174.61, 146.83];

    const idx = this.musicStep % 8;
    this.musicStep += 1;

    if (this.musicMode === 'battle') {
      const bass = battleBass[idx];
      this.playTone(ctx, 'triangle', bass, bass * 0.98, 0.34, 0.32, 0, 'music');
      const lead = battlePad[idx];
      if (lead > 0) {
        this.playTone(ctx, 'sine', lead, lead, 0.38, 0.14, 0.04, 'music');
      }
    } else {
      const pad = menuPad[idx];
      this.playTone(ctx, 'sine', pad, pad, 0.54, 0.18, 0, 'music');
    }
  }

  // --- Combat & Gameplay SFX ---
  playShot(isPlayer: boolean): void {
    const ctx = this.canPlaySfx(isPlayer ? 'shot_p' : 'shot_ai', isPlayer ? 40 : 75);
    if (!ctx) return;
    this.playTone(ctx, 'triangle', isPlayer ? 245 : 190, 55, 0.11, isPlayer ? 0.22 : 0.08);
  }

  playArtilleryShot(isPlayer: boolean): void {
    const ctx = this.canPlaySfx(isPlayer ? 'art_p' : 'art_ai', isPlayer ? 60 : 90);
    if (!ctx) return;
    this.playTone(ctx, 'sawtooth', isPlayer ? 155 : 128, 36, 0.2, isPlayer ? 0.24 : 0.095);
  }

  playBarrageLaunch(): void {
    const ctx = this.canPlaySfx('barrage', 120);
    if (!ctx) return;
    this.playTone(ctx, 'triangle', 210, 480, 0.14, 0.16);
    this.playTone(ctx, 'triangle', 480, 140, 0.2, 0.15, 0.14);
  }

  playElectricShot(isPlayer: boolean): void {
    const ctx = this.canPlaySfx(isPlayer ? 'elec_p' : 'elec_ai', isPlayer ? 45 : 80);
    if (!ctx) return;
    this.playTone(ctx, 'sawtooth', isPlayer ? 690 : 540, 175, 0.11, isPlayer ? 0.16 : 0.07);
  }

  playEmpPulse(): void {
    const ctx = this.canPlaySfx('emp', 140);
    if (!ctx) return;
    this.playTone(ctx, 'sine', 540, 95, 0.36, 0.24);
    this.playTone(ctx, 'triangle', 920, 240, 0.22, 0.12);
  }

  playImpact(kindOrHeavy: ImpactSoundKind | boolean = false): void {
    const kind: ImpactSoundKind =
      typeof kindOrHeavy === 'boolean' ? (kindOrHeavy ? 'tank' : 'wall') : kindOrHeavy;
    const ctx = this.canPlaySfx(`imp_${kind}`, 45);
    if (!ctx) return;

    switch (kind) {
      case 'shield':
        this.playTone(ctx, 'sine', 640, 320, 0.1, 0.14);
        break;
      case 'steel':
        this.playTone(ctx, 'triangle', 760, 480, 0.075, 0.09);
        break;
      case 'destructible':
        this.playTone(ctx, 'sawtooth', 220, 72, 0.085, 0.11);
        break;
      case 'tank':
        this.playTone(ctx, 'sawtooth', 165, 42, 0.1, 0.19);
        break;
      case 'wall':
      default:
        this.playTone(ctx, 'triangle', 260, 85, 0.065, 0.08);
        break;
    }
  }

  playShieldBreak(): void {
    const ctx = this.canPlaySfx('shd_break', 120);
    if (!ctx) return;
    this.playTone(ctx, 'sine', 780, 210, 0.2, 0.18);
    this.playTone(ctx, 'triangle', 520, 140, 0.18, 0.14, 0.04);
  }

  playExplosion(): void {
    const ctx = this.canPlaySfx('explosion', 95);
    if (!ctx) return;
    this.playTone(ctx, 'sawtooth', 118, 28, 0.34, 0.3);
    this.playTone(ctx, 'triangle', 84, 24, 0.32, 0.22, 0.02);
  }

  playElimination(isPlayerInvolved: boolean): void {
    const ctx = this.canPlaySfx('elim', 110);
    if (!ctx) return;
    const amp = isPlayerInvolved ? 0.28 : 0.15;
    this.playTone(ctx, 'sawtooth', 140, 30, 0.36, amp);
    this.playTone(ctx, 'triangle', 310, 88, 0.22, amp * 0.7, 0.04);
  }

  playBarrelPrime(): void {
    const ctx = this.canPlaySfx('barrel_prime', 150);
    if (!ctx) return;
    this.playTone(ctx, 'triangle', 540, 560, 0.11, 0.11, 0);
    this.playTone(ctx, 'triangle', 720, 740, 0.11, 0.11, 0.14);
  }

  playPowerup(): void {
    const ctx = this.canPlaySfx('powerup', 100);
    if (!ctx) return;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      this.playTone(ctx, 'sine', freq, freq * 1.02, 0.14, 0.15, idx * 0.045);
    });
  }

  playMineDeploy(): void {
    const ctx = this.canPlaySfx('mine', 100);
    if (!ctx) return;
    this.playTone(ctx, 'triangle', 220, 115, 0.12, 0.16);
  }

  playAbility(): void {
    const ctx = this.canPlaySfx('ability', 120);
    if (!ctx) return;
    this.playTone(ctx, 'square', 320, 640, 0.16, 0.13);
  }

  playAbilityExpire(tankId: TankId): void {
    const ctx = this.canPlaySfx(`abil_exp_${tankId}`, 150);
    if (!ctx) return;
    if (tankId === 'fortress') {
      this.playTone(ctx, 'sine', 420, 180, 0.16, 0.1);
    } else if (tankId === 'scout') {
      this.playTone(ctx, 'triangle', 340, 130, 0.18, 0.09);
    } else if (tankId === 'assault') {
      this.playTone(ctx, 'triangle', 460, 210, 0.14, 0.09);
    }
  }

  playAfterburner(): void {
    const ctx = this.canPlaySfx('afterburner', 120);
    if (!ctx) return;
    this.playTone(ctx, 'sawtooth', 165, 520, 0.17, 0.16);
    this.playTone(ctx, 'sawtooth', 520, 310, 0.14, 0.12, 0.16);
  }

  playPhaseShift(): void {
    const ctx = this.canPlaySfx('phase', 120);
    if (!ctx) return;
    this.playTone(ctx, 'sine', 280, 760, 0.18, 0.16);
    this.playTone(ctx, 'sine', 760, 420, 0.14, 0.12, 0.17);
  }

  playPhaseEnd(): void {
    const ctx = this.canPlaySfx('phase_end', 120);
    if (!ctx) return;
    this.playTone(ctx, 'sine', 520, 220, 0.16, 0.1);
  }

  playMatchEnd(victory: boolean): void {
    this.stopEngineLoop();
    const ctx = this.canPlaySfx('match_end', 300);
    if (!ctx) return;
    const seq = victory ? [440, 554.37, 659.25, 880] : [330, 293.66, 246.94, 196];
    seq.forEach((freq, i) => {
      this.playTone(ctx, 'triangle', freq, freq, 0.25, 0.18, i * 0.1);
    });
  }

  playCountdown(isGo: boolean): void {
    const ctx = this.canPlaySfx('countdown', 120);
    if (!ctx) return;
    this.playTone(ctx, 'triangle', isGo ? 784 : 440, isGo ? 880 : 440, isGo ? 0.24 : 0.12, isGo ? 0.2 : 0.14);
  }

  playEmptyClick(): void {
    const ctx = this.canPlaySfx('empty', 140);
    if (!ctx) return;
    this.playTone(ctx, 'square', 175, 85, 0.045, 0.09);
  }

  playReloadStart(): void {
    const ctx = this.canPlaySfx('reload_start', 150);
    if (!ctx) return;
    this.playTone(ctx, 'triangle', 290, 190, 0.09, 0.11);
  }

  playReloadComplete(): void {
    const ctx = this.canPlaySfx('reload_done', 150);
    if (!ctx) return;
    [410, 620].forEach((freq, i) => {
      this.playTone(ctx, 'triangle', freq, freq, 0.1, 0.12, i * 0.055);
    });
  }
}

export const soundFX = new SoundFXManager();
