import Phaser from 'phaser';
import { ObstaclePlacement, ObstacleType } from '../../types/game';

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
  readonly sprite: Phaser.GameObjects.Image;
  private crackOverlay: Phaser.GameObjects.Graphics | null = null;

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
    return (
      px >= this.left - padding &&
      px <= this.right + padding &&
      py >= this.top - padding &&
      py <= this.bottom + padding
    );
  }

  damage(amount: number, scene: Phaser.Scene): boolean {
    if (!this.alive || !this.destructible) return false;
    this.hp -= amount;

    // Visual flash
    this.sprite.setTint(0xffdddd);
    scene.time.delayedCall(65, () => {
      if (this.alive) this.sprite.clearTint();
    });

    if (this.hp <= 0) {
      this.destroy();
      return true;
    }

    // Draw damage cracks on brick/crate
    if (!this.crackOverlay && this.hp < this.maxHp * 0.65) {
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

    return false;
  }

  destroy(): void {
    this.alive = false;
    this.sprite.setVisible(false);
    this.sprite.destroy();
    if (this.crackOverlay) {
      this.crackOverlay.destroy();
      this.crackOverlay = null;
    }
  }
}
