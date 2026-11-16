import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Crosshair,
  Gift,
  Lock,
  Package,
  Shield,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { TankPreviewSvg } from '../components/TankPreviewSvg';
import {
  ACHIEVEMENT_DEFINITIONS,
  ALL_MISSION_DEFINITIONS,
  countUnclaimedRewards,
  formatCountdownDuration,
  getResetCountdowns,
  MISSION_RESET_CONFIG,
} from '../data/missions';
import { COSMETIC_DEFINITIONS } from '../data/progression';
import { TANK_DEFINITIONS } from '../data/tanks';
import {
  AchievementCategory,
  ClaimRewardOutcome,
  MissionRewardSpec,
  MissionsState,
  PlayerProgression,
  RewardScope,
} from '../types/game';

interface MissionsScreenProps {
  progression: PlayerProgression;
  missionsState: MissionsState;
  onClaimReward: (scope: RewardScope, id: string) => ClaimRewardOutcome;
  onCheckReset: () => void;
  onBack: () => void;
}

type MissionsTab = 'daily' | 'weekly' | 'achievements';
type AchievementFilter = 'All' | AchievementCategory;

const ACHIEVEMENT_CATEGORIES: AchievementFilter[] = [
  'All',
  'Combat',
  'Survival',
  'Collection',
  'Exploration',
];

function getCategoryIcon(category: AchievementCategory) {
  switch (category) {
    case 'Combat':
      return <Crosshair className="w-3.5 h-3.5" />;
    case 'Survival':
      return <Shield className="w-3.5 h-3.5" />;
    case 'Collection':
      return <Package className="w-3.5 h-3.5" />;
    case 'Exploration':
      return <Compass className="w-3.5 h-3.5" />;
  }
}

function RewardChips({
  reward,
  progression,
}: {
  reward: MissionRewardSpec;
  progression: PlayerProgression;
}) {
  const cosmetic = reward.cosmeticId ? COSMETIC_DEFINITIONS[reward.cosmeticId] : null;
  const activeTank = TANK_DEFINITIONS[progression.selectedTank] || TANK_DEFINITIONS.assault;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {reward.xp > 0 && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E08E26]/15 border border-[#E08E26]/35 text-[11px] font-mono font-bold text-[#FDE68A] tabular-nums">
          <Sparkles className="w-3 h-3 text-[#E08E26]" />
          +{reward.xp} XP
        </span>
      )}
      {reward.scrap > 0 && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/12 border border-sky-400/35 text-[11px] font-mono font-bold text-sky-300 tabular-nums">
          +{reward.scrap} Scrap
        </span>
      )}
      {cosmetic && (
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#22C55E]/12 border border-[#22C55E]/35 text-[11px] font-semibold text-[#86EFAC]">
          <TankPreviewSvg
            tank={activeTank}
            cosmeticId={cosmetic.id}
            size={24}
            className="shrink-0"
          />
          <span>{cosmetic.name} (Visual Skin)</span>
        </div>
      )}
    </div>
  );
}

export function MissionsScreen({
  progression,
  missionsState,
  onClaimReward,
  onCheckReset,
  onBack,
}: MissionsScreenProps) {
  const [activeTab, setActiveTab] = useState<MissionsTab>('daily');
  const [achFilter, setAchFilter] = useState<AchievementFilter>('All');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [claimBanner, setClaimBanner] = useState<{
    title: string;
    xp: number;
    scrap: number;
    cosmeticName: string | null;
  } | null>(null);

  useEffect(() => {
    onCheckReset();
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
      onCheckReset();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [onCheckReset]);

  const counts = useMemo(() => countUnclaimedRewards(missionsState), [missionsState]);
  const countdowns = useMemo(() => getResetCountdowns(nowMs, MISSION_RESET_CONFIG), [nowMs]);

  const xpPct = Math.max(
    0,
    Math.min(100, (progression.xp / Math.max(1, progression.xpToNext)) * 100)
  );

  const unlockedAchCount = useMemo(
    () =>
      ACHIEVEMENT_DEFINITIONS.filter((def) => missionsState.achievements[def.id]?.completed).length,
    [missionsState.achievements]
  );

  const filteredAchievements = useMemo(() => {
    if (achFilter === 'All') return ACHIEVEMENT_DEFINITIONS;
    return ACHIEVEMENT_DEFINITIONS.filter((a) => a.category === achFilter);
  }, [achFilter]);

  const handleClaim = (scope: RewardScope, id: string, title: string) => {
    const outcome = onClaimReward(scope, id);
    if (outcome.claimed) {
      const cosmeticName = outcome.cosmeticUnlocked
        ? COSMETIC_DEFINITIONS[outcome.cosmeticUnlocked]?.name ?? null
        : null;
      setClaimBanner({
        title,
        xp: outcome.xpAwarded,
        scrap: outcome.scrapAwarded,
        cosmeticName,
      });
    }
  };

  const renderMissionCard = (
    scope: 'daily' | 'weekly',
    entry: MissionsState['dailyMissions'][number]
  ) => {
    const def = ALL_MISSION_DEFINITIONS[entry.missionId];
    if (!def) return null;
    const pct = Math.max(0, Math.min(100, (entry.progress / Math.max(1, def.target)) * 100));
    const canClaim = entry.completed && !entry.claimed;

    return (
      <div
        key={def.id}
        className={`rounded-2xl border p-4 transition flex flex-col justify-between gap-3 ${
          canClaim
            ? 'bg-[#222820] border-[#E08E26] shadow-lg'
            : entry.claimed
            ? 'bg-[#191D18]/80 border-[#22C55E]/30'
            : 'bg-[#1B1F1A]/95 border-[#F3EFE6]/14'
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-xl font-extrabold tracking-wide text-[#F3EFE6] leading-tight">
                  {def.title}
                </h3>
              </div>
              <p className="text-xs text-[#F3EFE6]/72 mt-1 leading-relaxed">{def.description}</p>
            </div>

            <span
              className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider font-bold ${
                entry.claimed
                  ? 'bg-[#22C55E]/15 border border-[#22C55E]/35 text-[#86EFAC]'
                  : canClaim
                  ? 'bg-[#E08E26]/20 border border-[#E08E26]/55 text-[#FDE68A]'
                  : 'bg-[#141714] border border-[#F3EFE6]/15 text-[#F3EFE6]/60'
              }`}
            >
              {entry.claimed ? 'Claimed' : canClaim ? 'Ready' : 'Active'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1.5">
              <span className="text-[#F3EFE6]/60 uppercase text-[10px] tracking-wider">
                Progress
              </span>
              <span className={entry.completed ? 'text-[#22C55E] font-bold' : 'text-[#F3EFE6]'}>
                {entry.progress} / {def.target}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#141714] border border-[#F3EFE6]/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  entry.completed ? 'bg-[#22C55E]' : 'bg-[#E08E26]'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="pt-2.5 border-t border-[#F3EFE6]/10 flex flex-wrap items-center justify-between gap-2.5">
          <RewardChips reward={def.reward} progression={progression} />

          {canClaim ? (
            <button
              type="button"
              onClick={() => handleClaim(scope, def.id, def.title)}
              className="min-h-[44px] px-4 rounded-xl bg-[#E08E26] text-[#141714] font-display text-base font-extrabold tracking-wide uppercase flex items-center gap-1.5 hover:bg-[#EE9B32] active:scale-[0.98] transition whitespace-nowrap shadow"
            >
              <Gift className="w-4 h-4" />
              Claim
            </button>
          ) : entry.claimed ? (
            <div className="min-h-[44px] px-3.5 rounded-xl bg-[#22C55E]/12 border border-[#22C55E]/35 text-[#86EFAC] text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
              <Check className="w-4 h-4" />
              Claimed
            </div>
          ) : (
            <div className="min-h-[44px] px-3 rounded-xl bg-[#141714] border border-[#F3EFE6]/10 text-[#F3EFE6]/45 text-xs font-mono flex items-center whitespace-nowrap">
              In Progress
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#141714] tactical-bg-grid text-[#F3EFE6] flex flex-col">
      {/* Top Header */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-7 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-[#F3EFE6]/12 shrink-0 bg-[#141714]/85 backdrop-blur-xs">
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
              Missions &amp; Achievements
            </h1>
            <p className="text-[11px] font-mono text-[#F3EFE6]/55 mt-0.5">
              Daily Orders · Weekly Ops · Permanent Honors
            </p>
          </div>
        </div>

        {/* Live Commander Progression Summary */}
        <div className="flex items-center gap-2.5">
          <div className="bg-[#1E221D] border border-[#F3EFE6]/15 rounded-xl px-3 py-1.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#E08E26]/20 border border-[#E08E26]/50 text-[#E08E26] font-display font-extrabold text-sm flex items-center justify-center">
              {progression.level}
            </div>
            <div className="min-w-[96px]">
              <div className="flex items-center justify-between text-[10px] font-mono tabular-nums">
                <span className="text-[#E08E26] font-bold">LVL {progression.level}</span>
                <span className="text-[#F3EFE6]/65">
                  {progression.xp}/{progression.xpToNext} XP
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#141714] overflow-hidden mt-1 border border-[#F3EFE6]/10">
                <div className="h-full bg-[#E08E26]" style={{ width: `${xpPct}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-[#1E221D] border border-sky-400/25 rounded-xl px-3 py-2 text-right">
            <div className="text-[10px] font-mono uppercase tracking-wider text-sky-300/75 leading-none">
              Scrap
            </div>
            <div className="font-mono text-sm font-bold text-sky-300 tabular-nums mt-0.5">
              {progression.scrap}
            </div>
          </div>
        </div>
      </header>

      <main className="screen-transition flex-1 w-full max-w-6xl mx-auto px-4 sm:px-7 py-4 sm:py-5 flex flex-col gap-4">
        {/* Claim Notification Banner */}
        {claimBanner && (
          <div className="bg-[#1E2B1E] border border-[#22C55E]/55 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
              <span className="font-bold text-[#F3EFE6]">{claimBanner.title} Claimed:</span>
              {claimBanner.xp > 0 && (
                <span className="font-mono text-[#FDE68A] font-bold">+{claimBanner.xp} XP</span>
              )}
              {claimBanner.scrap > 0 && (
                <span className="font-mono text-sky-300 font-bold">+{claimBanner.scrap} Scrap</span>
              )}
              {claimBanner.cosmeticName && (
                <span className="font-semibold text-[#86EFAC]">
                  Unlocked Skin: {claimBanner.cosmeticName}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setClaimBanner(null)}
              className="text-xs font-mono text-[#F3EFE6]/70 hover:text-[#F3EFE6] px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Primary Section Tabs */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`min-h-[48px] px-2 sm:px-3 py-2 rounded-xl border font-display text-sm sm:text-xl font-bold tracking-wide flex items-center justify-center gap-1 sm:gap-2 transition ${
              activeTab === 'daily'
                ? 'bg-[#E08E26] text-[#141714] border-[#FEF08A]/50 shadow'
                : 'bg-[#1B1F1A] text-[#F3EFE6]/80 border-[#F3EFE6]/15 hover:border-[#E08E26]/55'
            }`}
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Daily</span>
            {counts.daily > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] sm:text-[11px] font-extrabold tabular-nums ${
                  activeTab === 'daily'
                    ? 'bg-[#141714] text-[#E08E26]'
                    : 'bg-[#E08E26] text-[#141714]'
                }`}
              >
                {counts.daily}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('weekly')}
            className={`min-h-[48px] px-2 sm:px-3 py-2 rounded-xl border font-display text-sm sm:text-xl font-bold tracking-wide flex items-center justify-center gap-1 sm:gap-2 transition ${
              activeTab === 'weekly'
                ? 'bg-[#E08E26] text-[#141714] border-[#FEF08A]/50 shadow'
                : 'bg-[#1B1F1A] text-[#F3EFE6]/80 border-[#F3EFE6]/15 hover:border-[#E08E26]/55'
            }`}
          >
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Weekly</span>
            {counts.weekly > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] sm:text-[11px] font-extrabold tabular-nums ${
                  activeTab === 'weekly'
                    ? 'bg-[#141714] text-[#E08E26]'
                    : 'bg-[#E08E26] text-[#141714]'
                }`}
              >
                {counts.weekly}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('achievements')}
            className={`min-h-[48px] px-2 sm:px-3 py-2 rounded-xl border font-display text-sm sm:text-xl font-bold tracking-wide flex items-center justify-center gap-1 sm:gap-2 transition ${
              activeTab === 'achievements'
                ? 'bg-[#E08E26] text-[#141714] border-[#FEF08A]/50 shadow'
                : 'bg-[#1B1F1A] text-[#F3EFE6]/80 border-[#F3EFE6]/15 hover:border-[#E08E26]/55'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Achievements</span>
            {counts.achievements > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] sm:text-[11px] font-extrabold tabular-nums shrink-0 ${
                  activeTab === 'achievements'
                    ? 'bg-[#141714] text-[#E08E26]'
                    : 'bg-[#E08E26] text-[#141714]'
                }`}
              >
                {counts.achievements}
              </span>
            )}
          </button>
        </div>

        {/* Daily Missions Section */}
        {activeTab === 'daily' && (
          <section className="flex flex-col gap-3">
            <div className="bg-[#1B1F1A]/85 border border-[#F3EFE6]/12 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-[#F3EFE6]/80">
                <span className="font-bold text-[#E08E26]">3 Active Daily Missions</span> — Complete objectives in live matches and claim your rewards before midnight reset.
              </div>
              <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#FDE68A] tabular-nums">
                <Clock className="w-3.5 h-3.5 text-[#E08E26]" />
                Resets in {formatCountdownDuration(countdowns.dailyMsLeft)} ({MISSION_RESET_CONFIG.timezone})
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {missionsState.dailyMissions.map((entry) => renderMissionCard('daily', entry))}
            </div>
          </section>
        )}

        {/* Weekly Missions Section */}
        {activeTab === 'weekly' && (
          <section className="flex flex-col gap-3">
            <div className="bg-[#1B1F1A]/85 border border-[#F3EFE6]/12 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="text-[#F3EFE6]/80">
                <span className="font-bold text-[#E08E26]">3 Active Weekly Operations</span> — Progress simultaneously alongside daily missions across matches.
              </div>
              <div className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#FDE68A] tabular-nums">
                <Clock className="w-3.5 h-3.5 text-[#E08E26]" />
                Resets in {formatCountdownDuration(countdowns.weeklyMsLeft)} ({MISSION_RESET_CONFIG.timezone})
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {missionsState.weeklyMissions.map((entry) => renderMissionCard('weekly', entry))}
            </div>
          </section>
        )}

        {/* Permanent Achievements Section */}
        {activeTab === 'achievements' && (
          <section className="flex flex-col gap-3">
            <div className="bg-[#1B1F1A]/85 border border-[#F3EFE6]/12 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                {ACHIEVEMENT_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAchFilter(cat)}
                    className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                      achFilter === cat
                        ? 'bg-[#E08E26]/20 border-[#E08E26] text-[#FDE68A]'
                        : 'bg-[#141714] border-[#F3EFE6]/12 text-[#F3EFE6]/65 hover:text-[#F3EFE6]'
                    }`}
                  >
                    {cat !== 'All' && getCategoryIcon(cat)}
                    {cat}
                  </button>
                ))}
              </div>
              <div className="text-xs font-mono tabular-nums text-[#86EFAC]">
                Unlocked {unlockedAchCount} / {ACHIEVEMENT_DEFINITIONS.length}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-4">
              {filteredAchievements.map((def) => {
                const entry = missionsState.achievements[def.id] ?? {
                  achievementId: def.id,
                  progress: 0,
                  completed: false,
                  unlockedAtMs: null,
                  claimed: false,
                  claimedAtMs: null,
                };
                const pct = Math.max(
                  0,
                  Math.min(100, (entry.progress / Math.max(1, def.target)) * 100)
                );
                const canClaim = entry.completed && !entry.claimed;

                return (
                  <div
                    key={def.id}
                    className={`rounded-2xl border p-4 transition flex flex-col justify-between gap-3 ${
                      canClaim
                        ? 'bg-[#222820] border-[#E08E26] shadow-lg'
                        : entry.completed
                        ? 'bg-[#192019] border-[#22C55E]/35'
                        : 'bg-[#1B1F1A]/95 border-[#F3EFE6]/14'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-[#E08E26] mb-1">
                            {getCategoryIcon(def.category)}
                            <span>{def.category}</span>
                          </div>
                          <h3 className="font-display text-xl font-extrabold tracking-wide text-[#F3EFE6] leading-tight">
                            {def.title}
                          </h3>
                          <p className="text-xs text-[#F3EFE6]/72 mt-1 leading-relaxed">
                            {def.description}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider font-bold flex items-center gap-1 ${
                            entry.claimed
                              ? 'bg-[#22C55E]/15 border border-[#22C55E]/35 text-[#86EFAC]'
                              : entry.completed
                              ? 'bg-[#E08E26]/20 border border-[#E08E26]/55 text-[#FDE68A]'
                              : 'bg-[#141714] border border-[#F3EFE6]/12 text-[#F3EFE6]/50'
                          }`}
                        >
                          {entry.claimed ? (
                            <>
                              <Check className="w-3 h-3" />
                              Claimed
                            </>
                          ) : entry.completed ? (
                            <>
                              <Trophy className="w-3 h-3" />
                              Unlocked
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              Locked
                            </>
                          )}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1.5">
                          <span className="text-[#F3EFE6]/60 uppercase text-[10px] tracking-wider">
                            Career Progress
                          </span>
                          <span
                            className={entry.completed ? 'text-[#22C55E] font-bold' : 'text-[#F3EFE6]'}
                          >
                            {entry.progress} / {def.target}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#141714] border border-[#F3EFE6]/10 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              entry.completed ? 'bg-[#22C55E]' : 'bg-[#E08E26]'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-[#F3EFE6]/10 flex flex-wrap items-center justify-between gap-2.5">
                      <RewardChips reward={def.reward} progression={progression} />

                      {canClaim ? (
                        <button
                          type="button"
                          onClick={() => handleClaim('achievement', def.id, def.title)}
                          className="min-h-[44px] px-4 rounded-xl bg-[#E08E26] text-[#141714] font-display text-base font-extrabold tracking-wide uppercase flex items-center gap-1.5 hover:bg-[#EE9B32] active:scale-[0.98] transition whitespace-nowrap shadow"
                        >
                          <Gift className="w-4 h-4" />
                          Claim
                        </button>
                      ) : entry.claimed ? (
                        <div className="min-h-[44px] px-3.5 rounded-xl bg-[#22C55E]/12 border border-[#22C55E]/35 text-[#86EFAC] text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                          <Check className="w-4 h-4" />
                          Claimed
                        </div>
                      ) : (
                        <div className="min-h-[44px] px-3 rounded-xl bg-[#141714] border border-[#F3EFE6]/10 text-[#F3EFE6]/45 text-xs font-mono flex items-center whitespace-nowrap">
                          Locked
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
