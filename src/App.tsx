import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Crosshair, Maximize2, RotateCw } from 'lucide-react';
import { isTankUnlocked, REWARDED_AD_BONUS_SCRAP } from './data/economy';
import {
  applyGameplayEvent,
  claimMissionOrAchievementReward,
  countUnclaimedRewards,
  ensureMissionPeriodsCurrent,
} from './data/missions';
import {
  applyMatchResultToProgression,
  buyCustomPaintStudioWithScrap,
  buyDecalWithScrap,
  buyPaintColorWithScrap,
  buyPresetWithScrap,
  buySpecialCosmeticWithScrap,
  buyTankWithScrap,
  equipPlayerCosmetic,
  grantRewardedAdScrap,
  hydrateFromPlatformStorage,
  loadMissions,
  loadProgression,
  loadSettings,
  resetAllLocalData,
  resetSavedTankCustomization,
  resetSettingsToDefault,
  saveMissions,
  saveProgression,
  saveSettings,
  saveTankCustomization,
  subscribeSaveEvents,
  updatePlayerDisplayName,
} from './data/storage';
import { TANK_DEFINITIONS } from './data/tanks';
import { gameBridge, MatchLaunchConfig } from './game/GameBridge';
import { PhaserGameHost } from './game/PhaserGameHost';
import { soundFX } from './game/systems/SoundFX';
import { platformBridge } from './services/bridge/PlaygamaBridgeAdapter';
import {
  ArenaId,
  BridgeRuntimeState,
  ClaimRewardOutcome,
  CosmeticId,
  GameSettings,
  MatchProgressionSummary,
  MatchResult,
  MissionsState,
  PlayerProgression,
  PurchaseOutcome,
  RewardedAdOutcome,
  RewardScope,
  ScreenId,
  TankCustomization,
  TankDecalId,
  TankId,
} from './types/game';
import { ArenaSelectionScreen } from './ui/ArenaSelectionScreen';
import { GameHUD } from './ui/GameHUD';
import { GarageScreen } from './ui/GarageScreen';
import { HowToPlayScreen } from './ui/HowToPlayScreen';
import { LevelUpModal } from './ui/LevelUpModal';
import { MainMenu } from './ui/MainMenu';
import { MissionsScreen } from './ui/MissionsScreen';
import { ProfileScreen } from './ui/ProfileScreen';
import { ResultsScreen } from './ui/ResultsScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { StatisticsScreen } from './ui/StatisticsScreen';
import { TankRosterScreen } from './ui/TankRosterScreen';
import { enterLandscapeFullscreen, useViewportOrientation } from './utils/orientation';

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('MAIN_MENU');
  const screenRef = useRef<ScreenId>(screen);
  screenRef.current = screen;
  const [previousMenuScreen, setPreviousMenuScreen] = useState<ScreenId>('MAIN_MENU');
  const [progression, setProgression] = useState<PlayerProgression>(() => loadProgression());
  const progressionRef = useRef<PlayerProgression>(progression);
  progressionRef.current = progression;
  const [missionsState, setMissionsState] = useState<MissionsState>(() =>
    loadMissions(undefined, Date.now(), progressionRef.current)
  );
  const missionsRef = useRef<MissionsState>(missionsState);
  missionsRef.current = missionsState;
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [lastResult, setLastResult] = useState<MatchResult | null>(null);
  const [lastMatchSummary, setLastMatchSummary] = useState<MatchProgressionSummary | null>(null);
  const [levelUpModalSummary, setLevelUpModalSummary] = useState<MatchProgressionSummary | null>(null);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [matchInstanceKey, setMatchInstanceKey] = useState(1);
  const [dismissedPortraitPrompt, setDismissedPortraitPrompt] = useState(false);
  const [lastSavedAtMs, setLastSavedAtMs] = useState<number | null>(null);
  const [saveFeedbackText, setSaveFeedbackText] = useState<string | null>(null);
  const [bridgeReady, setBridgeReady] = useState<boolean>(false);
  const [bridgeState, setBridgeState] = useState<BridgeRuntimeState>(() =>
    platformBridge.getState()
  );
  const [transitioningAd, setTransitioningAd] = useState(false);
  const saveToastTimerRef = useRef<number | null>(null);

  const { isPortrait, isTouchDevice, width, canFullscreen } = useViewportOrientation();
  const showLandscapeOverlay =
    settings.landscapePromptEnabled &&
    !dismissedPortraitPrompt &&
    isPortrait &&
    (isTouchDevice || width < 640);

  useEffect(() => {
    const unsubscribe = subscribeSaveEvents((ev) => {
      if (ev.status === 'saved') {
        setLastSavedAtMs(ev.timestampMs);
        // Never show intrusive save notifications during active combat
        if (screenRef.current === 'IN_GAME') return;
        setSaveFeedbackText('Progress Saved');
        if (saveToastTimerRef.current !== null) {
          window.clearTimeout(saveToastTimerRef.current);
        }
        saveToastTimerRef.current = window.setTimeout(() => {
          setSaveFeedbackText(null);
          saveToastTimerRef.current = null;
        }, 1600);
      }
    });
    return () => {
      unsubscribe();
      if (saveToastTimerRef.current !== null) {
        window.clearTimeout(saveToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unsubState = platformBridge.subscribeState((nextState) => {
      setBridgeState(nextState);
      soundFX.setPlatformMuted(!nextState.isAudioEnabled);
      soundFX.setAdPaused(nextState.isAdPlaying || nextState.isPlatformPaused);
    });

    let active = true;
    platformBridge
      .init()
      .then(async () => {
        const hydrated = await hydrateFromPlatformStorage();
        if (!active) return;
        if (hydrated.progression) {
          progressionRef.current = hydrated.progression;
          setProgression(hydrated.progression);
        }
        if (hydrated.missions) {
          missionsRef.current = hydrated.missions;
          setMissionsState(hydrated.missions);
        }
        platformBridge.notifyGameReady();
        platformBridge.trackEvent('game_started', {
          platform_id: platformBridge.platformId,
        });
      })
      .finally(() => {
        if (active) setBridgeReady(true);
      });

    return () => {
      active = false;
      unsubState();
    };
  }, []);

  useEffect(() => {
    soundFX.configure(
      settings.soundEnabled,
      settings.soundVolume,
      settings.musicEnabled,
      settings.musicVolume
    );
  }, [settings]);

  useEffect(() => {
    soundFX.setMusicMode(
      screen === 'IN_GAME' ? 'battle' : screen === 'RESULTS' ? 'none' : 'menu'
    );
  }, [screen]);

  const checkMissionResets = useCallback(() => {
    const {
      state: checked,
      dailyReset,
      weeklyReset,
    } = ensureMissionPeriodsCurrent(missionsRef.current);
    if (dailyReset || weeklyReset || checked !== missionsRef.current) {
      missionsRef.current = checked;
      setMissionsState(checked);
      saveMissions(checked);
    }
  }, []);

  useEffect(() => {
    const onFocus = () => checkMissionResets();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [checkMissionResets]);

  useEffect(() => {
    return gameBridge.onGameplayEvent((event) => {
      const { nextState, applied } = applyGameplayEvent(missionsRef.current, event);
      if (applied || nextState !== missionsRef.current) {
        missionsRef.current = nextState;
        setMissionsState(nextState);
        saveMissions(nextState);
      }
    });
  }, []);

  useEffect(() => {
    return gameBridge.onMatchEnd((result) => {
      const { progression: nextProgression, summary } = applyMatchResultToProgression(
        progressionRef.current,
        result
      );
      progressionRef.current = nextProgression;
      setProgression(nextProgression);
      setLastResult(result);
      setLastMatchSummary(summary);
      if (!summary.alreadyProcessed) {
        platformBridge.recordCompletedMatch();
        platformBridge.trackEvent('match_completed', {
          tank_id: result.tankId,
          arena_id: result.arenaId,
          placement: result.placement,
          eliminations: result.eliminations,
          survival_sec: result.survivalSec,
        });
        platformBridge.trackEvent(result.victory ? 'match_victory' : 'match_defeat', {
          tank_id: result.tankId,
          arena_id: result.arenaId,
          placement: result.placement,
        });
      }
      if (!summary.alreadyProcessed && summary.levelsGained > 0) {
        setLevelUpModalSummary(summary);
        setShowLevelUpModal(true);
      } else {
        setLevelUpModalSummary(null);
        setShowLevelUpModal(false);
      }
      setScreen('RESULTS');
    });
  }, []);

  const navigateTo = useCallback(
    (target: ScreenId) => {
      if (target === screen) return;
      if (target === 'MAIN_MENU' || target === 'MISSIONS') {
        checkMissionResets();
      }
      if (
        screen === 'MAIN_MENU' ||
        screen === 'GARAGE' ||
        screen === 'TANK_COLLECTION' ||
        screen === 'ARENA_SELECT'
      ) {
        setPreviousMenuScreen(screen);
      }
      setScreen(target);
    },
    [checkMissionResets, screen]
  );

  const handleSelectArena = useCallback((arenaId: ArenaId) => {
    setProgression((prev) => {
      const next = { ...prev, selectedArena: arenaId };
      progressionRef.current = next;
      saveProgression(next);
      return next;
    });
  }, []);

  const handleSelectTank = useCallback((tankId: TankId) => {
    setProgression((prev) => {
      if (!TANK_DEFINITIONS[tankId]?.implemented) return prev;
      if (!isTankUnlocked(prev, tankId)) return prev;
      const next = { ...prev, selectedTank: tankId };
      progressionRef.current = next;
      saveProgression(next);
      return next;
    });
  }, []);

  const handleUpdateSettings = useCallback((next: GameSettings) => {
    const normalized: GameSettings = {
      ...next,
      lowDetailMode: next.graphicsQuality === 'low',
    };
    setSettings(normalized);
    saveSettings(normalized);
    gameBridge.emitSettingsChange(normalized);
  }, []);

  const handleResetSettings = useCallback(() => {
    const defaults = resetSettingsToDefault();
    setSettings(defaults);
    gameBridge.emitSettingsChange(defaults);
  }, []);

  const handleToggleSound = useCallback(() => {
    soundFX.unlockFromUserGesture();
    setSettings((prev) => {
      const next = { ...prev, soundEnabled: !prev.soundEnabled };
      saveSettings(next);
      gameBridge.emitSettingsChange(next);
      return next;
    });
  }, []);

  const handleToggleMusic = useCallback(() => {
    soundFX.unlockFromUserGesture();
    setSettings((prev) => {
      const next = { ...prev, musicEnabled: !prev.musicEnabled };
      saveSettings(next);
      gameBridge.emitSettingsChange(next);
      return next;
    });
  }, []);

  const handleUpdatePlayerName = useCallback((name: string) => {
    setProgression((prev) => {
      const next = updatePlayerDisplayName(prev, name);
      progressionRef.current = next;
      return next;
    });
  }, []);

  const handleEquipCosmetic = useCallback((cosmeticId: CosmeticId) => {
    setProgression((prev) => {
      const next = equipPlayerCosmetic(prev, cosmeticId);
      progressionRef.current = next;
      return next;
    });
  }, []);

  const handleApplyTankCustomization = useCallback(
    (tankId: TankId, customization: TankCustomization) => {
      setProgression((prev) => {
        const next = saveTankCustomization(prev, tankId, customization);
        progressionRef.current = next;
        return next;
      });
    },
    []
  );

  const handleResetTankCustomization = useCallback((tankId: TankId) => {
    setProgression((prev) => {
      const next = resetSavedTankCustomization(prev, tankId);
      progressionRef.current = next;
      return next;
    });
  }, []);

  const handlePurchaseTank = useCallback((tankId: TankId): PurchaseOutcome => {
    const outcome = buyTankWithScrap(progressionRef.current, tankId);
    if (outcome.success) {
      progressionRef.current = outcome.nextProgression;
      setProgression(outcome.nextProgression);
      platformBridge.trackEvent('tank_unlocked', {
        tank_id: tankId,
        cost_scrap: outcome.cost,
      });
    }
    return outcome;
  }, []);

  const handleWatchRewardedAd = useCallback(
    async (grantId: string): Promise<RewardedAdOutcome> => {
      const outcome = await platformBridge.showRewardedAd(grantId);
      if (outcome.granted) {
        const rewardRes = grantRewardedAdScrap(
          progressionRef.current,
          grantId,
          REWARDED_AD_BONUS_SCRAP
        );
        if (rewardRes.granted) {
          progressionRef.current = rewardRes.nextProgression;
          setProgression(rewardRes.nextProgression);
        } else {
          return {
            ...outcome,
            granted: false,
            reason: 'duplicate_grant',
          };
        }
      }
      return outcome;
    },
    []
  );

  const handlePurchasePaintColor = useCallback((hex: string): PurchaseOutcome => {
    const outcome = buyPaintColorWithScrap(progressionRef.current, hex);
    if (outcome.success) {
      progressionRef.current = outcome.nextProgression;
      setProgression(outcome.nextProgression);
    }
    return outcome;
  }, []);

  const handlePurchaseCustomPaint = useCallback((): PurchaseOutcome => {
    const outcome = buyCustomPaintStudioWithScrap(progressionRef.current);
    if (outcome.success) {
      progressionRef.current = outcome.nextProgression;
      setProgression(outcome.nextProgression);
    }
    return outcome;
  }, []);

  const handlePurchaseDecal = useCallback((decalId: TankDecalId): PurchaseOutcome => {
    const outcome = buyDecalWithScrap(progressionRef.current, decalId);
    if (outcome.success) {
      progressionRef.current = outcome.nextProgression;
      setProgression(outcome.nextProgression);
    }
    return outcome;
  }, []);

  const handlePurchasePreset = useCallback((presetId: string): PurchaseOutcome => {
    const outcome = buyPresetWithScrap(progressionRef.current, presetId);
    if (outcome.success) {
      progressionRef.current = outcome.nextProgression;
      setProgression(outcome.nextProgression);
    }
    return outcome;
  }, []);

  const handlePurchaseCosmetic = useCallback((cosmeticId: CosmeticId): PurchaseOutcome => {
    const outcome = buySpecialCosmeticWithScrap(progressionRef.current, cosmeticId);
    if (outcome.success) {
      progressionRef.current = outcome.nextProgression;
      setProgression(outcome.nextProgression);
    }
    return outcome;
  }, []);

  const handleClaimMissionReward = useCallback(
    (scope: RewardScope, id: string): ClaimRewardOutcome => {
      const { nextProgression, nextMissions, outcome } = claimMissionOrAchievementReward(
        progressionRef.current,
        missionsRef.current,
        scope,
        id
      );
      if (outcome.claimed) {
        progressionRef.current = nextProgression;
        missionsRef.current = nextMissions;
        setProgression(nextProgression);
        setMissionsState(nextMissions);
        saveProgression(nextProgression);
        saveMissions(nextMissions);

        if (outcome.levelsGained > 0) {
          setLevelUpModalSummary({
            matchId: `claim_${scope}_${id}`,
            xpBreakdown: {
              completionXp: outcome.xpAwarded,
              victoryBonusXp: 0,
              eliminationXp: 0,
              topThreeBonusXp: 0,
              totalXp: outcome.xpAwarded,
            },
            previousLevel: outcome.previousLevel,
            newLevel: outcome.newLevel,
            previousXp: 0,
            previousXpToNext: 0,
            newXp: nextProgression.xp,
            newXpToNext: nextProgression.xpToNext,
            levelsGained: outcome.levelsGained,
            unlockedMilestones: outcome.unlockedMilestones,
            scrapFromMatch: outcome.scrapAwarded,
            scrapFromMilestones: 0,
            totalScrapAwarded: outcome.scrapAwarded,
            alreadyProcessed: false,
          });
          setShowLevelUpModal(true);
        }
      }
      return outcome;
    },
    []
  );

  const handleResetProgress = useCallback(() => {
    const fresh = resetAllLocalData();
    progressionRef.current = fresh.progression;
    missionsRef.current = fresh.missions;
    setProgression(fresh.progression);
    setMissionsState(fresh.missions);
    setSettings(fresh.settings);
    setLastResult(null);
    setLastMatchSummary(null);
    setLevelUpModalSummary(null);
    setShowLevelUpModal(false);
    gameBridge.emitSettingsChange(fresh.settings);
  }, []);

  const launchConfig: MatchLaunchConfig = useMemo(
    () => ({
      tankId: progression.selectedTank,
      arenaId: progression.selectedArena,
      cosmeticId: progression.equippedCosmetic,
      customization: progression.tankCustomizations[progression.selectedTank] ?? null,
      settings,
    }),
    [
      progression.selectedTank,
      progression.selectedArena,
      progression.equippedCosmetic,
      progression.tankCustomizations,
      settings,
    ]
  );

  useEffect(() => {
    gameBridge.setLaunchConfig(launchConfig);
  }, [launchConfig]);

  const startBattle = useCallback(
    (tankIdOverride?: TankId) => {
      soundFX.unlockFromUserGesture();
      const activeProg = progressionRef.current;
      const targetTankId =
        tankIdOverride &&
        TANK_DEFINITIONS[tankIdOverride]?.implemented &&
        isTankUnlocked(activeProg, tankIdOverride)
          ? tankIdOverride
          : isTankUnlocked(activeProg, activeProg.selectedTank)
          ? activeProg.selectedTank
          : 'assault';
      const effectiveConfig: MatchLaunchConfig = {
        tankId: targetTankId,
        arenaId: activeProg.selectedArena,
        cosmeticId: activeProg.equippedCosmetic,
        customization: activeProg.tankCustomizations[targetTankId] ?? null,
        settings,
      };
      gameBridge.setLaunchConfig(effectiveConfig);
      setLastResult(null);
      setLastMatchSummary(null);
      setLevelUpModalSummary(null);
      setShowLevelUpModal(false);
      gameBridge.clearLastHudSnapshot();
      if (screen === 'RESULTS') {
        setScreen('IN_GAME');
        gameBridge.sendCommand('RESTART');
      } else {
        setMatchInstanceKey((k) => k + 1);
        setScreen('IN_GAME');
      }
      if (isTouchDevice) {
        enterLandscapeFullscreen();
      }
    },
    [isTouchDevice, screen, settings]
  );

  const handleResultsPlayAgain = useCallback(async () => {
    setTransitioningAd(true);
    try {
      await platformBridge.maybeShowInterstitial('match_complete', {
        inActiveMatch: screenRef.current === 'IN_GAME',
      });
    } finally {
      setTransitioningAd(false);
      startBattle();
    }
  }, [startBattle]);

  const handleResultsMainMenu = useCallback(async () => {
    setTransitioningAd(true);
    try {
      await platformBridge.maybeShowInterstitial('return_to_menu', {
        inActiveMatch: screenRef.current === 'IN_GAME',
      });
    } finally {
      setTransitioningAd(false);
      setShowLevelUpModal(false);
      setLevelUpModalSummary(null);
      setScreen('MAIN_MENU');
    }
  }, []);

  const unclaimedMissionsCount = useMemo(
    () => countUnclaimedRewards(missionsState).total,
    [missionsState]
  );

  if (!bridgeReady) {
    return (
      <div className="relative w-full h-full bg-[#141714] tactical-bg-grid text-[#F3EFE6] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#E08E26] text-[#141714] flex items-center justify-center shadow-xl border border-[#FEF08A]/45 mb-4">
          <Crosshair className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-wider uppercase text-[#F3EFE6]">
          TANKBOUND ARENA
        </h1>
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-[#E08E26] mt-2">
          Preparing Command Deck...
        </p>
        <div className="w-48 h-1.5 rounded-full bg-[#222720] border border-[#F3EFE6]/12 overflow-hidden mt-4">
          <div className="h-full w-2/3 bg-[#E08E26] animate-pulse rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#141714]">
      {screen === 'MAIN_MENU' && (
        <MainMenu
          progression={progression}
          sessionCustomizations={progression.tankCustomizations}
          unclaimedMissionsCount={unclaimedMissionsCount}
          onNavigate={navigateTo}
          onStartBattle={() => startBattle()}
        />
      )}

      {screen === 'PROFILE' && (
        <ProfileScreen
          progression={progression}
          onUpdatePlayerName={handleUpdatePlayerName}
          onEquipCosmetic={handleEquipCosmetic}
          onPurchaseCosmetic={handlePurchaseCosmetic}
          onOpenStatistics={() => navigateTo('STATISTICS')}
          onBack={() => setScreen('MAIN_MENU')}
        />
      )}

      {screen === 'STATISTICS' && (
        <StatisticsScreen
          progression={progression}
          missionsState={missionsState}
          lastSavedAtMs={lastSavedAtMs}
          onOpenProfile={() => navigateTo('PROFILE')}
          onOpenMissions={() => navigateTo('MISSIONS')}
          onBack={() => setScreen('MAIN_MENU')}
        />
      )}

      {screen === 'GARAGE' && (
        <GarageScreen
          progression={progression}
          sessionCustomizations={progression.tankCustomizations}
          onApplyCustomization={handleApplyTankCustomization}
          onResetCustomization={handleResetTankCustomization}
          onSelectTank={handleSelectTank}
          onPurchaseTank={handlePurchaseTank}
          onPurchasePreset={handlePurchasePreset}
          onPurchasePaintColor={handlePurchasePaintColor}
          onPurchaseCustomPaint={handlePurchaseCustomPaint}
          onPurchaseDecal={handlePurchaseDecal}
          onPurchaseCosmetic={handlePurchaseCosmetic}
          onEquipCosmetic={handleEquipCosmetic}
          onOpenCollection={() => navigateTo('TANK_COLLECTION')}
          onBack={() =>
            setScreen(previousMenuScreen === 'TANK_COLLECTION' ? 'TANK_COLLECTION' : 'MAIN_MENU')
          }
          onStartBattle={startBattle}
        />
      )}

      {screen === 'TANK_COLLECTION' && (
        <TankRosterScreen
          progression={progression}
          sessionCustomizations={progression.tankCustomizations}
          isRewardedSupported={bridgeState.isRewardedSupported}
          bridgeState={bridgeState}
          onWatchRewardedAd={handleWatchRewardedAd}
          onSelectTank={handleSelectTank}
          onPurchaseTank={handlePurchaseTank}
          onOpenGarage={() => navigateTo('GARAGE')}
          onBack={() => setScreen(previousMenuScreen === 'GARAGE' ? 'GARAGE' : 'MAIN_MENU')}
          onStartBattle={startBattle}
        />
      )}

      {screen === 'ARENA_SELECT' && (
        <ArenaSelectionScreen
          selectedArena={progression.selectedArena}
          onSelectArena={handleSelectArena}
          onBack={() => setScreen('MAIN_MENU')}
          onStartBattle={() => startBattle()}
        />
      )}

      {screen === 'MISSIONS' && (
        <MissionsScreen
          progression={progression}
          missionsState={missionsState}
          onClaimReward={handleClaimMissionReward}
          onCheckReset={checkMissionResets}
          onBack={() => {
            setShowLevelUpModal(false);
            setLevelUpModalSummary(null);
            setScreen('MAIN_MENU');
          }}
        />
      )}

      {screen === 'SETTINGS' && (
        <SettingsScreen
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onResetSettings={handleResetSettings}
          onResetProgress={handleResetProgress}
          onBack={() => setScreen('MAIN_MENU')}
        />
      )}

      {screen === 'HOW_TO_PLAY' && (
        <HowToPlayScreen onBack={() => setScreen('MAIN_MENU')} />
      )}

      {(screen === 'IN_GAME' || screen === 'RESULTS') && (
        <div className="relative w-full h-full">
          <PhaserGameHost
            launchConfig={launchConfig}
            matchInstanceKey={matchInstanceKey}
          />
          {screen === 'IN_GAME' && (
            <GameHUD
              settings={settings}
              selectedTankId={progression.selectedTank}
              onToggleSound={handleToggleSound}
              onToggleMusic={handleToggleMusic}
              onExitToMenu={() => setScreen('MAIN_MENU')}
              onRestartMatch={() => {
                // ArenaScene handles scene.restart internally via gameBridge
              }}
            />
          )}
        </div>
      )}

      {screen === 'RESULTS' && lastResult && (
        <ResultsScreen
          result={lastResult}
          progression={progression}
          summary={lastMatchSummary}
          isRewardedSupported={bridgeState.isRewardedSupported}
          bridgeState={bridgeState}
          onWatchRewardedAd={handleWatchRewardedAd}
          onPlayAgain={handleResultsPlayAgain}
          onMainMenu={handleResultsMainMenu}
        />
      )}

      {transitioningAd && (
        <div
          aria-live="polite"
          className="fixed inset-0 z-50 bg-[#0D0F0D]/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="rounded-xl bg-[#1E221D] border border-[#F3EFE6]/20 px-5 py-3 text-xs font-mono uppercase tracking-wider text-[#F3EFE6]/85 shadow-xl">
            Preparing Next Sector...
          </div>
        </div>
      )}

      {(screen === 'RESULTS' || screen === 'MISSIONS') &&
        showLevelUpModal &&
        levelUpModalSummary &&
        levelUpModalSummary.levelsGained > 0 && (
          <LevelUpModal
            summary={levelUpModalSummary}
            activeTankId={lastResult?.tankId ?? progression.selectedTank}
            onDismiss={() => {
              setShowLevelUpModal(false);
              setLevelUpModalSummary(null);
            }}
          />
        )}

      {/* Landscape Orientation Prompt on Portrait Mobile */}
      {showLandscapeOverlay && (
        <div className="fixed inset-0 z-50 bg-[#141714]/92 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="w-full max-w-sm bg-[#1E221D] border-2 border-[#E08E26]/45 rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-[#E08E26]/15 border border-[#E08E26]/50 text-[#E08E26] flex items-center justify-center mx-auto mb-3">
              <RotateCw className="w-6 h-6" />
            </div>
            <h2 className="font-display text-2xl font-extrabold tracking-wide text-[#F3EFE6]">
              Landscape Mode Recommended
            </h2>
            <p className="text-xs sm:text-sm text-[#F3EFE6]/75 mt-2 leading-relaxed">
              Tankbound Arena is designed for landscape dual-stick controls and full-arena visibility. Rotate your device sideways or switch to landscape fullscreen.
            </p>
            <div className="flex flex-col gap-2.5 mt-5">
              {canFullscreen && (
                <button
                  type="button"
                  onClick={() => enterLandscapeFullscreen()}
                  className="min-h-[46px] w-full rounded-xl bg-[#E08E26] text-[#141714] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#EE9B32] transition whitespace-nowrap"
                >
                  <Maximize2 className="w-4 h-4" />
                  Switch to Landscape Fullscreen
                </button>
              )}
              <button
                type="button"
                onClick={() => setDismissedPortraitPrompt(true)}
                className="min-h-[44px] w-full rounded-xl border border-[#F3EFE6]/20 text-[#F3EFE6]/85 text-sm font-medium hover:bg-[#272C25] transition whitespace-nowrap"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Subtle Non-Combat Auto-Save Feedback */}
      {saveFeedbackText && screen !== 'IN_GAME' && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-3 right-3 z-40 inline-flex items-center gap-1.5 rounded-xl bg-[#1B1F1A]/95 border border-[#22C55E]/45 px-3 py-1.5 text-[11px] font-mono font-semibold text-[#86EFAC] shadow-lg backdrop-blur-xs"
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          {saveFeedbackText}
        </div>
      )}
    </div>
  );
}
