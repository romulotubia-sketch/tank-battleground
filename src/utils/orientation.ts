import { useEffect, useState } from 'react';

export interface ViewportOrientationState {
  width: number;
  height: number;
  isLandscape: boolean;
  isPortrait: boolean;
  isCompactLandscape: boolean;
  isTouchDevice: boolean;
  isFullscreen: boolean;
  canFullscreen: boolean;
}

function readState(): ViewportOrientationState {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 720,
      isLandscape: true,
      isPortrait: false,
      isCompactLandscape: false,
      isTouchDevice: false,
      isFullscreen: false,
      canFullscreen: false,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isLandscape = width >= height;
  const isPortrait = height > width;
  const isCompactLandscape = isLandscape && height <= 500;
  const isTouchDevice =
    'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isFullscreen = Boolean(document.fullscreenElement);
  const canFullscreen = Boolean(
    document.fullscreenEnabled ||
      document.documentElement.requestFullscreen
  );

  return {
    width,
    height,
    isLandscape,
    isPortrait,
    isCompactLandscape,
    isTouchDevice,
    isFullscreen,
    canFullscreen,
  };
}

export function useViewportOrientation(): ViewportOrientationState {
  const [state, setState] = useState<ViewportOrientationState>(() => readState());

  useEffect(() => {
    const update = () => setState(readState());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    document.addEventListener('fullscreenchange', update);
    screen.orientation?.addEventListener?.('change', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      document.removeEventListener('fullscreenchange', update);
      screen.orientation?.removeEventListener?.('change', update);
    };
  }, []);

  return state;
}

export async function enterLandscapeFullscreen(): Promise<boolean> {
  try {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen();
    }
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    if (orientation && typeof orientation.lock === 'function') {
      await orientation.lock('landscape').catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

export async function exitLandscapeFullscreen(): Promise<void> {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      unlock?: () => void;
    };
    if (orientation && typeof orientation.unlock === 'function') {
      orientation.unlock();
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch {
    // Ignore unsupported browser rejections
  }
}
