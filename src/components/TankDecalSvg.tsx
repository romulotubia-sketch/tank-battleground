import { DecalPosition, TankDecalId, TankVisualConfig } from '../types/game';
import { getDecalPlacements } from './TankDecalRenderer';

interface TankDecalGlyphProps {
  decalId: TankDecalId;
  color: string;
}

function getStarPoints(rOuter: number, rInner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push(`${(Math.cos(angle) * r).toFixed(2)},${(Math.sin(angle) * r).toFixed(2)}`);
  }
  return pts.join(' ');
}

function getHexPoints(radius: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    pts.push(`${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function TankDecalShape({ decalId, color }: TankDecalGlyphProps) {
  switch (decalId) {
    case 'chevron':
      return (
        <g fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="-4,-5 4,0 -4,5" />
          <polyline points="-7.5,-3.8 -1,0 -7.5,3.8" />
        </g>
      );
    case 'iron_crosshair':
      return (
        <g>
          <circle cx={0} cy={0} r={5.2} fill="none" stroke={color} strokeWidth={1.8} />
          <g stroke={color} strokeWidth={1.8} strokeLinecap="round">
            <line x1={-7.2} y1={0} x2={-2.4} y2={0} />
            <line x1={2.4} y1={0} x2={7.2} y2={0} />
            <line x1={0} y1={-7.2} x2={0} y2={-2.4} />
            <line x1={0} y1={2.4} x2={0} y2={7.2} />
          </g>
          <circle cx={0} cy={0} r={1.4} fill={color} />
        </g>
      );
    case 'shield_crest':
      return (
        <g>
          <polygon
            points="-5.2,-5.5 5.2,-5.5 5.2,0.5 0,6.5 -5.2,0.5"
            fill="none"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <polygon points="-2.5,-3 2.5,-3 0,3" fill={color} />
        </g>
      );
    case 'command_star':
      return <polygon points={getStarPoints(6.8, 2.9)} fill={color} />;
    case 'num_01':
    case 'num_07':
    case 'num_42':
    case 'num_99': {
      const label = decalId.slice(4);
      return (
        <text
          x={0}
          y={0.6}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="9.5"
          fontWeight="800"
          fontFamily="'Barlow Condensed', sans-serif"
          fill={color}
          stroke="#161815"
          strokeWidth={2.2}
          paintOrder="stroke fill"
        >
          {label}
        </text>
      );
    }
    case 'twin_stripes':
      return (
        <g fill={color}>
          <rect x={-6.5} y={-4} width={13} height={2.6} rx={0.6} />
          <rect x={-6.5} y={1.4} width={13} height={2.6} rx={0.6} />
        </g>
      );
    case 'hazard_stripes':
      return (
        <g stroke={color} strokeWidth={2.5} strokeLinecap="round">
          <line x1={-6.5} y1={-4.5} x2={-2.5} y2={4.5} />
          <line x1={-2} y1={-4.5} x2={2} y2={4.5} />
          <line x1={2.5} y1={-4.5} x2={6.5} y2={4.5} />
        </g>
      );
    case 'apex_diamond':
      return (
        <g>
          <polygon
            points="0,-6.5 6.5,0 0,6.5 -6.5,0"
            fill="none"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <polygon points="0,-3 3,0 0,3 -3,0" fill={color} />
        </g>
      );
    case 'hex_core':
      return (
        <g>
          <polygon
            points={getHexPoints(6)}
            fill="none"
            stroke={color}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <circle cx={0} cy={0} r={2.2} fill={color} />
        </g>
      );
    case 'thunder_bolt':
      return (
        <polygon points="1.8,-6.8 -4.2,0.5 -0.3,0.5 -2.2,6.8 4.2,-0.8 0.2,-0.8" fill={color} />
      );
    case 'apex_crown':
      return (
        <polygon points="-5.8,4.5 -5.8,-3.5 -2.5,0.5 0,-5 2.5,0.5 5.8,-3.5 5.8,4.5" fill={color} />
      );
    case 'winged_crest':
      return (
        <polygon
          points="-7,-3.5 -1.5,-1 0,-5 1.5,-1 7,-3.5 4.5,3 0,5.2 -4.5,3"
          fill={color}
        />
      );
    case 'none':
    default:
      return null;
  }
}

interface TankDecalSvgProps {
  decalId: TankDecalId;
  decalColor: string;
  position: DecalPosition;
  silhouette: TankVisualConfig['silhouette'];
  layer: 'hull' | 'turret';
}

export function TankDecalSvg({
  decalId,
  decalColor,
  position,
  silhouette,
  layer,
}: TankDecalSvgProps) {
  if (decalId === 'none') return null;
  const placements = getDecalPlacements(position, silhouette, layer, 1);
  if (placements.length === 0) return null;

  return (
    <g className="pointer-events-none">
      {placements.map((p, idx) => (
        <g
          key={`${layer}-${idx}`}
          transform={`translate(${p.x.toFixed(2)}, ${p.y.toFixed(2)}) rotate(${p.rotationDeg}) scale(${p.scale.toFixed(3)})`}
        >
          <TankDecalShape decalId={decalId} color={decalColor} />
        </g>
      ))}
    </g>
  );
}

interface TankDecalIconProps {
  decalId: TankDecalId;
  color?: string;
  size?: number;
  className?: string;
}

export function TankDecalIcon({
  decalId,
  color = '#F3EFE6',
  size = 22,
  className = '',
}: TankDecalIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-9 -9 18 18"
      className={className}
      aria-hidden="true"
    >
      {decalId === 'none' ? (
        <circle cx={0} cy={0} r={5.5} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1.6} strokeDasharray="2.2 2" />
      ) : (
        <TankDecalShape decalId={decalId} color={color} />
      )}
    </svg>
  );
}
