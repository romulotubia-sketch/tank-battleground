import Phaser from 'phaser';
import { GraphicsQuality } from '../../types/game';

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

interface PooledDecal {
  sprite: Phaser.GameObjects.Image;
  life: number;
  maxLife: number;
  startAlpha: number;
  active: boolean;
}

interface PooledFloatingLabel {
  label: Phaser.GameObjects.Text;
  startY: number;
  risePx: number;
  life: number;
  maxLife: number;
  active: boolean;
}

export type DamageIndicatorKind = 'normal' | 'shield' | 'electric' | 'explosion';

export class EffectsPool {
  private puffs: PuffParticle[] = [];
  private rings: BlastRing[] = [];
  private decals: PooledDecal[] = [];
  private labels: PooledFloatingLabel[] = [];
  private lowDetail = false;
  private quality: GraphicsQuality = 'high';

  constructor(scene: Phaser.Scene, qualityOrLowDetail: GraphicsQuality | boolean = 'high') {
    const quality: GraphicsQuality =
      typeof qualityOrLowDetail === 'boolean'
        ? qualityOrLowDetail
          ? 'low'
          : 'high'
        : qualityOrLowDetail;
    this.quality = quality;
    this.lowDetail = quality === 'low';

    const maxPuffs = quality === 'low' ? 45 : quality === 'medium' ? 80 : 120;
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

    const maxRings = 24;
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

    const maxDecals = quality === 'low' ? 16 : quality === 'medium' ? 28 : 48;
    for (let i = 0; i < maxDecals; i++) {
      const sprite = scene.add.image(-200, -200, 'fx_tread');
      sprite.setDepth(3);
      sprite.setVisible(false);
      this.decals.push({
        sprite,
        life: 0,
        maxLife: 1.4,
        startAlpha: 0.4,
        active: false,
      });
    }

    const maxLabels = 24;
    for (let i = 0; i < maxLabels; i++) {
      const label = scene.add
        .text(-200, -200, '', {
          fontFamily: '"Barlow Condensed", sans-serif',
          fontSize: '18px',
          fontStyle: 'bold',
          color: '#F3EFE6',
          stroke: '#141714',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(35)
        .setVisible(false);
      this.labels.push({
        label,
        startY: 0,
        risePx: 32,
        life: 0,
        maxLife: 0.65,
        active: false,
      });
    }
  }

  setGraphicsQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    this.lowDetail = quality === 'low';
  }

  setLowDetail(lowDetail: boolean): void {
    this.quality = lowDetail ? 'low' : 'high';
    this.lowDetail = lowDetail;
  }

  private scaleCount(highCount: number, mediumCount: number, lowCount: number): number {
    if (this.quality === 'low') return lowCount;
    if (this.quality === 'medium') return mediumCount;
    return highCount;
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

  spawnTreadMark(x: number, y: number, hullAngle: number, isHeavy = false): void {
    if (this.lowDetail) return;
    for (const d of this.decals) {
      if (!d.active) {
        d.active = true;
        d.life = 1.4;
        d.maxLife = 1.4;
        d.startAlpha = 0.42;
        d.sprite
          .setTexture('fx_tread')
          .setPosition(x, y)
          .setRotation(hullAngle)
          .setScale(isHeavy ? 1.18 : 0.95)
          .setAlpha(0.42)
          .setVisible(true);
        return;
      }
    }
  }

  spawnScorchMark(x: number, y: number, radius = 48): void {
    if (this.lowDetail) return;
    for (const d of this.decals) {
      if (!d.active) {
        d.active = true;
        d.life = 4.2;
        d.maxLife = 4.2;
        d.startAlpha = 0.65;
        d.sprite
          .setTexture('fx_scorch')
          .setPosition(x, y)
          .setRotation(Math.random() * Math.PI * 2)
          .setScale(Math.max(0.65, radius / 34))
          .setAlpha(0.65)
          .setVisible(true);
        return;
      }
    }
  }

  spawnTrailPuff(x: number, y: number, tint: number, startScale = 0.24): void {
    if (this.lowDetail) return;
    this.spawnPuff(
      x,
      y,
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14,
      tint,
      0.16,
      startScale,
      0.04
    );
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

  spawnElectricMuzzleFlash(x: number, y: number, angle: number): void {
    const count = this.lowDetail ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const spd = 80 + Math.random() * 65;
      this.spawnPuff(
        x,
        y,
        Math.cos(angle + spread) * spd,
        Math.sin(angle + spread) * spd,
        i === 0 ? 0xe0f2fe : 0x22d3ee,
        0.15,
        0.32,
        0.62
      );
    }
  }

  spawnElectricImpact(x: number, y: number): void {
    this.spawnRing(x, y, 30, 0x22d3ee, 0.2);
    const count = this.scaleCount(6, 4, 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 120;
      this.spawnPuff(
        x,
        y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        i % 2 === 0 ? 0x22d3ee : 0xe0f2fe,
        0.24,
        0.3,
        0.05
      );
    }
  }

  spawnEmpPulse(x: number, y: number, maxRadius: number): void {
    this.spawnRing(x, y, maxRadius, 0x22d3ee, 0.4);
    this.spawnRing(x, y, Math.round(maxRadius * 0.62), 0xa5f3fc, 0.28);
    const count = this.scaleCount(12, 8, 6);
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.2;
      const spd = 140 + Math.random() * 110;
      this.spawnPuff(
        x + Math.cos(a) * 16,
        y + Math.sin(a) * 16,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        i % 2 === 0 ? 0x22d3ee : 0xe0f2fe,
        0.32,
        0.34,
        0.08
      );
    }
  }

  spawnPhaseShift(x: number, y: number, entering: boolean): void {
    this.spawnRing(x, y, entering ? 56 : 42, entering ? 0xa78bfa : 0xc4b5fd, entering ? 0.32 : 0.24);
    const count = this.lowDetail ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const spd = (entering ? 85 : 55) + Math.random() * 65;
      this.spawnPuff(
        x + Math.cos(a) * 8,
        y + Math.sin(a) * 8,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        i % 2 === 0 ? 0xa78bfa : 0xddd6fe,
        entering ? 0.28 : 0.2,
        0.3,
        0.06
      );
    }
  }

  spawnLeafRustle(x: number, y: number): void {
    if (this.lowDetail) return;
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 30 + Math.random() * 45;
      this.spawnPuff(
        x + (Math.random() - 0.5) * 12,
        y + (Math.random() - 0.5) * 12,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        i === 0 ? 0x5e9e56 : 0x4a8544,
        0.26,
        0.25,
        0.06
      );
    }
  }

  spawnObstacleDebris(x: number, y: number, kind: 'crate' | 'brick' | 'steel'): void {
    const count =
      kind === 'steel' ? this.scaleCount(4, 3, 2) : this.scaleCount(7, 5, 3);
    const colA = kind === 'crate' ? 0xd97706 : kind === 'brick' ? 0xb45309 : 0xe2e8f0;
    const colB = kind === 'crate' ? 0x92400e : kind === 'brick' ? 0xd6d3d1 : 0x94a3b8;
    if (kind === 'steel') {
      this.spawnRing(x, y, 20, 0xcbd5e1, 0.14);
    }
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 55 + Math.random() * 115;
      this.spawnPuff(
        x,
        y,
        Math.cos(a) * spd,
        Math.sin(a) * spd,
        i % 2 === 0 ? colA : colB,
        0.28,
        kind === 'steel' ? 0.24 : 0.34,
        0.06
      );
    }
  }

  spawnImpact(x: number, y: number, tint = 0xf59e0b): void {
    const count = this.scaleCount(6, 4, 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 110;
      this.spawnPuff(x, y, Math.cos(a) * spd, Math.sin(a) * spd, tint, 0.22, 0.28, 0.05);
    }
  }

  spawnDestruction(x: number, y: number, tint = 0x9ca3af, radius = 64): void {
    this.spawnRing(x, y, radius, tint, 0.34);
    this.spawnScorchMark(x, y, Math.min(72, radius * 0.8));
    const count = this.scaleCount(12, 8, 6);
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

  spawnFloatingLabel(x: number, y: number, text: string, color = '#F3EFE6', fontSize = '17px'): void {
    for (const item of this.labels) {
      if (!item.active) {
        item.active = true;
        item.startY = y - 18;
        item.risePx = 30;
        item.life = 0.65;
        item.maxLife = 0.65;
        item.label
          .setText(text)
          .setColor(color)
          .setFontSize(fontSize)
          .setPosition(x + (Math.random() - 0.5) * 10, item.startY)
          .setAlpha(1)
          .setVisible(true);
        return;
      }
    }
  }

  spawnDamageNumber(x: number, y: number, amount: number, kind: DamageIndicatorKind = 'normal'): void {
    if (amount <= 0) return;
    const prefix = kind === 'shield' ? 'SHD -' : kind === 'electric' ? '⚡ -' : '-';
    const color =
      kind === 'shield'
        ? '#7DD3FC'
        : kind === 'electric'
        ? '#67E8F9'
        : kind === 'explosion'
        ? '#FB923C'
        : '#FEF08A';
    this.spawnFloatingLabel(x, y - 6, `${prefix}${Math.round(amount)}`, color, '16px');
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

    for (const d of this.decals) {
      if (!d.active) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        d.sprite.setVisible(false);
        continue;
      }
      const progress = 1 - d.life / d.maxLife;
      d.sprite.setAlpha(d.startAlpha * (1 - progress));
    }

    for (const item of this.labels) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.label.setVisible(false);
        continue;
      }
      const progress = 1 - item.life / item.maxLife;
      const eased = 1 - Math.pow(1 - progress, 2);
      item.label.setY(item.startY - item.risePx * eased);
      item.label.setAlpha(progress > 0.55 ? (1 - progress) / 0.45 : 1);
    }
  }
}
