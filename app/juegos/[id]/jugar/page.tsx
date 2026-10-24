import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GamePlayer } from "@/components/game-player";
import { getGame } from "@/lib/games";

export default function JugarPage({ params }: PageProps<"/juegos/[id]/jugar">) {
  // `params` se lee dentro de Suspense para que el shell estático no dependa de la URL
  return (
    <Suspense fallback={<div className="av-player" aria-busy="true" />}>
      <Jugar params={params} />
    </Suspense>
  );
}

async function Jugar({
  params,
}: {
  params: PageProps<"/juegos/[id]/jugar">["params"];
}) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <GamePlayer game={{ id: game.id, title: game.title }} />;
}
