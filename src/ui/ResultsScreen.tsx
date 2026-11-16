import { Home, RotateCcw, Trophy, Skull } from 'lucide-react';
import { ARENA_DEFINITIONS } from '../game/arenas/arenaLayouts';
import { TANK_DEFINITIONS } from '../data/tanks';
import { MatchResult } from '../types/game';

interface ResultsScreenProps {
  result: MatchResult;
  totalScrap: number;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

function getReasonLabel(result: MatchResult): string {
  switch (result.reason) {
    case 'last_standing':
      return 'Last tank standing in the arena';
    case 'time_highest_hp':
      return 'Match timer expired · Highest remaining armor';
    case 'time_outscored':
      return `Time expired · ${result.winnerName} held higher armor`;
    case 'eliminated':
      return `Eliminated · ${result.winnerName} took the field`;
  }
}

export function ResultsScreen({
  result,
  totalScrap,
  onPlayAgain,
  onMainMenu,
}: ResultsScreenProps) {
  const tank = TANK_DEFINITIONS[result.tankId];
  const arena = ARENA_DEFINITIONS[result.arenaId];

  return (
    <div className="fixed inset-0 z-30 w-full h-full overflow-y-auto bg-[#141714]/78 backdrop-blur-xs text-[#F3EFE6] flex items-center justify-center p-3 sm:p-4">
      <div
        className={`w-full max-w-lg bg-[#1E221D] border-2 rounded-2xl p-4 sm:p-7 shadow-2xl ${
          result.victory ? 'border-[#E08E26]/65' : 'border-[#F3EFE6]/25'
        }`}
      >
        {/* Outcome Header */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-2 mb-2 sm:mb-3 ${
              result.victory
                ? 'bg-[#E08E26]/20 border-[#E08E26] text-[#E08E26]'
                : 'bg-red-500/15 border-red-400/60 text-red-400'
            }`}
          >
            {result.victory ? <Trophy className="w-6 h-6 sm:w-7 sm:h-7" /> : <Skull className="w-6 h-6 sm:w-7 sm:h-7" />}
          </div>

          <h1
            className={`font-display text-3xl sm:text-5xl font-extrabold tracking-wide ${
              result.victory ? 'text-[#E08E26]' : 'text-[#F3EFE6]'
            }`}
          >
            {result.victory ? 'Victory' : 'Defeat'}
          </h1>
          <p className="text-xs sm:text-sm text-[#F3EFE6]/75 mt-1">
            {getReasonLabel(result)}
          </p>
          <p className="text-xs text-[#F3EFE6]/55 mt-1 font-mono tabular-nums">
            {tank.name} · {arena.name} · Rank #{result.placement} of {result.totalTanks}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 my-4 sm:my-6 py-3 sm:py-4 border-y border-[#F3EFE6]/12 text-center">
          <div>
            <div className="font-mono text-2xl font-bold tabular-nums text-[#F3EFE6]">
              #{result.placement}
              <span className="text-sm text-[#F3EFE6]/50">/{result.totalTanks}</span>
            </div>
            <div className="text-xs text-[#F3EFE6]/60 mt-0.5">Placement</div>
          </div>

          <div>
            <div className="font-mono text-2xl font-bold tabular-nums text-[#F3EFE6]">
              {result.eliminations}
            </div>
            <div className="text-xs text-[#F3EFE6]/60 mt-0.5">Eliminations</div>
          </div>

          <div>
            <div className="font-mono text-2xl font-bold tabular-nums text-[#F3EFE6]">
              {result.damageDealt}
            </div>
            <div className="text-xs text-[#F3EFE6]/60 mt-0.5">Damage</div>
          </div>

          <div>
            <div className="font-mono text-2xl font-bold tabular-nums text-[#E08E26]">
              +{result.scrapEarned}
            </div>
            <div className="text-xs text-[#F3EFE6]/60 mt-0.5">Scrap Earned</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[#F3EFE6]/65 mb-5 font-mono tabular-nums">
          <span>Survival Time: {result.survivalSec}s</span>
          <span>Total Scrap: {totalScrap}</span>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="min-h-[48px] flex-1 px-5 rounded-xl bg-[#E08E26] text-[#141714] font-display text-xl font-extrabold tracking-wide flex items-center justify-center gap-2 hover:bg-[#EE9B32] transition whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            Play Again
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="min-h-[48px] flex-1 px-5 rounded-xl bg-[#272C25] border border-[#F3EFE6]/20 text-[#F3EFE6] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#31382E] transition whitespace-nowrap"
          >
            <Home className="w-4 h-4" />
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
