import { useState } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Trash2, Volume2, VolumeX } from 'lucide-react';
import { GameSettings } from '../types/game';
import {
  enterLandscapeFullscreen,
  exitLandscapeFullscreen,
  useViewportOrientation,
} from '../utils/orientation';

interface SettingsScreenProps {
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onResetProgress: () => void;
  onBack: () => void;
}

export function SettingsScreen({
  settings,
  onUpdateSettings,
  onResetProgress,
  onBack,
}: SettingsScreenProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const { isLandscape, isFullscreen, canFullscreen } = useViewportOrientation();

  return (
    <div className="w-full h-full overflow-y-auto bg-[#161915] text-[#F3EFE6] flex flex-col">
      <header className="w-full max-w-4xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-[#F3EFE6]/10 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3 rounded-lg border border-[#F3EFE6]/20 flex items-center gap-1.5 text-sm font-medium hover:bg-[#232721] transition whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-wide">
            Settings
          </h1>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-8 py-5 flex flex-col gap-4">
        {/* Landscape & Display */}
        <section className="bg-[#1E221D] border border-[#F3EFE6]/12 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Landscape & Display</h2>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">
                Current Orientation: {isLandscape ? 'Landscape' : 'Portrait'}
              </div>
              <div className="text-xs text-[#F3EFE6]/60">
                Lock fullscreen landscape mode on supported Android and desktop browsers
              </div>
            </div>
            {canFullscreen && (
              <button
                type="button"
                onClick={() => {
                  if (isFullscreen) exitLandscapeFullscreen();
                  else enterLandscapeFullscreen();
                }}
                className={`min-h-[44px] px-4 rounded-lg border font-semibold text-sm flex items-center gap-2 transition whitespace-nowrap ${
                  isFullscreen
                    ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                    : 'bg-[#161915] text-[#F3EFE6] border-[#F3EFE6]/25 hover:border-[#F3EFE6]/45'
                }`}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
                {isFullscreen ? 'Exit Fullscreen' : 'Enter Landscape Fullscreen'}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Portrait Rotation Prompt</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Show a landscape reminder when holding mobile devices vertically
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  landscapePromptEnabled: !settings.landscapePromptEnabled,
                })
              }
              className={`min-h-[44px] px-4 rounded-lg border font-semibold text-sm transition whitespace-nowrap ${
                settings.landscapePromptEnabled
                  ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                  : 'bg-[#161915] text-[#F3EFE6]/70 border-[#F3EFE6]/20'
              }`}
            >
              {settings.landscapePromptEnabled ? 'Enabled' : 'Off'}
            </button>
          </div>
        </section>

        {/* Audio Section */}
        <section className="bg-[#1E221D] border border-[#F3EFE6]/12 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Audio</h2>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Sound Effects</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Synthesized cannon, impact, and alert audio
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })
              }
              className={`min-h-[44px] px-4 rounded-lg border font-semibold text-sm flex items-center gap-2 transition whitespace-nowrap ${
                settings.soundEnabled
                  ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                  : 'bg-[#161915] text-[#F3EFE6]/70 border-[#F3EFE6]/20'
              }`}
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
              {settings.soundEnabled ? 'Enabled' : 'Muted'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <label htmlFor="volume-slider" className="text-sm font-medium text-[#F3EFE6]/85">
              Master Volume
            </label>
            <div className="flex items-center gap-3 w-48 sm:w-64">
              <input
                id="volume-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.soundVolume * 100)}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    soundVolume: Number(e.target.value) / 100,
                  })
                }
                className="w-full accent-[#E08E26]"
              />
              <span className="w-10 text-right font-mono text-xs tabular-nums">
                {Math.round(settings.soundVolume * 100)}%
              </span>
            </div>
          </div>
        </section>

        {/* Controls & Performance */}
        <section className="bg-[#1E221D] border border-[#F3EFE6]/12 rounded-xl p-4 sm:p-5 flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Controls & Performance</h2>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Virtual Joysticks</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Always display touch joysticks or auto-detect touchscreens
              </div>
            </div>
            <div className="flex items-center gap-1 bg-[#161915] p-1 rounded-lg border border-[#F3EFE6]/15">
              {(['always', 'auto'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, showTouchControls: opt })}
                  className={`min-h-[38px] px-3.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
                    settings.showTouchControls === opt
                      ? 'bg-[#E08E26] text-[#141714]'
                      : 'text-[#F3EFE6]/70 hover:text-[#F3EFE6]'
                  }`}
                >
                  {opt === 'always' ? 'Always Show' : 'Touch Only'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Auto-Fire on Full Aim</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Fire automatically when pushing the aiming stick to the outer ring
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, autoFireOnAim: !settings.autoFireOnAim })
              }
              className={`min-h-[44px] px-4 rounded-lg border font-semibold text-sm transition whitespace-nowrap ${
                settings.autoFireOnAim
                  ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                  : 'bg-[#161915] text-[#F3EFE6]/70 border-[#F3EFE6]/20'
              }`}
            >
              {settings.autoFireOnAim ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Low-Spec Battery Mode</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Reduces particle count and screen shake for older Android devices
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, lowDetailMode: !settings.lowDetailMode })
              }
              className={`min-h-[44px] px-4 rounded-lg border font-semibold text-sm transition whitespace-nowrap ${
                settings.lowDetailMode
                  ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                  : 'bg-[#161915] text-[#F3EFE6]/70 border-[#F3EFE6]/20'
              }`}
            >
              {settings.lowDetailMode ? 'Enabled' : 'Standard'}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Match Time Limit</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Timer winner uses highest remaining HP, then eliminations
              </div>
            </div>
            <div className="flex items-center gap-1 bg-[#161915] p-1 rounded-lg border border-[#F3EFE6]/15">
              {[90, 150, 210].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, matchDurationSec: sec })}
                  className={`min-h-[38px] px-3 rounded-md font-mono text-xs font-semibold tabular-nums transition whitespace-nowrap ${
                    settings.matchDurationSec === sec
                      ? 'bg-[#E08E26] text-[#141714]'
                      : 'text-[#F3EFE6]/70 hover:text-[#F3EFE6]'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Local Data Management */}
        <section className="bg-[#1E221D] border border-[#F3EFE6]/12 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Local Progression Data</div>
            <div className="text-xs text-[#F3EFE6]/60">
              Clears unlocked tanks, Scrap balance, and career stats stored in this browser
            </div>
          </div>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[44px] px-4 rounded-lg border border-red-500/40 text-red-400 text-sm font-semibold flex items-center gap-2 hover:bg-red-500/10 transition whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              Reset Progress
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetProgress();
                  setConfirmReset(false);
                }}
                className="min-h-[44px] px-4 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition whitespace-nowrap"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[44px] px-4 rounded-lg border border-[#F3EFE6]/20 text-sm font-medium hover:bg-[#272C25] transition whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
