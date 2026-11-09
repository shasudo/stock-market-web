import type { FundamentalsProviderId } from "./types";

/**
 * Deliberately has no dependency on the actual provider implementations
 * (`./eodhd`, `./yahoo`) so it stays safe to import from client components
 * such as `coverage.ts`'s callers. Importing the provider modules here would
 * pull `yahoo-finance2` (and its Node-only `tls`/`fs`/`child_process` deps
 * via `@deno/shim-deno`) into the browser bundle.
 */
export function resolveFundamentalsProviderId(
  environment: NodeJS.ProcessEnv = process.env,
): FundamentalsProviderId {
  return environment.FUNDAMENTALS_PROVIDER?.trim().toLowerCase() === "eodhd"
    ? "eodhd"
    : "yahoo";
}
