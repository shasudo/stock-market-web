"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { logger, serializeError } from "@/lib/logger";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Application error boundary activated", {
      error: serializeError(error),
      digest: error.digest,
    });
  }, [error, reset]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
        </div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground mb-2">
          Something went wrong
        </h2>
        <p className="text-muted-foreground mb-6 text-sm">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      </div>
    </div>
  );
}
