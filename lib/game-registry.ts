// Registro de juegos con motor real. Apto para Client Components (sin next/headers).
// Un juego sin entrada aquí conserva el reproductor simulado.
import { H as ARKANOID_H, W as ARKANOID_W } from "@/lib/arkanoid/constants";
import { ArkanoidEngine } from "@/lib/arkanoid/engine";
import { H, W } from "@/lib/asteroids/constants";
import { AsteroidsEngine } from "@/lib/asteroids/engine";
import type { CreateEngine } from "@/lib/game-engine";
import { H as FROGGER_H, W as FROGGER_W } from "@/lib/frogger/constants";
import { FroggerEngine } from "@/lib/frogger/engine";
import { H as SNAKE_H, W as SNAKE_W } from "@/lib/snake/constants";
import { SnakeEngine } from "@/lib/snake/engine";
import { H as TETRIS_H, W as TETRIS_W } from "@/lib/tetris/constants";
import { TetrisEngine } from "@/lib/tetris/engine";

export type TouchStyle = "default" | "arcade";

export interface GameEntry {
  width: number;
  height: number;
  createEngine: CreateEngine;
  controls: { keys: string[]; action: string }[]; // línea de ayuda bajo el CRT
  touchStyle?: TouchStyle;
}

export const GAME_REGISTRY: Record<string, GameEntry> = {
  asteroids: {
    width: W,
    height: H,
    createEngine: (canvas, callbacks, options) =>
      new AsteroidsEngine(canvas, callbacks, options),
    controls: [
      { keys: ["←", "→"], action: "Girar" },
      { keys: ["↑"], action: "Propulsar" },
      { keys: ["Espacio"], action: "Disparar" },
      { keys: ["B"], action: "Bomba Nova, si la tienes" },
    ],
    touchStyle: "arcade",
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
    touchStyle: "arcade",
  },
  arkanoid: {
    width: ARKANOID_W,
    height: ARKANOID_H,
    createEngine: (canvas, callbacks, options) =>
      new ArkanoidEngine(canvas, callbacks, options),
    controls: [
      { keys: ["←", "→"], action: "Mover" },
      { keys: ["Espacio"], action: "Lanzar" },
    ],
    touchStyle: "arcade",
  },
  snake: {
    width: SNAKE_W,
    height: SNAKE_H,
    createEngine: (canvas, callbacks, options) =>
      new SnakeEngine(canvas, callbacks, options),
    controls: [
      { keys: ["←", "↑", "→", "↓"], action: "Mover" },
      { keys: ["A", "W", "D", "S"], action: "Mover" },
    ],
    touchStyle: "arcade",
  },
  frogger: {
    width: FROGGER_W,
    height: FROGGER_H,
    createEngine: (canvas, callbacks, options) =>
      new FroggerEngine(canvas, callbacks, options),
    controls: [
      { keys: ["↑", "↓", "←", "→"], action: "Saltar" },
      { keys: ["W", "S", "A", "D"], action: "Saltar" },
    ],
    touchStyle: "arcade",
  },
};
