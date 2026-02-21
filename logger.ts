import fs from "node:fs";
import path from "node:path";

type Level = "debug" | "info" | "warn" | "error";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "bot.log");

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function writeLine(level: Level, message: string, meta?: Record<string, unknown>) {
  ensureLogDir();
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  fs.appendFileSync(LOG_FILE, JSON.stringify(line) + "\n", "utf8");
  // Also print to console (Replit logs)
  const prefix = level.toUpperCase();
  // eslint-disable-next-line no-console
  console.log(`[${prefix}] ${message}`, meta ?? "");
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => writeLine("debug", m, meta),
  info: (m: string, meta?: Record<string, unknown>) => writeLine("info", m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => writeLine("warn", m, meta),
  error: (m: string, meta?: Record<string, unknown>) => writeLine("error", m, meta),
};
