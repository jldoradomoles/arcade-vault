"use client";

import { useState } from "react";
import { sendContactMessage } from "@/app/acerca-de/actions";
import { CONTACT_LIMITS } from "@/lib/contact";

const EMPTY = { name: "", email: "", msg: "" };

const ERRORS = {
  invalid: `REVISA LOS CAMPOS: CORREO VÁLIDO, NOMBRE HASTA ${CONTACT_LIMITS.name} Y MENSAJE HASTA ${CONTACT_LIMITS.message} CARACTERES.`,
  send_failed: "NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO EN UNOS MINUTOS.",
} as const;

export function ContactForm() {
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await sendContactMessage(new FormData(e.currentTarget));
      if (res.ok) setSent(res.name || form.name.trim());
      else setError(ERRORS[res.error]);
    } catch {
      setError(ERRORS.send_failed);
    } finally {
      setPending(false);
    }
  };

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit}>
      {!sent ? (
        <>
          {/* Honeypot: invisible para personas, los bots lo rellenan */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
            <label>
              WEBSITE
              <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>
          <div className="field">
            <label>NOMBRE</label>
            <input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="px_kai" />
          </div>
          <div className="field">
            <label>CORREO ELECTRÓNICO</label>
            <input name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jugador@vault.gg" />
          </div>
          <div className="field">
            <label>MENSAJE</label>
            <textarea name="msg" rows={5} value={form.msg} onChange={(e) => setForm({ ...form, msg: e.target.value })} placeholder="Cuéntanos qué tienes en mente…" />
          </div>
          {error && <div className="contact-error" role="alert">&gt; {error}</div>}
          <button className="btn xl press w-full" type="submit" disabled={pending}>
            {pending ? "▶  ENVIANDO…" : "▶  ENVIAR MENSAJE"}
          </button>
        </>
      ) : (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r" /><span className="dot y" /><span className="dot g" />
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line"><span className="prompt">vault@arcade:~$</span> ./send_message --to=team</div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success">&gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {sent.toUpperCase()}.<span className="caret">_</span></div>
            <div className="mt-[18px]">
              <button
                className="btn ghost"
                type="button"
                onClick={() => { setSent(null); setForm(EMPTY); setError(null); }}
              >
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
