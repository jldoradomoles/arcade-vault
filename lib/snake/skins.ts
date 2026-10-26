// Paletas de Snake por skin. Toda la cromática del juego vive aquí.
import type { SkinId } from "@/lib/game-types";

export interface SnakePalette {
  bg: string; // color de fondo del canvas
  gridLine: string; // retícula del tablero
  head: string; // cabeza de la serpiente
  body: string; // cuerpo de la serpiente
  fruitFallback: string; // círculo de respaldo mientras no carga el sprite
  spriteFilter: string; // filtro CSS aplicado al dibujar fruits.png
}

export const SKINS: Record<SkinId, SnakePalette> = {
  // Clásico: valores originales exactos de constants.ts
  classic: {
    bg: "#11111f",
    gridLine: "rgba(0, 245, 255, 0.07)",
    head: "#00f5ff",
    body: "#00ff88",
    fruitFallback: "#ff006e",
    spriteFilter: "none",
  },
  // Neón: magenta/amarillo saturados sobre fondo oscuro de la plataforma;
  // los sprites de fruta se tiñen con un hue-rotate para alinearse con la paleta.
  neon: {
    bg: "#0b0b14",
    gridLine: "rgba(255, 0, 110, 0.1)",
    head: "#ff006e",
    body: "#f5ff00",
    fruitFallback: "#00f5ff",
    spriteFilter: "saturate(1.5) hue-rotate(140deg) brightness(1.05)",
  },
  // Retro: ámbar sobre pantalla CRT ambarina, estilo monitor de los 80;
  // la hoja de sprites pasa por sepia + hue-rotate para quedar monocromática cálida.
  retro: {
    bg: "#1a0a00",
    gridLine: "rgba(255, 176, 0, 0.1)",
    head: "#ffd77a",
    body: "#ffb000",
    fruitFallback: "#ff6a00",
    spriteFilter: "sepia(1) hue-rotate(-20deg) saturate(1.6) brightness(1.05)",
  },
};
