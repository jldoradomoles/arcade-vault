"use server";

import { Resend } from "resend";
import { CONTACT_LIMITS, type ContactInput, type ContactResult } from "@/lib/contact";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isValid({ name, email, message }: ContactInput): boolean {
  return (
    name.length > 0 && name.length <= CONTACT_LIMITS.name &&
    email.length > 0 && email.length <= CONTACT_LIMITS.email && EMAIL_RE.test(email) &&
    message.length > 0 && message.length <= CONTACT_LIMITS.message
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendContactMessage(formData: FormData): Promise<ContactResult> {
  const input: ContactInput = {
    name: field(formData, "name"),
    email: field(formData, "email"),
    message: field(formData, "msg"),
  };

  // Honeypot: un bot lo rellena; se responde como éxito sin enviar nada.
  if (field(formData, "website") !== "") return { ok: true, name: input.name };

  if (!isValid(input)) return { ok: false, error: "invalid" };

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!apiKey || !to || !from) return { ok: false, error: "send_failed" };

  // Sin saltos de línea en el asunto (evita inyección de cabeceras).
  const subjectName = input.name.replace(/\s+/g, " ");
  const text = `Nombre: ${input.name}\nCorreo: ${input.email}\n\n${input.message}`;
  const html =
    `<p><strong>Nombre:</strong> ${escapeHtml(input.name)}</p>` +
    `<p><strong>Correo:</strong> ${escapeHtml(input.email)}</p>` +
    `<p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>`;

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      replyTo: input.email,
      subject: `[Arcade Vault] Mensaje de ${subjectName}`,
      html,
      text,
    });
    if (error) return { ok: false, error: "send_failed" };
  } catch {
    return { ok: false, error: "send_failed" };
  }

  return { ok: true, name: input.name };
}
