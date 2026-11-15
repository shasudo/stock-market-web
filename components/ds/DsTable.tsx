import * as React from "react";
import { cn } from "@/lib/utils";

export function DsTableContainer({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-table-container"
      className={cn(
        "w-full overflow-hidden rounded-[8px] border border-border bg-card shadow-[var(--card-shadow)]",
        className,
      )}
      {...props}
    />
  );
}

export function DsTableScroll({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-table-scroll"
      className={cn("w-full overflow-x-auto", className)}
      {...props}
    />
  );
}

export function DsTable({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="ds-table"
      className={cn("w-full border-collapse text-left text-[13px]", className)}
      {...props}
    />
  );
}

export function DsTableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="ds-table-header"
      className={cn(
        "sticky top-0 z-10 border-b border-border bg-muted/70",
        className,
      )}
      {...props}
    />
  );
}

export function DsTableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody data-slot="ds-table-body" className={cn("divide-y divide-border", className)} {...props} />
  );
}

export function DsRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="ds-row"
      className={cn(
        "border-b border-border transition-colors last:border-b-0 even:bg-card odd:bg-muted/40 hover:bg-primary/[0.05]",
        className,
      )}
      {...props}
    />
  );
}

type Align = "left" | "right" | "center";

const alignClass: Record<Align, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DsHead({
  className,
  align = "left",
  ...props
}: React.ComponentProps<"th"> & { align?: Align }) {
  return (
    <th
      data-slot="ds-head"
      className={cn(
        "whitespace-nowrap px-3.5 py-2.5 align-middle text-[11px] font-semibold uppercase tracking-wider text-muted-foreground select-none",
        alignClass[align],
        className,
      )}
      {...props}
    />
  );
}

export function DsCell({
  className,
  align = "left",
  ...props
}: React.ComponentProps<"td"> & { align?: Align }) {
  return (
    <td
      data-slot="ds-cell"
      className={cn(
        "whitespace-nowrap px-3.5 py-2.5 align-middle text-[13px] font-normal text-foreground",
        alignClass[align],
        className,
      )}
      {...props}
    />
  );
}

export function DsNumCell({
  className,
  align = "right",
  ...props
}: React.ComponentProps<"td"> & { align?: Align }) {
  return (
    <td
      data-slot="ds-num-cell"
      className={cn(
        "whitespace-nowrap px-3.5 py-2.5 align-middle text-[13px] font-medium tabular-nums",
        alignClass[align],
        className,
      )}
      {...props}
    />
  );
}
