import { ArenaDefinition, ObstacleType } from '../types/game';

interface ArenaPreviewSvgProps {
  arena: ArenaDefinition;
  className?: string;
}

const OBSTACLE_COLOR: Record<ObstacleType, string> = {
  steel: '#5A626B',
  brick: '#9A4E38',
  crate: '#A8743B',
  water: '#3282B8',
  bush: '#436B33',
  barrel: '#D13B2E',
};

const OBSTACLE_STROKE: Record<ObstacleType, string> = {
  steel: '#8B95A1',
  brick: '#C96D52',
  crate: '#D29B59',
  water: '#63B3ED',
  bush: '#689A50',
  barrel: '#FCA5A5',
};

export function ArenaPreviewSvg({ arena, className = '' }: ArenaPreviewSvgProps) {
  const { width, height, groundColor, groundGridColor, borderColor, obstacles, spawns, id } =
    arena;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${arena.name} tactical arena preview`}
      className={`w-full aspect-[2080/1200] rounded-lg border border-[#F3EFE6]/15 overflow-hidden bg-[#141714] ${className}`}
    >
      {/* Ground Base */}
      <rect x={0} y={0} width={width} height={height} fill={groundColor} />

      {/* Subtle Tactical Grid */}
      <g stroke={groundGridColor} strokeWidth={4} opacity={0.35}>
        {[400, 800, 1200, 1600].map((x) => (
          <line key={`gx-${x}`} x1={x} y1={0} x2={x} y2={height} />
        ))}
        {[300, 600, 900].map((y) => (
          <line key={`gy-${y}`} x1={0} y1={y} x2={width} y2={y} />
        ))}
      </g>

      {/* Theme Terrain Signature Overlay */}
      {id === 'training_grounds' && (
        <g>
          <rect
            x={720}
            y={340}
            width={640}
            height={520}
            rx={16}
            fill="#AE9D78"
            opacity={0.45}
          />
          <circle
            cx={width / 2}
            cy={height / 2}
            r={235}
            fill="none"
            stroke="#DFD1B0"
            strokeWidth={6}
            opacity={0.45}
          />
        </g>
      )}

      {id === 'industrial_zone' && (
        <g>
          <rect x={315} y={260} width={350} height={680} fill="#7B8287" opacity={0.42} />
          <rect x={1415} y={260} width={350} height={680} fill="#7B8287" opacity={0.42} />
          <rect
            x={315}
            y={260}
            width={350}
            height={680}
            fill="none"
            stroke="#E08E26"
            strokeWidth={8}
            opacity={0.45}
          />
          <rect
            x={1415}
            y={260}
            width={350}
            height={680}
            fill="none"
            stroke="#E08E26"
            strokeWidth={8}
            opacity={0.45}
          />
          <circle
            cx={width / 2}
            cy={height / 2}
            r={180}
            fill="none"
            stroke="#D68624"
            strokeWidth={6}
            opacity={0.4}
          />
        </g>
      )}

      {id === 'wasteland' && (
        <g>
          <ellipse cx={540} cy={590} rx={270} ry={170} fill="#9C7348" opacity={0.38} />
          <ellipse cx={1540} cy={590} rx={270} ry={170} fill="#9C7348" opacity={0.38} />
          <ellipse cx={1040} cy={310} rx={300} ry={110} fill="#D5AB7B" opacity={0.35} />
          <ellipse cx={1040} cy={890} rx={300} ry={110} fill="#D5AB7B" opacity={0.35} />
        </g>
      )}

      {/* Arena Inner Border */}
      <rect
        x={12}
        y={12}
        width={width - 24}
        height={height - 24}
        fill="none"
        stroke={borderColor}
        strokeWidth={24}
      />

      {/* Obstacles */}
      {obstacles.map((obs, idx) => {
        if (obs.type === 'barrel') {
          return (
            <circle
              key={`obs-${idx}`}
              cx={obs.x}
              cy={obs.y}
              r={obs.w * 0.52}
              fill={OBSTACLE_COLOR.barrel}
              stroke={OBSTACLE_STROKE.barrel}
              strokeWidth={5}
            />
          );
        }
        if (obs.type === 'bush') {
          return (
            <ellipse
              key={`obs-${idx}`}
              cx={obs.x}
              cy={obs.y}
              rx={obs.w * 0.5}
              ry={obs.h * 0.5}
              fill={OBSTACLE_COLOR.bush}
              stroke={OBSTACLE_STROKE.bush}
              strokeWidth={4}
              opacity={0.85}
            />
          );
        }
        return (
          <rect
            key={`obs-${idx}`}
            x={obs.x - obs.w / 2}
            y={obs.y - obs.h / 2}
            width={obs.w}
            height={obs.h}
            rx={obs.type === 'water' ? 14 : 5}
            fill={OBSTACLE_COLOR[obs.type]}
            stroke={OBSTACLE_STROKE[obs.type]}
            strokeWidth={obs.type === 'steel' ? 6 : 4}
          />
        );
      })}

      {/* 8 Fair Spawn Markers */}
      {spawns.map((sp, idx) => (
        <g key={`sp-${idx}`}>
          <circle
            cx={sp.x}
            cy={sp.y}
            r={24}
            fill={idx === 0 ? '#E08E26' : '#1E221D'}
            stroke="#F3EFE6"
            strokeWidth={6}
          />
        </g>
      ))}
    </svg>
  );
}
