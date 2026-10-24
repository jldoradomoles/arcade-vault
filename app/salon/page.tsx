import { Suspense } from "react";
import { HallOfFame, type MyBests } from "@/components/hall-of-fame";
import { getGames } from "@/lib/games";
import { getTopScores, getUserBest } from "@/lib/scores";
import { createClient } from "@/lib/supabase/server";

export default function SalonPage() {
  return (
    <Suspense fallback={<div className="av-hall" aria-busy="true" />}>
      <SalonGames />
    </Suspense>
  );
}

// Usuario autenticado y su mejor marca en cada juego donde ha jugado.
async function getMyBests(gameIds: string[]): Promise<MyBests | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;

  const [profile, bests] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", userId).maybeSingle(),
    Promise.all(gameIds.map((id) => getUserBest(userId, id))),
  ]);
  if (!profile.data) return null;

  const byGame: MyBests["byGame"] = {};
  gameIds.forEach((id, i) => {
    const best = bests[i];
    if (best) byGame[id] = best;
  });
  return { name: profile.data.username.toUpperCase(), byGame };
}

async function SalonGames() {
  const games = await getGames();
  const ids = games.map((g) => g.id);
  const [tops, mine] = await Promise.all([
    Promise.all(ids.map((id) => getTopScores(id, 12))),
    getMyBests(ids),
  ]);
  const topsByGame = Object.fromEntries(ids.map((id, i) => [id, tops[i]]));
  return <HallOfFame games={games} topsByGame={topsByGame} mine={mine} />;
}
