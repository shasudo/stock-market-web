"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PopoverProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly trigger: ReactNode;
  readonly children: ReactNode;
  readonly align?: "left" | "right";
  readonly className?: string;
}

/** A click-anchored panel that closes on outside click and Escape. */
export function Popover({ open, onClose, trigger, children, align = "left", className }: PopoverProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <span ref={ref} className="relative inline-flex">
      {trigger}
      {open && (
        <div
          className={cn(
            "absolute top-full z-50 mt-1 min-w-[180px] rounded-xl border border-border bg-card p-1 shadow-lg shadow-slate-900/10",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {children}
        </div>
      )}
    </span>
  );
}

interface MenuItemProps {
  readonly onSelect: () => void;
  readonly active?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

export function MenuItem({ onSelect, active, children, className }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-primary/10 hover:text-primary",
        active && "bg-primary/10 text-primary",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { readonly children: ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}
