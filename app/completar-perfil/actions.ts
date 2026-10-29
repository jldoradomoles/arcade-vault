"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,10}$/;

export type SetUsernameResult = { ok: true } | { ok: false; error: string };

export async function setUsername(
  _prev: SetUsernameResult | null,
  formData: FormData,
): Promise<SetUsernameResult> {
  const username = String(formData.get("username") ?? "").trim();

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error:
        "El usuario debe tener de 3 a 10 caracteres: letras, números o guion bajo.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "No hay sesión activa." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", user.id);

  if (error) {
    const msg =
      error.code === "23505"
        ? "Ese nombre de usuario ya está en uso."
        : "No se pudo guardar el usuario. Inténtalo de nuevo.";
    return { ok: false, error: msg };
  }

  redirect("/");
}
