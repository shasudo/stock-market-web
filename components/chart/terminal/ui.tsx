"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly active?: boolean;
  readonly label: string;
  readonly children: ReactNode;
}

/** Icon or text button in the chart toolbars. */
export function ToolbarButton({
  active = false,
  label,
  className,
  children,
  ...rest
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-foreground transition-colors",
        "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent",
        active && "bg-primary/10 text-primary hover:bg-primary/15",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Divider({ vertical = true }: { vertical?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-border",
        vertical ? "mx-1 h-5 w-px" : "my-1 h-px w-full",
      )}
    />
  );
}

/** Closes when the user clicks elsewhere or presses Escape. */
export function useDismiss(onDismiss: () => void, active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!active) return;
    const onPointer = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node))
        onDismiss();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, onDismiss]);
  return ref;
}

interface MenuProps {
  readonly trigger: (state: {
    open: boolean;
    toggle: (event: { currentTarget: Element }) => void;
  }) => ReactNode;
  readonly children: (close: () => void) => ReactNode;
  readonly align?: "left" | "right";
  readonly side?: "bottom" | "right" | "top";
  readonly className?: string;
}

/**
 * A small anchored panel; renders its own trigger so callers style it freely.
 * The panel uses fixed coordinates measured from the trigger so a toolbar with
 * its own scrolling can never clip it.
 */
export function Menu({
  trigger,
  children,
  align = "left",
  side = "bottom",
  className,
}: MenuProps) {
  const [position, setPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);
  const [anchor, setAnchor] = useState<{
    bottom?: number;
    left?: number;
    right?: number;
  } | null>(null);
  const close = useCallback(() => {
    setPosition(null);
    setAnchor(null);
  }, []);
  const open = position !== null || anchor !== null;
  const ref = useDismiss(close, open);

  const toggle = (event: { currentTarget: Element }): void => {
    if (position !== null || anchor !== null) {
      setPosition(null);
      setAnchor(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (side === "right") {
      // Keep tall flyouts on screen: slide up so at least ~420px is available.
      const top = Math.max(8, Math.min(rect.top, window.innerHeight - 420));
      setPosition({ top, left: rect.right + 4 });
      setAnchor(null);
    } else if (side === "top") {
      // Open above the trigger (e.g. bottom-bar menus): anchor the panel's
      // bottom edge to the trigger's top edge so it grows upward.
      setPosition(null);
      if (align === "right") {
        setAnchor({
          bottom: window.innerHeight - rect.top + 4,
          right: window.innerWidth - rect.right,
        });
      } else {
        setAnchor({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
        });
      }
    } else if (align === "right") {
      setPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    } else {
      setPosition({ top: rect.bottom + 4, left: rect.left });
    }
  };

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle })}
      {position && (
        <div
          role="menu"
          className={cn(
            "fixed z-[70] min-w-44 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-[0_8px_30px_rgba(0,0,0,0.14)]",
            className,
          )}
          style={{
            top: position.top,
            left: position.left,
            right: position.right,
            maxHeight: `calc(100vh - ${position.top}px - 8px)`,
          }}
        >
          {children(close)}
        </div>
      )}
      {anchor && (
        <div
          role="menu"
          className={cn(
            "fixed z-[70] min-w-44 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-[0_8px_30px_rgba(0,0,0,0.14)]",
            className,
          )}
          style={{
            bottom: anchor.bottom,
            left: anchor.left,
            right: anchor.right,
            maxHeight: `calc(100vh - ${anchor.bottom ?? 0}px - 8px)`,
          }}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  active = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly active?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-muted disabled:opacity-40",
        active && "bg-primary/10 font-semibold text-primary",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

export function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function signed(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

export const UP_COLOR = "#089981";
export const DOWN_COLOR = "#F23645";
