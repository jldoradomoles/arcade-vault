"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GameCanvas } from "@/components/game-canvas";
import { useSession } from "@/components/session-provider";
import type { GameStats } from "@/lib/game-engine";
import { GAME_REGISTRY } from "@/lib/game-registry";
import type { Game } from "@/lib/games";
import { submitScore } from "@/app/juegos/[id]/jugar/actions";

const SAVE_ERRORS = {
  "no-session": "Tu sesión ha caducado. Inicia sesión de nuevo para guardar.",
  invalid: "Esta puntuación no se puede guardar.",
  failed: "No se pudo guardar la puntuación. Inténtalo de nuevo.",
} as const;

const fmt = (n: number) => n.toLocaleString("es-ES");
const LIVES = 3;
const POINTS_PER_LEVEL = 2500;

// Los juegos con entrada en GAME_REGISTRY tienen motor real: puntos, vidas y nivel vienen del motor
// (lo que el motor no emite, el HUD lo oculta). Los demás siguen con un reproductor simulado.
export function GamePlayer({ game }: { game: Pick<Game, "id" | "title"> }) {
  const { user } = useSession();
  const entry = GAME_REGISTRY[game.id];
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<number | undefined>(LIVES);
  const [engineLevel, setEngineLevel] = useState<number | undefined>(1);
  const [runKey, setRunKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const name = user?.name.toUpperCase() ?? "INVITADO";
  const level = entry
    ? engineLevel
    : 1 + Math.floor(score / POINTS_PER_LEVEL);

  const onStats = (stats: GameStats) => {
    setScore(stats.score);
    setLives(stats.lives);
    setEngineLevel(stats.level);
  };

  const onGameOver = (finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  };

  useEffect(() => {
    if (entry || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [entry, over, paused]);

  const restart = () => {
    setScore(0);
    setLives(entry ? undefined : LIVES);
    setEngineLevel(entry ? undefined : 1);
    setRunKey((k) => k + 1); // remonta el canvas: motor nuevo
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(null);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await submitScore({ gameId: game.id, score });
      if (result.ok) setSaved(true);
      else setSaveError(SAVE_ERRORS[result.error]);
    } catch {
      setSaveError(SAVE_ERRORS.failed);
    } finally {
      setSaving(false);
    }
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
          {lives !== undefined && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(lives).trim()}</div>
            </div>
          )}
          {level !== undefined && (
            <div className="hud-stat level">
              <div className="l">Nivel</div>
              <div className="v">{String(level).padStart(2, "0")}</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button
            type="button"
            className="btn yellow"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button
            type="button"
            className="btn magenta"
            onClick={() => setOver(true)}
          >
            FIN
          </button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div
        className="crt mx-auto"
        style={
          entry && entry.height > entry.width
            ? // juego vertical: el ancho se limita para que la pantalla quepa en la ventana
              { maxWidth: `calc(72vh * ${entry.width / entry.height} + 48px)` }
            : undefined
        }
      >
        <div
          className="crt-screen"
          style={
            entry
              ? { aspectRatio: `${entry.width} / ${entry.height}` }
              : undefined
          }
        >
          {entry ? (
            <GameCanvas
              key={runKey}
              createEngine={entry.createEngine}
              width={entry.width}
              height={entry.height}
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

      {entry && (
        <ul
          aria-label="Controles"
          className="mono mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-[12px] text-ink-dim"
        >
          {entry.controls.map(({ keys, action }) => (
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
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Fin del juego"
          >
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{fmt(score)}</div>
            {saved ? (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            ) : user ? (
              <div className="input-row">
                <div className="save-as" aria-label="Se guardará a nombre de">
                  {name}
                </div>
                <button
                  type="button"
                  className="btn yellow"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="input-row">
                <Link href="/acceso" className="btn yellow w-full">
                  INICIA SESIÓN PARA GUARDAR
                </Link>
              </div>
            )}
            {saveError && (
              <div className="auth-error" role="alert">
                {saveError}
              </div>
            )}
            <div className="actions">
              <button type="button" className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/biblioteca" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
