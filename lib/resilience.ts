export interface RetryOptions {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly shouldRetry: (error: unknown) => boolean;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

export interface CircuitBreakerOptions {
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
  readonly now?: () => number;
}

export type CircuitState = "closed" | "open" | "half-open";

export class CircuitOpenError extends Error {
  public constructor() {
    super("The external service circuit is open");
    this.name = "CircuitOpenError";
  }
}

export class RetryExhaustedError extends Error {
  public constructor() {
    super("Retry exhausted without executing the operation");
    this.name = "RetryExhaustedError";
  }
}

export class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | undefined;
  private halfOpenCallInFlight = false;
  private readonly now: () => number;

  public constructor(private readonly options: CircuitBreakerOptions) {
    assertPositiveInteger(options.failureThreshold, "failureThreshold");
    assertNonNegativeInteger(options.resetTimeoutMs, "resetTimeoutMs");
    this.now = options.now ?? Date.now;
  }

  public async execute<TResult>(
    operation: () => Promise<TResult>,
  ): Promise<TResult> {
    this.assertRequestAllowed();

    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  public getState(): CircuitState {
    if (this.openedAt === undefined) {
      return "closed";
    }
    if (this.now() - this.openedAt >= this.options.resetTimeoutMs) {
      return "half-open";
    }
    return "open";
  }

  private assertRequestAllowed(): void {
    const state = this.getState();
    if (state === "closed") {
      return;
    }
    if (state === "open" || this.halfOpenCallInFlight) {
      throw new CircuitOpenError();
    }
    this.halfOpenCallInFlight = true;
  }

  private recordFailure(): void {
    this.halfOpenCallInFlight = false;
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.openedAt = this.now();
    }
  }

  private reset(): void {
    this.consecutiveFailures = 0;
    this.openedAt = undefined;
    this.halfOpenCallInFlight = false;
  }
}

export async function retry<TResult>(
  operation: () => Promise<TResult>,
  options: RetryOptions,
): Promise<TResult> {
  assertPositiveInteger(options.maxAttempts, "maxAttempts");
  assertNonNegativeInteger(options.initialDelayMs, "initialDelayMs");
  assertNonNegativeInteger(options.maxDelayMs, "maxDelayMs");

  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = attempt === options.maxAttempts;
      if (isLastAttempt || !options.shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(
        options.initialDelayMs * 2 ** (attempt - 1),
        options.maxDelayMs,
      );
      await sleep(delay);
    }
  }

  throw new RetryExhaustedError();
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}
