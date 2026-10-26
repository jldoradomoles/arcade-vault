// Registro de juegos con motor real. Apto para Client Components (sin next/headers).
// Un juego sin entrada aquí conserva el reproductor simulado.
import { H as ARKANOID_H, W as ARKANOID_W } from "@/lib/arkanoid/constants";
import { ArkanoidEngine } from "@/lib/arkanoid/engine";
import { H, W } from "@/lib/asteroids/constants";
import { AsteroidsEngine } from "@/lib/asteroids/engine";
import type { CreateEngine } from "@/lib/game-engine";
import { H as SNAKE_H, W as SNAKE_W } from "@/lib/snake/constants";
import { SnakeEngine } from "@/lib/snake/engine";
import { H as TETRIS_H, W as TETRIS_W } from "@/lib/tetris/constants";
import { TetrisEngine } from "@/lib/tetris/engine";

export interface GameEntry {
  width: number;
  height: number;
  createEngine: CreateEngine;
  controls: { keys: string[]; action: string }[]; // línea de ayuda bajo el CRT
}

export const GAME_REGISTRY: Record<string, GameEntry> = {
  asteroids: {
    width: W,
    height: H,
    createEngine: (canvas, callbacks) => new AsteroidsEngine(canvas, callbacks),
    controls: [
      { keys: ["←", "→"], action: "Girar" },
      { keys: ["↑"], action: "Propulsar" },
      { keys: ["Espacio"], action: "Disparar" },
      { keys: ["B"], action: "Bomba Nova, si la tienes" },
    ],
  },
  tetris: {
    width: TETRIS_W,
    height: TETRIS_H,
    createEngine: (canvas, callbacks) => new TetrisEngine(canvas, callbacks),
    controls: [
      { keys: ["←", "→"], action: "Mover" },
      { keys: ["↑", "X"], action: "Rotar" },
      { keys: ["↓"], action: "Bajar" },
      { keys: ["Espacio"], action: "Caída" },
    ],
  },
  arkanoid: {
    width: ARKANOID_W,
    height: ARKANOID_H,
    createEngine: (canvas, callbacks) => new ArkanoidEngine(canvas, callbacks),
    controls: [
      { keys: ["←", "→"], action: "Mover" },
      { keys: ["Espacio"], action: "Lanzar" },
      { keys: ["Ratón"], action: "Mover y lanzar (clic)" },
    ],
  },
  snake: {
    width: SNAKE_W,
    height: SNAKE_H,
    createEngine: (canvas, callbacks) => new SnakeEngine(canvas, callbacks),
    controls: [
      { keys: ["←", "↑", "→", "↓"], action: "Mover" },
      { keys: ["A", "W", "D", "S"], action: "Mover" },
    ],
  },
};
