import { ArrowLeft, Award, Clock } from 'lucide-react';

interface MissionsScreenProps {
  onBack: () => void;
}

export function MissionsScreen({ onBack }: MissionsScreenProps) {
  return (
    <div className="w-full h-full overflow-y-auto bg-[#141714] tactical-bg-grid text-[#F3EFE6] flex flex-col">
      <header className="w-full max-w-4xl mx-auto px-4 sm:px-7 py-3 flex items-center justify-between border-b border-[#F3EFE6]/12 shrink-0 bg-[#141714]/80">
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
            Missions
          </h1>
        </div>
      </header>

      <main className="screen-transition flex-1 w-full max-w-4xl mx-auto px-4 sm:px-7 py-8 flex items-center justify-center">
        <div className="w-full max-w-md bg-[#1B1F1A]/95 border border-[#F3EFE6]/15 rounded-2xl p-6 sm:p-8 text-center shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-[#E08E26]/15 border border-[#E08E26]/45 text-[#E08E26] flex items-center justify-center mx-auto mb-4">
            <Award className="w-7 h-7" />
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[#E08E26] mb-1">
            <Clock className="w-3.5 h-3.5" />
            Planned for Stage 11
          </div>
          <h2 className="font-display text-3xl font-extrabold text-[#F3EFE6]">
            Combat Missions Offline
          </h2>
          <p className="text-sm text-[#F3EFE6]/70 mt-2 leading-relaxed">
            Daily combat objectives and mission rewards are scheduled for Stage 11. Your current tank selection, arena choice, and match controls are ready for battle.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 min-h-[46px] w-full rounded-xl bg-[#E08E26] text-[#141714] font-display text-lg font-extrabold tracking-wide hover:bg-[#EE9B32] transition"
          >
            Return to Main Menu
          </button>
        </div>
      </main>
    </div>
  );
}
