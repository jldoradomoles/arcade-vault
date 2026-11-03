import type { SkinId } from "@/lib/game-types";

// Paleta cromática completa para Croak. Los campos *Rgb almacenan solo la
// parte "r,g,b" para colores con canal alpha dinámico (calculado en el motor).
export interface CroakPalette {
  // Fondo
  bg: string;
  waterDeep: string; // parada opaca del gradiente de agua
  waterReflect: string; // líneas de reflejo horizontal
  bgFirefly: string; // luciérnagas decorativas de fondo

  // Nenúfar
  lilyHlActive: string;
  lilyHlInactive: string;
  lilyMidActive: string;
  lilyMidInactive: string;
  lilyDark: string;
  lilySplitActive: string; // hendidura del nenúfar activo
  lilySplitInactive: string;
  lilyRimActive: string; // borde de neón del nenúfar activo
  lilyGlow: string; // shadowColor del borde activo

  // Rana
  frogBody: string;
  frogGlow: string; // shadowColor del cuerpo
  frogHead: string; // cabeza y bulbos de los ojos
  frogPupil: string; // pupilas

  // Lengua
  tongue: string; // trazo y shadowColor
  tongueTip: string; // bola de la punta

  // Línea de apuntado
  aimLine: string;
  aimTip: string;

  // Mosca (alpha fijo)
  flyBody: string;
  flyWing: string; // rgba completo con alpha fijo
  flyEye: string;

  // Libélula (alas con alpha dinámico basado en `wing`)
  dragonflyBody: string;
  dragonflyWingRgb: string; // solo "r,g,b" — se combina con alpha dinámico
  dragonflyEye: string;

  // Luciérnaga (halo y alas con alpha dinámico basado en `glow`)
  fireflyHaloRgb: string; // solo "r,g,b"
  fireflyBody: string;
  fireflyGlow: string; // shadowColor del cuerpo
  fireflyWingRgb: string; // solo "r,g,b"

  // Barra de tiempo
  timerHigh: string; // ratio > 0.5
  timerMid: string; // ratio > 0.25
  timerLow: string; // ratio ≤ 0.25

  // UI textual
  comboColor: string;
  uiAccent: string; // titulos de ronda completada
  uiSub: string; // subtítulos de ronda y shadowColor
  readyText: string; // texto de pantalla inicial
}

export const SKINS: Record<SkinId, CroakPalette> = {
  // classic: reproduce exactamente los valores originales de engine.ts
  classic: {
    bg: "#061206",
    waterDeep: "rgba(4,18,10,0.85)",
    waterReflect: "rgba(0,245,255,0.04)",
    bgFirefly: "#00f5ff",

    lilyHlActive: "#2eff88",
    lilyHlInactive: "#22cc55",
    lilyMidActive: "#1a9944",
    lilyMidInactive: "#177733",
    lilyDark: "#0d4422",
    lilySplitActive: "rgba(0,245,255,0.4)",
    lilySplitInactive: "rgba(0,200,80,0.25)",
    lilyRimActive: "rgba(0,245,255,0.55)",
    lilyGlow: "#00f5ff",

    frogBody: "#22dd44",
    frogGlow: "#00ff88",
    frogHead: "#2eff55",
    frogPupil: "#001a00",

    tongue: "#ff88aa",
    tongueTip: "#ff4488",

    aimLine: "rgba(0,245,255,0.45)",
    aimTip: "rgba(0,245,255,0.65)",

    flyBody: "#888",
    flyWing: "rgba(200,220,255,0.5)",
    flyEye: "#cc4444",

    dragonflyBody: "#44aaff",
    dragonflyWingRgb: "150,220,255",
    dragonflyEye: "#88eeff",

    fireflyHaloRgb: "0,245,255",
    fireflyBody: "#ffe070",
    fireflyGlow: "#00f5ff",
    fireflyWingRgb: "180,240,255",

    timerHigh: "#00f5ff",
    timerMid: "#f5ff00",
    timerLow: "#ff004c",

    comboColor: "#f5ff00",
    uiAccent: "#f5ff00",
    uiSub: "#00f5ff",
    readyText: "rgba(0,245,255,0.85)",
  },

  // neon: saturado y de alto contraste sobre fondo CRT oscuro
  neon: {
    bg: "#04080a",
    waterDeep: "rgba(0,12,20,0.85)",
    waterReflect: "rgba(0,255,170,0.06)",
    bgFirefly: "#ff00aa",

    lilyHlActive: "#00ffaa",
    lilyHlInactive: "#00cc66",
    lilyMidActive: "#00aa44",
    lilyMidInactive: "#007733",
    lilyDark: "#003318",
    lilySplitActive: "rgba(0,255,136,0.5)",
    lilySplitInactive: "rgba(0,200,80,0.3)",
    lilyRimActive: "rgba(0,255,170,0.7)",
    lilyGlow: "#00ffaa",

    frogBody: "#00dd55",
    frogGlow: "#00ff88",
    frogHead: "#00ff66",
    frogPupil: "#000a00",

    tongue: "#ff00aa",
    tongueTip: "#ff0066",

    aimLine: "rgba(0,255,136,0.5)",
    aimTip: "rgba(0,255,136,0.7)",

    flyBody: "#aaaaaa",
    flyWing: "rgba(180,240,255,0.6)",
    flyEye: "#ff3333",

    dragonflyBody: "#00aaff",
    dragonflyWingRgb: "100,220,255",
    dragonflyEye: "#66eeff",

    fireflyHaloRgb: "255,0,170",
    fireflyBody: "#ffee00",
    fireflyGlow: "#ff00aa",
    fireflyWingRgb: "255,180,255",

    timerHigh: "#00ffaa",
    timerMid: "#ffee00",
    timerLow: "#ff0044",

    comboColor: "#ffee00",
    uiAccent: "#ffee00",
    uiSub: "#00ffaa",
    readyText: "rgba(0,255,170,0.9)",
  },

  // retro: ámbar / verde fósforo, coherente con el chrome CRT
  retro: {
    bg: "#0a0800",
    waterDeep: "rgba(10,8,0,0.85)",
    waterReflect: "rgba(180,140,0,0.05)",
    bgFirefly: "#c8a000",

    lilyHlActive: "#b8ff00",
    lilyHlInactive: "#88cc00",
    lilyMidActive: "#669900",
    lilyMidInactive: "#446600",
    lilyDark: "#223300",
    lilySplitActive: "rgba(184,255,0,0.45)",
    lilySplitInactive: "rgba(100,160,0,0.3)",
    lilyRimActive: "rgba(184,255,0,0.6)",
    lilyGlow: "#b8ff00",

    frogBody: "#b8cc00",
    frogGlow: "#d4ee00",
    frogHead: "#ccee00",
    frogPupil: "#0a0800",

    tongue: "#cc8800",
    tongueTip: "#ee6600",

    aimLine: "rgba(184,255,0,0.5)",
    aimTip: "rgba(184,255,0,0.7)",

    flyBody: "#887744",
    flyWing: "rgba(200,180,100,0.5)",
    flyEye: "#cc4400",

    dragonflyBody: "#aacc00",
    dragonflyWingRgb: "180,200,80",
    dragonflyEye: "#eedd88",

    fireflyHaloRgb: "184,255,0",
    fireflyBody: "#eebb00",
    fireflyGlow: "#b8ff00",
    fireflyWingRgb: "200,220,100",

    timerHigh: "#b8ff00",
    timerMid: "#ddcc00",
    timerLow: "#cc4400",

    comboColor: "#eebb00",
    uiAccent: "#eebb00",
    uiSub: "#b8ff00",
    readyText: "rgba(184,255,0,0.85)",
  },
};
