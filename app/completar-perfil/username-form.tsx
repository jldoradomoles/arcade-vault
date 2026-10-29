"use client";

import { useActionState } from "react";
import { setUsername, type SetUsernameResult } from "./actions";

export function UsernameForm() {
  const [state, action, pending] = useActionState<
    SetUsernameResult | null,
    FormData
  >(setUsername, null);

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-ink-faint">
            ELIGE TU NOMBRE DE JUGADOR
          </div>
        </div>

        <form action={action} noValidate>
          <div className="field">
            <label htmlFor="username">Nombre de usuario</label>
            <input
              id="username"
              name="username"
              placeholder="px_kai"
              maxLength={10}
              autoComplete="username"
              autoFocus
            />
          </div>

          {state && !state.ok && (
            <div className="auth-error" role="alert">
              {state.error}
            </div>
          )}

          <button
            className="btn lg mt-2 w-full"
            type="submit"
            disabled={pending}
          >
            {pending ? "GUARDANDO…" : "ENTRAR AL VAULT"}
          </button>
        </form>

        <div className="mt-[18px] text-center text-[11px] tracking-[0.1em] text-ink-faint">
          3–10 CARACTERES · LETRAS, NÚMEROS O GUION BAJO
        </div>
      </div>
    </div>
  );
}
