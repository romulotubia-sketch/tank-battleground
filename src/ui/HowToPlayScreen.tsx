import { ArrowLeft, Crosshair, Flame, Shield, Sparkles, Trophy } from 'lucide-react';
import { POWERUP_DEFINITIONS, POWERUP_IDS } from '../data/powerups';

interface HowToPlayScreenProps {
  onBack: () => void;
}

const OBSTACLE_GUIDE = [
  {
    name: 'Brick Barrier',
    rule: 'Destructible cover. Absorbs shells until shattered.',
    swatch: '#A84B36',
  },
  {
    name: 'Steel Barrier',
    rule: 'Indestructible armor wall. Blocks both movement and fire.',
    swatch: '#646D75',
  },
  {
    name: 'Wooden Crate',
    rule: 'Light destructible cover that clears quickly under fire.',
    swatch: '#B57B42',
  },
  {
    name: 'Brush & Bushes',
    rule: 'Conceals your tank from enemies unless revealed by Radar.',
    swatch: '#4A8544',
  },
  {
    name: 'Water Pool',
    rule: 'Blocks tank treads, but cannon shells fly cleanly over.',
    swatch: '#387D9C',
  },
  {
    name: 'Explosive Barrel',
    rule: 'Detonates on destruction, damaging nearby tanks and walls.',
    swatch: '#C93A2B',
  },
];

export function HowToPlayScreen({ onBack }: HowToPlayScreenProps) {
  return (
    <div className="w-full h-full overflow-y-auto bg-[#161915] text-[#F3EFE6] flex flex-col">
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between border-b border-[#F3EFE6]/10 shrink-0">
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
            How to Play
          </h1>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-5 flex flex-col gap-5">
        {/* Controls & Victory */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="bg-[#1E221D] border border-[#F3EFE6]/12 rounded-xl p-4 sm:p-5">
            <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-3">
              <Crosshair className="w-5 h-5 text-[#E08E26]" />
              Controls
            </h2>
            <ul className="space-y-2 text-xs sm:text-sm text-[#F3EFE6]/80 leading-relaxed">
              <li>
                <strong className="text-[#F3EFE6]">Touchscreen (Landscape):</strong> Use the left joystick to drive in any direction and the right joystick to rotate your turret independently. Tap <strong>FIRE</strong> to shoot, <strong>RELOAD</strong> to reload early, and <strong>ABILITY</strong> to trigger your tank special.
              </li>
              <li>
                <strong className="text-[#F3EFE6]">Keyboard & Mouse:</strong> Move with <strong>WASD</strong> or <strong>Arrow Keys</strong>, aim with the mouse cursor, shoot with <strong>Left Click</strong> or <strong>Space</strong>, reload with <strong>R</strong>, activate ability with <strong>E</strong> or <strong>Shift</strong>, and pause with <strong>P</strong> or <strong>Esc</strong>.
              </li>
            </ul>
          </section>

          <section className="bg-[#1E221D] border border-[#F3EFE6]/12 rounded-xl p-4 sm:p-5">
            <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-[#E08E26]" />
              Match Rules & Victory
            </h2>
            <ul className="space-y-2 text-xs sm:text-sm text-[#F3EFE6]/80 leading-relaxed">
              <li>
                Eight tanks enter each Free-for-All match (1 human commander vs 7 autonomous AI opponents).
              </li>
              <li>
                Be the last surviving tank to claim <strong>Victory</strong>. If the match clock expires first, the survivor with the highest remaining HP wins (eliminations break ties).
              </li>
              <li>
                Earn <strong>Scrap</strong> from every match based on placement and eliminations to unlock additional tank classes.
              </li>
            </ul>
          </section>
        </div>

        {/* Terrain & Obstacles */}
        <section className="bg-[#1E221D] border border-[#F3EFE6]/12 rounded-xl p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-[#E08E26]" />
            Arena Obstacles & Terrain
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {OBSTACLE_GUIDE.map((item) => (
              <div
                key={item.name}
                className="bg-[#161915] border border-[#F3EFE6]/10 rounded-lg p-3 flex items-start gap-3"
              >
                <span
                  className="w-5 h-5 rounded-sm border border-[#141714] shrink-0 mt-0.5"
                  style={{ backgroundColor: item.swatch }}
                />
                <div>
                  <div className="text-xs font-bold text-[#F3EFE6]">{item.name}</div>
                  <div className="text-xs text-[#F3EFE6]/70 mt-0.5 leading-snug">
                    {item.rule}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Powerups */}
        <section className="bg-[#1E221D] border border-[#F3EFE6]/12 rounded-xl p-4 sm:p-5">
          <h2 className="font-display text-xl font-bold flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[#E08E26]" />
            Field Powerups (Max 3 Active on Map)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {POWERUP_IDS.map((id) => {
              const p = POWERUP_DEFINITIONS[id];
              return (
                <div
                  key={id}
                  className="bg-[#161915] border border-[#F3EFE6]/10 rounded-lg px-3 py-2.5 flex items-center gap-3"
                >
                  <span
                    className="w-9 h-9 rounded-md border border-[#141714] flex items-center justify-center font-display text-xs font-extrabold text-[#141714] shrink-0"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.shortLabel}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#F3EFE6] flex items-center gap-1.5">
                      <span>{p.name}</span>
                      <span className="text-[#F3EFE6]/45 font-mono text-[11px]">
                        {p.durationSec > 0 ? `${p.durationSec}s` : 'Instant'}
                      </span>
                    </div>
                    <div className="text-xs text-[#F3EFE6]/70 truncate">{p.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[#F3EFE6]/55 mt-3 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-[#E08E26]" />
            Picking up a duplicate temporary powerup refreshes its timer.
          </p>
        </section>
      </main>
    </div>
  );
}
