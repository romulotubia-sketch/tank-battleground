import { Award, Check, Sparkles, Star, X } from 'lucide-react';
import { TankPreviewSvg } from '../components/TankPreviewSvg';
import { COSMETIC_DEFINITIONS } from '../data/progression';
import { TANK_DEFINITIONS } from '../data/tanks';
import { MatchProgressionSummary, TankId } from '../types/game';

interface LevelUpModalProps {
  summary: MatchProgressionSummary;
  activeTankId: TankId;
  onDismiss: () => void;
}

export function LevelUpModal({
  summary,
  activeTankId,
  onDismiss,
}: LevelUpModalProps) {
  const tank = TANK_DEFINITIONS[activeTankId] || TANK_DEFINITIONS.assault;
  const xpPct = Math.max(
    0,
    Math.min(100, (summary.newXp / Math.max(1, summary.newXpToNext)) * 100)
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="levelup-modal-title"
      className="fixed inset-0 z-40 bg-[#141714]/82 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="levelup-pop relative w-full max-w-md bg-[#1E221D] border-2 border-[#E08E26] rounded-2xl p-5 sm:p-6 text-[#F3EFE6] shadow-2xl">
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss level up notification"
          className="absolute top-3.5 right-3.5 min-w-[40px] min-h-[40px] rounded-xl bg-[#141714] border border-[#F3EFE6]/15 text-[#F3EFE6]/75 hover:text-[#F3EFE6] hover:border-[#E08E26]/60 flex items-center justify-center transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Animated Emblem */}
        <div className="flex flex-col items-center text-center">
          <div className="relative w-16 h-16 rounded-2xl bg-[#E08E26]/20 border-2 border-[#E08E26] text-[#E08E26] flex items-center justify-center mb-3 shadow-lg">
            <Star className="w-8 h-8 fill-current" />
            <span className="absolute -bottom-2 px-2 py-0.5 rounded-md bg-[#E08E26] text-[#141714] font-mono text-[10px] font-extrabold uppercase tracking-wider">
              +{summary.levelsGained} {summary.levelsGained === 1 ? 'LVL' : 'LVLS'}
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.2em] text-[#E08E26]">
            <Sparkles className="w-3.5 h-3.5" />
            Promotion Achieved
          </div>

          <h2
            id="levelup-modal-title"
            className="font-display text-3xl sm:text-4xl font-extrabold tracking-wide text-[#F3EFE6] mt-0.5"
          >
            Level {summary.newLevel} Reached!
          </h2>

          <p className="text-xs font-mono text-[#F3EFE6]/70 mt-1 tabular-nums">
            Level {summary.previousLevel} → Level {summary.newLevel} · +{summary.xpBreakdown.totalXp} XP Earned
          </p>
        </div>

        {/* Carryover XP Bar */}
        <div className="mt-4 bg-[#141714] border border-[#F3EFE6]/12 rounded-xl p-3">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1.5">
            <span className="text-[#E08E26] font-bold">Level {summary.newLevel} Progress</span>
            <span className="text-[#F3EFE6]/75">
              {summary.newXp} / {summary.newXpToNext} XP
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#1E221D] overflow-hidden border border-[#F3EFE6]/10">
            <div
              className="h-full bg-[#E08E26] transition-all duration-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        {/* Milestone Rewards Unlocked */}
        {summary.unlockedMilestones.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#22C55E] mb-2 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" />
              Milestone Rewards Unlocked
            </div>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-0.5">
              {summary.unlockedMilestones.map((m) => {
                const cosmetic = m.cosmeticId ? COSMETIC_DEFINITIONS[m.cosmeticId] : null;
                return (
                  <div
                    key={m.id}
                    className="bg-[#141714] border border-[#22C55E]/35 rounded-xl p-2.5 flex items-center gap-3"
                  >
                    {cosmetic ? (
                      <TankPreviewSvg
                        tank={tank}
                        cosmeticId={cosmetic.id}
                        size={48}
                        className="shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-[#E08E26]/15 border border-[#E08E26]/45 text-[#E08E26] flex items-center justify-center font-mono text-xs font-extrabold shrink-0">
                        +{m.scrapAmount}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#F3EFE6] truncate">
                          {m.title}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#22C55E]/15 text-[#86EFAC] shrink-0">
                          LVL {m.level}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#F3EFE6]/65 leading-snug mt-0.5">
                        {m.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 min-h-[46px] w-full rounded-xl bg-[#E08E26] text-[#141714] font-display text-xl font-extrabold tracking-wide flex items-center justify-center gap-2 hover:bg-[#EE9B32] transition"
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
          Continue
        </button>
      </div>
    </div>
  );
}
