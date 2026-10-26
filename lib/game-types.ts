// Tipos y constantes del catálogo que también usan los Client Components.
// Viven aparte de lib/games.ts porque éste importa el cliente de servidor (next/headers).
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: GameColor;
  best: number;
  plays: string;
}

export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;

// ===== Skins =====
// Identificadores de skin disponibles para cualquier juego. Cada motor resuelve
// su propia paleta a partir de aquí; la plataforma solo propaga el id.
export type SkinId = "classic" | "neon" | "retro";
export const SKIN_IDS: readonly SkinId[] = [
  "classic",
  "neon",
  "retro",
] as const;
export const DEFAULT_SKIN: SkinId = "classic";
export const SKIN_LABELS: Record<SkinId, string> = {
  classic: "Clásico",
  neon: "Neón",
  retro: "Retro",
};
