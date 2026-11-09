/**
 * Java envelope compatibility.
 *
 * The retired Next backend returned bare payloads from its data routes
 * (`NextResponse.json(response)`). Java wraps every payload in its API
 * envelope: `{success, message, data, errors}`. Native-fetch call sites
 * were written for bare payloads, so each one unwraps through here before
 * running its shape guard. Envelopes with `success: false` and non-envelope
 * bodies pass through untouched — validation, not this helper, rejects them.
 */
export function isApiEnvelope(value: unknown): value is {
  success: boolean;
  message: string | null;
  data: unknown;
} {
  return (
    value !== null &&
    typeof value === "object" &&
    "success" in value &&
    "data" in value
  );
}

export function unwrapApiEnvelope<T>(body: T): unknown {
  if (isApiEnvelope(body) && body.success === true) {
    return body.data;
  }
  return body;
}
