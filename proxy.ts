import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

// Refresca la sesión de Supabase en cada petición: getClaims() renueva el token
// caducado y las cookies actualizadas viajan en la petición y en la respuesta.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  await supabase.auth.getClaims();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    const pathname = request.nextUrl.pathname;
    const isExcluded =
      pathname === "/completar-perfil" || pathname.startsWith("/auth/");

    if (!isExcluded) {
      // Fast path: usuarios email tienen username en user_metadata (sin consulta DB).
      const metaUsername = session.user.user_metadata?.username as
        string | undefined;

      if (!metaUsername) {
        // Usuarios OAuth: verificar en profiles.
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!profile?.username) {
          return NextResponse.redirect(
            new URL("/completar-perfil", request.url),
          );
        }
      }
    }
  }

  return response;
}

export const config = {
  // Todas las rutas salvo estáticos de Next, imágenes y el favicon.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
