"use client";

import { useEffect, useRef } from "react";
import { W, H } from "@/lib/asteroids/constants";
import { AsteroidsEngine, type AsteroidsStats } from "@/lib/asteroids/engine";

interface AsteroidsCanvasProps {
  paused: boolean;
  over: boolean; // true => el motor llama a finish()
  onStats: (stats: AsteroidsStats) => void;
  onGameOver: (finalScore: number) => void;
}

export function AsteroidsCanvas({
  paused,
  over,
  onStats,
  onGameOver,
}: AsteroidsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);

  // El motor se crea una sola vez; los callbacks se leen de refs para no recrearlo en cada render
  const callbacksRef = useRef({ onStats, onGameOver });
  useEffect(() => {
    callbacksRef.current = { onStats, onGameOver };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new AsteroidsEngine(canvas, {
      onStats: (s) => callbacksRef.current.onStats(s),
      onGameOver: (score) => callbacksRef.current.onGameOver(score),
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (over) engineRef.current?.finish();
  }, [over]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      className="block aspect-[4/3] w-full"
    />
  );
}
