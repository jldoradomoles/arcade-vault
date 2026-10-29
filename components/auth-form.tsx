"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/components/session-provider";

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,10}$/;

const PASSWORD_RULES = [
  {
    id: "len",
    label: "Mínimo 8 caracteres",
    test: (p: string) => p.length >= 8,
  },
  { id: "upper", label: "Una mayúscula", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "Una minúscula", test: (p: string) => /[a-z]/.test(p) },
  { id: "digit", label: "Un número", test: (p: string) => /\d/.test(p) },
  {
    id: "special",
    label: "Un carácter especial (!@#$…)",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
];

export function AuthForm() {
  const router = useRouter();
  const { signIn, signUp, signInWithProvider } = useSession();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchTab = (next: "in" | "up") => {
    setTab(next);
    setError(null);
  };

  const validate = (): string | null => {
    if (tab === "up" && !USERNAME_PATTERN.test(username)) {
      return "El usuario debe tener de 3 a 10 caracteres: letras, números o guion bajo.";
    }
    if (!email.trim()) return "Escribe tu correo electrónico.";
    if (tab === "up") {
      const failing = PASSWORD_RULES.find((r) => !r.test(pass));
      if (failing)
        return `La contraseña no cumple: ${failing.label.toLowerCase()}.`;
    } else {
      if (pass.length < 8)
        return "La contraseña debe tener al menos 8 caracteres.";
    }
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setBusy(true);
    const failure =
      tab === "in"
        ? await signIn(email.trim(), pass)
        : await signUp(username, email.trim(), pass);
    if (failure) {
      setError(failure);
      setBusy(false);
      return;
    }
    router.push("/");
  };

  const guest = () => router.push("/");

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono mt-1.5 text-[11px] tracking-[0.16em] text-ink-faint">
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === "in" ? "on" : ""}
            onClick={() => switchTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            className={tab === "up" ? "on" : ""}
            onClick={() => switchTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          {tab === "up" && (
            <div className="field slide-in">
              <label htmlFor="auth-user">Usuario</label>
              <input
                id="auth-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="px_kai"
                maxLength={10}
                autoComplete="username"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Contraseña</label>
            <input
              id="auth-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === "in" ? "current-password" : "new-password"}
            />
            {tab === "up" && pass.length > 0 && (
              <ul className="auth-password-rules">
                {PASSWORD_RULES.map((r) => (
                  <li
                    key={r.id}
                    className={r.test(pass) ? "rule-ok" : "rule-fail"}
                  >
                    {r.test(pass) ? "✓" : "✗"} {r.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <button className="btn lg mt-2 w-full" type="submit" disabled={busy}>
            {busy
              ? tab === "in"
                ? "ENTRANDO…"
                : "CREANDO CUENTA…"
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR Y JUGAR"}
          </button>
        </form>

        <button
          type="button"
          className="btn ghost mt-2.5 w-full"
          onClick={guest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            onClick={() => signInWithProvider("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => signInWithProvider("github")}
          >
            ▣ GITHUB
          </button>
        </div>

        <div className="mt-[18px] text-center text-[11px] tracking-[0.1em] text-ink-faint">
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
