type LogLevel = "debug" | "info" | "warn" | "error";
type LogValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | Date
  | readonly LogValue[]
  | LogContext;

export interface LogContext {
  readonly [key: string]: LogValue;
}

const SENSITIVE_FIELD_PATTERN =
  /(?:authorization|cookie|password|secret|token|api[_-]?key|email|phone|address)/i;
const SENSITIVE_TEXT_VALUE_PATTERN =
  /(\b(?:authorization|cookie|password|secret|token|api[_-]?key)\b\s*(?:=|:)\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const SENSITIVE_QUERY_VALUE_PATTERN =
  /([?&](?:authorization|cookie|password|secret|token|api[_-]?key)=)[^&#\s]+/gi;
const BEARER_TOKEN_PATTERN = /(Bearer\s+)[^\s,;]+/gi;
const EMAIL_ADDRESS_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const MAX_SERIALIZED_ERROR_LENGTH = 1_000;

export const logger = {
  debug(message: string, context?: LogContext): void {
    writeLog("debug", message, context);
  },
  info(message: string, context?: LogContext): void {
    writeLog("info", message, context);
  },
  warn(message: string, context?: LogContext): void {
    writeLog("warn", message, context);
  },
  error(message: string, context?: LogContext): void {
    writeLog("error", message, context);
  },
};

export function serializeError(error: unknown): string {
  return redactSensitiveText(describeError(error)).slice(
    0,
    MAX_SERIALIZED_ERROR_LENGTH,
  );
}

/**
 * `error.message` alone loses the only fields that tell you what to do next:
 * an axios failure logged as "" is indistinguishable from a timeout, a DNS
 * failure, or a 401. Include the class, any errno/HTTP status, and the cause.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  const parts: string[] = [];
  const status = readNumber(error, ["status"]) ?? readResponseStatus(error);
  const code = readString(error, ["code"]);

  parts.push(error.name || "Error");
  if (status !== undefined) parts.push(`HTTP ${status}`);
  if (code !== undefined) parts.push(code);

  const detail = error.message?.trim();
  const head = detail ? `${parts.join(" ")}: ${detail}` : parts.join(" ");

  const cause = (error as { cause?: unknown }).cause;
  if (cause !== undefined && cause !== null) {
    return `${head} <- ${describeError(cause)}`;
  }
  return head;
}

function readResponseStatus(error: Error): number | undefined {
  const response = (error as { response?: unknown }).response;
  if (typeof response !== "object" || response === null) return undefined;
  const status = (response as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function readNumber(error: Error, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = (error as unknown as Record<string, unknown>)[key];
    if (typeof value === "number") return value;
  }
  return undefined;
}

function readString(error: Error, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = (error as unknown as Record<string, unknown>)[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return undefined;
}

function writeLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: redactSensitiveText(message),
    ...(context ? { context: redactContext(context) } : {}),
  };

  const serializedEntry = JSON.stringify(entry);
  if (level === "error") {
    console.error(serializedEntry);
    return;
  }

  if (level === "warn") {
    console.warn(serializedEntry);
    return;
  }

  console.info(serializedEntry);
}

function redactContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      SENSITIVE_FIELD_PATTERN.test(key) ? "[REDACTED]" : redactValue(value),
    ]),
  );
}

function redactValue(value: LogValue): LogValue {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (isLogContext(value)) {
    return redactContext(value);
  }

  return value;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(BEARER_TOKEN_PATTERN, "$1[REDACTED]")
    .replace(SENSITIVE_TEXT_VALUE_PATTERN, "$1[REDACTED]")
    .replace(SENSITIVE_QUERY_VALUE_PATTERN, "$1[REDACTED]")
    .replace(EMAIL_ADDRESS_PATTERN, "[REDACTED_EMAIL]");
}

function isLogContext(value: LogValue): value is LogContext {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}
