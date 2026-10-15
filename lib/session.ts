export interface SessionUser {
  name: string;
}

export interface SavedScore {
  game: string;
  score: number;
  name: string;
  at: number;
}

export const USER_KEY = "av_user";
export const SCORES_KEY = "av_scores";

// Mock de sesión: todo acceso a localStorage va envuelto en try/catch.
export function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

export function parseUser(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.name === "string" ? { name: parsed.name } : null;
  } catch {
    return null;
  }
}

export function appendScore(entry: Omit<SavedScore, "at">): void {
  try {
    const all: SavedScore[] = JSON.parse(readRaw(SCORES_KEY) || "[]");
    all.push({ ...entry, at: Date.now() });
    writeRaw(SCORES_KEY, JSON.stringify(all));
  } catch {}
}
