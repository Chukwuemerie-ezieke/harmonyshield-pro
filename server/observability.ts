// Optional, dependency-free error-tracking hook.
//
// By default this is a no-op: nothing is sent anywhere. Error reporting is
// enabled only when one of the following environment variables is set:
//
//   ERROR_WEBHOOK  - a URL that receives a JSON POST per unhandled error.
//                    The payload is { message, stack, context } with no
//                    secrets. Delivery is best-effort and failures are
//                    swallowed so observability never breaks the request path.
//   SENTRY_DSN     - when set (without a bundled Sentry SDK) the error is
//                    emitted as a structured JSON log line tagged for Sentry
//                    so an external log drain / sidecar can forward it. This
//                    keeps the server dependency-free; add the Sentry SDK and
//                    its esbuild allowlist entry if you want native delivery.

interface ErrorContext {
  requestId?: string;
  method?: string;
  path?: string;
}

export function isErrorTrackingEnabled(): boolean {
  return Boolean(process.env.ERROR_WEBHOOK || process.env.SENTRY_DSN);
}

export async function reportError(err: unknown, context: ErrorContext = {}): Promise<void> {
  if (!isErrorTrackingEnabled()) {
    return; // default no-op
  }

  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  if (process.env.SENTRY_DSN) {
    // Dependency-free fallback: emit a structured log line a drain can forward.
    console.error(
      JSON.stringify({
        level: "error",
        type: "error-tracking",
        timestamp: new Date().toISOString(),
        message,
        stack,
        ...context,
      }),
    );
  }

  const webhook = process.env.ERROR_WEBHOOK;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, stack, context, timestamp: new Date().toISOString() }),
      });
    } catch {
      // Best-effort: never let the error sink throw into the request path.
    }
  }
}
