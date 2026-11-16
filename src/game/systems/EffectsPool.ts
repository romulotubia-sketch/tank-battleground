import Phaser from 'phaser';

interface PuffParticle {
  sprite: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  startScale: number;
  endScale: number;
  active: boolean;
}

interface BlastRing {
  graphics: Phaser.GameObjects.Arc;
  life: number;
  maxLife: number;
  maxRadius: number;
  active: boolean;
}

export class EffectsPool {
  private scene: Phaser.Scene;
  private puffs: PuffParticle[] = [];
  private rings: BlastRing[] = [];
  private lowDetail = false;

  constructor(scene: Phaser.Scene, lowDetail = false) {
    this.scene = scene;
    this.lowDetail = lowDetail;

    const maxPuffs = lowDetail ? 40 : 90;
    for (let i = 0; i < maxPuffs; i++) {
      const sprite = scene.add.image(-200, -200, 'fx_puff');
      sprite.setDepth(28);
      sprite.setVisible(false);
      this.puffs.push({
        sprite,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0.3,
        startScale: 0.4,
        endScale: 1,
        active: false,
      });
    }

    const maxRings = 16;
    for (let i = 0; i < maxRings; i++) {
      const graphics = scene.add.circle(-200, -200, 10, 0xf59e0b, 0);
      graphics.setStrokeStyle(4, 0xf59e0b, 1);
      graphics.setDepth(27);
      graphics.setVisible(false);
      this.rings.push({
        graphics,
        life: 0,
        maxLife: 0.35,
        maxRadius: 80,
        active: false,
      });
    }
  }

  setLowDetail(lowDetail: boolean): void {
    this.lowDetail = lowDetail;
  }

  private spawnPuff(
    x: number,
    y: number,
    vx: number,
    vy: number,
    tint: number,
    life: number,
    startScale: number,
    endScale: number
  ): void {
    for (const p of this.puffs) {
      if (!p.active) {
        p.active = true;
        p.vx = vx;
        p.vy = vy;
        p.life = life;
        p.maxLife = life;
        p.startScale = startScale;
        p.endScale = endScale;
        p.sprite.setPosition(x, y);
        p.sprite.setTint(tint);
        p.sprite.setAlpha(0.9);
        p.sprite.setScale(startScale);
        p.sprite.setVisible(true);
        return;
      }
    }
  }

  spawnRing(x: number, y: number, maxRadius: number, color = 0xf59e0b, duration = 0.32): void {
    for (const r of this.rings) {
      if (!r.active) {
        r.active = true;
        r.life = duration;
        r.maxLife = duration;
        r.maxRadius = maxRadius;
        r.graphics.setPosition(x, y);
        r.graphics.setRadius(10);
        r.graphics.setStrokeStyle(4, color, 1);
        r.graphics.setFillStyle(color, 0.16);
        r.graphics.setAlpha(1);
        r.graphics.setVisible(true);
        return;
      }
    }
  }

  spawnMuzzleFlash(x: number, y: number, angle: number): void {
    const count = this.lowDetail ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.4;
      const spd = 70 + Math.random() * 50;
      this.spawnPuff(
        x,
        y,
        Math.cos(angle + spread) * spd,
        Math.sin(angle + spread) * spd,
        0xfef08a,
        0.13,
        0.35,
        0.7
      );
    }
  }

  spawnImpact(x: number, y: number, tint = 0xf59e0b): void {
    const count = this.lowDetail ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 110;
      this.spawnPuff(x, y, Math.cos(a) * spd, Math.sin(a) * spd, tint, 0.22, 0.28, 0.05);
    }
  }

  spawnDestruction(x: number, y: number, tint = 0x9ca3af, radius = 64): void {
    this.spawnRing(x, y, radius, tint, 0.34);
    const count = this.lowDetail ? 6 : 12;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const spd = 70 + Math.random() * 140;
      this.spawnPuff(
        x,
        y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        i % 2 === 0 ? tint : 0x292524,
        0.38,
        0.48,
        0.15
      );
    }
  }

  spawnTreadDust(x: number, y: number): void {
    if (this.lowDetail) return;
    this.spawnPuff(
      x + (Math.random() - 0.5) * 10,
      y + (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 18,
      0xa89f8d,
      0.28,
      0.22,
      0.55
    );
  }

  spawnAfterburnerExhaust(x: number, y: number, hullAngle: number, burst = false): void {
    if (this.lowDetail && !burst) return;
    const count = burst ? (this.lowDetail ? 2 : 4) : 1;
    const backAngle = hullAngle + Math.PI;
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.55;
      const spd = (burst ? 110 : 85) + Math.random() * 55;
      this.spawnPuff(
        x + (Math.random() - 0.5) * 6,
        y + (Math.random() - 0.5) * 6,
        Math.cos(backAngle + spread) * spd,
        Math.sin(backAngle + spread) * spd,
        i % 2 === 0 ? 0xfacc15 : 0xf97316,
        burst ? 0.24 : 0.16,
        burst ? 0.34 : 0.26,
        0.06
      );
    }
  }

  spawnFloatingLabel(x: number, y: number, text: string, color = '#F3EFE6'): void {
    const label = this.scene.add
      .text(x, y - 18, text, {
        fontFamily: '"Barlow Condensed", sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color,
        stroke: '#141714',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(35);

    this.scene.tweens.add({
      targets: label,
      y: y - 50,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  update(dt: number): void {
    for (const p of this.puffs) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.sprite.setVisible(false);
        continue;
      }
      const progress = 1 - p.life / p.maxLife;
      p.sprite.x += p.vx * dt;
      p.sprite.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.sprite.setScale(Phaser.Math.Linear(p.startScale, p.endScale, progress));
      p.sprite.setAlpha(1 - progress);
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        r.graphics.setVisible(false);
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      r.graphics.setRadius(Phaser.Math.Linear(12, r.maxRadius, progress));
      r.graphics.setAlpha(1 - progress);
    }
  }
}
