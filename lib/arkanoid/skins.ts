// Paletas de Arkanoid por skin. Como el juego dibuja sprites PNG, el teñido se
// aplica con `ctx.filter = spriteFilter` justo antes de cada `drawImage`.
import type { SkinId } from "@/lib/game-types";

export interface ArkanoidPalette {
  bg: string; // color de fondo del canvas
  levelText: string; // rótulo «Nivel N» mientras la bola está pegada
  spriteFilter: string; // filtro CSS aplicado al spritesheet
}

export const SKINS: Record<SkinId, ArkanoidPalette> = {
  // Clásico: valores originales exactos de constants.ts
  classic: {
    bg: "#11111f",
    levelText: "#ffffff",
    spriteFilter: "none",
  },
  // Neón: cian/magenta sobre `--bg`, con sprite virado al cian saturado
  neon: {
    bg: "#0b0b14",
    levelText: "#00f5ff",
    spriteFilter: "hue-rotate(90deg) saturate(1.4) brightness(1.1)",
  },
  // Retro: ámbar sobre fondo CRT ambarino, estilo monitor de los 80
  retro: {
    bg: "#1a0a00",
    levelText: "#ffd77a",
    spriteFilter: "sepia(1) hue-rotate(-30deg) saturate(1.6) brightness(1.1)",
  },
};
