import { useEffect, useRef } from 'react';

interface TouchJoystickProps {
  label: string;
  accentColor: string;
  size?: number;
  sensitivity?: number;
  onChange: (nx: number, ny: number, active: boolean) => void;
}

export function TouchJoystick({
  label,
  accentColor,
  size = 112,
  sensitivity = 1.0,
  onChange,
}: TouchJoystickProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const dragBoundsRef = useRef<{ cx: number; cy: number; maxTravel: number } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const maxTravel = size * 0.34;

  useEffect(() => {
    return () => {
      activePointerId.current = null;
      dragBoundsRef.current = null;
      onChangeRef.current(0, 0, false);
    };
  }, []);

  const updateStick = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;

    let bounds = dragBoundsRef.current;
    if (!bounds) {
      const rect = base.getBoundingClientRect();
      bounds = {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        maxTravel,
      };
      dragBoundsRef.current = bounds;
    }

    let dx = clientX - bounds.cx;
    let dy = clientY - bounds.cy;
    const distSq = dx * dx + dy * dy;
    const travel = bounds.maxTravel;

    if (distSq > travel * travel && distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      dx = (dx / dist) * travel;
      dy = (dy / dist) * travel;
    }

    knob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    const rawNx = dx / travel;
    const rawNy = dy / travel;
    const rawMag = Math.hypot(rawNx, rawNy);
    if (rawMag > 0.001) {
      const scaledMag = Math.min(1, rawMag * sensitivity);
      onChangeRef.current((rawNx / rawMag) * scaledMag, (rawNy / rawMag) * scaledMag, true);
    } else {
      onChangeRef.current(0, 0, true);
    }
  };

  const resetStick = () => {
    activePointerId.current = null;
    dragBoundsRef.current = null;
    if (knobRef.current) {
      knobRef.current.style.transition = '';
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
    onChangeRef.current(0, 0, false);
  };

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label={label}
      className="touch-none-game relative rounded-full border-2 border-[#F3EFE6]/35 bg-[#141714]/65 backdrop-blur-xs flex items-center justify-center shadow-lg select-none"
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activePointerId.current !== null) return;
        activePointerId.current = e.pointerId;
        const rect = e.currentTarget.getBoundingClientRect();
        dragBoundsRef.current = {
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2,
          maxTravel,
        };
        if (knobRef.current) {
          knobRef.current.style.transition = 'none';
        }
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore environments without pointer capture support
        }
        updateStick(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        updateStick(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore
        }
        resetStick();
      }}
      onPointerCancel={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        e.stopPropagation();
        resetStick();
      }}
      onLostPointerCapture={(e) => {
        if (activePointerId.current !== e.pointerId) return;
        resetStick();
      }}
    >
      {/* Crosshair guide */}
      <div className="pointer-events-none absolute inset-3 rounded-full border border-[#F3EFE6]/15" />
      <span className="pointer-events-none absolute bottom-1.5 text-[10px] font-semibold tracking-wider uppercase text-[#F3EFE6]/55">
        {label}
      </span>

      {/* Thumb knob */}
      <div
        ref={knobRef}
        className="pointer-events-none rounded-full border-2 border-[#141714] shadow-md transition-transform duration-75 will-change-transform"
        style={{
          width: size * 0.42,
          height: size * 0.42,
          backgroundColor: accentColor,
        }}
      />
    </div>
  );
}
