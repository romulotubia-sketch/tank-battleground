import { TankDefinition } from '../types/game';

interface TankPreviewSvgProps {
  tank: TankDefinition;
  size?: number;
  className?: string;
}

export function TankPreviewSvg({ tank, size = 96, className = '' }: TankPreviewSvgProps) {
  const { visual } = tank;
  const ink = '#161815';

  const treadW = visual.silhouette === 'heavy' ? 62 : visual.silhouette === 'sleek' ? 54 : 58;
  const treadH = visual.silhouette === 'heavy' ? 13 : 10;
  const treadYOffset = visual.silhouette === 'heavy' ? 20 : 17;

  const hullW = visual.silhouette === 'heavy' ? 54 : visual.silhouette === 'sleek' ? 48 : 52;
  const hullH = visual.silhouette === 'heavy' ? 36 : visual.silhouette === 'sleek' ? 26 : 30;
  const turretR = visual.silhouette === 'heavy' ? 17 : visual.silhouette === 'sleek' ? 13 : 15;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 110 110"
      className={className}
      aria-label={`${tank.name} illustration`}
    >
      <g transform="translate(50, 55) rotate(-18)">
        {/* Shadow */}
        <rect x={-28} y={-24} width={60} height={52} rx={9} fill="rgba(0,0,0,0.28)" />

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

        {/* Hull */}
        {visual.silhouette === 'angular' ? (
          <polygon
            points="28,0 14,-18 -24,-16 -19,0 -24,16 14,18"
            fill={visual.hullPrimary}
            stroke={ink}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        ) : (
          <>
            <rect
              x={-hullW / 2}
              y={-hullH / 2}
              width={hullW}
              height={hullH}
              rx={7}
              fill={visual.hullPrimary}
              stroke={ink}
              strokeWidth={3}
            />
            <rect
              x={-hullW / 2 + 6}
              y={-hullH / 2 + 5}
              width={hullW - 16}
              height={hullH - 10}
              rx={4}
              fill={visual.hullSecondary}
              stroke={ink}
              strokeWidth={2}
            />
          </>
        )}

        {/* Front Accent Visor */}
        <rect
          x={12}
          y={-8}
          width={6}
          height={16}
          rx={2}
          fill={visual.accentColor}
          stroke={ink}
          strokeWidth={2}
        />

        {/* Barrel */}
        {visual.silhouette === 'long_barrel' ? (
          <>
            <rect
              x={8}
              y={-4.5}
              width={45}
              height={9}
              rx={2}
              fill={visual.hullSecondary}
              stroke={ink}
              strokeWidth={2.5}
            />
            <rect
              x={47}
              y={-6}
              width={8}
              height={12}
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
              fill={visual.hullSecondary}
              stroke={ink}
              strokeWidth={2.5}
            />
            <line x1={20} y1={-8} x2={20} y2={8} stroke={visual.accentColor} strokeWidth={3.5} />
            <line x1={28} y1={-8} x2={28} y2={8} stroke={visual.accentColor} strokeWidth={3.5} />
            <line x1={36} y1={-8} x2={36} y2={8} stroke={visual.accentColor} strokeWidth={3.5} />
          </>
        ) : (
          <>
            <rect
              x={8}
              y={-5}
              width={34}
              height={10}
              rx={3}
              fill={visual.hullSecondary}
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

        {/* Hatch */}
        <circle
          cx={-3}
          cy={-2}
          r={5}
          fill={visual.hullSecondary}
          stroke={ink}
          strokeWidth={2}
        />
      </g>
    </svg>
  );
}
