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
  enableTouchDrag?: boolean;
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
  enableTouchDrag,
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enableTouchDrag) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      canvas.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: touch.clientX,
          clientY: touch.clientY,
          bubbles: true,
        }),
      );
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
    };

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [enableTouchDrag]);

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
