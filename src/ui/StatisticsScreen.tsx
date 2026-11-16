import {
  ArrowLeft,
  Award,
  BarChart3,
  Clock,
  Crosshair,
  HardDrive,
  Hexagon,
  Palette,
  Shield,
  Skull,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { ScrapBadge } from '../components/ScrapBadge';
import { ACHIEVEMENT_DEFINITIONS } from '../data/missions';
import { formatPlaytime } from '../data/progression';
import { CURRENT_SAVE_VERSION } from '../data/storage';
import { TANK_LIST } from '../data/tanks';
import { MissionsState, PlayerProgression } from '../types/game';

interface StatisticsScreenProps {
  progression: PlayerProgression;
  missionsState: MissionsState;
  lastSavedAtMs: number | null;
  onOpenProfile: () => void;
  onOpenMissions: () => void;
  onBack: () => void;
}

export function StatisticsScreen({
  progression,
  missionsState,
  lastSavedAtMs,
  onOpenProfile,
  onOpenMissions,
  onBack,
}: StatisticsScreenProps) {
  const matchesPlayed = progression.matchesPlayed;
  const matchesWon = progression.wins;
  const matchesLost = progression.defeats;
  const winRatePct =
    matchesPlayed > 0 ? ((matchesWon / matchesPlayed) * 100).toFixed(1) : '0.0';

  const unlockedAchievements = ACHIEVEMENT_DEFINITIONS.filter(
    (def) => missionsState.achievements[def.id]?.completed
  );

  const customizedTanksCount = Object.keys(progression.tankCustomizations ?? {}).length;

  return (
    <div className="w-full h-full overflow-y-auto bg-[#141714] tactical-bg-grid text-[#F3EFE6] flex flex-col">
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-7 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#F3EFE6]/12 shrink-0 bg-[#141714]/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3.5 rounded-xl border border-[#F3EFE6]/20 bg-[#1E221D] flex items-center gap-1.5 text-sm font-semibold hover:bg-[#282D26] transition whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-wide leading-none">
              Combat Statistics
            </h1>
            <p className="text-[11px] text-[#F3EFE6]/55 mt-0.5">
              Commander {progression.playerName} · Lifetime combat record, Scrap ledger &amp; unlocks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ScrapBadge scrap={progression.scrap} />
          <button
            type="button"
            onClick={onOpenProfile}
            className="min-h-[44px] px-3.5 rounded-xl bg-[#1E221D] border border-[#F3EFE6]/20 text-xs sm:text-sm font-semibold hover:border-[#E08E26]/65 hover:bg-[#262C24] transition whitespace-nowrap"
          >
            Profile
          </button>
        </div>
      </header>

      <main className="screen-transition flex-1 w-full max-w-6xl mx-auto px-4 sm:px-7 py-4 sm:py-6 flex flex-col gap-5">
        {/* Primary Combat Record Cards */}
        <section className="bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#E08E26]" />
              Match Performance
            </h2>
            <div className="text-xs font-mono text-[#F3EFE6]/60 tabular-nums">
              Level {progression.level} · {progression.totalXpEarned.toLocaleString()} Lifetime XP
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#141714] border border-[#F3EFE6]/12 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/60">
                <Shield className="w-3.5 h-3.5 text-[#E08E26]" />
                Matches Played
              </div>
              <div className="font-mono text-2xl font-extrabold tabular-nums text-[#F3EFE6] mt-1">
                {matchesPlayed.toLocaleString()}
              </div>
            </div>

            <div className="bg-[#141714] border border-[#22C55E]/25 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/60">
                <Trophy className="w-3.5 h-3.5 text-[#22C55E]" />
                Matches Won
              </div>
              <div className="font-mono text-2xl font-extrabold tabular-nums text-[#22C55E] mt-1">
                {matchesWon.toLocaleString()}
              </div>
            </div>

            <div className="bg-[#141714] border border-red-400/20 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/60">
                <Skull className="w-3.5 h-3.5 text-red-400" />
                Matches Lost
              </div>
              <div className="font-mono text-2xl font-extrabold tabular-nums text-red-300 mt-1">
                {matchesLost.toLocaleString()}
              </div>
            </div>

            <div className="bg-[#141714] border border-[#E08E26]/30 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/60">
                <Award className="w-3.5 h-3.5 text-[#E08E26]" />
                Win Rate
              </div>
              <div className="font-mono text-2xl font-extrabold tabular-nums text-[#E08E26] mt-1">
                {winRatePct}%
              </div>
              <div className="text-[10px] font-mono text-[#F3EFE6]/45 mt-0.5">
                {matchesPlayed > 0
                  ? `${matchesWon}W / ${matchesPlayed} completed`
                  : 'No matches completed'}
              </div>
            </div>

            <div className="bg-[#141714] border border-[#F3EFE6]/12 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/60">
                <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                Total Eliminations
              </div>
              <div className="font-mono text-2xl font-extrabold tabular-nums text-[#F3EFE6] mt-1">
                {progression.totalEliminations.toLocaleString()}
              </div>
            </div>

            <div className="bg-[#141714] border border-[#F3EFE6]/12 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/60">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                Combat Time
              </div>
              <div className="font-mono text-xl sm:text-2xl font-extrabold tabular-nums text-sky-300 mt-1">
                {formatPlaytime(progression.totalPlaytimeSec)}
              </div>
              <div className="text-[10px] font-mono text-[#F3EFE6]/45 mt-0.5">
                Best Rank: {progression.bestPlacement ? `#${progression.bestPlacement}` : '—'}
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Grid: Scrap Economy Ledger + Unlocks & Achievements */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Scrap Economy Ledger */}
          <section className="lg:col-span-5 bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Hexagon className="w-5 h-5 text-sky-300" />
                Scrap Economy Ledger
              </h2>
              <span className="text-[11px] font-mono text-sky-300/80">Single Currency</span>
            </div>

            <div className="space-y-2.5">
              <div className="bg-[#141714] border border-sky-400/25 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-[#F3EFE6]/65">Current Scrap Balance</div>
                  <div className="text-[11px] text-[#F3EFE6]/45 mt-0.5">
                    Available for Tank &amp; Cosmetic Shops
                  </div>
                </div>
                <div className="font-mono text-2xl font-extrabold tabular-nums text-sky-300">
                  {progression.scrap.toLocaleString()}
                </div>
              </div>

              <div className="bg-[#141714] border border-[#22C55E]/25 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/35 flex items-center justify-center text-[#22C55E] shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#F3EFE6]">Total Scrap Earned</div>
                    <div className="text-[11px] text-[#F3EFE6]/50">
                      Matches, milestones &amp; mission claims
                    </div>
                  </div>
                </div>
                <div className="font-mono text-xl font-extrabold tabular-nums text-[#86EFAC]">
                  +{progression.totalScrapEarned.toLocaleString()}
                </div>
              </div>

              <div className="bg-[#141714] border border-[#E08E26]/25 rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#E08E26]/15 border border-[#E08E26]/35 flex items-center justify-center text-[#E08E26] shrink-0">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#F3EFE6]">Total Scrap Spent</div>
                    <div className="text-[11px] text-[#F3EFE6]/50">
                      Tank unlocks, paints, decals &amp; skins
                    </div>
                  </div>
                </div>
                <div className="font-mono text-xl font-extrabold tabular-nums text-[#E08E26]">
                  {progression.totalScrapSpent.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Save Status Footer */}
            <div className="mt-1 pt-3 border-t border-[#F3EFE6]/10 flex items-center justify-between gap-2 text-[11px] font-mono text-[#F3EFE6]/55">
              <span className="inline-flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-[#22C55E]" />
                Save Format v{progression.saveVersion ?? CURRENT_SAVE_VERSION} · Auto-Saved
              </span>
              <span className="tabular-nums">
                {lastSavedAtMs
                  ? new Date(lastSavedAtMs).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Restored'}
              </span>
            </div>
          </section>

          {/* Unlocks, Customization & Achievements */}
          <section className="lg:col-span-7 bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#E08E26]" />
                Unlocks &amp; Achievements
              </h2>
              <button
                type="button"
                onClick={onOpenMissions}
                className="min-h-[38px] px-3 rounded-lg bg-[#141714] border border-[#F3EFE6]/18 text-xs font-semibold text-[#E08E26] hover:border-[#E08E26]/65 transition"
              >
                View All Missions &amp; Achievements
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono tabular-nums">
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Tanks Unlocked</div>
                <div className="text-lg font-bold text-[#F3EFE6] mt-0.5">
                  {progression.unlockedTanks.length} / {TANK_LIST.length}
                </div>
              </div>
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Paint Colors</div>
                <div className="text-lg font-bold text-[#F3EFE6] mt-0.5">
                  {progression.unlockedPaintColors.length}
                </div>
              </div>
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Decals &amp; Presets</div>
                <div className="text-lg font-bold text-[#F3EFE6] mt-0.5">
                  {progression.unlockedDecals.length} / {progression.unlockedPresets.length}
                </div>
              </div>
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="text-[10px] font-sans text-[#F3EFE6]/55">Custom Looks Saved</div>
                <div className="text-lg font-bold text-[#86EFAC] mt-0.5">
                  {customizedTanksCount}
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-[#F3EFE6]/85">
                  Unlocked Achievements ({unlockedAchievements.length} / {ACHIEVEMENT_DEFINITIONS.length})
                </span>
                <span className="font-mono text-[#E08E26]">
                  {Math.round(
                    (unlockedAchievements.length / Math.max(1, ACHIEVEMENT_DEFINITIONS.length)) *
                      100
                  )}
                  % Complete
                </span>
              </div>

              {unlockedAchievements.length === 0 ? (
                <div className="rounded-xl bg-[#141714] border border-[#F3EFE6]/10 p-4 text-xs text-[#F3EFE6]/60 text-center">
                  No achievements unlocked yet. Complete matches, destroy obstacles, and try new tanks to earn permanent badges.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5">
                  {unlockedAchievements.map((ach) => (
                    <div
                      key={ach.id}
                      className="rounded-xl bg-[#141714] border border-[#22C55E]/30 px-3 py-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#F3EFE6] truncate">
                          {ach.title}
                        </div>
                        <div className="text-[10px] text-[#F3EFE6]/55 truncate">
                          {ach.category} · {ach.description}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#22C55E]/15 text-[#86EFAC] shrink-0">
                        Unlocked
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
