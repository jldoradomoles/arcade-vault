import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";

export async function createClient() {
  // supabase-js lee la sesión (Date.now()) al consultar: debe ejecutarse en la petición,
  // no durante el prerender de prefetch, donde Next lo marca como valor inestable.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: no se pueden escribir cookies.
            // Se ignora; el refresco de sesión lo hace proxy.ts.
          }
        },
      },
    },
  );
}
