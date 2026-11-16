import { useState } from 'react';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Music,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GameSettings, GraphicsQuality } from '../types/game';
import { isVibrationSupported } from '../utils/haptics';
import {
  enterLandscapeFullscreen,
  exitLandscapeFullscreen,
  useViewportOrientation,
} from '../utils/orientation';

interface SettingsScreenProps {
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onResetSettings: () => void;
  onResetProgress: () => void;
  onBack: () => void;
}

const QUALITY_OPTIONS: Array<{ id: GraphicsQuality; label: string }> = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
];

export function SettingsScreen({
  settings,
  onUpdateSettings,
  onResetSettings,
  onResetProgress,
  onBack,
}: SettingsScreenProps) {
  const [confirmResetProgress, setConfirmResetProgress] = useState(false);
  const { isLandscape, isFullscreen, canFullscreen } = useViewportOrientation();
  const vibrationSupported = isVibrationSupported();

  return (
    <div className="w-full h-full overflow-y-auto bg-[#141714] tactical-bg-grid text-[#F3EFE6] flex flex-col">
      <header className="w-full max-w-4xl mx-auto px-4 sm:px-7 py-3 flex items-center justify-between gap-3 border-b border-[#F3EFE6]/12 shrink-0 bg-[#141714]/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3.5 rounded-xl border border-[#F3EFE6]/20 bg-[#1E221D] flex items-center gap-1.5 text-sm font-semibold hover:bg-[#282D26] transition whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-wide">
            Settings
          </h1>
        </div>

        <button
          type="button"
          onClick={onResetSettings}
          className="min-h-[44px] px-3.5 rounded-xl border border-[#F3EFE6]/20 bg-[#1E221D] text-xs sm:text-sm font-semibold flex items-center gap-1.5 text-[#F3EFE6]/85 hover:border-[#E08E26]/65 hover:text-[#F3EFE6] transition whitespace-nowrap"
        >
          <RotateCcw className="w-4 h-4 text-[#E08E26]" />
          Reset to Default
        </button>
      </header>

      <main className="screen-transition flex-1 w-full max-w-4xl mx-auto px-4 sm:px-7 py-5 flex flex-col gap-4">
        {/* Audio Section */}
        <section className="bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Audio</h2>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Sound Effects</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Cannon fire, armor impacts, ability cues, and movement rumble
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled })
              }
              className={`min-h-[44px] px-4 rounded-xl border font-semibold text-sm flex items-center gap-2 transition whitespace-nowrap ${
                settings.soundEnabled
                  ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                  : 'bg-[#141714] text-[#F3EFE6]/70 border-[#F3EFE6]/20'
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="sfx-volume-slider" className="text-sm font-medium text-[#F3EFE6]/85">
              Sound Effects Volume
            </label>
            <div className="flex items-center gap-3 w-full sm:w-64">
              <input
                id="sfx-volume-slider"
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

          <div className="border-t border-[#F3EFE6]/10 pt-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Music</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Original tactical soundtrack during menus and battle
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ ...settings, musicEnabled: !settings.musicEnabled })
              }
              className={`min-h-[44px] px-4 rounded-xl border font-semibold text-sm flex items-center gap-2 transition whitespace-nowrap ${
                settings.musicEnabled
                  ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                  : 'bg-[#141714] text-[#F3EFE6]/70 border-[#F3EFE6]/20'
              }`}
            >
              <Music className="w-4 h-4" />
              {settings.musicEnabled ? 'Enabled' : 'Muted'}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="music-volume-slider" className="text-sm font-medium text-[#F3EFE6]/85">
              Music Volume
            </label>
            <div className="flex items-center gap-3 w-full sm:w-64">
              <input
                id="music-volume-slider"
                type="range"
                min={0}
                max={100}
                value={Math.round(settings.musicVolume * 100)}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    musicVolume: Number(e.target.value) / 100,
                  })
                }
                className="w-full accent-[#E08E26]"
              />
              <span className="w-10 text-right font-mono text-xs tabular-nums">
                {Math.round(settings.musicVolume * 100)}%
              </span>
            </div>
          </div>
        </section>

        {/* Graphics & Feedback */}
        <section className="bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Graphics &amp; Feedback</h2>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Graphics Quality</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Adjusts particle pool density, tread decals, and ambient arena effects
              </div>
            </div>
            <div className="flex items-center gap-1 bg-[#141714] p-1 rounded-xl border border-[#F3EFE6]/15">
              {QUALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    onUpdateSettings({
                      ...settings,
                      graphicsQuality: opt.id,
                      lowDetailMode: opt.id === 'low',
                    })
                  }
                  className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                    settings.graphicsQuality === opt.id
                      ? 'bg-[#E08E26] text-[#141714]'
                      : 'text-[#F3EFE6]/70 hover:text-[#F3EFE6]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Screen Shake</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Subtle camera kick during barrel blasts and tank eliminations
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({
                  ...settings,
                  screenShakeEnabled: !settings.screenShakeEnabled,
                })
              }
              className={`min-h-[44px] px-4 rounded-xl border font-semibold text-sm transition whitespace-nowrap ${
                settings.screenShakeEnabled
                  ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                  : 'bg-[#141714] text-[#F3EFE6]/70 border-[#F3EFE6]/20'
              }`}
            >
              {settings.screenShakeEnabled ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold">Vibration</div>
              <div className="text-xs text-[#F3EFE6]/60">
                {vibrationSupported
                  ? 'Short haptic pulses on cannon fire, ability use, and heavy hits'
                  : 'Hardware vibration is not supported on this device or browser'}
              </div>
            </div>
            {vibrationSupported ? (
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    vibrationEnabled: !settings.vibrationEnabled,
                  })
                }
                className={`min-h-[44px] px-4 rounded-xl border font-semibold text-sm transition whitespace-nowrap ${
                  settings.vibrationEnabled
                    ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                    : 'bg-[#141714] text-[#F3EFE6]/70 border-[#F3EFE6]/20'
                }`}
              >
                {settings.vibrationEnabled ? 'On' : 'Off'}
              </button>
            ) : (
              <span className="min-h-[44px] px-3.5 rounded-xl border border-[#F3EFE6]/12 bg-[#141714] text-xs font-mono text-[#F3EFE6]/45 flex items-center whitespace-nowrap">
                Unsupported
              </span>
            )}
          </div>
        </section>

        {/* Controls & Match */}
        <section className="bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Controls &amp; Match</h2>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label htmlFor="sensitivity-slider" className="text-sm font-semibold block">
                Control Sensitivity
              </label>
              <div className="text-xs text-[#F3EFE6]/60">
                Scales virtual joystick response and turret tracking speed
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-64">
              <input
                id="sensitivity-slider"
                type="range"
                min={60}
                max={150}
                step={5}
                value={Math.round(settings.controlSensitivity * 100)}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    controlSensitivity: Number(e.target.value) / 100,
                  })
                }
                className="w-full accent-[#E08E26]"
              />
              <span className="w-12 text-right font-mono text-xs tabular-nums">
                {Math.round(settings.controlSensitivity * 100)}%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Virtual Joysticks</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Always display touch joysticks or auto-detect touchscreens
              </div>
            </div>
            <div className="flex items-center gap-1 bg-[#141714] p-1 rounded-xl border border-[#F3EFE6]/15">
              {(['always', 'auto'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, showTouchControls: opt })}
                  className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
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
              className={`min-h-[44px] px-4 rounded-xl border font-semibold text-sm transition whitespace-nowrap ${
                settings.autoFireOnAim
                  ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                  : 'bg-[#141714] text-[#F3EFE6]/70 border-[#F3EFE6]/20'
              }`}
            >
              {settings.autoFireOnAim ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Match Time Limit</div>
              <div className="text-xs text-[#F3EFE6]/60">
                Timer winner uses highest remaining HP, then eliminations
              </div>
            </div>
            <div className="flex items-center gap-1 bg-[#141714] p-1 rounded-xl border border-[#F3EFE6]/15">
              {[90, 150, 210].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, matchDurationSec: sec })}
                  className={`min-h-[38px] px-3 rounded-lg font-mono text-xs font-semibold tabular-nums transition whitespace-nowrap ${
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

        {/* Display & Orientation */}
        <section className="bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">Landscape &amp; Display</h2>

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
                className={`min-h-[44px] px-4 rounded-xl border font-semibold text-sm flex items-center gap-2 transition whitespace-nowrap ${
                  isFullscreen
                    ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                    : 'bg-[#141714] text-[#F3EFE6] border-[#F3EFE6]/25 hover:border-[#F3EFE6]/45'
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
              className={`min-h-[44px] px-4 rounded-xl border font-semibold text-sm transition whitespace-nowrap ${
                settings.landscapePromptEnabled
                  ? 'bg-[#E08E26] text-[#141714] border-[#E08E26]'
                  : 'bg-[#141714] text-[#F3EFE6]/70 border-[#F3EFE6]/20'
              }`}
            >
              {settings.landscapePromptEnabled ? 'Enabled' : 'Off'}
            </button>
          </div>
        </section>

        {/* Local Data Management */}
        <section className="bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Local Match Records</div>
            <div className="text-xs text-[#F3EFE6]/60">
              Clears locally stored match counts, wins, eliminations, and selections
            </div>
          </div>

          {!confirmResetProgress ? (
            <button
              type="button"
              onClick={() => setConfirmResetProgress(true)}
              className="min-h-[44px] px-4 rounded-xl border border-red-500/40 text-red-400 text-sm font-semibold flex items-center gap-2 hover:bg-red-500/10 transition whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              Clear Local Records
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onResetProgress();
                  setConfirmResetProgress(false);
                }}
                className="min-h-[44px] px-4 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition whitespace-nowrap"
              >
                Confirm Clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetProgress(false)}
                className="min-h-[44px] px-4 rounded-xl border border-[#F3EFE6]/20 text-sm font-medium hover:bg-[#272C25] transition whitespace-nowrap"
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
