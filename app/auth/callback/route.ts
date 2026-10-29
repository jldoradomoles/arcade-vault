import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

type CookieEntry = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/acceso`);
  }

  // Colectamos las cookies que Supabase quiere escribir para aplicarlas
  // al redirect final, independientemente del destino.
  const pendingCookies: CookieEntry[] = [];

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const cookie of cookies) {
            pendingCookies.push(cookie as CookieEntry);
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/acceso`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", data.session.user.id)
    .maybeSingle();

  const destination = profile?.username ? "/" : "/completar-perfil";
  const response = NextResponse.redirect(`${origin}${destination}`);

  for (const { name, value, options } of pendingCookies) {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    );
  }

  return response;
}
