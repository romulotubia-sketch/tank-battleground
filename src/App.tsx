import { useCallback, useEffect, useMemo, useState } from 'react';
import { Maximize2, RotateCw } from 'lucide-react';
import {
  applyMatchResultToProgression,
  loadProgression,
  loadSettings,
  resetAllLocalData,
  saveProgression,
  saveSettings,
} from './data/storage';
import { TANK_DEFINITIONS } from './data/tanks';
import { gameBridge, MatchLaunchConfig } from './game/GameBridge';
import { PhaserGameHost } from './game/PhaserGameHost';
import { soundFX } from './game/systems/SoundFX';
import { platformBridge } from './services/bridge/PlaygamaBridgeAdapter';
import {
  ArenaId,
  GameSettings,
  MatchResult,
  PlayerProgression,
  ScreenId,
  TankId,
} from './types/game';
import { GameHUD } from './ui/GameHUD';
import { HowToPlayScreen } from './ui/HowToPlayScreen';
import { MainMenu } from './ui/MainMenu';
import { ResultsScreen } from './ui/ResultsScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { TankRosterScreen } from './ui/TankRosterScreen';
import { enterLandscapeFullscreen, useViewportOrientation } from './utils/orientation';

export default function App() {
  const [screen, setScreen] = useState<ScreenId>('MAIN_MENU');
  const [progression, setProgression] = useState<PlayerProgression>(() => loadProgression());
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [lastResult, setLastResult] = useState<MatchResult | null>(null);
  const [matchInstanceKey, setMatchInstanceKey] = useState(1);
  const [dismissedPortraitPrompt, setDismissedPortraitPrompt] = useState(false);

  const { isPortrait, isTouchDevice, width, canFullscreen } = useViewportOrientation();
  const showLandscapeOverlay =
    settings.landscapePromptEnabled &&
    !dismissedPortraitPrompt &&
    isPortrait &&
    (isTouchDevice || width < 640);

  useEffect(() => {
    platformBridge.init().then(() => {
      platformBridge.notifyGameReady();
    });
  }, []);

  useEffect(() => {
    soundFX.configure(settings.soundEnabled, settings.soundVolume);
  }, [settings]);

  useEffect(() => {
    return gameBridge.onMatchEnd((result) => {
      setLastResult(result);
      setProgression((prev) => applyMatchResultToProgression(prev, result));
      setScreen('RESULTS');
    });
  }, []);

  const handleSelectArena = useCallback((arenaId: ArenaId) => {
    setProgression((prev) => {
      const next = { ...prev, selectedArena: arenaId };
      saveProgression(next);
      return next;
    });
  }, []);

  const handleSelectTank = useCallback((tankId: TankId) => {
    setProgression((prev) => {
      if (!TANK_DEFINITIONS[tankId]?.implemented || !prev.unlockedTanks.includes(tankId)) return prev;
      const next = { ...prev, selectedTank: tankId };
      saveProgression(next);
      return next;
    });
  }, []);

  const handleUnlockTank = useCallback((tankId: TankId) => {
    setProgression((prev) => {
      if (prev.unlockedTanks.includes(tankId)) return prev;
      const def = TANK_DEFINITIONS[tankId];
      if (!def || !def.implemented || prev.scrap < def.unlockCost) return prev;
      const next: PlayerProgression = {
        ...prev,
        scrap: prev.scrap - def.unlockCost,
        unlockedTanks: [...prev.unlockedTanks, tankId],
        selectedTank: tankId,
      };
      saveProgression(next);
      return next;
    });
  }, []);

  const handleUpdateSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
    gameBridge.emitSettingsChange(next);
  }, []);

  const handleToggleSound = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, soundEnabled: !prev.soundEnabled };
      saveSettings(next);
      gameBridge.emitSettingsChange(next);
      return next;
    });
  }, []);

  const handleResetProgress = useCallback(() => {
    const fresh = resetAllLocalData();
    setProgression(fresh.progression);
    setSettings(fresh.settings);
  }, []);

  const launchConfig: MatchLaunchConfig = useMemo(
    () => ({
      tankId: progression.selectedTank,
      arenaId: progression.selectedArena,
      settings,
    }),
    [progression.selectedTank, progression.selectedArena, settings]
  );

  useEffect(() => {
    gameBridge.setLaunchConfig(launchConfig);
  }, [launchConfig]);

  const startBattle = useCallback(
    (tankIdOverride?: TankId) => {
      const targetTankId =
        tankIdOverride && TANK_DEFINITIONS[tankIdOverride]?.implemented
          ? tankIdOverride
          : progression.selectedTank;
      const effectiveConfig: MatchLaunchConfig = {
        tankId: targetTankId,
        arenaId: progression.selectedArena,
        settings,
      };
      gameBridge.setLaunchConfig(effectiveConfig);
      setLastResult(null);
      if (screen === 'RESULTS') {
        setScreen('IN_GAME');
        gameBridge.sendCommand('RESTART');
      } else {
        gameBridge.clearLastHudSnapshot();
        setMatchInstanceKey((k) => k + 1);
        setScreen('IN_GAME');
      }
      if (isTouchDevice) {
        // Attempt native landscape lock when user starts battle via tap
        enterLandscapeFullscreen();
      }
    },
    [isTouchDevice, progression.selectedArena, progression.selectedTank, screen, settings]
  );

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#141714]">
      {screen === 'MAIN_MENU' && (
        <MainMenu
          progression={progression}
          onNavigate={setScreen}
          onSelectArena={handleSelectArena}
          onStartBattle={startBattle}
        />
      )}

      {(screen === 'TANK_SELECT' || screen === 'TANK_COLLECTION') && (
        <TankRosterScreen
          mode={screen === 'TANK_COLLECTION' ? 'collection' : 'select'}
          progression={progression}
          onSelectTank={handleSelectTank}
          onUnlockTank={handleUnlockTank}
          onBack={() => setScreen('MAIN_MENU')}
          onStartBattle={startBattle}
        />
      )}

      {screen === 'SETTINGS' && (
        <SettingsScreen
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
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
          totalScrap={progression.scrap}
          onPlayAgain={() => startBattle()}
          onMainMenu={() => setScreen('MAIN_MENU')}
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
    </div>
  );
}
