"use client";

import { useCallback, useRef, useEffect } from "react";
import type { DpadButton, TouchLayout } from "@/lib/touch-controls";

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

  if (layout.style === "arcade") {
    return (
      <ArcadeGamepad layout={layout} disabled={disabled} setRef={setRef} />
    );
  }

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

interface ArcadeGamepadProps {
  layout: TouchLayout;
  disabled: boolean;
  setRef: (el: HTMLButtonElement | null) => void;
}

const DPAD_DIRECTIONS: DpadButton["direction"][] = [
  "up",
  "left",
  "right",
  "down",
];
const AB_LETTERS = ["A", "B"] as const;
const AB_CLASSES = ["a", "b"] as const;

function ArcadeGamepad({ layout, disabled, setRef }: ArcadeGamepadProps) {
  const dpadByDir = new Map(layout.dpad.map((btn) => [btn.direction, btn]));
  const actions = layout.actions.slice(0, 2);

  return (
    <div
      className={`av-gp av-gp-neon${disabled ? " tc-disabled" : ""}`}
      role="group"
      aria-label="Controles táctiles"
    >
      <div className="av-gp-body">
        <div className="av-gp-col av-gp-col-left">
          <div className="av-gp-dpad">
            {DPAD_DIRECTIONS.map((dir) => {
              const btn = dpadByDir.get(dir);
              if (!btn) {
                return (
                  <div
                    key={dir}
                    className={`av-dp av-dp-${dir} av-dp-empty`}
                    aria-hidden="true"
                  />
                );
              }
              return (
                <button
                  key={dir}
                  ref={setRef}
                  type="button"
                  className={`av-dp av-dp-${dir}`}
                  data-code={btn.code}
                  data-keyval={btn.key}
                  aria-label={dir}
                >
                  <span className="av-dp-arrow">{DPAD_ARROW[dir]}</span>
                </button>
              );
            })}
            <div className="av-dp-hub" aria-hidden="true">
              <div className="av-dp-hub-gem" />
            </div>
          </div>
        </div>
        <div className="av-gp-col av-gp-col-right">
          <div
            className={`av-gp-actions${actions.length === 1 ? " av-gp-actions-single" : ""}`}
          >
            {actions.map((btn, i) => (
              <button
                key={btn.label}
                ref={setRef}
                type="button"
                className={`av-ab av-ab-${AB_CLASSES[i]}`}
                data-code={btn.code}
                data-keyval={btn.key}
                aria-label={btn.label}
              >
                <span className="av-ab-letter">{AB_LETTERS[i]}</span>
                <span className="av-ab-ring" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
