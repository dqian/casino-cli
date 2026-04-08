import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";

export interface AuthData {
  token: string;
  email: string;
  userId: number;
}

const AUTH_DIR = join(homedir(), ".casino-cli");
const AUTH_FILE = join(AUTH_DIR, "auth.json");

export function loadAuth(): AuthData | null {
  try {
    const raw = require("fs").readFileSync(AUTH_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (data.token && data.email && data.userId) return data as AuthData;
    return null;
  } catch {
    return null;
  }
}

export function saveAuth(data: AuthData): void {
  mkdirSync(AUTH_DIR, { recursive: true });
  require("fs").writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
}

export function clearAuth(): void {
  try {
    require("fs").unlinkSync(AUTH_FILE);
  } catch {}
}
