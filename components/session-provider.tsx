"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

export interface SessionUser {
  id: string;
  name: string; // profiles.username
}

interface SessionContextValue {
  user: SessionUser | null;
  signIn: (email: string, password: string) => Promise<string | null>; // devuelve mensaje de error
  signUp: (
    username: string,
    email: string,
    password: string,
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
}

// Supabase devuelve mensajes en inglés; el trigger handle_new_user falla con un error genérico
// cuando el username ya existe (el patrón ya se valida en el formulario).
function authMessage(error: { message: string; code?: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos.";
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese correo.";
    case "email_address_invalid":
    case "validation_failed":
      return "El correo electrónico no es válido.";
    case "weak_password":
      return "La contraseña es demasiado débil. Usa al menos 6 caracteres.";
    case "unexpected_failure":
    case "database_error":
      return "Ese nombre de usuario ya está en uso.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Demasiados intentos. Espera un momento y vuelve a probar.";
  }
  if (/database error saving new user/i.test(error.message)) {
    return "Ese nombre de usuario ya está en uso.";
  }
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}

const SessionContext = createContext<SessionContextValue | null>(null);

// El cliente se crea la primera vez que se usa, siempre en el navegador (efectos y acciones).
// Crearlo al renderizar lo ejecutaría también en el prerender del servidor, donde la
// librería de auth lee Date.now() al emitir la sesión inicial.
let browserClient: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  return (browserClient ??= createClient());
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<SessionUser | null>(null);

  // Servidor e hidratación: sin sesión, para que el primer render coincida.
  // El callback solo guarda el id; la lectura de profiles va en otro efecto
  // porque no se deben hacer llamadas a Supabase dentro de onAuthStateChange.
  useEffect(() => {
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getSupabase()
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled)
          setProfile(data ? { id: userId, name: data.username } : null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // El perfil solo vale si corresponde a la sesión actual.
  const user = userId && profile?.id === userId ? profile : null;

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email,
      password,
    });
    return error ? authMessage(error) : null;
  }, []);

  const signUp = useCallback(
    async (username: string, email: string, password: string) => {
      const { data, error } = await getSupabase().auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) return authMessage(error);
      // Sin sesión inmediata es que el proyecto exige confirmar el correo.
      if (!data.session) {
        return "Cuenta creada, pero hay que confirmar el correo antes de entrar.";
      }
      return null;
    },
    [],
  );

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user, signIn, signUp, signOut }),
    [user, signIn, signUp, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx)
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return ctx;
}
