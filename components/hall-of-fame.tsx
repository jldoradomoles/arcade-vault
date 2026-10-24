"use client";

import Link from "next/link";
import { useState } from "react";
import type { Game } from "@/lib/game-types";
import type { ScoreRow } from "@/lib/scores";

const fmt = (n: number) => n.toLocaleString("es-ES");

function PodiumSlot({
  row,
  place,
  className,
}: {
  row: ScoreRow | undefined;
  place: "01" | "02" | "03";
  className: "gold" | "silver" | "bronze";
}) {
  const champion = place === "01";
  return (
    <div className={"podium-slot " + className + (row ? "" : " vacant")}>
      {champion && (
        <div className="pixel text-[9px] tracking-[0.18em] text-gold">
          CAMPEÓN
        </div>
      )}
      <div className={"rank-num" + (champion ? " mt-1 !text-[36px]" : "")}>
        {place}
      </div>
      <div className="name">{row ? row.name : "—"}</div>
      <div className={"score" + (champion ? " !text-[20px]" : "")}>
        {row ? fmt(row.score) : "—"}
      </div>
      <div className="date">{row ? row.date : "SIN OCUPAR"}</div>
    </div>
  );
}

export interface MyBests {
  name: string;
  byGame: Record<string, { rank: number; score: number; date: string }>;
}

export function HallOfFame({
  games,
  topsByGame,
  mine,
}: {
  games: Game[];
  topsByGame: Record<string, ScoreRow[]>;
  mine: MyBests | null;
}) {
  const [tab, setTab] = useState(games[0]?.id ?? "");
  const rows = topsByGame[tab] ?? [];
  const [first, second, third] = rows;
  const game = games.find((g) => g.id === tab);
  const myBest = mine?.byGame[tab];

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel text-[10px]">
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="hall-empty">
          <div className="pixel mb-3 text-sm text-magenta">
            NADIE HA ENTRADO AQUÍ TODAVÍA
          </div>
          <div>
            Juega una partida, guarda tu puntuación y ocupa el primer puesto.
          </div>
          <Link href={`/juegos/${tab}`} className="btn lg mt-5">
            VER JUEGO
          </Link>
        </div>
      ) : (
        <>
          <div className="podium">
            <PodiumSlot row={second} place="02" className="silver" />
            <PodiumSlot row={first} place="01" className="gold" />
            <PodiumSlot row={third} place="03" className="bronze" />
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.rank}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{fmt(r.score)}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {mine && myBest && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game?.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk !text-yellow">
                    #{String(myBest.rank).padStart(2, "0")}
                  </div>
                  <div className="pl !text-yellow">{mine.name}</div>
                  <div className="sc !text-yellow [text-shadow:0_0_6px_rgba(245,255,0,0.5)]">
                    {fmt(myBest.score)}
                  </div>
                  <div className="dt">{myBest.date}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="mt-8 text-center">
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
