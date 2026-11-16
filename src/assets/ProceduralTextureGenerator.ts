import Phaser from 'phaser';
import { drawCanvasDecal } from '../components/TankDecalRenderer';
import { getCustomizationSignature, resolveEffectiveTankVisual } from '../data/customization';
import { POWERUP_DEFINITIONS, POWERUP_IDS } from '../data/powerups';
import { getEffectiveTankVisual } from '../data/progression';
import { TANK_DEFINITIONS, TANK_LIST } from '../data/tanks';
import { CosmeticId, TankCustomization, TankDefinition, TankId, TankVisualConfig } from '../types/game';

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

function drawTankHull(
  ctx: CanvasRenderingContext2D,
  tank: TankDefinition,
  visualOverride?: TankVisualConfig,
  customization?: TankCustomization | null
) {
  const visual = visualOverride ?? tank.visual;
  const cx = 40;
  const cy = 40;

  // Ground drop shadow scaled to chassis footprint
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.roundRect(
    cx - (visual.silhouette === 'heavy' ? 25 : 23),
    cy - (visual.silhouette === 'heavy' ? 22 : 19),
    visual.silhouette === 'heavy' ? 54 : 50,
    visual.silhouette === 'heavy' ? 48 : 42,
    8
  );
  ctx.fill();

  const treadW =
    visual.silhouette === 'heavy'
      ? 56
      : visual.silhouette === 'sleek'
      ? 46
      : visual.silhouette === 'long_barrel'
      ? 52
      : 50;
  const treadH = visual.silhouette === 'heavy' ? 12.5 : visual.silhouette === 'sleek' ? 8 : 9.5;
  const treadOffset = visual.silhouette === 'heavy' ? 17.5 : visual.silhouette === 'sleek' ? 14 : 15;

  // Left & Right treads with detailed track links
  for (const side of [-1, 1]) {
    const ty = cy + side * treadOffset - treadH / 2;
    drawInkRect(ctx, cx - treadW / 2, ty, treadW, treadH, visual.treadColor, 3.5, 2.5);
    ctx.strokeStyle = '#4B5049';
    ctx.lineWidth = 1.5;
    for (let tx = cx - treadW / 2 + 5; tx < cx + treadW / 2 - 4; tx += 6.5) {
      ctx.beginPath();
      ctx.moveTo(tx, ty + 1.5);
      ctx.lineTo(tx, ty + treadH - 1.5);
      ctx.stroke();
    }
  }

  // Distinct chassis silhouettes
  if (visual.silhouette === 'angular') {
    // Phantom: faceted stealth arrowhead hull
    ctx.beginPath();
    ctx.moveTo(cx + 26, cy);
    ctx.lineTo(cx + 12, cy - 17);
    ctx.lineTo(cx - 22, cy - 15);
    ctx.lineTo(cx - 17, cy);
    ctx.lineTo(cx - 22, cy + 15);
    ctx.lineTo(cx + 12, cy + 17);
    ctx.closePath();
    ctx.fillStyle = visual.hullPrimary;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // Inner stealth armor facet & seam lines
    ctx.beginPath();
    ctx.moveTo(cx + 18, cy);
    ctx.lineTo(cx + 7, cy - 11);
    ctx.lineTo(cx - 15, cy - 9);
    ctx.lineTo(cx - 12, cy);
    ctx.lineTo(cx - 15, cy + 9);
    ctx.lineTo(cx + 7, cy + 11);
    ctx.closePath();
    ctx.fillStyle = visual.hullSecondary;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // Rear recessed stealth vents
    drawInkRect(ctx, cx - 17, cy - 7, 5, 4, '#1B1822', 1, 1.2);
    drawInkRect(ctx, cx - 17, cy + 3, 5, 4, '#1B1822', 1, 1.2);
  } else if (visual.silhouette === 'sleek') {
    // Scout: tapered lightweight wedge nose
    ctx.beginPath();
    ctx.moveTo(cx + 23, cy - 8);
    ctx.lineTo(cx + 23, cy + 8);
    ctx.lineTo(cx + 6, cy + 12);
    ctx.lineTo(cx - 22, cy + 12);
    ctx.lineTo(cx - 22, cy - 12);
    ctx.lineTo(cx + 6, cy - 12);
    ctx.closePath();
    ctx.fillStyle = visual.hullPrimary;
    ctx.fill();
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = INK;
    ctx.stroke();

    drawInkRect(ctx, cx - 17, cy - 8, 28, 16, visual.hullSecondary, 4, 1.8);
    // Twin rear turbine exhaust ports
    drawInkRect(ctx, cx - 22, cy - 7, 4, 5, '#2A2520', 1, 1.4);
    drawInkRect(ctx, cx - 22, cy + 2, 4, 5, '#2A2520', 1, 1.4);
  } else if (visual.silhouette === 'heavy') {
    // Fortress: wide composite armor + side reactive armor skirts
    drawInkRect(ctx, cx - 25, cy - 17, 50, 34, visual.hullPrimary, 6, 3);
    drawInkRect(ctx, cx - 19, cy - 12, 34, 24, visual.hullSecondary, 4, 2);
    // Side reactive armor blocks
    for (const side of [-1, 1]) {
      for (const ox of [-14, -2, 10]) {
        drawInkRect(ctx, cx + ox, cy + side * 14 - 2.5, 9, 5, visual.hullSecondary, 1.5, 1.6);
      }
    }
    // Dual shield capacitor nodes
    drawInkRect(ctx, cx - 23, cy - 9, 5, 6, visual.accentColor, 1.5, 1.4);
    drawInkRect(ctx, cx - 23, cy + 3, 5, 6, visual.accentColor, 1.5, 1.4);
  } else if (visual.silhouette === 'long_barrel') {
    // Artillery: broad stabilized hull + rear recoil spades
    drawInkRect(ctx, cx - 25, cy - 13, 6, 6, '#3B342C', 1.5, 1.8);
    drawInkRect(ctx, cx - 25, cy + 7, 6, 6, '#3B342C', 1.5, 1.8);
    drawInkRect(ctx, cx - 23, cy - 15, 46, 30, visual.hullPrimary, 6, 3);
    drawInkRect(ctx, cx - 17, cy - 10, 31, 20, visual.hullSecondary, 3, 2);
    // Rear shell rack detail
    for (const ry of [-6, 0, 6]) {
      drawInkRect(ctx, cx - 20, cy + ry - 2, 6, 4, visual.accentColor, 1, 1.2);
    }
  } else if (visual.silhouette === 'coil') {
    // Tesla: insulated chassis with glowing flank capacitor cells
    drawInkRect(ctx, cx - 23, cy - 14.5, 46, 29, visual.hullPrimary, 7, 3);
    drawInkRect(ctx, cx - 17, cy - 9.5, 31, 19, visual.hullSecondary, 4, 2);
    for (const side of [-1, 1]) {
      drawInkRect(ctx, cx - 12, cy + side * 12.5 - 3, 22, 6, visual.accentColor, 2, 1.6);
    }
  } else {
    // Assault: balanced frontline armor + rear engine grille
    drawInkRect(ctx, cx - 23, cy - 14.5, 46, 29, visual.hullPrimary, 7, 3);
    drawInkRect(ctx, cx - 16, cy - 9.5, 30, 19, visual.hullSecondary, 4, 2);
    // Engine deck louvers
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    for (const lx of [-13, -9, -5]) {
      ctx.beginPath();
      ctx.moveTo(cx + lx, cy - 6);
      ctx.lineTo(cx + lx, cy + 6);
      ctx.stroke();
    }
  }

  // Front glacis visor / accent stripe
  ctx.fillStyle = visual.accentColor;
  ctx.beginPath();
  ctx.roundRect(cx + 12, cy - 7, 5.5, 14, 2);
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = INK;
  ctx.stroke();

  if (customization && customization.decalId !== 'none') {
    drawCanvasDecal(
      ctx,
      cx,
      cy,
      customization.decalId,
      customization.decalColor,
      customization.decalPosition,
      visual.silhouette,
      'hull',
      0.92
    );
  }
}

function drawTankTurret(
  ctx: CanvasRenderingContext2D,
  tank: TankDefinition,
  visualOverride?: TankVisualConfig,
  customization?: TankCustomization | null
) {
  const visual = visualOverride ?? tank.visual;
  const barrelColor = visual.barrelColor ?? visual.hullSecondary;
  const cx = 36; // pivot slightly left so long barrel fits in 96x64
  const cy = 32;

  // Barrel(s)
  if (visual.silhouette === 'heavy') {
    // Fortress heavy cannon + twin recoil collar
    drawInkRect(ctx, cx + 6, cy - 7.5, 12, 15, visual.hullPrimary, 3, 2.2);
    drawInkRect(ctx, cx + 10, cy - 5.5, 27, 11, barrelColor, 2.5, 2.5);
    drawInkRect(ctx, cx + 32, cy - 7, 7.5, 14, visual.accentColor, 2, 2);
  } else if (visual.silhouette === 'long_barrel') {
    // Artillery extra-long rifled siege barrel + slotted muzzle brake
    drawInkRect(ctx, cx + 7, cy - 6.5, 14, 13, visual.hullPrimary, 3, 2.2);
    drawInkRect(ctx, cx + 12, cy - 4, 41, 8, barrelColor, 2, 2.5);
    drawInkRect(ctx, cx + 48, cy - 6, 8, 12, visual.accentColor, 2, 2);
  } else if (visual.silhouette === 'coil') {
    drawInkRect(ctx, cx + 8, cy - 5, 29, 10, barrelColor, 3, 2.5);
    // Emitter prongs at muzzle
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(cx + 33, cy - 4);
    ctx.lineTo(cx + 43, cy - 8.5);
    ctx.moveTo(cx + 33, cy + 4);
    ctx.lineTo(cx + 43, cy + 8.5);
    ctx.stroke();
    ctx.strokeStyle = visual.accentColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(cx + 33, cy - 4);
    ctx.lineTo(cx + 43, cy - 8.5);
    ctx.moveTo(cx + 33, cy + 4);
    ctx.lineTo(cx + 43, cy + 8.5);
    ctx.stroke();
    // Tesla induction coils along barrel
    for (const ox of [15, 22, 29]) {
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy - 8);
      ctx.lineTo(cx + ox, cy + 8);
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = visual.accentColor;
      ctx.stroke();
    }
  } else if (visual.silhouette === 'sleek') {
    drawInkRect(ctx, cx + 6, cy - 3.5, 29, 7, barrelColor, 2, 2.5);
    drawInkRect(ctx, cx + 31, cy - 4.5, 5, 9, visual.accentColor, 1.5, 1.8);
  } else if (visual.silhouette === 'angular') {
    drawInkRect(ctx, cx + 6, cy - 3.5, 32, 7, barrelColor, 2, 2.5);
    drawInkRect(ctx, cx + 33, cy - 4.5, 6, 9, visual.accentColor, 2, 2);
  } else {
    // Assault balanced cannon + coaxial barrel stub
    drawInkRect(ctx, cx + 10, cy + 4, 15, 3.5, '#2A2F26', 1, 1.4);
    drawInkRect(ctx, cx + 6, cy - 4.5, 33, 9, barrelColor, 3, 2.5);
    drawInkRect(ctx, cx + 34, cy - 5.5, 6, 11, visual.accentColor, 2, 2);
  }

  // Turret dome
  const radius = visual.silhouette === 'heavy' ? 16.5 : visual.silhouette === 'sleek' ? 12 : 14;
  ctx.beginPath();
  if (visual.silhouette === 'angular') {
    ctx.moveTo(cx + 15, cy);
    ctx.lineTo(cx + 2, cy - 13);
    ctx.lineTo(cx - 14, cy - 9);
    ctx.lineTo(cx - 14, cy + 9);
    ctx.lineTo(cx + 2, cy + 13);
    ctx.closePath();
  } else if (visual.silhouette === 'heavy') {
    // Chamfered octagon fortress turret
    ctx.moveTo(cx + 16, cy - 8);
    ctx.lineTo(cx + 16, cy + 8);
    ctx.lineTo(cx + 6, cy + 16);
    ctx.lineTo(cx - 11, cy + 15);
    ctx.lineTo(cx - 16, cy + 8);
    ctx.lineTo(cx - 16, cy - 8);
    ctx.lineTo(cx - 11, cy - 15);
    ctx.lineTo(cx + 6, cy - 16);
    ctx.closePath();
  } else {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  }
  ctx.fillStyle = visual.turretColor;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // Rear radio antenna for Scout
  if (visual.silhouette === 'sleek') {
    ctx.strokeStyle = visual.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - 6);
    ctx.lineTo(cx - 18, cy - 12);
    ctx.stroke();
  }

  // Hatch / coil cap detail
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 2, 5, 0, Math.PI * 2);
  ctx.fillStyle =
    visual.silhouette === 'coil' || visual.silhouette === 'angular'
      ? visual.accentColor
      : visual.hullSecondary;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();

  if (customization && customization.decalId !== 'none') {
    drawCanvasDecal(
      ctx,
      cx,
      cy,
      customization.decalId,
      customization.decalColor,
      customization.decalPosition,
      visual.silhouette,
      'turret',
      0.92
    );
  }
}

export function ensurePlayerTankTextures(
  scene: Phaser.Scene,
  tankId: TankId,
  cosmeticId: CosmeticId = 'default',
  customization?: TankCustomization | null
): { hullKey: string; turretKey: string } {
  const tank = TANK_DEFINITIONS[tankId] || TANK_LIST[0];
  if (!customization && cosmeticId === 'default') {
    return {
      hullKey: `tank_hull_${tank.id}`,
      turretKey: `tank_turret_${tank.id}`,
    };
  }

  const sig = getCustomizationSignature(tank.id, cosmeticId, customization);
  const hullKey = `tank_hull_${sig}`;
  const turretKey = `tank_turret_${sig}`;
  const visual = resolveEffectiveTankVisual(tank, cosmeticId, customization);

  makeCanvasTexture(scene, hullKey, 80, 80, (ctx) =>
    drawTankHull(ctx, tank, visual, customization)
  );
  makeCanvasTexture(scene, turretKey, 96, 64, (ctx) =>
    drawTankTurret(ctx, tank, visual, customization)
  );

  return { hullKey, turretKey };
}

export function ensureProceduralTextures(
  scene: Phaser.Scene,
  playerCosmeticId: CosmeticId = 'default'
): void {
  // 1. All 6 Tank hulls and turrets (plus cosmetic variant if equipped)
  for (const tank of TANK_LIST) {
    makeCanvasTexture(scene, `tank_hull_${tank.id}`, 80, 80, (ctx) => drawTankHull(ctx, tank));
    makeCanvasTexture(scene, `tank_turret_${tank.id}`, 96, 64, (ctx) =>
      drawTankTurret(ctx, tank)
    );
    if (playerCosmeticId !== 'default') {
      const cosmeticVisual = getEffectiveTankVisual(tank, playerCosmeticId);
      makeCanvasTexture(scene, `tank_hull_${tank.id}_${playerCosmeticId}`, 80, 80, (ctx) =>
        drawTankHull(ctx, tank, cosmeticVisual)
      );
      makeCanvasTexture(scene, `tank_turret_${tank.id}_${playerCosmeticId}`, 96, 64, (ctx) =>
        drawTankTurret(ctx, tank, cosmeticVisual)
      );
    }
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

  // 3. Projectiles with clear directional silhouette
  makeCanvasTexture(scene, 'proj_standard', 26, 16, (ctx) => {
    // Hot tracer tail
    ctx.fillStyle = 'rgba(254, 240, 138, 0.5)';
    ctx.beginPath();
    ctx.ellipse(7, 8, 5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(23, 8);
    ctx.lineTo(12, 3);
    ctx.lineTo(5, 4);
    ctx.lineTo(5, 12);
    ctx.lineTo(12, 13);
    ctx.closePath();
    ctx.fillStyle = '#FCD34D';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });

  makeCanvasTexture(scene, 'proj_heavy', 30, 20, (ctx) => {
    ctx.fillStyle = 'rgba(251, 146, 60, 0.45)';
    ctx.beginPath();
    ctx.ellipse(8, 10, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(27, 10);
    ctx.lineTo(15, 3);
    ctx.lineTo(5, 5);
    ctx.lineTo(5, 15);
    ctx.lineTo(15, 17);
    ctx.closePath();
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(16, 10, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FDE047';
    ctx.fill();
  });

  makeCanvasTexture(scene, 'proj_pierce', 32, 18, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(29, 9);
    ctx.lineTo(6, 2);
    ctx.lineTo(11, 9);
    ctx.lineTo(6, 16);
    ctx.closePath();
    ctx.fillStyle = '#C084FC';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = INK;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(24, 9);
    ctx.lineTo(12, 9);
    ctx.strokeStyle = '#F3E8FF';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  makeCanvasTexture(scene, 'proj_electric', 30, 22, (ctx) => {
    // Outer electric aura
    ctx.beginPath();
    ctx.ellipse(15, 11, 11, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.fill();

    // Electric plasma orb
    ctx.beginPath();
    ctx.ellipse(15, 11, 8.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#22D3EE';
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    ctx.stroke();

    // Bright arc core
    ctx.beginPath();
    ctx.ellipse(16, 11, 4.2, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ECFEFF';
    ctx.fill();

    // Trailing arc crackle
    ctx.strokeStyle = '#A5F3FC';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(3, 8);
    ctx.lineTo(7, 11);
    ctx.lineTo(4, 14);
    ctx.stroke();
  });

  makeCanvasTexture(scene, 'proj_artillery', 34, 22, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(31, 11);
    ctx.lineTo(16, 3);
    ctx.lineTo(4, 5);
    ctx.lineTo(4, 17);
    ctx.lineTo(16, 19);
    ctx.closePath();
    ctx.fillStyle = '#EF4444';
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(19, 11, 5.5, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FCD34D';
    ctx.fill();
  });

  // 4. Proximity Mine
  makeCanvasTexture(scene, 'entity_mine', 38, 38, (ctx) => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.moveTo(19 + Math.cos(a) * 11, 19 + Math.sin(a) * 11);
      ctx.lineTo(19 + Math.cos(a) * 16.5, 19 + Math.sin(a) * 16.5);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(19, 19, 12.5, 0, Math.PI * 2);
    ctx.fillStyle = '#333834';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(19, 19, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = '#F97316';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(19, 19, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FEF08A';
    ctx.fill();
  });

  // 5. Powerup icons with distinct emblems + short labels
  for (const id of POWERUP_IDS) {
    const def = POWERUP_DEFINITIONS[id];
    makeCanvasTexture(scene, `pwr_${id}`, 48, 48, (ctx) => {
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.beginPath();
      ctx.roundRect(5, 7, 38, 38, 10);
      ctx.fill();

      drawInkRect(ctx, 4, 4, 38, 38, def.color, 9, 2.8);
      drawInkRect(ctx, 8, 8, 30, 30, def.accent, 6, 1.5);

      ctx.save();
      ctx.strokeStyle = def.color;
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 2.5;
      if (id === 'repair_kit') {
        ctx.fillRect(20, 12, 6, 22);
        ctx.fillRect(12, 20, 22, 6);
      } else if (id === 'shield') {
        ctx.beginPath();
        ctx.moveTo(23, 12);
        ctx.lineTo(32, 16);
        ctx.lineTo(30, 26);
        ctx.lineTo(23, 33);
        ctx.lineTo(16, 26);
        ctx.lineTo(14, 16);
        ctx.closePath();
        ctx.stroke();
      } else if (id === 'radar') {
        ctx.beginPath();
        ctx.arc(23, 23, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(23, 23, 5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (id === 'multi_shot') {
        ctx.beginPath();
        ctx.moveTo(23, 28);
        ctx.lineTo(13, 14);
        ctx.moveTo(23, 28);
        ctx.lineTo(23, 12);
        ctx.moveTo(23, 28);
        ctx.lineTo(33, 14);
        ctx.stroke();
      } else if (id === 'piercing_shell') {
        ctx.beginPath();
        ctx.moveTo(14, 30);
        ctx.lineTo(32, 15);
        ctx.stroke();
      } else if (id === 'mine_kit') {
        ctx.beginPath();
        ctx.arc(23, 23, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = INK;
      ctx.font = 'bold 12px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.shortLabel, 23, 24);
    });
  }

  // 6. Pooled VFX textures (puff, tread mark, blast scorch)
  makeCanvasTexture(scene, 'fx_puff', 32, 32, (ctx) => {
    ctx.beginPath();
    ctx.arc(16, 16, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  });

  makeCanvasTexture(scene, 'fx_tread', 16, 36, (ctx) => {
    ctx.fillStyle = 'rgba(26, 24, 20, 0.34)';
    ctx.fillRect(2, 2, 12, 7);
    ctx.fillRect(2, 27, 12, 7);
  });

  makeCanvasTexture(scene, 'fx_scorch', 64, 64, (ctx) => {
    const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(22, 20, 18, 0.65)');
    grad.addColorStop(0.6, 'rgba(28, 25, 22, 0.32)');
    grad.addColorStop(1, 'rgba(28, 25, 22, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
  });
}
