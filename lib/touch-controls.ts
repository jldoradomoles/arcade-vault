export interface DpadButton {
  direction: "left" | "right" | "up" | "down";
  code: string;
  key: string;
}

export interface ActionButton {
  label: string;
  code: string;
  key: string;
}

export interface TouchLayout {
  dpad: DpadButton[];
  actions: ActionButton[];
  canvasDrag: boolean;
}

const ARROWS = new Set(["←", "→", "↑", "↓"]);

const ARROW_META: Record<
  string,
  { direction: DpadButton["direction"]; code: string; key: string }
> = {
  "←": { direction: "left", code: "ArrowLeft", key: "ArrowLeft" },
  "→": { direction: "right", code: "ArrowRight", key: "ArrowRight" },
  "↑": { direction: "up", code: "ArrowUp", key: "ArrowUp" },
  "↓": { direction: "down", code: "ArrowDown", key: "ArrowDown" },
};

function labelToKeyCode(label: string): { code: string; key: string } {
  if (label === "Espacio") return { code: "Space", key: " " };
  const arrow = ARROW_META[label];
  if (arrow) return { code: arrow.code, key: arrow.key };
  return { code: `Key${label.toUpperCase()}`, key: label.toLowerCase() };
}

export function deriveTouchLayout(
  controls: { keys: string[]; action: string }[],
): TouchLayout {
  const dpad: DpadButton[] = [];
  const actions: ActionButton[] = [];
  let canvasDrag = false;

  const seenActions = new Set<string>();
  const deduped = controls.filter((c) => {
    if (seenActions.has(c.action)) return false;
    seenActions.add(c.action);
    return true;
  });

  const hasRaton = deduped.some((c) => c.keys.includes("Ratón"));
  if (hasRaton) canvasDrag = true;

  const filtered = hasRaton
    ? deduped.filter(
        (c) => !c.keys.includes("Ratón") && !c.keys.every((k) => ARROWS.has(k)),
      )
    : deduped;

  for (const entry of filtered) {
    const allArrows = entry.keys.every((k) => ARROWS.has(k));
    const hasNonArrow = entry.keys.some((k) => !ARROWS.has(k));

    if (allArrows) {
      for (const k of entry.keys) {
        const meta = ARROW_META[k];
        if (meta)
          dpad.push({
            direction: meta.direction,
            code: meta.code,
            key: meta.key,
          });
      }
    } else if (hasNonArrow) {
      const { code, key } = labelToKeyCode(entry.keys[0]);
      actions.push({ label: entry.action, code, key });
    }
  }

  return { dpad, actions, canvasDrag };
}
