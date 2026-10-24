import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { Game, GameCategory, GameColor } from "@/lib/game-types";

export { CATS } from "@/lib/game-types";
export type { Game, GameCategory, GameColor } from "@/lib/game-types";

type GameStat = Pick<Tables<"game_stats">, "best" | "plays">;

// 8700 -> "8.7K"; por debajo de mil se muestra el número tal cual.
function formatPlays(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

function toGame(row: Tables<"games">, stat?: GameStat): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.category as GameCategory,
    cover: row.cover,
    color: row.color as GameColor,
    best: stat?.best ?? 0,
    plays: formatPlays(stat?.plays ?? 0),
  };
}

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const [games, stats] = await Promise.all([
    supabase.from("games").select("*").order("sort_order"),
    supabase.from("game_stats").select("game_id, best, plays"),
  ]);
  if (games.error)
    throw new Error(`No se pudo leer games: ${games.error.message}`);
  if (stats.error)
    throw new Error(`No se pudo leer game_stats: ${stats.error.message}`);

  const byId = new Map(stats.data.map((s) => [s.game_id, s]));
  return games.data.map((g) => toGame(g, byId.get(g.id)));
}

export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const [game, stat] = await Promise.all([
    supabase.from("games").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("game_stats")
      .select("best, plays")
      .eq("game_id", id)
      .maybeSingle(),
  ]);
  if (game.error)
    throw new Error(`No se pudo leer games: ${game.error.message}`);
  if (stat.error)
    throw new Error(`No se pudo leer game_stats: ${stat.error.message}`);
  return game.data ? toGame(game.data, stat.data ?? undefined) : null;
}
