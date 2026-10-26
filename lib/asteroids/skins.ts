// Paletas de Asteroids por skin. Toda la cromática del juego vive aquí.
import type { SkinId } from "@/lib/game-types";
import type { PowerUpType } from "./constants";

export interface AsteroidsPalette {
  bg: string; // color de fondo del canvas
  ship: string; // trazo de la nave
  asteroid: string; // trazo de los asteroides
  bullet: string; // relleno de las balas
  particleRgb: string; // "r,g,b" para rgba() de las partículas de explosión
  thrust: string; // llama del propulsor
  bombFlashRgb: string; // "r,g,b" para rgba() del destello de la Bomba Nova
  shieldFill: string; // relleno del escudo
  powerUpColors: Record<PowerUpType, string>; // trazo/relleno de cada power-up
}

export const SKINS: Record<SkinId, AsteroidsPalette> = {
  // Clásico: valores originales exactos de constants.ts y entities.ts
  classic: {
    bg: "#000",
    ship: "#fff",
    asteroid: "#fff",
    bullet: "#fff",
    particleRgb: "255,255,255",
    thrust: "rgba(255, 130, 0, 0.85)",
    bombFlashRgb: "255,255,255",
    shieldFill: "rgba(68,255,68,0.12)",
    powerUpColors: {
      triple: "#0ff",
      shield: "#4f4",
      bomb: "#f80",
    },
  },
  // Neón: cian/magenta/amarillo saturados sobre fondo oscuro de la plataforma
  neon: {
    bg: "#0b0b14",
    ship: "#00f5ff",
    asteroid: "#ff006e",
    bullet: "#f5ff00",
    particleRgb: "0,245,255",
    thrust: "rgba(255, 0, 110, 0.9)",
    bombFlashRgb: "245,255,0",
    shieldFill: "rgba(0,255,136,0.18)",
    powerUpColors: {
      triple: "#00f5ff",
      shield: "#00ff88",
      bomb: "#f5ff00",
    },
  },
  // Retro: ámbar sobre pantalla CRT ambarina, estilo monitor de los 80
  retro: {
    bg: "#1a0a00",
    ship: "#ffb000",
    asteroid: "#ffb000",
    bullet: "#ffd77a",
    particleRgb: "255,176,0",
    thrust: "rgba(255, 100, 0, 0.9)",
    bombFlashRgb: "255,200,100",
    shieldFill: "rgba(255,207,58,0.18)",
    powerUpColors: {
      triple: "#ffd77a",
      shield: "#ffcf3a",
      bomb: "#ff6a00",
    },
  },
};
