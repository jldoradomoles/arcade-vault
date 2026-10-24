"use server";

import { createClient } from "@/lib/supabase/server";

const MAX_SCORE = 10_000_000;

export type SubmitScoreResult =
  { ok: true } | { ok: false; error: "no-session" | "invalid" | "failed" };

// Valida tipo y rango (sin anti-trampas: ver SPEC 06) y guarda la puntuación del usuario autenticado.
export async function submitScore(input: {
  gameId: string;
  score: number;
}): Promise<SubmitScoreResult> {
  const { gameId, score } = input ?? {};
  if (
    typeof gameId !== "string" ||
    gameId.length === 0 ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_SCORE
  ) {
    return { ok: false, error: "invalid" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "no-session" };

  const [game, profile] = await Promise.all([
    supabase.from("games").select("id").eq("id", gameId).maybeSingle(),
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  if (game.error || profile.error || !profile.data)
    return { ok: false, error: "failed" };
  if (!game.data) return { ok: false, error: "invalid" };

  const { error } = await supabase.from("scores").insert({
    game_id: gameId,
    user_id: user.id,
    player_name: profile.data.username,
    score,
  });
  if (error) return { ok: false, error: "failed" };

  return { ok: true };
}
