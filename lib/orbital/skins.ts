import type { SkinId } from "@/lib/game-types";

export interface OrbitalPalette {
  // Fondo
  bg: string;
  // Núcleo central
  coreColor: string;
  // Escudo (arco)
  arcColor: string;
  // Bola hostil
  ballColor: string;
  // Bola devuelta tras rebotar en el escudo
  returnedColor: string;
  // Anillo de recarga del pulso
  pulseColor: string;
  // Componentes R,G,B para construir rgba() dinámico en explosiones
  explosionRgb: string;
}

export const SKINS: Record<SkinId, OrbitalPalette> = {
  // Copia literal de los colores actuales de constants.ts
  classic: {
    bg: "#11111f",
    coreColor: "#ff44cc",
    arcColor: "#ff88ff",
    ballColor: "#ff3399",
    returnedColor: "#ffccff",
    pulseColor: "rgba(255, 136, 255, 0.35)",
    explosionRgb: "255, 200, 255",
  },
  // Cian/magenta saturado sobre fondo oscuro CRT
  neon: {
    bg: "#0a0a0f",
    coreColor: "#00f5ff",
    arcColor: "#ff006e",
    ballColor: "#ff006e",
    returnedColor: "#00f5ff",
    pulseColor: "rgba(0, 245, 255, 0.35)",
    explosionRgb: "255, 0, 110",
  },
  // Ámbar/verde fósforo, estética CRT monocroma
  retro: {
    bg: "#060c06",
    coreColor: "#ffb300",
    arcColor: "#00ff88",
    ballColor: "#ffb300",
    returnedColor: "#00ff88",
    pulseColor: "rgba(0, 255, 136, 0.35)",
    explosionRgb: "255, 200, 0",
  },
};
