import { DecalPosition, TankDecalId, TankVisualConfig } from '../types/game';

export interface DecalPlacementSpec {
  x: number;
  y: number;
  scale: number;
  rotationDeg: number;
}

/**
 * Shared placement solver used by both SVG preview (unit radius ~55) and Phaser Canvas2D textures.
 * `coordScale` converts from canonical SVG hull/turret space into canvas texture space (~0.92).
 */
export function getDecalPlacements(
  position: DecalPosition,
  silhouette: TankVisualConfig['silhouette'],
  layer: 'hull' | 'turret',
  coordScale = 1
): DecalPlacementSpec[] {
  if (position === 'turret_top') {
    if (layer !== 'turret') return [];
    const scale = silhouette === 'heavy' ? 1.05 : silhouette === 'sleek' ? 0.82 : 0.94;
    return [
      {
        x: 2.2 * coordScale,
        y: 1.4 * coordScale,
        scale: scale * coordScale,
        rotationDeg: 0,
      },
    ];
  }

  if (layer !== 'hull') return [];

  if (position === 'hull_rear') {
    const rx =
      silhouette === 'heavy'
        ? -20.5
        : silhouette === 'angular'
        ? -13
        : silhouette === 'long_barrel'
        ? -18
        : -18.5;
    const scale = silhouette === 'sleek' ? 0.72 : silhouette === 'heavy' ? 0.88 : 0.78;
    return [
      {
        x: rx * coordScale,
        y: 0,
        scale: scale * coordScale,
        rotationDeg: 0,
      },
    ];
  }

  if (position === 'hull_front') {
    const fx =
      silhouette === 'heavy'
        ? 15
        : silhouette === 'angular'
        ? 9
        : silhouette === 'sleek'
        ? 14
        : 14;
    const fy =
      silhouette === 'heavy'
        ? 11.5
        : silhouette === 'sleek'
        ? 7.5
        : silhouette === 'angular'
        ? 9.5
        : 9.5;
    const scale = silhouette === 'sleek' ? 0.56 : silhouette === 'heavy' ? 0.68 : 0.62;
    return [
      { x: fx * coordScale, y: -fy * coordScale, scale: scale * coordScale, rotationDeg: 0 },
      { x: fx * coordScale, y: fy * coordScale, scale: scale * coordScale, rotationDeg: 0 },
    ];
  }

  // hull_flanks (left & right rear-mid armor flanks, clear of turret silhouette)
  const lx = silhouette === 'heavy' ? -16.5 : silhouette === 'angular' ? -11 : -14.5;
  const ly = silhouette === 'heavy' ? 12 : silhouette === 'sleek' ? 8.2 : 10.5;
  const scale = silhouette === 'sleek' ? 0.54 : silhouette === 'heavy' ? 0.68 : 0.6;
  return [
    { x: lx * coordScale, y: -ly * coordScale, scale: scale * coordScale, rotationDeg: -90 },
    { x: lx * coordScale, y: ly * coordScale, scale: scale * coordScale, rotationDeg: 90 },
  ];
}

function drawStarPath(ctx: CanvasRenderingContext2D, rOuter: number, rInner: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? rOuter : rInner;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawCanvasDecal(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  decalId: TankDecalId,
  decalColor: string,
  position: DecalPosition,
  silhouette: TankVisualConfig['silhouette'],
  layer: 'hull' | 'turret',
  coordScale = 0.92
): void {
  if (decalId === 'none') return;
  const placements = getDecalPlacements(position, silhouette, layer, coordScale);
  if (placements.length === 0) return;

  for (const p of placements) {
    ctx.save();
    ctx.translate(centerX + p.x, centerY + p.y);
    ctx.rotate((p.rotationDeg * Math.PI) / 180);
    ctx.scale(p.scale, p.scale);
    ctx.fillStyle = decalColor;
    ctx.strokeStyle = decalColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (decalId) {
      case 'chevron': {
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(-4, -5);
        ctx.lineTo(4, 0);
        ctx.lineTo(-4, 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-7.5, -3.8);
        ctx.lineTo(-1, 0);
        ctx.lineTo(-7.5, 3.8);
        ctx.stroke();
        break;
      }
      case 'iron_crosshair': {
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-7.2, 0);
        ctx.lineTo(-2.4, 0);
        ctx.moveTo(2.4, 0);
        ctx.lineTo(7.2, 0);
        ctx.moveTo(0, -7.2);
        ctx.lineTo(0, -2.4);
        ctx.moveTo(0, 2.4);
        ctx.lineTo(0, 7.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 1.4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'shield_crest': {
        ctx.beginPath();
        ctx.moveTo(-5.2, -5.5);
        ctx.lineTo(5.2, -5.5);
        ctx.lineTo(5.2, 0.5);
        ctx.lineTo(0, 6.5);
        ctx.lineTo(-5.2, 0.5);
        ctx.closePath();
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-2.5, -3);
        ctx.lineTo(2.5, -3);
        ctx.lineTo(0, 3);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'command_star': {
        drawStarPath(ctx, 6.8, 2.9);
        ctx.fill();
        break;
      }
      case 'num_01':
      case 'num_07':
      case 'num_42':
      case 'num_99': {
        const text = decalId.slice(4);
        ctx.font = '800 9.5px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = '#161815';
        ctx.strokeText(text, 0, 0.5);
        ctx.fillStyle = decalColor;
        ctx.fillText(text, 0, 0.5);
        break;
      }
      case 'twin_stripes': {
        ctx.fillRect(-6.5, -4, 13, 2.6);
        ctx.fillRect(-6.5, 1.4, 13, 2.6);
        break;
      }
      case 'hazard_stripes': {
        ctx.lineWidth = 2.5;
        for (const ox of [-4.5, 0, 4.5]) {
          ctx.beginPath();
          ctx.moveTo(ox - 2, -4.5);
          ctx.lineTo(ox + 2, 4.5);
          ctx.stroke();
        }
        break;
      }
      case 'apex_diamond': {
        ctx.beginPath();
        ctx.moveTo(0, -6.5);
        ctx.lineTo(6.5, 0);
        ctx.lineTo(0, 6.5);
        ctx.lineTo(-6.5, 0);
        ctx.closePath();
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(3, 0);
        ctx.lineTo(0, 3);
        ctx.lineTo(-3, 0);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'hex_core': {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const hx = Math.cos(a) * 6;
          const hy = Math.sin(a) * 6;
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'thunder_bolt': {
        ctx.beginPath();
        ctx.moveTo(1.8, -6.8);
        ctx.lineTo(-4.2, 0.5);
        ctx.lineTo(-0.3, 0.5);
        ctx.lineTo(-2.2, 6.8);
        ctx.lineTo(4.2, -0.8);
        ctx.lineTo(0.2, -0.8);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'apex_crown': {
        ctx.beginPath();
        ctx.moveTo(-5.8, 4.5);
        ctx.lineTo(-5.8, -3.5);
        ctx.lineTo(-2.5, 0.5);
        ctx.lineTo(0, -5);
        ctx.lineTo(2.5, 0.5);
        ctx.lineTo(5.8, -3.5);
        ctx.lineTo(5.8, 4.5);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'winged_crest': {
        ctx.beginPath();
        ctx.moveTo(-7, -3.5);
        ctx.lineTo(-1.5, -1);
        ctx.lineTo(0, -5);
        ctx.lineTo(1.5, -1);
        ctx.lineTo(7, -3.5);
        ctx.lineTo(4.5, 3);
        ctx.lineTo(0, 5.2);
        ctx.lineTo(-4.5, 3);
        ctx.closePath();
        ctx.fill();
        break;
      }
      default:
        break;
    }

    ctx.restore();
  }
}
