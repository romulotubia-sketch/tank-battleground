import Phaser from 'phaser';
import { ObstaclePlacement, ObstacleType } from '../../types/game';
import { EffectsPool } from '../systems/EffectsPool';
import { soundFX } from '../systems/SoundFX';

export const BARREL_BLAST_RADIUS = 125;
export const BARREL_FUSE_SEC = 0.58;

export class ObstacleEntity {
  readonly id: number;
  readonly type: ObstacleType;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly blocksMovement: boolean;
  readonly blocksProjectiles: boolean;
  readonly destructible: boolean;
  readonly providesConcealment: boolean;

  hp: number;
  maxHp: number;
  alive = true;
  isPriming = false;
  fuseRemainingSec = 0;
  fuseTotalSec = BARREL_FUSE_SEC;
  primedByAttackerId = '';

  readonly sprite: Phaser.GameObjects.Image;
  private crackOverlay: Phaser.GameObjects.Graphics | null = null;
  private warningOuter: Phaser.GameObjects.Arc | null = null;
  private warningInner: Phaser.GameObjects.Arc | null = null;
  private waterShimmer: Phaser.GameObjects.Rectangle | null = null;
  private damageStage = 0;
  private fuseSparkTimer = 0;

  constructor(scene: Phaser.Scene, id: number, placement: ObstaclePlacement) {
    this.id = id;
    this.type = placement.type;
    this.x = placement.x;
    this.y = placement.y;
    this.width = placement.w;
    this.height = placement.h;

    this.blocksMovement = placement.type !== 'bush';
    this.blocksProjectiles =
      placement.type === 'brick' ||
      placement.type === 'steel' ||
      placement.type === 'crate' ||
      placement.type === 'barrel';
    this.destructible =
      placement.type === 'brick' || placement.type === 'crate' || placement.type === 'barrel';
    this.providesConcealment = placement.type === 'bush';

    if (placement.type === 'brick') {
      this.maxHp = 65;
    } else if (placement.type === 'crate') {
      this.maxHp = 35;
    } else if (placement.type === 'barrel') {
      this.maxHp = 22;
    } else {
      this.maxHp = 9999;
    }
    this.hp = this.maxHp;

    const texKey = `obs_${placement.type}`;
    this.sprite = scene.add.image(placement.x, placement.y, texKey);
    this.sprite.setDisplaySize(placement.w, placement.h);

    if (placement.type === 'bush') {
      this.sprite.setDepth(22); // renders above tanks for concealment
      this.sprite.setAlpha(0.92);
    } else if (placement.type === 'water') {
      this.sprite.setDepth(2);
      this.waterShimmer = scene.add
        .rectangle(placement.x, placement.y, Math.max(18, placement.w * 0.56), Math.max(8, placement.h * 0.12), 0xdbeafe, 0.24)
        .setDepth(2);
    } else {
      this.sprite.setDepth(10);
    }
  }

  get left(): number {
    return this.x - this.width / 2;
  }

  get right(): number {
    return this.x + this.width / 2;
  }

  get top(): number {
    return this.y - this.height / 2;
  }

  get bottom(): number {
    return this.y + this.height / 2;
  }

  containsPoint(px: number, py: number, padding = 0): boolean {
    if (!this.alive) return false;
    return (
      px >= this.left - padding &&
      px <= this.right + padding &&
      py >= this.top - padding &&
      py <= this.bottom + padding
    );
  }

  damage(amount: number, scene: Phaser.Scene, attackerId = ''): boolean {
    if (!this.alive || !this.destructible) return false;
    if (this.isPriming) return false;

    this.hp = Math.max(0, this.hp - amount);

    // Visual hit flash
    this.sprite.setTint(0xffdddd);
    scene.time.delayedCall(65, () => {
      if (this.alive && !this.isPriming && this.sprite.scene) {
        this.sprite.clearTint();
      }
    });

    if (this.hp <= 0) {
      if (this.type === 'barrel') {
        this.startFuse(scene, attackerId);
        return false;
      }
      this.destroy();
      return true;
    }

    // Multi-stage damage cracks for brick / crate / barrel
    const hpRatio = this.hp / this.maxHp;
    if (this.damageStage < 1 && hpRatio < 0.68) {
      this.damageStage = 1;
      this.crackOverlay = scene.add.graphics().setDepth(11);
      this.crackOverlay.lineStyle(2.5, 0x161815, 0.85);
      this.crackOverlay.beginPath();
      this.crackOverlay.moveTo(this.x - this.width * 0.28, this.y - this.height * 0.25);
      this.crackOverlay.lineTo(this.x + 2, this.y);
      this.crackOverlay.lineTo(this.x + this.width * 0.24, this.y + this.height * 0.22);
      this.crackOverlay.moveTo(this.x + 2, this.y);
      this.crackOverlay.lineTo(this.x - this.width * 0.14, this.y + this.height * 0.28);
      this.crackOverlay.strokePath();
    }
    if (this.damageStage < 2 && hpRatio < 0.36 && this.crackOverlay) {
      this.damageStage = 2;
      this.crackOverlay.lineStyle(2.8, 0x161815, 0.95);
      this.crackOverlay.beginPath();
      this.crackOverlay.moveTo(this.x + this.width * 0.26, this.y - this.height * 0.28);
      this.crackOverlay.lineTo(this.x - 4, this.y + 3);
      this.crackOverlay.lineTo(this.x - this.width * 0.3, this.y + this.height * 0.08);
      this.crackOverlay.strokePath();
      this.sprite.setAlpha(0.88);
    }

    return false;
  }

  private startFuse(scene: Phaser.Scene, attackerId: string): void {
    if (this.isPriming || !this.alive) return;
    this.isPriming = true;
    this.fuseTotalSec = BARREL_FUSE_SEC;
    this.fuseRemainingSec = BARREL_FUSE_SEC;
    this.primedByAttackerId = attackerId;

    this.warningOuter = scene.add
      .circle(this.x, this.y, BARREL_BLAST_RADIUS, 0xef4444, 0.13)
      .setStrokeStyle(2.5, 0xef4444, 0.9)
      .setDepth(5);
    this.warningInner = scene.add
      .circle(this.x, this.y, 18, 0xf97316, 0.24)
      .setStrokeStyle(2, 0xfacc15, 0.95)
      .setDepth(5);
    this.sprite.setTint(0xfacc15);
    soundFX.playBarrelPrime();
  }

  updateAmbient(elapsedSec: number): void {
    if (!this.alive) return;
    if (this.type === 'water' && this.waterShimmer) {
      const wave = Math.sin(elapsedSec * 2.1 + this.id * 1.3);
      this.waterShimmer.setPosition(this.x + wave * 6, this.y + Math.cos(elapsedSec * 1.5 + this.id) * 3);
      this.waterShimmer.setAlpha(0.16 + 0.14 * Math.abs(wave));
    } else if (this.type === 'bush' && this.sprite.scene) {
      this.sprite.setRotation(Math.sin(elapsedSec * 1.45 + this.id * 0.9) * 0.026);
    }
  }

  updateFuse(dt: number, effects?: EffectsPool): { x: number; y: number; attackerId: string } | null {
    if (!this.alive || !this.isPriming) return null;

    this.fuseRemainingSec = Math.max(0, this.fuseRemainingSec - dt);
    const progress = 1 - this.fuseRemainingSec / Math.max(0.01, this.fuseTotalSec);

    if (effects) {
      this.fuseSparkTimer -= dt;
      if (this.fuseSparkTimer <= 0) {
        this.fuseSparkTimer = 0.12;
        effects.spawnTrailPuff(
          this.x + (Math.random() - 0.5) * 14,
          this.y - 10 + (Math.random() - 0.5) * 8,
          0xfef08a,
          0.24
        );
      }
    }

    if (this.warningInner) {
      this.warningInner.setRadius(18 + (BARREL_BLAST_RADIUS - 18) * progress);
    }
    if (this.warningOuter) {
      const pulse = 0.65 + 0.35 * Math.abs(Math.sin(this.fuseRemainingSec * 22));
      this.warningOuter.setAlpha(pulse);
    }
    if (this.sprite.scene) {
      const flash = Math.sin(this.fuseRemainingSec * 28) > 0;
      this.sprite.setTint(flash ? 0xfef08a : 0xef4444);
      const s = 1 + 0.1 * progress;
      this.sprite.setDisplaySize(this.width * s, this.height * s);
    }

    if (this.fuseRemainingSec <= 0) {
      const result = {
        x: this.x,
        y: this.y,
        attackerId: this.primedByAttackerId,
      };
      this.destroy();
      return result;
    }

    return null;
  }

  destroy(): void {
    this.alive = false;
    this.isPriming = false;
    this.hp = 0;
    this.sprite.setVisible(false);
    this.sprite.destroy();
    if (this.waterShimmer) {
      this.waterShimmer.destroy();
      this.waterShimmer = null;
    }
    if (this.crackOverlay) {
      this.crackOverlay.destroy();
      this.crackOverlay = null;
    }
    if (this.warningOuter) {
      this.warningOuter.destroy();
      this.warningOuter = null;
    }
    if (this.warningInner) {
      this.warningInner.destroy();
      this.warningInner = null;
    }
  }
}
