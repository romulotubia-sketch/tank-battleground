import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Film,
  Hexagon,
  Lock,
  Play,
  Shield,
  ShoppingCart,
  Wrench,
  Zap,
} from 'lucide-react';
import { ScrapBadge } from '../components/ScrapBadge';
import { TankPreviewSvg } from '../components/TankPreviewSvg';
import { isTankUnlocked, REWARDED_AD_BONUS_SCRAP } from '../data/economy';
import {
  getEffectiveTankMaxHp,
  getEffectiveTankMoveSpeed,
  getEffectiveTankProjectileRange,
  getEffectiveTankReloadSec,
  TANK_DEFINITIONS,
  TANK_LIST,
} from '../data/tanks';
import {
  PlayerProgression,
  PurchaseOutcome,
  RewardedAdOutcome,
  TankCustomization,
  TankId,
} from '../types/game';

interface TankRosterScreenProps {
  progression: PlayerProgression;
  sessionCustomizations?: Partial<Record<TankId, TankCustomization>>;
  isRewardedSupported?: boolean;
  onWatchRewardedAd?: (grantId: string) => Promise<RewardedAdOutcome>;
  onSelectTank: (tankId: TankId) => void;
  onPurchaseTank: (tankId: TankId) => PurchaseOutcome;
  onOpenGarage: () => void;
  onBack: () => void;
  onStartBattle: (tankId?: TankId) => void;
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-20 text-[#F3EFE6]/65 font-medium">{label}</span>
      <div className="flex-1 h-2 bg-[#141714] rounded-sm overflow-hidden border border-[#F3EFE6]/10">
        <div
          className="h-full bg-[#E08E26] transition-all duration-200"
          style={{ width: `${value * 10}%` }}
        />
      </div>
      <span className="w-7 text-right font-mono tabular-nums text-[#F3EFE6]/85">
        {value}/10
      </span>
    </div>
  );
}

export function TankRosterScreen({
  progression,
  sessionCustomizations,
  isRewardedSupported = false,
  onWatchRewardedAd,
  onSelectTank,
  onPurchaseTank,
  onOpenGarage,
  onBack,
  onStartBattle,
}: TankRosterScreenProps) {
  const [inspectedId, setInspectedId] = useState<TankId>(progression.selectedTank);
  const [adBusy, setAdBusy] = useState(false);
  const [shopNotice, setShopNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setInspectedId((curr) => (curr in TANK_DEFINITIONS ? curr : progression.selectedTank));
  }, [progression.selectedTank]);

  const inspectedTank = TANK_DEFINITIONS[inspectedId] || TANK_DEFINITIONS.assault;
  const effectiveMaxHp = getEffectiveTankMaxHp(inspectedTank);
  const effectiveMoveSpeed = getEffectiveTankMoveSpeed(inspectedTank);
  const effectiveRange = getEffectiveTankProjectileRange(inspectedTank);
  const effectiveReloadSec = getEffectiveTankReloadSec(inspectedTank);
  const isUnlocked = isTankUnlocked(progression, inspectedTank.id);
  const isSelected = isUnlocked && progression.selectedTank === inspectedTank.id;
  const canAfford = progression.scrap >= inspectedTank.unlockCost;
  const scrapMissing = Math.max(0, inspectedTank.unlockCost - progression.scrap);

  const handleBuyTank = (tankId: TankId) => {
    const def = TANK_DEFINITIONS[tankId];
    const outcome = onPurchaseTank(tankId);
    if (outcome.success) {
      setShopNotice({
        type: 'success',
        text: `${def.name} unlocked and ready for deployment! (-${outcome.cost} Scrap)`,
      });
    } else if (outcome.reason === 'insufficient_scrap') {
      setShopNotice({
        type: 'error',
        text: `Insufficient Scrap: need ${Math.max(0, outcome.cost - outcome.remainingScrap)} more Scrap to unlock ${def.name}.`,
      });
    } else if (outcome.reason === 'already_unlocked') {
      setShopNotice({
        type: 'error',
        text: `${def.name} is already unlocked.`,
      });
    }
  };

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
              Tank Shop &amp; Hangar
            </h1>
            <p className="text-[11px] text-[#F3EFE6]/55 mt-0.5">
              {progression.unlockedTanks.length} of {TANK_LIST.length} tanks unlocked · Unlock new chassis with Scrap
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <ScrapBadge scrap={progression.scrap} />

          <button
            type="button"
            onClick={onOpenGarage}
            className="min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-[#1E221D] border border-[#F3EFE6]/20 text-xs sm:text-sm font-semibold flex items-center gap-2 hover:border-[#E08E26]/65 hover:bg-[#262C24] transition whitespace-nowrap"
          >
            <Wrench className="w-4 h-4 text-[#E08E26]" />
            Open Garage
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="screen-transition flex-1 w-full max-w-6xl mx-auto px-4 sm:px-7 py-3.5 sm:py-5 grid grid-cols-1 landscape:grid-cols-12 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* All 6 Tank Cards */}
        <section className="landscape:col-span-7 lg:col-span-7 flex flex-col gap-3">
          {shopNotice && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold border flex items-center justify-between gap-2 ${
                shopNotice.type === 'success'
                  ? 'bg-[#1A2B1D] border-[#22C55E]/50 text-[#86EFAC]'
                  : 'bg-[#2B1B1B] border-red-400/45 text-red-300'
              }`}
            >
              <span>{shopNotice.text}</span>
              <button
                type="button"
                onClick={() => setShopNotice(null)}
                className="text-[11px] font-mono opacity-75 hover:opacity-100 px-1.5"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {TANK_LIST.map((tank) => {
              const unlocked = isTankUnlocked(progression, tank.id);
              const selected = unlocked && progression.selectedTank === tank.id;
              const focused = inspectedTank.id === tank.id;
              const affordable = progression.scrap >= tank.unlockCost;
              const customForCard =
                sessionCustomizations?.[tank.id] ?? progression.tankCustomizations?.[tank.id] ?? null;

              return (
                <button
                  key={tank.id}
                  type="button"
                  onClick={() => {
                    setInspectedId(tank.id);
                    setShopNotice(null);
                    if (unlocked) {
                      onSelectTank(tank.id);
                    }
                  }}
                  aria-pressed={selected}
                  className={`text-left rounded-xl p-3 border transition flex flex-col items-center gap-2 relative ${
                    selected
                      ? 'bg-[#252B23] border-[#E08E26] shadow-lg'
                      : focused
                      ? 'bg-[#212620] border-[#F3EFE6]/45'
                      : unlocked
                      ? 'bg-[#1B1F1A]/95 border-[#F3EFE6]/12 hover:border-[#F3EFE6]/30'
                      : 'bg-[#171A16]/90 border-[#F3EFE6]/10 hover:border-sky-400/45'
                  }`}
                >
                  <div className="relative">
                    <div className={unlocked ? '' : 'opacity-70 saturate-75'}>
                      <TankPreviewSvg
                        tank={tank}
                        cosmeticId={progression.equippedCosmetic}
                        customization={customForCard}
                        size={78}
                      />
                    </div>
                    {selected ? (
                      <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#22C55E] text-[#141714] flex items-center justify-center shadow">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    ) : !unlocked ? (
                      <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#141714] border border-sky-400/50 text-sky-300 flex items-center justify-center shadow">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                    ) : null}
                  </div>

                  <div className="w-full text-center">
                    <div className="font-display text-lg font-bold leading-tight truncate text-[#F3EFE6]">
                      {tank.name}
                    </div>
                    <div className="text-[11px] text-[#F3EFE6]/60 truncate">
                      {tank.role}
                    </div>
                    {unlocked ? (
                      <div
                        className={`mt-1 text-[10px] font-mono uppercase tracking-wider font-semibold ${
                          selected ? 'text-[#22C55E]' : 'text-[#F3EFE6]/55'
                        }`}
                      >
                        {selected ? 'Selected' : 'Unlocked'}
                      </div>
                    ) : (
                      <div
                        className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tabular-nums border ${
                          affordable
                            ? 'bg-sky-500/15 border-sky-400/45 text-sky-300'
                            : 'bg-[#141714] border-[#F3EFE6]/15 text-[#F3EFE6]/55'
                        }`}
                      >
                        <Hexagon className="w-2.5 h-2.5" />
                        {tank.unlockCost} Scrap
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Detailed Inspector & Tank Purchase Panel */}
        <aside className="landscape:col-span-5 lg:col-span-5 bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5">
          <div className="flex items-center gap-3.5">
            <TankPreviewSvg
              tank={inspectedTank}
              cosmeticId={progression.equippedCosmetic}
              customization={
                sessionCustomizations?.[inspectedTank.id] ??
                progression.tankCustomizations?.[inspectedTank.id] ??
                null
              }
              size={86}
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-[#E08E26] font-medium truncate">
                  {inspectedTank.role} · {effectiveMaxHp} HP
                </div>
                {!isUnlocked ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#141714] border border-sky-400/40 text-sky-300 text-[10px] font-mono font-bold shrink-0">
                    <Lock className="w-2.5 h-2.5" />
                    Locked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#22C55E]/15 border border-[#22C55E]/35 text-[#86EFAC] text-[10px] font-mono font-bold shrink-0">
                    <Check className="w-2.5 h-2.5" />
                    Owned
                  </span>
                )}
              </div>
              <h2 className="font-display text-3xl font-extrabold text-[#F3EFE6] leading-tight truncate">
                {inspectedTank.name}
              </h2>
              <p className="text-xs text-[#F3EFE6]/75 mt-1 leading-relaxed">
                {inspectedTank.description}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[#F3EFE6]/10">
            <StatBar label="Armor" value={inspectedTank.ratings.armor} />
            <StatBar label="Firepower" value={inspectedTank.ratings.firepower} />
            <StatBar label="Mobility" value={inspectedTank.ratings.mobility} />
            <StatBar label="Range" value={inspectedTank.ratings.range} />
          </div>

          {/* Numeric Combat, Magazine & Reload Specifications */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F3EFE6]/10 text-xs font-mono tabular-nums">
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Health</div>
              <div className="font-bold text-[#F3EFE6]">{effectiveMaxHp} HP</div>
            </div>
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Move Speed</div>
              <div className="font-bold text-[#F3EFE6]">{effectiveMoveSpeed}</div>
            </div>
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Proj. Range</div>
              <div className="font-bold text-[#F3EFE6]">{effectiveRange}</div>
            </div>
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Magazine</div>
              <div className="font-bold text-[#E08E26]">
                {inspectedTank.stats.magazineCapacity} Rounds
              </div>
            </div>
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Reload</div>
              <div className="font-bold text-emerald-400">
                {effectiveReloadSec.toFixed(2)}s
              </div>
            </div>
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg px-2.5 py-2">
              <div className="text-[10px] font-sans text-[#F3EFE6]/55">Damage</div>
              <div className="font-bold text-[#F3EFE6]">
                {inspectedTank.stats.projectileDamage}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-[#F3EFE6]/10 text-xs">
            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg p-2.5">
              <div className="flex items-center justify-between font-semibold text-[#E08E26]">
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Active: {inspectedTank.activeAbility.name}
                </span>
                <span className="font-mono tabular-nums text-[#F3EFE6]/65">
                  {inspectedTank.activeAbility.cooldownSec}s CD
                </span>
              </div>
              <p className="text-[#F3EFE6]/75 mt-1 leading-relaxed">
                {inspectedTank.activeAbility.description}
              </p>
            </div>

            <div className="bg-[#141714] border border-[#F3EFE6]/10 rounded-lg p-2.5">
              <div className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                <Shield className="w-3.5 h-3.5" />
                Passive: {inspectedTank.passiveAbility.name}
              </div>
              <p className="text-[#F3EFE6]/75 mt-1 leading-relaxed">
                {inspectedTank.passiveAbility.description}
              </p>
            </div>
          </div>

          {!isUnlocked ? (
            <div className="pt-2 border-t border-[#F3EFE6]/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-[#F3EFE6]/65">Unlock Cost</span>
                <span className="font-bold text-sky-300">
                  {inspectedTank.unlockCost} Scrap
                </span>
              </div>
              <button
                type="button"
                disabled={!canAfford}
                onClick={() => handleBuyTank(inspectedTank.id)}
                className={`min-h-[48px] w-full px-5 rounded-xl font-display text-lg font-extrabold tracking-wide flex items-center justify-center gap-2 transition whitespace-nowrap ${
                  canAfford
                    ? 'bg-sky-400 text-[#141714] hover:bg-sky-300 shadow-lg'
                    : 'bg-[#141714] border border-[#F3EFE6]/15 text-[#F3EFE6]/45 cursor-not-allowed'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                {canAfford
                  ? `Unlock Tank · ${inspectedTank.unlockCost} Scrap`
                  : `Need ${scrapMissing} More Scrap`}
              </button>
              {onWatchRewardedAd && !canAfford && (
                <button
                  type="button"
                  disabled={!isRewardedSupported || adBusy}
                  onClick={async () => {
                    if (!isRewardedSupported || adBusy) return;
                    setAdBusy(true);
                    try {
                      const grantId = `shop_${Date.now()}`;
                      const outcome = await onWatchRewardedAd(grantId);
                      if (outcome.granted) {
                        setShopNotice({
                          type: 'success',
                          text: `Supply Drop received: +${REWARDED_AD_BONUS_SCRAP} Scrap!`,
                        });
                      } else if (outcome.status === 'skipped') {
                        setShopNotice({
                          type: 'error',
                          text: 'Ad closed early — no bonus Scrap awarded.',
                        });
                      } else {
                        setShopNotice({
                          type: 'error',
                          text: 'Rewarded ads are unavailable offline or right now.',
                        });
                      }
                    } finally {
                      setAdBusy(false);
                    }
                  }}
                  className={`min-h-[40px] w-full px-3 rounded-lg border text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition ${
                    isRewardedSupported && !adBusy
                      ? 'bg-[#222820] border-[#E08E26]/65 text-[#FDE68A] hover:bg-[#2B3227]'
                      : 'bg-[#141714] border-[#F3EFE6]/12 text-[#F3EFE6]/40 cursor-not-allowed'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  {adBusy
                    ? 'Loading Ad...'
                    : isRewardedSupported
                    ? `Optional Ad · +${REWARDED_AD_BONUS_SCRAP} Scrap`
                    : 'Optional Ad (+35 Scrap) · Offline Unavailable'}
                </button>
              )}
            </div>
          ) : (
            <div className="pt-1 flex items-center gap-2.5">
              {!isSelected ? (
                <button
                  type="button"
                  onClick={() => onSelectTank(inspectedTank.id)}
                  className="min-h-[46px] flex-1 px-4 rounded-xl bg-[#272D25] border border-[#F3EFE6]/25 text-sm font-semibold hover:bg-[#31382E] transition whitespace-nowrap"
                >
                  Select Tank
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenGarage}
                  className="min-h-[46px] flex-1 px-4 rounded-xl bg-[#272D25] border border-[#F3EFE6]/25 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#31382E] transition whitespace-nowrap"
                >
                  <Wrench className="w-4 h-4 text-[#E08E26]" />
                  Customize in Garage
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onSelectTank(inspectedTank.id);
                  onStartBattle(inspectedTank.id);
                }}
                className="min-h-[46px] flex-1 px-5 rounded-xl bg-[#E08E26] text-[#141714] font-display text-lg font-extrabold tracking-wide flex items-center justify-center gap-2 hover:bg-[#EE9B32] transition whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                Play Match
              </button>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
