"use client";

import { SKIN_IDS, SKIN_LABELS, type SkinId } from "@/lib/game-types";

interface GameSkinPickerProps {
  current: SkinId;
  onChange: (next: SkinId) => void;
}

// Selector compacto de skin, pensado para vivir dentro del HUD del player.
// No persiste nada: al recargar o reiniciar, el estado vuelve a `classic`.
export function GameSkinPicker({ current, onChange }: GameSkinPickerProps) {
  return (
    <div
      role="group"
      aria-label="Selector de skin"
      className="flex items-center gap-2"
    >
      <span className="mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
        Skin
      </span>
      <div className="flex gap-1">
        {SKIN_IDS.map((id) => {
          const active = id === current;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(id)}
              className={[
                "pixel border px-2 py-1.5 text-[9px] uppercase tracking-[0.14em] transition-colors",
                active
                  ? "border-cyan text-cyan shadow-[0_0_10px_rgba(0,245,255,0.45)]"
                  : "border-ink-faint text-ink-dim hover:text-ink",
              ].join(" ")}
            >
              {SKIN_LABELS[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
