import { Hexagon } from 'lucide-react';

interface ScrapBadgeProps {
  scrap: number;
  compact?: boolean;
  label?: string;
  className?: string;
}

export function ScrapBadge({
  scrap,
  compact = false,
  label = 'Scrap',
  className = '',
}: ScrapBadgeProps) {
  const safeScrap = Math.max(0, Math.floor(scrap));

  return (
    <div
      aria-label={`Scrap balance: ${safeScrap}`}
      className={`inline-flex items-center gap-2 rounded-xl bg-[#1E221D] border border-sky-400/30 shadow-sm shrink-0 ${
        compact ? 'px-2.5 py-1.5 min-h-[38px]' : 'px-3 sm:px-3.5 py-1.5 min-h-[44px]'
      } ${className}`}
    >
      <div className="w-6 h-6 rounded-md bg-sky-500/15 border border-sky-400/40 text-sky-300 flex items-center justify-center shrink-0">
        <Hexagon className="w-3.5 h-3.5 stroke-[2.4]" />
      </div>
      <div className="leading-none">
        {!compact && (
          <div className="text-[9px] font-mono uppercase tracking-wider text-sky-300/75">
            {label}
          </div>
        )}
        <div className="font-mono text-sm font-extrabold text-sky-300 tabular-nums mt-0.5">
          {safeScrap.toLocaleString()}
          {compact && (
            <span className="ml-1 text-[10px] font-semibold uppercase text-sky-300/75">
              Scrap
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
