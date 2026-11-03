import type { SkinId } from "@/lib/game-types";

// Paleta cromática del juego Pantano. Cada campo corresponde a un color
// concreto usado en el motor; los valores de 'classic' reproducen
// exactamente los colores que existían en engine.ts antes de la refactorización.
export interface PantanoPalette {
  // Fondos
  bgWater: string;
  bgShore: string;

  // Cuadrícula y corrientes
  gridLine: string;
  arrowNormal: string;
  arrowDiagonal: string;

  // Barra de tiempo (indicador de estado: bien / advertencia / peligro)
  timerHigh: string;
  timerMid: string;
  timerLow: string;

  // Cursor fantasma (fase de colocación)
  cursorValid: string;
  cursorInvalid: string;
  cursorLilypadFill: string;
  cursorLogFill: string;
  cursorTurtleFill: string;

  // Pieza: nenúfar
  lilypadFill: string;
  lilypadStroke: string;

  // Pieza: tronco
  logFill: string;
  logStroke: string;
  logGrain: string;

  // Pieza: tortuga
  turtleFill: string;
  turtleStroke: string;
  turtleRing: string;

  // Barra de inventario
  hudBarBg: string;
  invSelectedBg: string;
  invEmptyColor: string;
  invLilypadColor: string;
  invLogColor: string;
  invTurtleColor: string;
  invTextSelected: string;
  invTextAvailable: string;
  invTextEmpty: string;
  invLabelSelected: string;
  invLabelAvailable: string;

  // Etiquetas HUD superpuestas al canvas
  phaseLabel: string;
  frogCountText: string;

  // Ranas
  frogBody: string;
  frogBodyStroke: string;
  frogEye: string;
  frogPupil: string;

  // Panel de resultado de oleada y overlay de bienvenida
  resultBg: string;
  waveIntroBg: string;
  accentColor: string;
  resultDivider: string;
  resultProgressBg: string;
  resultText: string;
  resultHighlight: string;
  waveStatText: string;
}

export const SKINS: Record<SkinId, PantanoPalette> = {
  // classic: copia literal de los colores que tenía engine.ts originalmente
  classic: {
    bgWater: "#0d2137",
    bgShore: "#2d5a1e",

    gridLine: "rgba(255,255,255,0.06)",
    arrowNormal: "rgba(100,180,255,0.20)",
    arrowDiagonal: "rgba(224,64,251,0.22)",

    timerHigh: "#4caf50",
    timerMid: "#ffea00",
    timerLow: "#f44336",

    cursorValid: "#ffea00",
    cursorInvalid: "#f44336",
    cursorLilypadFill: "#2d7a1e",
    cursorLogFill: "#7b4a2a",
    cursorTurtleFill: "#556b2f",

    lilypadFill: "#2d7a2d",
    lilypadStroke: "#1a5a1a",

    logFill: "#7b4a2a",
    logStroke: "#5a3520",
    logGrain: "rgba(90,53,32,0.5)",

    turtleFill: "#556b2f",
    turtleStroke: "#3d4f22",
    turtleRing: "rgba(100,120,40,0.7)",

    hudBarBg: "rgba(0,0,0,0.5)",
    invSelectedBg: "rgba(255,234,0,0.12)",
    invEmptyColor: "rgba(70,70,70,0.5)",
    invLilypadColor: "#2d7a2d",
    invLogColor: "#7b4a2a",
    invTurtleColor: "#556b2f",
    invTextSelected: "#ffea00",
    invTextAvailable: "#cccccc",
    invTextEmpty: "#555555",
    invLabelSelected: "rgba(255,234,0,0.75)",
    invLabelAvailable: "rgba(160,160,160,0.45)",

    phaseLabel: "rgba(255,255,255,0.55)",
    frogCountText: "rgba(255,255,255,0.65)",

    frogBody: "#22dd44",
    frogBodyStroke: "#18a030",
    frogEye: "#2eff55",
    frogPupil: "#001a00",

    resultBg: "rgba(5,15,25,0.88)",
    waveIntroBg: "rgba(5,15,25,0.82)",
    accentColor: "#e040fb",
    resultDivider: "rgba(224,64,251,0.35)",
    resultProgressBg: "rgba(224,64,251,0.2)",
    resultText: "#cccccc",
    resultHighlight: "#ffea00",
    waveStatText: "#ffffff",
  },

  // neon: saturado y de alto contraste sobre el fondo CRT (#0a0a0f)
  neon: {
    bgWater: "#050e1a",
    bgShore: "#051a0e",

    gridLine: "rgba(0,245,255,0.07)",
    arrowNormal: "rgba(0,245,255,0.28)",
    arrowDiagonal: "rgba(255,0,110,0.30)",

    timerHigh: "#00ff88",
    timerMid: "#f5ff00",
    timerLow: "#ff006e",

    cursorValid: "#f5ff00",
    cursorInvalid: "#ff006e",
    cursorLilypadFill: "#00c4a0",
    cursorLogFill: "#cc3366",
    cursorTurtleFill: "#00aa66",

    lilypadFill: "#00c4a0",
    lilypadStroke: "#007a64",

    logFill: "#b0004e",
    logStroke: "#700030",
    logGrain: "rgba(255,0,110,0.30)",

    turtleFill: "#00aa66",
    turtleStroke: "#006640",
    turtleRing: "rgba(0,255,136,0.55)",

    hudBarBg: "rgba(0,0,0,0.7)",
    invSelectedBg: "rgba(0,245,255,0.10)",
    invEmptyColor: "rgba(50,50,70,0.5)",
    invLilypadColor: "#00c4a0",
    invLogColor: "#b0004e",
    invTurtleColor: "#00aa66",
    invTextSelected: "#f5ff00",
    invTextAvailable: "#a0d0d0",
    invTextEmpty: "#404060",
    invLabelSelected: "rgba(0,245,255,0.75)",
    invLabelAvailable: "rgba(0,180,200,0.45)",

    phaseLabel: "rgba(0,245,255,0.65)",
    frogCountText: "rgba(0,245,255,0.70)",

    frogBody: "#00ff88",
    frogBodyStroke: "#00cc60",
    frogEye: "#ccffe8",
    frogPupil: "#003322",

    resultBg: "rgba(0,8,18,0.90)",
    waveIntroBg: "rgba(0,8,18,0.84)",
    accentColor: "#00f5ff",
    resultDivider: "rgba(0,245,255,0.35)",
    resultProgressBg: "rgba(0,245,255,0.18)",
    resultText: "#a0d0d0",
    resultHighlight: "#f5ff00",
    waveStatText: "#e6e9ff",
  },

  // retro: ámbar/fósforo verde, coherente con el chrome CRT de la plataforma
  retro: {
    bgWater: "#080c04",
    bgShore: "#141008",

    gridLine: "rgba(180,140,0,0.12)",
    arrowNormal: "rgba(180,140,0,0.25)",
    arrowDiagonal: "rgba(200,80,0,0.25)",

    timerHigh: "#70a000",
    timerMid: "#c4a000",
    timerLow: "#c44000",

    cursorValid: "#c4a000",
    cursorInvalid: "#c44000",
    cursorLilypadFill: "#507800",
    cursorLogFill: "#886000",
    cursorTurtleFill: "#607000",

    lilypadFill: "#507800",
    lilypadStroke: "#305000",

    logFill: "#886000",
    logStroke: "#584000",
    logGrain: "rgba(130,90,0,0.5)",

    turtleFill: "#607000",
    turtleStroke: "#404a00",
    turtleRing: "rgba(110,130,0,0.7)",

    hudBarBg: "rgba(0,0,0,0.6)",
    invSelectedBg: "rgba(200,160,0,0.14)",
    invEmptyColor: "rgba(60,60,30,0.5)",
    invLilypadColor: "#507800",
    invLogColor: "#886000",
    invTurtleColor: "#607000",
    invTextSelected: "#c4a000",
    invTextAvailable: "#8a8060",
    invTextEmpty: "#404030",
    invLabelSelected: "rgba(196,160,0,0.75)",
    invLabelAvailable: "rgba(130,120,60,0.45)",

    phaseLabel: "rgba(196,170,0,0.65)",
    frogCountText: "rgba(196,170,0,0.70)",

    frogBody: "#70c000",
    frogBodyStroke: "#488000",
    frogEye: "#a8d030",
    frogPupil: "#101000",

    resultBg: "rgba(10,8,0,0.90)",
    waveIntroBg: "rgba(10,8,0,0.84)",
    accentColor: "#c4a000",
    resultDivider: "rgba(196,160,0,0.35)",
    resultProgressBg: "rgba(196,160,0,0.18)",
    resultText: "#909060",
    resultHighlight: "#c4a000",
    waveStatText: "#d0c080",
  },
};
