type LogLevel = "info" | "warn" | "error" | "debug";

type LogEntry = {
  level: LogLevel;
  service_name: string;
  context?: string;
  message: string;
  correlation_id?: string;
  endpoint?: string;
  status?: string;
  error?: string;
  [key: string]: unknown;
};

const LEVEL_LABEL: Record<LogLevel, string> = {
  debug: "DEBUG",
  info:  "LOG  ",
  warn:  "WARN ",
  error: "ERROR",
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: "\x1b[34m",
  info:  "\x1b[32m",
  warn:  "\x1b[33m",
  error: "\x1b[31m",
};

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";

function formatDate(): string {
  return new Date().toLocaleString("en-US", {
    month:  "2-digit",
    day:    "2-digit",
    year:   "numeric",
    hour:   "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatPretty(entry: LogEntry): string {
  const color  = LEVEL_COLOR[entry.level];
  const label  = LEVEL_LABEL[entry.level];
  const ctx    = entry.context ?? entry.service_name;
  const serialize = (v: unknown): string => {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "object") return JSON.stringify(v, null, 2);
    return String(v);
  };

  const extras = Object.entries(entry)
    .filter(([k]) => !["level", "service_name", "context", "message"].includes(k))
    .map(([k, v]) => `${DIM}${k}=${RESET}${serialize(v)}`)
    .join("  ");

  return (
    `${color}${BOLD}[${entry.service_name}]${RESET} ` +
    `${DIM}${process.pid}  - ${formatDate()}${RESET}     ` +
    `${color}${BOLD}${label}${RESET} ` +
    `${color}[${ctx}]${RESET} ` +
    `${entry.message}` +
    (extras ? `  ${extras}` : "")
  );
}

function isJsonMode(): boolean {
  const env = process.env.NODE_ENV;
  return env === "production" || env === "test";
}

function log(entry: LogEntry): void {
  const minLevel = (process.env.LOG_LEVEL ?? "info") as LogLevel;
  const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[entry.level] < levels[minLevel]) return;

  const output = isJsonMode()
    ? JSON.stringify({ ...entry, timestamp: new Date().toISOString() })
    : formatPretty(entry);

  if (entry.level === "error") {
    console.error(output);
  } else {
    console.log(output);
  }
}

export function createLogger(serviceName: string, context?: string) {
  const ctx = context ?? serviceName;
  return {
    info: (message: string, extra?: Record<string, unknown>) =>
      log({ level: "info", service_name: serviceName, context: ctx, message, ...extra }),
    warn: (message: string, extra?: Record<string, unknown>) =>
      log({ level: "warn", service_name: serviceName, context: ctx, message, ...extra }),
    error: (message: string, extra?: Record<string, unknown>) =>
      log({ level: "error", service_name: serviceName, context: ctx, message, ...extra }),
    debug: (message: string, extra?: Record<string, unknown>) =>
      log({ level: "debug", service_name: serviceName, context: ctx, message, ...extra }),
    child: (childContext: string) => createLogger(serviceName, childContext),
  };
}
