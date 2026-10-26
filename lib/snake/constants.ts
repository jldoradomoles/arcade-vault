// Canvas lógico 800×600: tablero de 20×15 celdas de 40 px
export const W = 800;
export const H = 600;

export const CELL = 40;
export const COLS = 20;
export const ROWS = 15;

export const START_LENGTH = 3;
export const FRUIT_POINTS = 10;
export const FRUITS_PER_LEVEL = 5;

export const STEP_BASE_MS = 140;
export const STEP_DECREASE_MS = 10;
export const STEP_MIN_MS = 70;

export const MAX_DT_MS = 50;
export const MAX_QUEUED_TURNS = 2;
export const MAX_SCORE = 10_000_000; // límite de submitScore (SPEC 06)

export const FRUITS_SRC = "/games/snake/fruits.png";

// Recortes de la fila central de fruits.png (hoja de 3790×442, fondo transparente)
export interface FruitSprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FRUIT_SPRITES: readonly FruitSprite[] = [
  { x: 34, y: 136, w: 110, h: 160 }, // banana
  { x: 186, y: 136, w: 150, h: 160 }, // orange
  { x: 378, y: 136, w: 110, h: 160 }, // grape
  { x: 540, y: 136, w: 130, h: 160 }, // garlic
  { x: 712, y: 136, w: 130, h: 160 }, // eggplant
  { x: 894, y: 136, w: 110, h: 160 }, // strawberry
  { x: 1066, y: 136, w: 110, h: 160 }, // cherry
  { x: 1228, y: 136, w: 130, h: 160 }, // carrot
  { x: 1400, y: 136, w: 130, h: 160 }, // mushroom
  { x: 1582, y: 136, w: 110, h: 160 }, // broccoli
  { x: 1734, y: 136, w: 150, h: 160 }, // watermelon
  { x: 1906, y: 136, w: 150, h: 160 }, // pepper
  { x: 2068, y: 136, w: 170, h: 160 }, // kiwi
  { x: 2250, y: 136, w: 140, h: 160 }, // lemon
  { x: 2432, y: 136, w: 130, h: 160 }, // peach
  { x: 2604, y: 136, w: 130, h: 160 }, // peanut
  { x: 2786, y: 136, w: 110, h: 160 }, // apple
  { x: 2948, y: 136, w: 130, h: 160 }, // tomato
  { x: 3110, y: 136, w: 150, h: 160 }, // berries
  { x: 3302, y: 136, w: 110, h: 160 }, // grapes2
  { x: 3454, y: 136, w: 150, h: 160 }, // pineapple
  { x: 3637, y: 136, w: 130, h: 160 }, // melon
];

export type Dir = "up" | "down" | "left" | "right";
export type Phase = "ready" | "playing" | "gameover";

export interface Cell {
  x: number; // columna 0..19
  y: number; // fila 0..14
}

export interface Fruit extends Cell {
  sprite: number; // índice en FRUIT_SPRITES
}
