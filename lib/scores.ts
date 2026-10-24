import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { GameColor } from "@/lib/game-types";

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

// Filas leídas por juego antes de quedarse con la mejor de cada jugador.
const FETCH_LIMIT = 1000;

// dd/mm/yyyy en UTC, igual en servidor y cliente.
function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

// Mejor puntuación de cada jugador en un juego, de mayor a menor (desempate: la más antigua).
// Los jugadores semilla no tienen user_id: se identifican por player_name.
// cache() evita repetir la consulta cuando top y «tu mejor marca» se piden en la misma petición.
const bestPerPlayer = cache(async (gameId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("user_id, player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(FETCH_LIMIT);
  if (error) throw new Error(`No se pudo leer scores: ${error.message}`);

  const seen = new Set<string>();
  const rows: {
    userId: string | null;
    name: string;
    score: number;
    date: string;
  }[] = [];
  for (const s of data) {
    const key = s.user_id ?? `seed:${s.player_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      userId: s.user_id,
      name: s.player_name.toUpperCase(),
      score: s.score,
      date: formatDate(s.created_at),
    });
  }
  return rows;
});

export async function getTopScores(
  gameId: string,
  limit = 12,
): Promise<ScoreRow[]> {
  const rows = await bestPerPlayer(gameId);
  return rows.slice(0, limit).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    score: r.score,
    date: r.date,
  }));
}

export async function getUserBest(
  userId: string,
  gameId: string,
): Promise<{ rank: number; score: number; date: string } | null> {
  const rows = await bestPerPlayer(gameId);
  const i = rows.findIndex((r) => r.userId === userId);
  return i === -1
    ? null
    : { rank: i + 1, score: rows[i].score, date: rows[i].date };
}

export interface RecentScore {
  id: string;
  player: string;
  game: string;
  score: number;
  ago: string;
  color: GameColor;
}

export interface TopPlayer {
  rank: number;
  player: string;
  score: number;
}

// "hace 5 min", "hace 3 h", "hace 2 d"
function formatAgo(iso: string): string {
  const min = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 1440) return `hace ${Math.floor(min / 60)} h`;
  return `hace ${Math.floor(min / 1440)} d`;
}

export async function getRecentScores(limit = 7): Promise<RecentScore[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("id, player_name, score, created_at, games(title, color)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`No se pudo leer scores: ${error.message}`);
  return data.flatMap((s) =>
    s.games
      ? [
          {
            id: s.id,
            player: s.player_name.toUpperCase(),
            game: s.games.title,
            score: s.score,
            ago: formatAgo(s.created_at),
            color: s.games.color as GameColor,
          },
        ]
      : [],
  );
}

// Mejor puntuación de cada jugador en las últimas 24 horas, de mayor a menor.
export async function getTopPlayersToday(limit = 5): Promise<TopPlayer[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("scores")
    .select("user_id, player_name, score")
    .gte("created_at", since)
    .order("score", { ascending: false })
    .limit(FETCH_LIMIT);
  if (error) throw new Error(`No se pudo leer scores: ${error.message}`);

  const seen = new Set<string>();
  const rows: TopPlayer[] = [];
  for (const s of data) {
    const key = s.user_id ?? `seed:${s.player_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      rank: rows.length + 1,
      player: s.player_name.toUpperCase(),
      score: s.score,
    });
    if (rows.length === limit) break;
  }
  return rows;
}
