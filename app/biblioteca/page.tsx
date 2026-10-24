import { Suspense } from "react";
import { Library } from "@/components/library";
import { getGames } from "@/lib/games";

export default function BibliotecaPage() {
  // La lectura de Supabase usa cookies(): va dentro de Suspense para no bloquear el shell estático
  return (
    <Suspense fallback={<div className="fade-in" aria-busy="true" />}>
      <BibliotecaGames />
    </Suspense>
  );
}

async function BibliotecaGames() {
  const games = await getGames();
  return <Library games={games} />;
}
