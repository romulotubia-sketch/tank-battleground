import { useState } from 'react';
import { Award, Film, Hexagon, Home, RotateCcw, Skull, Sparkles, Star, Trophy } from 'lucide-react';
import { REWARDED_AD_BONUS_SCRAP } from '../data/economy';
import { calculateMatchScrapBreakdown, formatPlaytime } from '../data/progression';
import { TANK_DEFINITIONS } from '../data/tanks';
import { ARENA_DEFINITIONS } from '../game/arenas/arenaLayouts';
import { formatRewardedAdStatusMessage } from '../services/bridge/PlaygamaBridgeAdapter';
import {
  BridgeRuntimeState,
  MatchProgressionSummary,
  MatchResult,
  PlayerProgression,
  RewardedAdOutcome,
} from '../types/game';

interface ResultsScreenProps {
  result: MatchResult;
  progression: PlayerProgression;
  summary: MatchProgressionSummary | null;
  isRewardedSupported?: boolean;
  bridgeState?: BridgeRuntimeState;
  onWatchRewardedAd?: (grantId: string) => Promise<RewardedAdOutcome>;
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
  progression,
  summary,
  isRewardedSupported = false,
  bridgeState,
  onWatchRewardedAd,
  onPlayAgain,
  onMainMenu,
}: ResultsScreenProps) {
  const [adBusy, setAdBusy] = useState(false);
  const [adStatusText, setAdStatusText] = useState<string | null>(null);
  const rewardGrantId = `match_bonus_${result.matchId}`;
  const alreadyClaimedBonus = Boolean(
    progression.processedRewardedAdIds?.includes(rewardGrantId)
  );
  const tank = TANK_DEFINITIONS[result.tankId];
  const arena = ARENA_DEFINITIONS[result.arenaId];

  const prevLevel = summary?.previousLevel ?? progression.level;
  const newLevel = summary?.newLevel ?? progression.level;
  const leveledUp = (summary?.levelsGained ?? 0) > 0;
  const xpBreakdown = summary?.xpBreakdown;
  const scrapBreakdown =
    summary?.scrapBreakdown ?? result.scrapBreakdown ?? calculateMatchScrapBreakdown(result);
  const xpPct = Math.max(
    0,
    Math.min(100, (progression.xp / Math.max(1, progression.xpToNext)) * 100)
  );
  const unlockedMilestones = summary?.unlockedMilestones ?? [];
  const scrapFromMilestones = summary?.scrapFromMilestones ?? 0;
  const totalScrapEarned = summary?.totalScrapAwarded ?? result.scrapEarned;

  return (
    <div className="fixed inset-0 z-30 w-full h-full overflow-y-auto bg-[#141714]/82 backdrop-blur-xs text-[#F3EFE6] flex items-center justify-center p-3 sm:p-4">
      <div
        className={`w-full max-w-2xl bg-[#1E221D] border-2 rounded-2xl p-4 sm:p-6 shadow-2xl my-auto ${
          result.victory ? 'border-[#E08E26]/65' : 'border-[#F3EFE6]/25'
        }`}
      >
        {/* Outcome Header */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center border-2 mb-2 ${
              result.victory
                ? 'bg-[#E08E26]/20 border-[#E08E26] text-[#E08E26]'
                : 'bg-red-500/15 border-red-400/60 text-red-400'
            }`}
          >
            {result.victory ? (
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
            ) : (
              <Skull className="w-6 h-6 sm:w-7 sm:h-7" />
            )}
          </div>

          <h1
            className={`font-display text-3xl sm:text-5xl font-extrabold tracking-wide leading-none ${
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

        {/* Combat Metrics Grid */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 my-4 py-3 border-y border-[#F3EFE6]/12 text-center">
          <div>
            <div className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#F3EFE6]">
              #{result.placement}
              <span className="text-xs sm:text-sm text-[#F3EFE6]/50">/{result.totalTanks}</span>
            </div>
            <div className="text-[11px] text-[#F3EFE6]/60 mt-0.5">Placement</div>
          </div>

          <div>
            <div className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#F3EFE6]">
              {result.eliminations}
            </div>
            <div className="text-[11px] text-[#F3EFE6]/60 mt-0.5">Eliminations</div>
          </div>

          <div>
            <div className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-[#F3EFE6]">
              {result.damageDealt}
            </div>
            <div className="text-[11px] text-[#F3EFE6]/60 mt-0.5">Damage</div>
          </div>

          <div>
            <div className="font-mono text-xl sm:text-2xl font-bold tabular-nums text-sky-300">
              +{totalScrapEarned}
            </div>
            <div className="text-[11px] text-[#F3EFE6]/60 mt-0.5">Total Scrap</div>
          </div>
        </div>

        {/* Scrap & XP Breakdowns Side-by-Side on wider screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* Scrap Reward Breakdown */}
          <div className="bg-[#141714] border border-sky-400/25 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <Hexagon className="w-4 h-4 text-sky-300" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold text-[#F3EFE6]">
                    Scrap Rewards
                  </span>
                </div>
                <span className="font-mono text-sm font-extrabold text-sky-300 tabular-nums">
                  +{totalScrapEarned} Scrap
                </span>
              </div>

              <div className="space-y-1 text-xs font-mono tabular-nums pb-2.5 border-b border-[#F3EFE6]/10">
                <div className="flex items-center justify-between text-[#F3EFE6]/75">
                  <span>Match Completion</span>
                  <span className="text-[#F3EFE6]">+{scrapBreakdown.completionScrap}</span>
                </div>
                <div className="flex items-center justify-between text-[#F3EFE6]/75">
                  <span>Eliminations ({result.eliminations})</span>
                  <span className="text-[#F3EFE6]">+{scrapBreakdown.eliminationScrap}</span>
                </div>
                <div className="flex items-center justify-between text-[#F3EFE6]/75">
                  <span>Victory Bonus</span>
                  <span
                    className={
                      scrapBreakdown.victoryBonusScrap > 0 ? 'text-[#22C55E]' : 'text-[#F3EFE6]/40'
                    }
                  >
                    {scrapBreakdown.victoryBonusScrap > 0
                      ? `+${scrapBreakdown.victoryBonusScrap}`
                      : '0'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#F3EFE6]/75">
                  <span>Performance Bonus</span>
                  <span
                    className={
                      scrapBreakdown.performanceBonusScrap > 0
                        ? 'text-sky-300'
                        : 'text-[#F3EFE6]/40'
                    }
                  >
                    {scrapBreakdown.performanceBonusScrap > 0
                      ? `+${scrapBreakdown.performanceBonusScrap}`
                      : '0'}
                  </span>
                </div>
                {scrapFromMilestones > 0 && (
                  <div className="flex items-center justify-between text-[#86EFAC]">
                    <span>Level Milestone Bonus</span>
                    <span>+{scrapFromMilestones}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono tabular-nums pt-2">
              <span className="text-[#F3EFE6]/65">Updated Balance</span>
              <span className="font-extrabold text-sky-300">
                {progression.scrap.toLocaleString()} Scrap
              </span>
            </div>
          </div>

          {/* XP Breakdown & Level Progress */}
          <div className="bg-[#141714] border border-[#F3EFE6]/12 rounded-xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E08E26]" />
                  <span className="text-xs font-mono uppercase tracking-wider font-bold text-[#F3EFE6]">
                    Experience
                  </span>
                </div>
                <span className="font-mono text-sm font-extrabold text-[#E08E26] tabular-nums">
                  +{xpBreakdown?.totalXp ?? 0} XP
                </span>
              </div>

              {xpBreakdown && (
                <div className="space-y-1 text-xs font-mono tabular-nums pb-2.5 mb-2 border-b border-[#F3EFE6]/10">
                  <div className="flex items-center justify-between text-[#F3EFE6]/75">
                    <span>Match Completed</span>
                    <span className="text-[#F3EFE6]">+{xpBreakdown.completionXp}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#F3EFE6]/75">
                    <span>Eliminations ({result.eliminations})</span>
                    <span className="text-[#F3EFE6]">+{xpBreakdown.eliminationXp}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#F3EFE6]/75">
                    <span>Victory Bonus</span>
                    <span className={xpBreakdown.victoryBonusXp > 0 ? 'text-[#22C55E]' : 'text-[#F3EFE6]/40'}>
                      {xpBreakdown.victoryBonusXp > 0 ? `+${xpBreakdown.victoryBonusXp}` : '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#F3EFE6]/75">
                    <span>Top-3 Survival</span>
                    <span className={xpBreakdown.topThreeBonusXp > 0 ? 'text-sky-400' : 'text-[#F3EFE6]/40'}>
                      {xpBreakdown.topThreeBonusXp > 0 ? `+${xpBreakdown.topThreeBonusXp}` : '0'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              {/* Previous -> New Level & Progress Bar */}
              <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums mb-1.5">
                <div className="flex items-center gap-2">
                  {leveledUp ? (
                    <span className="inline-flex items-center gap-1 font-bold text-[#E08E26]">
                      <Star className="w-3.5 h-3.5 fill-current" />
                      LVL {prevLevel} → LVL {newLevel}
                    </span>
                  ) : (
                    <span className="font-bold text-[#F3EFE6]">Level {newLevel}</span>
                  )}
                  {leveledUp && (
                    <span className="px-1.5 py-0.5 rounded bg-[#E08E26]/20 border border-[#E08E26]/50 text-[#E08E26] text-[10px] font-extrabold uppercase">
                      Level Up!
                    </span>
                  )}
                </div>
                <span className="text-[#F3EFE6]/75">
                  {progression.xp} / {progression.xpToNext} XP
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-[#1E221D] overflow-hidden border border-[#F3EFE6]/10">
                <div
                  className="h-full bg-[#E08E26] transition-all duration-300"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Unlocked Milestones in This Match */}
        {unlockedMilestones.length > 0 && (
          <div className="bg-[#1A241B] border border-[#22C55E]/40 rounded-xl p-3 mb-4">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[#86EFAC] font-bold flex items-center gap-1.5 mb-1.5">
              <Award className="w-3.5 h-3.5" />
              Milestone Rewards Unlocked
            </div>
            <div className="flex flex-col gap-1">
              {unlockedMilestones.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-xs gap-2">
                  <span className="font-semibold text-[#F3EFE6]">
                    LVL {m.level} · {m.title}
                  </span>
                  <span className="font-mono text-[#86EFAC] shrink-0">
                    {m.type === 'currency' && m.scrapAmount
                      ? `+${m.scrapAmount} Scrap`
                      : 'Cosmetic Unlocked'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-[#F3EFE6]/65 mb-4 font-mono tabular-nums">
          <span>Survival Time: {formatPlaytime(result.survivalSec)}</span>
          <span className="text-sky-300 font-bold">
            Scrap Balance: {progression.scrap.toLocaleString()}
          </span>
        </div>

        {/* Optional Rewarded Ad Bonus Scrap Offer */}
        {onWatchRewardedAd && (
          <div className="bg-[#141714] border border-[#E08E26]/30 rounded-xl p-3 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#E08E26]">
                <Film className="w-3.5 h-3.5 shrink-0" />
                <span>Optional Supply Drop (+{REWARDED_AD_BONUS_SCRAP} Bonus Scrap)</span>
              </div>
              <p className="text-[11px] text-[#F3EFE6]/65 mt-0.5">
                {alreadyClaimedBonus
                  ? `Bonus +${REWARDED_AD_BONUS_SCRAP} Scrap claimed for this match.`
                  : adStatusText
                  ? adStatusText
                  : isRewardedSupported
                  ? `Watch a short ad to receive +${REWARDED_AD_BONUS_SCRAP} bonus Scrap.`
                  : bridgeState && (!bridgeState.isInitialized || bridgeState.isInitPending || !bridgeState.isSdkReady)
                  ? 'Rewarded ads are unavailable because the Playgama SDK is not initialized.'
                  : bridgeState?.platformId
                  ? `Rewarded ads are not supported on this platform (${bridgeState.platformId}).`
                  : 'Rewarded ads are unavailable in local/offline mode.'}
              </p>
            </div>
            <button
              type="button"
              disabled={alreadyClaimedBonus || adBusy || !isRewardedSupported}
              onClick={async () => {
                if (alreadyClaimedBonus || adBusy || !isRewardedSupported) return;
                setAdBusy(true);
                setAdStatusText(null);
                try {
                  const outcome = await onWatchRewardedAd(rewardGrantId);
                  setAdStatusText(
                    formatRewardedAdStatusMessage(outcome, REWARDED_AD_BONUS_SCRAP)
                  );
                } catch (err: unknown) {
                  const message =
                    err instanceof Error && err.message.trim()
                      ? err.message.trim().slice(0, 120)
                      : 'Unexpected ad error';
                  setAdStatusText(
                    `Rewarded ad failed (${message}) — no bonus Scrap granted.`
                  );
                } finally {
                  setAdBusy(false);
                }
              }}
              className={`min-h-[42px] px-3.5 rounded-lg font-mono text-xs font-bold shrink-0 transition whitespace-nowrap ${
                alreadyClaimedBonus
                  ? 'bg-[#1A2B1D] border border-[#22C55E]/40 text-[#86EFAC] cursor-default'
                  : isRewardedSupported && !adBusy
                  ? 'bg-[#E08E26]/20 border border-[#E08E26] text-[#FDE68A] hover:bg-[#E08E26]/30'
                  : 'bg-[#1E221D] border border-[#F3EFE6]/15 text-[#F3EFE6]/45 cursor-not-allowed'
              }`}
            >
              {alreadyClaimedBonus
                ? `+${REWARDED_AD_BONUS_SCRAP} Claimed`
                : adBusy
                ? 'Loading Ad...'
                : isRewardedSupported
                ? `Watch Ad · +${REWARDED_AD_BONUS_SCRAP} Scrap`
                : 'Ads Unavailable'}
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={adBusy}
            onClick={onPlayAgain}
            className="min-h-[48px] flex-1 px-5 rounded-xl bg-[#E08E26] text-[#141714] font-display text-xl font-extrabold tracking-wide flex items-center justify-center gap-2 hover:bg-[#EE9B32] transition whitespace-nowrap disabled:opacity-60"
          >
            <RotateCcw className="w-4 h-4" />
            Play Again
          </button>

          <button
            type="button"
            disabled={adBusy}
            onClick={onMainMenu}
            className="min-h-[48px] flex-1 px-5 rounded-xl bg-[#272C25] border border-[#F3EFE6]/20 text-[#F3EFE6] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#31382E] transition whitespace-nowrap disabled:opacity-60"
          >
            <Home className="w-4 h-4" />
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
