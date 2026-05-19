function ts(): string {
  return new Date().toISOString();
}

function emit(level: "info" | "warn" | "error", msg: string, meta?: Record<string, unknown>): void {
  const line = meta ? `${msg} ${JSON.stringify(meta)}` : msg;
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : "log"](`[${ts()}] [${level}] ${line}`);
}

export const log = {
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
