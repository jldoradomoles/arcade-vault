"use client";

import { useEffect, useRef } from "react";
import type { CreateEngine, GameEngine, GameStats } from "@/lib/game-engine";
import type { SkinId } from "@/lib/game-types";

interface GameCanvasProps {
  createEngine: CreateEngine;
  width: number;
  height: number;
  paused: boolean;
  over: boolean; // true => el motor llama a finish()
  skin?: SkinId;
  onStats: (stats: GameStats) => void;
  onGameOver: (finalScore: number) => void;
}

export function GameCanvas({
  createEngine,
  width,
  height,
  paused,
  over,
  skin,
  onStats,
  onGameOver,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // El motor se crea una sola vez; los callbacks se leen de refs para no recrearlo en cada render
  const callbacksRef = useRef({ onStats, onGameOver });
  useEffect(() => {
    callbacksRef.current = { onStats, onGameOver };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createEngine(
      canvas,
      {
        onStats: (s) => callbacksRef.current.onStats(s),
        onGameOver: (score) => callbacksRef.current.onGameOver(score),
      },
      { skin },
    );
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
    // createEngine viene del registro (referencia estable por juego).
    // Al cambiar la skin se remonta el motor para aplicar la paleta.
  }, [createEngine, skin]);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (over) engineRef.current?.finish();
  }, [over]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="block w-full"
      style={{ aspectRatio: `${width} / ${height}` }}
    />
  );
}
