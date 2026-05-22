import fs from "fs";
import path from "path";
import { loadBaileys } from "./adapter";
import { config } from "../config";

export function getSessionAuthPath(sessionId: number, sessionName?: string): string {
  const dir = config.SESSIONS_DIR;
  const folder = `session-${sessionId}${sessionName ? `-${sessionName.replace(/[^a-zA-Z0-9-]/g, "_")}` : ""}`;
  const full = path.resolve(dir, folder);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  return full;
}

export async function useAuthState(authPath: string) {
  const baileys = await loadBaileys();
  return baileys.useMultiFileAuthState(authPath);
}

export function clearAuthState(authPath: string): void {
  if (fs.existsSync(authPath)) {
    fs.rmSync(authPath, { recursive: true, force: true });
  }
}
