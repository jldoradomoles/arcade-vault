"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AsteroidsCanvas } from "@/components/asteroids-canvas";
import { useSession } from "@/components/session-provider";
import type { AsteroidsStats } from "@/lib/asteroids/engine";
import type { Game } from "@/lib/games";

const fmt = (n: number) => n.toLocaleString("es-ES");
const LIVES = 3;
const POINTS_PER_LEVEL = 2500;

const ASTEROIDS_CONTROLS: { keys: string[]; action: string }[] = [
  { keys: ["←", "→"], action: "Girar" },
  { keys: ["↑"], action: "Propulsar" },
  { keys: ["Espacio"], action: "Disparar" },
  { keys: ["B"], action: "Bomba Nova, si la tienes" },
];

// Asteroids es un juego real (motor en lib/asteroids): puntos, vidas y nivel vienen del motor.
// Los demás juegos siguen con un reproductor simulado: el puntaje sube solo.
export function GamePlayer({ game }: { game: Pick<Game, "id" | "title"> }) {
  const { user, saveScore } = useSession();
  const isAsteroids = game.id === "asteroids";
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [engineLevel, setEngineLevel] = useState(1);
  const [runKey, setRunKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const name = nameOverride ?? user?.name ?? "INVITADO";
  const level = isAsteroids ? engineLevel : 1 + Math.floor(score / POINTS_PER_LEVEL);

  const onStats = (stats: AsteroidsStats) => {
    setScore(stats.score);
    setLives(stats.lives);
    setEngineLevel(stats.level);
  };

  const onGameOver = (finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  };

  useEffect(() => {
    if (isAsteroids || over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [isAsteroids, over, paused]);

  const restart = () => {
    setScore(0);
    setLives(LIVES);
    setEngineLevel(1);
    setRunKey((k) => k + 1); // remonta el canvas: motor nuevo
    setPaused(false);
    setOver(false);
    setSaved(false);
  };

  const save = () => {
    saveScore({ game: game.id, score, name });
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div className="flex flex-wrap gap-6">
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v !text-ink">{name}</div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{fmt(score)}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim()}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button type="button" className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button type="button" className="btn magenta" onClick={() => setOver(true)}>FIN</button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">SALIR</Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isAsteroids ? (
            <AsteroidsCanvas
              key={runKey}
              paused={paused}
              over={over}
              onStats={onStats}
              onGameOver={onGameOver}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {paused && (
            <div className="crt-content z-[5] bg-black/60">
              <div>
                <div className="pixel neon-yellow text-[22px]">EN PAUSA</div>
                <div className="mono mt-2.5 text-[11px] tracking-[0.16em] text-ink-dim">
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {isAsteroids && (
        <ul
          aria-label="Controles"
          className="mono mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[12px] text-ink-dim"
        >
          {ASTEROIDS_CONTROLS.map(({ keys, action }) => (
            <li key={action} className="flex items-center gap-2">
              <span className="flex gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="min-w-7 rounded border border-b-2 border-ink-faint bg-white/5 px-1.5 py-0.5 text-center font-[inherit] text-ink"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
              {action}
            </li>
          ))}
        </ul>
      )}

      {over && (
        <div className="modal-bd">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Fin del juego">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{fmt(score)}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setNameOverride(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                  aria-label="Tus iniciales"
                />
                <button type="button" className="btn yellow" onClick={save}>
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button type="button" className="btn" onClick={restart}>JUGAR DE NUEVO</button>
              <Link href="/biblioteca" className="btn magenta">VOLVER AL VAULT</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
