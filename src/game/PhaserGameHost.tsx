import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { gameBridge, MatchLaunchConfig } from './GameBridge';
import { ArenaScene } from './scenes/ArenaScene';

const VIEWPORT_WIDTH = 1440;
const VIEWPORT_HEIGHT = 840;

interface PhaserGameHostProps {
  launchConfig: MatchLaunchConfig;
  matchInstanceKey: number;
}

export function PhaserGameHost({ launchConfig, matchInstanceKey }: PhaserGameHostProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const launchConfigRef = useRef<MatchLaunchConfig>(launchConfig);
  launchConfigRef.current = launchConfig;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialConfig = launchConfigRef.current;
    gameBridge.setLaunchConfig(initialConfig);

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: container,
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      backgroundColor: '#141714',
      antialias: true,
      roundPixels: false,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
      },
      scene: [],
      callbacks: {
        postBoot: (bootedGame) => {
          bootedGame.scene.add('ArenaScene', ArenaScene, true, initialConfig);
        },
      },
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    const handleResize = () => {
      game.scale.refresh();
    };
    const resizeObserver = new ResizeObserver(() => {
      game.scale.refresh();
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    screen.orientation?.addEventListener?.('change', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      document.removeEventListener('fullscreenchange', handleResize);
      screen.orientation?.removeEventListener?.('change', handleResize);
      gameBridge.resetInput();
      gameBridge.clearLastHudSnapshot();
      game.destroy(true);
      gameRef.current = null;
    };
  }, [matchInstanceKey, launchConfig.tankId, launchConfig.arenaId]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center bg-[#141714] overflow-hidden"
    />
  );
}
