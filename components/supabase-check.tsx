"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Temporal (SPEC 04): comprueba la conexión con Supabase y la deja en la consola.
export function SupabaseCheck() {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      console.error(
        "[Supabase] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      );
      return;
    }

    const supabase = createClient();
    Promise.all([
      supabase.auth.getSession(),
      fetch(`${url}/auth/v1/health`, { headers: { apikey: key } }),
    ])
      .then(([{ data, error }, health]) => {
        if (error || !health.ok) {
          console.error("[Supabase] Conexión fallida", {
            error,
            health: health.status,
          });
          return;
        }
        console.log(
          `[Supabase] Conexión OK · ${url} · health ${health.status} · sesión:`,
          data.session,
        );
      })
      .catch((err) => console.error("[Supabase] Conexión fallida", err));
  }, []);

  return null;
}
