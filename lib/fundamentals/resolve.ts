import {
  createEodhdFundamentalsProviderFromEnvironment,
  isEodhdFundamentalsConfigured,
} from "./eodhd";
import type { FundamentalsProvider } from "./provider";
import { resolveFundamentalsProviderId } from "./provider-id";
import {
  createYahooFundamentalsProviderFromEnvironment,
  isYahooFundamentalsConfigured,
} from "./yahoo";

export { resolveFundamentalsProviderId } from "./provider-id";

/**
 * True whenever the currently selected fundamentals provider is ready to use.
 * Yahoo is always ready; EODHD additionally needs EODHD_API_TOKEN.
 */
export function isFundamentalsProviderConfigured(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveFundamentalsProviderId(environment) === "eodhd"
    ? isEodhdFundamentalsConfigured(environment)
    : isYahooFundamentalsConfigured(environment);
}

export function createFundamentalsProviderFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): FundamentalsProvider {
  return resolveFundamentalsProviderId(environment) === "eodhd"
    ? createEodhdFundamentalsProviderFromEnvironment(environment)
    : createYahooFundamentalsProviderFromEnvironment(environment);
}
