import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";
const level = process.env.LOG_LEVEL ?? (isDev ? "debug" : "info");

export const logger = pino({
  level,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      "apiKey",
      "password",
      "secret",
      "token",
      "authorization",
      "*.apiKey",
      "*.password",
      "*.secret",
      "*.token",
      "error.stack",
    ],
    censor: "[REDACTED]",
  },
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "HH:MM:ss.l",
        ignore: "pid,hostname",
      },
    },
  }),
});

const EXPECTED_ERROR_PATTERNS = [
  "Unauthorized",
  "Not Found",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "State mismatch",
  "User not found",
  "Credential account not found",
  "Invalid API key",
] as const;

export function isExpectedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return EXPECTED_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function getErrorSummary(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message };
  if (typeof error === "string") return { name: "Error", message: error };
  if (typeof error === "object" && error !== null) return { name: "Error", message: JSON.stringify(error) };
  return { name: "Error", message: String(error) };
}

export function logServerError(context: string, error: unknown, extra: Record<string, unknown> = {}): void {
  const summary = getErrorSummary(error);

  if (isExpectedError(error)) {
    logger.warn({ err: summary, ...extra }, context);
    return;
  }

  logger.error({ err: error instanceof Error ? error : summary, ...extra }, context);
}
