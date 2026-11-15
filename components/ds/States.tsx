import * as React from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({ message = "Loading…", className }: { message?: string; className?: string }) {
  return (
    <div
      data-slot="ds-loading"
      className={cn("flex items-center justify-center px-4 py-16", className)}
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="border-primary mx-auto mb-3 h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" />
        <p className="text-[13px] text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

export function LoadingBlock({ className }: { className?: string }) {
  return (
    <div data-slot="ds-loading-block" className={cn("px-4 py-3", className)} aria-hidden="true">
      <div className="h-4 w-full rounded bg-muted animate-pulse" />
      <div className="mt-2 h-4 w-11/12 rounded bg-muted animate-pulse" />
      <div className="mt-2 h-4 w-4/5 rounded bg-muted animate-pulse" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="ds-empty"
      className={cn("flex flex-col items-center px-4 py-14 text-center", className)}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted">
        <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      data-slot="ds-error"
      className={cn("flex flex-col items-center px-4 py-14 text-center", className)}
      role="alert"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted"
        >
          Try again
        </button>
      )}
    </div>
  );
}
