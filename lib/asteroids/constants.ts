export const W = 800;
export const H = 600;

export type AsteroidSize = 1 | 2 | 3;
export type PowerUpType = "triple" | "shield" | "bomb";
export type AsteroidsState = "playing" | "dead" | "gameover";

export const RADII = [0, 16, 30, 50] as const; // por tamaño 1, 2, 3
export const SPEEDS = [0, 85, 55, 32] as const; // velocidad base por tamaño
export const POINTS = [0, 100, 50, 20] as const; // puntos por tamaño

// Forma fija de asteroide grande, vértices normalizados (radio = 1)
export const BIG_SHAPE: ReadonlyArray<readonly [number, number]> = [
  [-0.113, -0.979],
  [0.444, -0.81],
  [0.331, -0.218],
  [0.894, -0.049],
  [0.732, 0.563],
  [0.239, 0.542],
  [0.007, 0.937],
  [-0.676, 0.606],
  [-1.0, 0.028],
  [-0.852, -0.585],
];
export const BIG_SHAPE_CHANCE = 0.25; // probabilidad de que un asteroide grande use esta forma

export const TRIPLE_DURATION = 8; // segundos de efecto
export const SHIELD_DURATION = 8; // segundos de efecto (o hasta recibir un golpe)
export const SHIELD_PAD = 9; // holgura del escudo respecto al radio de la nave
export const SHIELD_GRACE = 0.5; // segundos sin colisión con la nave tras absorber un golpe
export const POWERUP_TYPES: Record<
  PowerUpType,
  { color: string; label: string }
> = {
  triple: { color: "#0ff", label: "3" },
  shield: { color: "#4f4", label: "E" },
  bomb: { color: "#f80", label: "B" },
};
export const BOMB_CHANCE = 0.3; // probabilidad por ronda de que aparezca la Bomba Nova
export const BOMB_FLASH = 0.5; // segundos del destello al detonar

interface Point {
  x: number;
  y: number;
}

export const wrap = (v: number, max: number) => ((v % max) + max) % max;
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const rand = (min: number, max: number) =>
  min + Math.random() * (max - min);
export const randInt = (min: number, max: number) =>
  Math.floor(rand(min, max + 1));
