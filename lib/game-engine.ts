// Contrato que cumple todo motor de juego de la plataforma (SPEC 07).
// Sin React ni next/*: solo DOM y canvas.
import type { SkinId } from "@/lib/game-types";

export interface GameStats {
  score: number;
  lives?: number; // si no se emite, el HUD oculta VIDAS
  level?: number; // si no se emite, el HUD oculta NIVEL
}

export interface GameCallbacks {
  onStats: (stats: GameStats) => void; // solo cuando cambia algún valor
  onGameOver: (finalScore: number) => void; // una sola vez por partida
}

export interface GameEngine {
  start(): void;
  setPaused(paused: boolean): void;
  finish(): void; // botón FIN: termina con el puntaje actual
  destroy(): void;
}

export type CreateEngine = (
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks,
  options?: { skin?: SkinId },
) => GameEngine;
