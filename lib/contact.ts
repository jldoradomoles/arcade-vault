export const CONTACT_LIMITS = { name: 60, email: 120, message: 2000 } as const;

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export type ContactResult =
  | { ok: true; name: string }
  | { ok: false; error: "invalid" | "send_failed" };
