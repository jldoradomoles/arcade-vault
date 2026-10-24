import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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
