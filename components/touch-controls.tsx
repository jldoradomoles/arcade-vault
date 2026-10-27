"use client";

import { useCallback, useRef, useEffect } from "react";
import type { TouchLayout } from "@/lib/touch-controls";

interface TouchControlsProps {
  layout: TouchLayout;
  disabled: boolean;
}

function fireKey(type: "keydown" | "keyup", code: string, key: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true }));
}

function handleTouchStart(e: TouchEvent, disabled: boolean) {
  if (e.cancelable) e.preventDefault();
  if (disabled) return;
  const el = e.currentTarget as HTMLElement;
  const { code = "", keyval = "" } = el.dataset;
  fireKey("keydown", code, keyval);
}

function handleTouchEnd(e: TouchEvent) {
  if (e.cancelable) e.preventDefault();
  const el = e.currentTarget as HTMLElement;
  const { code = "", keyval = "" } = el.dataset;
  fireKey("keyup", code, keyval);
}

const DPAD_POS: Record<string, { gridColumn: number; gridRow: number }> = {
  up: { gridColumn: 2, gridRow: 1 },
  left: { gridColumn: 1, gridRow: 2 },
  right: { gridColumn: 3, gridRow: 2 },
  down: { gridColumn: 2, gridRow: 3 },
};

const DPAD_ARROW: Record<string, string> = {
  up: "▲",
  left: "◀",
  right: "▶",
  down: "▼",
};

function useTouchButton(disabled: boolean) {
  const refs = useRef<Set<HTMLButtonElement>>(new Set());
  const disabledRef = useRef(disabled);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const setRef = useCallback((el: HTMLButtonElement | null) => {
    if (el) refs.current.add(el);
  }, []);

  useEffect(() => {
    const buttons = refs.current;
    const onStart = (e: TouchEvent) => handleTouchStart(e, disabledRef.current);
    const onEnd = (e: TouchEvent) => handleTouchEnd(e);

    for (const btn of buttons) {
      btn.addEventListener("touchstart", onStart, { passive: false });
      btn.addEventListener("touchend", onEnd, { passive: false });
      btn.addEventListener("touchcancel", onEnd, { passive: false });
    }
    return () => {
      for (const btn of buttons) {
        btn.removeEventListener("touchstart", onStart);
        btn.removeEventListener("touchend", onEnd);
        btn.removeEventListener("touchcancel", onEnd);
      }
    };
  }, []);

  return setRef;
}

export function TouchControls({ layout, disabled }: TouchControlsProps) {
  const setRef = useTouchButton(disabled);

  const hasDpad = layout.dpad.length > 0;
  const hasActions = layout.actions.length > 0;
  if (!hasDpad && !hasActions) return null;

  return (
    <div
      className={`tc-wrap${disabled ? " tc-disabled" : ""}`}
      role="group"
      aria-label="Controles táctiles"
    >
      {hasDpad && (
        <div className="tc-dpad">
          {layout.dpad.map((btn) => (
            <button
              key={btn.direction}
              ref={setRef}
              type="button"
              className="tc-btn tc-dir"
              style={DPAD_POS[btn.direction]}
              data-code={btn.code}
              data-keyval={btn.key}
              aria-label={btn.direction}
            >
              {DPAD_ARROW[btn.direction]}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1" />
      {hasActions && (
        <div className="tc-actions">
          {layout.actions.map((btn) => (
            <button
              key={btn.label}
              ref={setRef}
              type="button"
              className="tc-btn tc-act"
              data-code={btn.code}
              data-keyval={btn.key}
              aria-label={btn.label}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
