import { useState } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  Check,
  Clock,
  Crosshair,
  Edit3,
  Hexagon,
  Lock,
  Palette,
  Shield,
  Skull,
  Sparkles,
  Trophy,
  User,
} from 'lucide-react';
import { ScrapBadge } from '../components/ScrapBadge';
import { TankPreviewSvg } from '../components/TankPreviewSvg';
import {
  COSMETIC_DEFINITIONS,
  COSMETIC_LIST,
  formatPlaytime,
  MILESTONE_REWARDS,
} from '../data/progression';
import { TANK_DEFINITIONS } from '../data/tanks';
import { CosmeticId, PlayerProgression, PurchaseOutcome } from '../types/game';

interface ProfileScreenProps {
  progression: PlayerProgression;
  onUpdatePlayerName: (name: string) => void;
  onEquipCosmetic: (cosmeticId: CosmeticId) => void;
  onPurchaseCosmetic?: (cosmeticId: CosmeticId) => PurchaseOutcome;
  onOpenStatistics?: () => void;
  onBack: () => void;
}

export function ProfileScreen({
  progression,
  onUpdatePlayerName,
  onEquipCosmetic,
  onPurchaseCosmetic,
  onOpenStatistics,
  onBack,
}: ProfileScreenProps) {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(progression.playerName);
  const [nameError, setNameError] = useState<string | null>(null);

  const activeTank = TANK_DEFINITIONS[progression.selectedTank] || TANK_DEFINITIONS.assault;
  const xpPct = Math.max(
    0,
    Math.min(100, (progression.xp / Math.max(1, progression.xpToNext)) * 100)
  );
  const xpRemaining = Math.max(0, progression.xpToNext - progression.xp);
  const winRate =
    progression.matchesPlayed > 0
      ? Math.round((progression.wins / progression.matchesPlayed) * 100)
      : 0;

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) {
      setNameError('Display name cannot be empty.');
      return;
    }
    onUpdatePlayerName(trimmed.slice(0, 20));
    setDraftName(trimmed.slice(0, 20));
    setNameError(null);
    setEditingName(false);
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-[#141714] tactical-bg-grid text-[#F3EFE6] flex flex-col">
      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-4 sm:px-7 py-3 flex items-center justify-between gap-3 border-b border-[#F3EFE6]/12 shrink-0 bg-[#141714]/80">
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
              Commander Profile
            </h1>
            <p className="text-[11px] text-[#F3EFE6]/55 mt-0.5">
              Local progression, combat record &amp; level milestone rewards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ScrapBadge scrap={progression.scrap} />
          {onOpenStatistics && (
            <button
              type="button"
              onClick={onOpenStatistics}
              className="min-h-[44px] px-3.5 rounded-xl bg-[#1E221D] border border-[#F3EFE6]/20 text-xs sm:text-sm font-semibold flex items-center gap-1.5 hover:border-[#E08E26]/65 hover:bg-[#262C24] transition whitespace-nowrap"
            >
              <BarChart3 className="w-4 h-4 text-[#22C55E]" />
              Statistics
            </button>
          )}
        </div>
      </header>

      <main className="screen-transition flex-1 w-full max-w-6xl mx-auto px-4 sm:px-7 py-4 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Identity, Level Progress, Lifetime Stats & Cosmetics */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          {/* Identity & Level Card */}
          <div className="bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-[#E08E26]/15 border-2 border-[#E08E26] flex flex-col items-center justify-center shrink-0">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-[#E08E26] leading-none">
                    LVL
                  </span>
                  <span className="font-display text-2xl font-extrabold text-[#F3EFE6] leading-none mt-0.5 tabular-nums">
                    {progression.level}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  {!editingName ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F3EFE6] leading-none truncate">
                        {progression.playerName}
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftName(progression.playerName);
                          setNameError(null);
                          setEditingName(true);
                        }}
                        aria-label="Edit display name"
                        className="min-h-[34px] px-2.5 rounded-lg bg-[#141714] border border-[#F3EFE6]/18 text-xs font-semibold text-[#F3EFE6]/80 hover:border-[#E08E26]/65 hover:text-[#E08E26] flex items-center gap-1.5 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Rename
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveName} className="flex flex-wrap items-center gap-2">
                      <label htmlFor="player-name-input" className="sr-only">
                        Player Display Name
                      </label>
                      <input
                        id="player-name-input"
                        type="text"
                        maxLength={20}
                        value={draftName}
                        onChange={(e) => {
                          setDraftName(e.target.value);
                          if (nameError) setNameError(null);
                        }}
                        autoFocus
                        placeholder="Enter callsign..."
                        className="min-h-[38px] px-3 rounded-lg bg-[#141714] border border-[#E08E26] text-sm font-semibold text-[#F3EFE6] focus:outline-none w-44 sm:w-52"
                      />
                      <button
                        type="submit"
                        className="min-h-[38px] px-3 rounded-lg bg-[#E08E26] text-[#141714] text-xs font-bold hover:bg-[#EE9B32] transition flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingName(false);
                          setNameError(null);
                        }}
                        className="min-h-[38px] px-3 rounded-lg border border-[#F3EFE6]/20 text-xs font-medium text-[#F3EFE6]/75 hover:bg-[#272C25] transition"
                      >
                        Cancel
                      </button>
                    </form>
                  )}

                  {nameError && (
                    <p className="text-xs text-red-400 mt-1">{nameError}</p>
                  )}

                  <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-[#F3EFE6]/60 tabular-nums">
                    <span className="inline-flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-[#E08E26]" />
                      Local Profile
                    </span>
                    <span>·</span>
                    <span>Lifetime XP: {progression.totalXpEarned.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* XP Progress Bar */}
            <div className="mt-4 bg-[#141714] border border-[#F3EFE6]/12 rounded-xl p-3.5">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums mb-1.5">
                <span className="text-[#E08E26] font-bold">
                  Level {progression.level} → Level {progression.level + 1}
                </span>
                <span className="text-[#F3EFE6]/85">
                  {progression.xp} / {progression.xpToNext} XP
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#1E221D] overflow-hidden border border-[#F3EFE6]/12">
                <div
                  className="h-full bg-[#E08E26] transition-all duration-300"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#F3EFE6]/55 mt-1.5 font-mono tabular-nums">
                <span>{Math.round(xpPct)}% Complete</span>
                <span>{xpRemaining} XP to next level</span>
              </div>
            </div>

            {/* Lifetime Combat Statistics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/55">
                  <Shield className="w-3.5 h-3.5 text-[#E08E26]" />
                  Total Matches
                </div>
                <div className="font-mono text-xl font-bold tabular-nums text-[#F3EFE6] mt-1">
                  {progression.matchesPlayed}
                </div>
              </div>

              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/55">
                  <Trophy className="w-3.5 h-3.5 text-[#22C55E]" />
                  Victories
                </div>
                <div className="font-mono text-xl font-bold tabular-nums text-[#22C55E] mt-1">
                  {progression.wins}
                  <span className="text-xs text-[#F3EFE6]/50 font-normal ml-1.5">
                    ({winRate}%)
                  </span>
                </div>
              </div>

              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/55">
                  <Skull className="w-3.5 h-3.5 text-red-400" />
                  Defeats
                </div>
                <div className="font-mono text-xl font-bold tabular-nums text-red-300 mt-1">
                  {progression.defeats}
                </div>
              </div>

              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/55">
                  <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                  Eliminations
                </div>
                <div className="font-mono text-xl font-bold tabular-nums text-[#F3EFE6] mt-1">
                  {progression.totalEliminations}
                </div>
              </div>

              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/55">
                  <Hexagon className="w-3.5 h-3.5 text-sky-300" />
                  Scrap Earned
                </div>
                <div className="font-mono text-xl font-bold tabular-nums text-sky-300 mt-1">
                  {progression.totalScrapEarned.toLocaleString()}
                </div>
              </div>

              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/55">
                  <Hexagon className="w-3.5 h-3.5 text-[#E08E26]" />
                  Scrap Spent
                </div>
                <div className="font-mono text-xl font-bold tabular-nums text-[#E08E26] mt-1">
                  {progression.totalScrapSpent.toLocaleString()}
                </div>
              </div>

              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/55">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  Playtime
                </div>
                <div className="font-mono text-xl font-bold tabular-nums text-[#F3EFE6] mt-1">
                  {formatPlaytime(progression.totalPlaytimeSec)}
                </div>
              </div>

              <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-xl p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[#F3EFE6]/55">
                  <Sparkles className="w-3.5 h-3.5 text-[#E08E26]" />
                  Lifetime XP
                </div>
                <div className="font-mono text-xl font-bold tabular-nums text-[#F3EFE6] mt-1">
                  {progression.totalXpEarned.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Tank Cosmetics (Visual-Only) */}
          <div className="bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="font-display text-xl font-bold flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#E08E26]" />
                  Tank Cosmetics
                </h2>
                <p className="text-xs text-[#F3EFE6]/60">
                  Earned via level milestones or unlocked with Scrap · Visual appearance only
                </p>
              </div>
              <span className="text-[11px] font-mono text-[#F3EFE6]/60">
                Previewing: {activeTank.name}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {COSMETIC_LIST.map((cosmetic) => {
                const isUnlocked =
                  cosmetic.id === 'default' ||
                  progression.unlockedCosmetics.includes(cosmetic.id);
                const isEquipped = progression.equippedCosmetic === cosmetic.id;
                const shopCost = cosmetic.scrapCost ?? 0;
                const isShopSkin = !isUnlocked && shopCost > 0 && Boolean(onPurchaseCosmetic);
                const canBuy = isShopSkin && progression.scrap >= shopCost;

                return (
                  <button
                    key={cosmetic.id}
                    type="button"
                    disabled={!isUnlocked && !canBuy}
                    onClick={() => {
                      if (isUnlocked) {
                        onEquipCosmetic(cosmetic.id);
                      } else if (canBuy && onPurchaseCosmetic) {
                        const outcome = onPurchaseCosmetic(cosmetic.id);
                        if (outcome.success) {
                          onEquipCosmetic(cosmetic.id);
                        }
                      }
                    }}
                    className={`text-left rounded-xl p-3 border flex items-center gap-3 transition ${
                      isEquipped
                        ? 'bg-[#252B23] border-[#E08E26]'
                        : isUnlocked
                        ? 'bg-[#141714] border-[#F3EFE6]/15 hover:border-[#E08E26]/55'
                        : canBuy
                        ? 'bg-[#141714] border-sky-400/35 hover:border-sky-400'
                        : 'bg-[#141714]/60 border-[#F3EFE6]/8 opacity-65 cursor-not-allowed'
                    }`}
                  >
                    <TankPreviewSvg
                      tank={activeTank}
                      cosmeticId={cosmetic.id}
                      customization={progression.tankCustomizations?.[activeTank.id] ?? null}
                      size={54}
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#F3EFE6] truncate">
                          {cosmetic.name}
                        </span>
                        {isEquipped ? (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#E08E26] text-[#141714] font-bold shrink-0">
                            Equipped
                          </span>
                        ) : isUnlocked ? (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#22C55E]/15 text-[#86EFAC] shrink-0">
                            Equip
                          </span>
                        ) : isShopSkin ? (
                          <span
                            className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              canBuy
                                ? 'bg-sky-400 text-[#141714]'
                                : 'bg-[#272D25] text-sky-300'
                            }`}
                          >
                            {canBuy ? `Buy · ${shopCost} Scrap` : `${shopCost} Scrap`}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#272D25] text-[#F3EFE6]/60 inline-flex items-center gap-1 shrink-0">
                            <Lock className="w-2.5 h-2.5" />
                            {cosmetic.unlockSourceLabel ?? `LVL ${cosmetic.unlockLevel}`}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#F3EFE6]/65 mt-0.5 leading-snug">
                        {cosmetic.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right Column: Milestone Rewards Schedule */}
        <aside className="lg:col-span-5 bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
          <div>
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Award className="w-4 h-4 text-[#E08E26]" />
              Level Milestone Rewards
            </h2>
            <p className="text-xs text-[#F3EFE6]/60 mt-0.5">
              Granted automatically once when reaching each milestone level
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            {MILESTONE_REWARDS.map((milestone) => {
              const claimed = progression.claimedMilestoneLevels.includes(milestone.level);
              const reached = progression.level >= milestone.level || claimed;
              const cosmetic = milestone.cosmeticId
                ? COSMETIC_DEFINITIONS[milestone.cosmeticId]
                : null;

              return (
                <div
                  key={milestone.id}
                  className={`rounded-xl p-3 border flex items-center gap-3 ${
                    reached
                      ? 'bg-[#1A241B] border-[#22C55E]/40'
                      : 'bg-[#141714] border-[#F3EFE6]/12'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center font-mono shrink-0 border ${
                      reached
                        ? 'bg-[#22C55E]/15 border-[#22C55E]/50 text-[#86EFAC]'
                        : 'bg-[#1E221D] border-[#F3EFE6]/15 text-[#F3EFE6]/65'
                    }`}
                  >
                    <span className="text-[9px] uppercase leading-none">LVL</span>
                    <span className="text-base font-extrabold leading-none mt-0.5">
                      {milestone.level}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#F3EFE6] truncate">
                        {milestone.title}
                      </span>
                      {reached ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#22C55E]/20 text-[#86EFAC] font-bold shrink-0">
                          <Check className="w-3 h-3" />
                          Unlocked
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#272D25] text-[#E08E26] shrink-0">
                          Level {milestone.level}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#F3EFE6]/65 mt-0.5 leading-snug">
                      {milestone.description}
                    </p>
                    {milestone.type === 'currency' && milestone.scrapAmount && (
                      <div className="text-[11px] font-mono text-[#E08E26] mt-1">
                        Reward: +{milestone.scrapAmount} Scrap
                      </div>
                    )}
                    {cosmetic && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className="w-3 h-3 rounded-full border border-[#F3EFE6]/30"
                          style={{ backgroundColor: cosmetic.previewPrimary }}
                        />
                        <span
                          className="w-3 h-3 rounded-full border border-[#F3EFE6]/30"
                          style={{ backgroundColor: cosmetic.previewAccent }}
                        />
                        <span className="text-[11px] font-mono text-[#F3EFE6]/70">
                          Cosmetic: {cosmetic.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </main>
    </div>
  );
}
