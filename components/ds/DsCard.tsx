import * as React from "react";
import { cn } from "@/lib/utils";

export function DsCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-card"
      className={cn("rounded-[10px] border border-border bg-card", className)}
      {...props}
    />
  );
}

export function DsCardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-card-header"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function DsCardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-card-title"
      className={cn(
        "text-[13px] font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function DsCardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-card-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export function DsCardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="ds-card-content" className={cn("px-4 py-3", className)} {...props} />
  );
}

export function DsCardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-card-footer"
      className={cn(
        "flex items-center gap-2 border-t border-border px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}
