import Phaser from 'phaser';
import { POWERUP_DEFINITIONS, POWERUP_IDS } from '../data/powerups';
import { TANK_LIST } from '../data/tanks';
import { TankDefinition } from '../types/game';

/**
 * Asset Replacement Registry
 * Allows dropping in custom image paths later to override procedural textures.
 */
export interface AssetOverrideMap {
  [textureKey: string]: string;
}

const ASSET_OVERRIDES: AssetOverrideMap = {};

export function registerAssetOverride(textureKey: string, url: string): void {
  ASSET_OVERRIDES[textureKey] = url;
}

export function getAssetOverrides(): AssetOverrideMap {
  return ASSET_OVERRIDES;
}

const INK = '#161815';

function drawInkRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  radius = 4,
  lineWidth = 3
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function makeCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, width, height);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx, width, height);
  tex.refresh();
}

function drawTankHull(ctx: CanvasRenderingContext2D, tank: TankDefinition) {
  const { visual } = tank;
  const cx = 40;
  const cy = 40;

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.roundRect(cx - 23, cy - 20, 50, 44, 8);
  ctx.fill();

  const treadW = visual.silhouette === 'heavy' ? 54 : visual.silhouette === 'sleek' ? 46 : 50;
  const treadH = visual.silhouette === 'heavy' ? 12 : 9;
  const treadOffset = visual.silhouette === 'heavy' ? 17 : 15;

  // Left & Right treads
  for (const side of [-1, 1]) {
    const ty = cy + side * treadOffset - treadH / 2;
    drawInkRect(ctx, cx - treadW / 2, ty, treadW, treadH, visual.treadColor, 4, 2.5);
    ctx.strokeStyle = '#4B5049';
    ctx.lineWidth = 1.5;
    for (let tx = cx - treadW / 2 + 6; tx < cx + treadW / 2 - 4; tx += 7) {
      ctx.beginPath();
      ctx.moveTo(tx, ty + 1.5);
      ctx.lineTo(tx, ty + treadH - 1.5);
      ctx.stroke();
    }
  }

  // Main Hull shape based on silhouette
  if (visual.silhouette === 'angular') {
    ctx.beginPath();
    ctx.moveTo(cx + 25, cy);
    ctx.lineTo(cx + 12, cy - 17);
    ctx.lineTo(cx - 22, cy - 15);
    ctx.lineTo(cx - 18, cy);
    ctx.lineTo(cx - 22, cy + 15);
    ctx.lineTo(cx + 12, cy + 17);
    ctx.closePath();
    ctx.fillStyle = visual.hullPrimary;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  } else {
    const hw = visual.silhouette === 'heavy' ? 48 : visual.silhouette === 'sleek' ? 44 : 46;
    const hh = visual.silhouette === 'heavy' ? 32 : visual.silhouette === 'sleek' ? 24 : 28;
    drawInkRect(ctx, cx - hw / 2, cy - hh / 2, hw, hh, visual.hullPrimary, 7, 3);
    drawInkRect(
      ctx,
      cx - hw / 2 + 6,
      cy - hh / 2 + 5,
      hw - 16,
      hh - 10,
      visual.hullSecondary,
      4,
      2
    );
  }

  // Front visor / accent stripe
  ctx.fillStyle = visual.accentColor;
  ctx.beginPath();
  ctx.roundRect(cx + 11, cy - 8, 6, 16, 2);
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function drawTankTurret(ctx: CanvasRenderingContext2D, tank: TankDefinition) {
  const { visual } = tank;
  const cx = 36; // pivot slightly left so long barrel fits in 96x64
  const cy = 32;

  // Barrel(s)
  if (visual.silhouette === 'heavy') {
    drawInkRect(ctx, cx + 6, cy - 6, 30, 12, visual.hullSecondary, 3, 2.5);
    drawInkRect(ctx, cx + 31, cy - 7, 7, 14, visual.accentColor, 2, 2);
  } else if (visual.silhouette === 'long_barrel') {
    drawInkRect(ctx, cx + 8, cy - 4, 44, 8, visual.hullSecondary, 2, 2.5);
    drawInkRect(ctx, cx + 46, cy - 5.5, 8, 11, visual.accentColor, 2, 2);
  } else if (visual.silhouette === 'coil') {
    drawInkRect(ctx, cx + 8, cy - 5, 28, 10, visual.hullSecondary, 3, 2.5);
    // Tesla coils
    for (const ox of [18, 25, 32]) {
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy - 7);
      ctx.lineTo(cx + ox, cy + 7);
      ctx.lineWidth = 3;
      ctx.strokeStyle = visual.accentColor;
      ctx.stroke();
    }
  } else if (visual.silhouette === 'sleek') {
    drawInkRect(ctx, cx + 6, cy - 3.5, 29, 7, visual.hullSecondary, 2, 2.5);
  } else if (visual.silhouette === 'angular') {
    drawInkRect(ctx, cx + 6, cy - 3.5, 32, 7, visual.hullSecondary, 2, 2.5);
  } else {
    // Balanced assault cannon
    drawInkRect(ctx, cx + 6, cy - 4.5, 33, 9, visual.hullSecondary, 3, 2.5);
    drawInkRect(ctx, cx + 34, cy - 5.5, 6, 11, visual.accentColor, 2, 2);
  }

  // Turret dome
  const radius = visual.silhouette === 'heavy' ? 16 : visual.silhouette === 'sleek' ? 12 : 14;
  ctx.beginPath();
  if (visual.silhouette === 'angular') {
    ctx.moveTo(cx + 15, cy);
    ctx.lineTo(cx + 2, cy - 13);
    ctx.lineTo(cx - 14, cy - 9);
    ctx.lineTo(cx - 14, cy + 9);
    ctx.lineTo(cx + 2, cy + 13);
    ctx.closePath();
  } else {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  }
  ctx.fillStyle = visual.turretColor;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // Hatch detail
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = visual.hullSecondary;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

export function ensureProceduralTextures(scene: Phaser.Scene): void {
  // 1. All 6 Tank hulls and turrets
  for (const tank of TANK_LIST) {
    makeCanvasTexture(scene, `tank_hull_${tank.id}`, 80, 80, (ctx) => drawTankHull(ctx, tank));
    makeCanvasTexture(scene, `tank_turret_${tank.id}`, 96, 64, (ctx) =>
      drawTankTurret(ctx, tank)
    );
  }

  // 2. Obstacles (brick, steel, crate, bush, water, barrel)
  makeCanvasTexture(scene, 'obs_brick', 64, 64, (ctx, w, h) => {
    drawInkRect(ctx, 2, 2, w - 4, h - 4, '#A84B36', 4, 3);
    ctx.strokeStyle = '#D9C5B2';
    ctx.lineWidth = 2;
    for (const rowY of [16, 32, 48]) {
      ctx.beginPath();
      ctx.moveTo(4, rowY);
      ctx.lineTo(w - 4, rowY);
      ctx.stroke();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    for (const [x, y] of [
      [22, 4],
      [44, 4],
      [14, 16],
      [38, 16],
      [24, 32],
      [48, 32],
      [16, 48],
      [40, 48],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 14);
      ctx.stroke();
    }
  });

  makeCanvasTexture(scene, 'obs_steel', 64, 64, (ctx, w, h) => {
    drawInkRect(ctx, 2, 2, w - 4, h - 4, '#646D75', 5, 3);
    drawInkRect(ctx, 8, 8, w - 16, h - 16, '#7C868F', 3, 2);
    // Diagonal steel shine
    ctx.strokeStyle = '#B8C2CC';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(14, 24);
    ctx.lineTo(24, 14);
    ctx.moveTo(14, 38);
    ctx.lineTo(38, 14);
    ctx.stroke();
    // Rivets
    ctx.fillStyle = INK;
    for (const [rx, ry] of [
      [12, 12],
      [w - 12, 12],
      [12, h - 12],
      [w - 12, h - 12],
    ]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  makeCanvasTexture(scene, 'obs_crate', 64, 64, (ctx, w, h) => {
    drawInkRect(ctx, 2, 2, w - 4, h - 4, '#B57B42', 4, 3);
    drawInkRect(ctx, 9, 9, w - 18, h - 18, '#CC9256', 2, 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(w - 10, h - 10);
    ctx.moveTo(w - 10, 10);
    ctx.lineTo(10, h - 10);
    ctx.stroke();
  });

  makeCanvasTexture(scene, 'obs_bush', 96, 96, (ctx) => {
    const blobs = [
      [48, 48, 28, '#3B6E38'],
      [30, 40, 20, '#4A8544'],
      [64, 42, 21, '#4A8544'],
      [40, 62, 20, '#366533'],
      [58, 60, 19, '#53944C'],
      [48, 34, 18, '#5E9E56'],
    ] as const;
    for (const [bx, by, br, col] of blobs) {
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  });

  makeCanvasTexture(scene, 'obs_water', 128, 96, (ctx, w, h) => {
    ctx.beginPath();
    ctx.roundRect(3, 3, w - 6, h - 6, 22);
    ctx.fillStyle = '#387D9C';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1E4659';
    ctx.stroke();

    // Inner shallow highlight + hand-drawn ripples
    ctx.beginPath();
    ctx.roundRect(10, 10, w - 20, h - 20, 16);
    ctx.fillStyle = '#4B95B5';
    ctx.fill();

    ctx.strokeStyle = '#CBEAF7';
    ctx.lineWidth = 2.2;
    for (const [rx, ry, rw] of [
      [28, 30, 28],
      [68, 46, 32],
      [38, 64, 24],
    ]) {
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.quadraticCurveTo(rx + rw / 2, ry - 4, rx + rw, ry);
      ctx.stroke();
    }
  });

  makeCanvasTexture(scene, 'obs_barrel', 48, 48, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(26, 26, 17, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(24, 24, 17, 0, Math.PI * 2);
    ctx.fillStyle = '#C93A2B';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // Hazard stripe & cap
    ctx.beginPath();
    ctx.arc(24, 24, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#F59E0B';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(24, 24, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  });

  // 3. Projectiles
  makeCanvasTexture(scene, 'proj_standard', 24, 16, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(12, 8, 9, 5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FCD34D';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });

  makeCanvasTexture(scene, 'proj_heavy', 28, 20, (ctx) => {
    ctx.beginPath();
    ctx.ellipse(14, 10, 11, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });

  makeCanvasTexture(scene, 'proj_pierce', 30, 16, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(27, 8);
    ctx.lineTo(6, 2);
    ctx.lineTo(10, 8);
    ctx.lineTo(6, 14);
    ctx.closePath();
    ctx.fillStyle = '#C084FC';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });

  makeCanvasTexture(scene, 'proj_electric', 24, 18, (ctx) => {
    ctx.beginPath();
    ctx.arc(12, 9, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#22D3EE';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });

  makeCanvasTexture(scene, 'proj_artillery', 32, 20, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(29, 10);
    ctx.lineTo(14, 3);
    ctx.lineTo(4, 5);
    ctx.lineTo(4, 15);
    ctx.lineTo(14, 17);
    ctx.closePath();
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(18, 10, 5, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FCD34D';
    ctx.fill();
  });

  // 4. Proximity Mine
  makeCanvasTexture(scene, 'entity_mine', 34, 34, (ctx) => {
    ctx.beginPath();
    ctx.arc(17, 17, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#3B3F3A';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(17, 17, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#F97316';
    ctx.fill();
  });

  // 5. Powerup icons
  for (const id of POWERUP_IDS) {
    const def = POWERUP_DEFINITIONS[id];
    makeCanvasTexture(scene, `pwr_${id}`, 44, 44, (ctx) => {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.roundRect(5, 7, 36, 36, 10);
      ctx.fill();

      drawInkRect(ctx, 4, 4, 36, 36, def.color, 9, 2.8);
      drawInkRect(ctx, 8, 8, 28, 28, def.accent, 6, 1.5);

      ctx.fillStyle = INK;
      ctx.font = 'bold 11px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.shortLabel, 22, 23);
    });
  }

  // 6. Soft smoke/spark circle particle
  makeCanvasTexture(scene, 'fx_puff', 32, 32, (ctx) => {
    ctx.beginPath();
    ctx.arc(16, 16, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });
}
