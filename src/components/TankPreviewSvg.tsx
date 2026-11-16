import { resolveEffectiveTankVisual } from '../data/customization';
import { CosmeticId, TankCustomization, TankDefinition } from '../types/game';
import { TankDecalSvg } from './TankDecalSvg';

interface TankPreviewSvgProps {
  tank: TankDefinition;
  cosmeticId?: CosmeticId;
  customization?: TankCustomization | null;
  size?: number;
  hullAngleDeg?: number;
  turretAngleDeg?: number;
  className?: string;
}

export function TankPreviewSvg({
  tank,
  cosmeticId = 'default',
  customization = null,
  size = 96,
  hullAngleDeg = -18,
  turretAngleDeg,
  className = '',
}: TankPreviewSvgProps) {
  const visual = resolveEffectiveTankVisual(tank, cosmeticId, customization);
  const barrelColor = visual.barrelColor ?? visual.hullSecondary;
  const ink = '#161815';
  const effectiveTurretDeg = turretAngleDeg ?? hullAngleDeg;
  const relativeTurretDeg = effectiveTurretDeg - hullAngleDeg;

  const treadW =
    visual.silhouette === 'heavy'
      ? 62
      : visual.silhouette === 'sleek'
      ? 52
      : visual.silhouette === 'long_barrel'
      ? 58
      : 56;
  const treadH = visual.silhouette === 'heavy' ? 14 : visual.silhouette === 'sleek' ? 9 : 10.5;
  const treadYOffset = visual.silhouette === 'heavy' ? 20 : visual.silhouette === 'sleek' ? 16 : 17;

  const turretR = visual.silhouette === 'heavy' ? 18 : visual.silhouette === 'sleek' ? 13 : 15;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 110 110"
      className={className}
      aria-label={`${tank.name} illustration`}
    >
      <g transform={`translate(50, 55) rotate(${hullAngleDeg})`}>
        {/* Shadow */}
        <rect
          x={-28}
          y={-24}
          width={visual.silhouette === 'heavy' ? 62 : 58}
          height={visual.silhouette === 'heavy' ? 54 : 48}
          rx={9}
          fill="rgba(0,0,0,0.28)"
        />

        {/* Treads */}
        <rect
          x={-treadW / 2}
          y={-treadYOffset - treadH / 2}
          width={treadW}
          height={treadH}
          rx={4}
          fill={visual.treadColor}
          stroke={ink}
          strokeWidth={3}
        />
        <rect
          x={-treadW / 2}
          y={treadYOffset - treadH / 2}
          width={treadW}
          height={treadH}
          rx={4}
          fill={visual.treadColor}
          stroke={ink}
          strokeWidth={3}
        />

        {/* Distinct Hull Silhouettes */}
        {visual.silhouette === 'angular' ? (
          <>
            <polygon
              points="28,0 14,-18 -24,-16 -19,0 -24,16 14,18"
              fill={visual.hullPrimary}
              stroke={ink}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <polygon
              points="18,0 8,-11 -16,-9 -13,0 -16,9 8,11"
              fill={visual.hullSecondary}
              stroke={ink}
              strokeWidth={1.8}
              strokeLinejoin="round"
            />
          </>
        ) : visual.silhouette === 'sleek' ? (
          <>
            <polygon
              points="26,-9 26,9 7,13 -24,13 -24,-13 7,-13"
              fill={visual.hullPrimary}
              stroke={ink}
              strokeWidth={3}
              strokeLinejoin="round"
            />
            <rect
              x={-18}
              y={-9}
              width={30}
              height={18}
              rx={4}
              fill={visual.hullSecondary}
              stroke={ink}
              strokeWidth={2}
            />
          </>
        ) : visual.silhouette === 'heavy' ? (
          <>
            <rect
              x={-28}
              y={-19}
              width={56}
              height={38}
              rx={7}
              fill={visual.hullPrimary}
              stroke={ink}
              strokeWidth={3}
            />
            <rect
              x={-21}
              y={-13}
              width={38}
              height={26}
              rx={4}
              fill={visual.hullSecondary}
              stroke={ink}
              strokeWidth={2}
            />
            <rect x={-25} y={-10} width={5} height={7} rx={1.5} fill={visual.accentColor} stroke={ink} strokeWidth={1.5} />
            <rect x={-25} y={3} width={5} height={7} rx={1.5} fill={visual.accentColor} stroke={ink} strokeWidth={1.5} />
          </>
        ) : visual.silhouette === 'long_barrel' ? (
          <>
            <rect x={-28} y={-15} width={7} height={7} rx={1.5} fill="#3B342C" stroke={ink} strokeWidth={2} />
            <rect x={-28} y={8} width={7} height={7} rx={1.5} fill="#3B342C" stroke={ink} strokeWidth={2} />
            <rect
              x={-25}
              y={-17}
              width={50}
              height={34}
              rx={6}
              fill={visual.hullPrimary}
              stroke={ink}
              strokeWidth={3}
            />
            <rect
              x={-19}
              y={-11}
              width={34}
              height={22}
              rx={3}
              fill={visual.hullSecondary}
              stroke={ink}
              strokeWidth={2}
            />
          </>
        ) : visual.silhouette === 'coil' ? (
          <>
            <rect
              x={-26}
              y={-16}
              width={52}
              height={32}
              rx={7}
              fill={visual.hullPrimary}
              stroke={ink}
              strokeWidth={3}
            />
            <rect
              x={-19}
              y={-11}
              width={34}
              height={22}
              rx={4}
              fill={visual.hullSecondary}
              stroke={ink}
              strokeWidth={2}
            />
            <rect x={-14} y={-17} width={24} height={6} rx={2} fill={visual.accentColor} stroke={ink} strokeWidth={1.6} />
            <rect x={-14} y={11} width={24} height={6} rx={2} fill={visual.accentColor} stroke={ink} strokeWidth={1.6} />
          </>
        ) : (
          <>
            <rect
              x={-26}
              y={-16}
              width={52}
              height={32}
              rx={7}
              fill={visual.hullPrimary}
              stroke={ink}
              strokeWidth={3}
            />
            <rect
              x={-19}
              y={-11}
              width={34}
              height={22}
              rx={4}
              fill={visual.hullSecondary}
              stroke={ink}
              strokeWidth={2}
            />
          </>
        )}

        {/* Front Accent Visor */}
        <rect
          x={13}
          y={-8}
          width={6}
          height={16}
          rx={2}
          fill={visual.accentColor}
          stroke={ink}
          strokeWidth={2}
        />

        {/* Hull-Mounted Decals */}
        {customization && customization.decalId !== 'none' && (
          <TankDecalSvg
            decalId={customization.decalId}
            decalColor={customization.decalColor}
            position={customization.decalPosition}
            silhouette={visual.silhouette}
            layer="hull"
          />
        )}

        {/* Independent Turret & Barrel Group */}
        <g transform={`rotate(${relativeTurretDeg})`}>
        {/* Barrel */}
        {visual.silhouette === 'long_barrel' ? (
          <>
            <rect x={7} y={-7} width={14} height={14} rx={3} fill={visual.hullPrimary} stroke={ink} strokeWidth={2.2} />
            <rect
              x={12}
              y={-4.5}
              width={43}
              height={9}
              rx={2}
              fill={barrelColor}
              stroke={ink}
              strokeWidth={2.5}
            />
            <rect
              x={49}
              y={-6.5}
              width={8.5}
              height={13}
              rx={2}
              fill={visual.accentColor}
              stroke={ink}
              strokeWidth={2}
            />
          </>
        ) : visual.silhouette === 'heavy' ? (
          <>
            <rect x={6} y={-8} width={13} height={16} rx={3} fill={visual.hullPrimary} stroke={ink} strokeWidth={2.2} />
            <rect
              x={11}
              y={-6}
              width={29}
              height={12}
              rx={3}
              fill={barrelColor}
              stroke={ink}
              strokeWidth={2.5}
            />
            <rect
              x={35}
              y={-7.5}
              width={8}
              height={15}
              rx={2}
              fill={visual.accentColor}
              stroke={ink}
              strokeWidth={2}
            />
          </>
        ) : visual.silhouette === 'coil' ? (
          <>
            <rect
              x={8}
              y={-5}
              width={32}
              height={10}
              rx={3}
              fill={barrelColor}
              stroke={ink}
              strokeWidth={2.5}
            />
            <line x1={35} y1={-4} x2={45} y2={-9} stroke={ink} strokeWidth={4.5} strokeLinecap="round" />
            <line x1={35} y1={4} x2={45} y2={9} stroke={ink} strokeWidth={4.5} strokeLinecap="round" />
            <line x1={35} y1={-4} x2={45} y2={-9} stroke={visual.accentColor} strokeWidth={2.2} strokeLinecap="round" />
            <line x1={35} y1={4} x2={45} y2={9} stroke={visual.accentColor} strokeWidth={2.2} strokeLinecap="round" />
            <line x1={17} y1={-8} x2={17} y2={8} stroke={visual.accentColor} strokeWidth={3.2} />
            <line x1={24} y1={-8} x2={24} y2={8} stroke={visual.accentColor} strokeWidth={3.2} />
            <line x1={31} y1={-8} x2={31} y2={8} stroke={visual.accentColor} strokeWidth={3.2} />
          </>
        ) : (
          <>
            <rect
              x={8}
              y={-5}
              width={34}
              height={10}
              rx={3}
              fill={barrelColor}
              stroke={ink}
              strokeWidth={2.5}
            />
            <rect
              x={37}
              y={-6}
              width={7}
              height={12}
              rx={2}
              fill={visual.accentColor}
              stroke={ink}
              strokeWidth={2}
            />
          </>
        )}

        {/* Turret Dome */}
        {visual.silhouette === 'angular' ? (
          <polygon
            points="16,0 3,-14 -14,-10 -14,10 3,14"
            fill={visual.turretColor}
            stroke={ink}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        ) : visual.silhouette === 'heavy' ? (
          <polygon
            points="17,-9 17,9 6,17 -12,16 -17,8 -17,-8 -12,-16 6,-17"
            fill={visual.turretColor}
            stroke={ink}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        ) : (
          <circle
            cx={0}
            cy={0}
            r={turretR}
            fill={visual.turretColor}
            stroke={ink}
            strokeWidth={3}
          />
        )}

        {visual.silhouette === 'sleek' && (
          <line x1={-8} y1={-6} x2={-19} y2={-13} stroke={visual.accentColor} strokeWidth={2.2} strokeLinecap="round" />
        )}

        {/* Hatch */}
        <circle
          cx={-3}
          cy={-2}
          r={5}
          fill={
            visual.silhouette === 'coil' || visual.silhouette === 'angular'
              ? visual.accentColor
              : visual.hullSecondary
          }
          stroke={ink}
          strokeWidth={2}
        />

        {/* Turret-Mounted Decal */}
        {customization && customization.decalId !== 'none' && (
          <TankDecalSvg
            decalId={customization.decalId}
            decalColor={customization.decalColor}
            position={customization.decalPosition}
            silhouette={visual.silhouette}
            layer="turret"
          />
        )}
        </g>
      </g>
    </svg>
  );
}
