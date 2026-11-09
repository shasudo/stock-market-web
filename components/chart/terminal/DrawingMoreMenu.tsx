"use client";

import { useState } from "react";
import {
  ChevronRight,
  Copy,
  EyeOff,
  Layers,
  type LucideIcon,
} from "lucide-react";
import {
  DRAWING_VISIBILITY_SCOPES,
  type Drawing,
  type DrawingVisibilityScope,
  type VisualOrderDirection,
} from "@/lib/chart/drawings";
import { Divider, MenuItem } from "./ui";

const VISUAL_ORDER: readonly {
  id: VisualOrderDirection;
  label: string;
}[] = [
  { id: "front", label: "Bring to front" },
  { id: "back", label: "Send to back" },
  { id: "forward", label: "Bring forward" },
  { id: "backward", label: "Send backward" },
];

interface DrawingMoreMenuProps {
  readonly drawing: Drawing;
  readonly onVisualOrder: (direction: VisualOrderDirection) => void;
  readonly onVisibility: (scope: DrawingVisibilityScope) => void;
  readonly onClone: () => void;
  readonly onCopy: () => void;
  readonly onHide: () => void;
  readonly close: () => void;
}

function SubmenuRow({
  icon: Icon,
  label,
  open,
  onOpen,
  children,
}: {
  icon: LucideIcon;
  label: string;
  open: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative" onMouseEnter={onOpen}>
      <MenuItem onClick={onOpen} aria-haspopup="menu" aria-expanded={open}>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">{label}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </MenuItem>
      {open && (
        <div
          role="menu"
          className="absolute left-full top-0 z-[80] min-w-52 rounded-lg border border-border bg-card py-1 shadow-[0_8px_30px_rgba(0,0,0,0.14)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function Hint({ children }: { children: string }) {
  return (
    <span className="ml-auto pl-6 text-[12px] text-muted-foreground/70">
      {children}
    </span>
  );
}

/**
 * The "···" menu for a selected drawing, exactly like TradingView: visual
 * order, visibility on intervals, clone, copy and hide. Shared by the
 * floating toolbar and the right-click menu.
 */
export default function DrawingMoreMenu({
  drawing,
  onVisualOrder,
  onVisibility,
  onClone,
  onCopy,
  onHide,
  close,
}: DrawingMoreMenuProps) {
  const [openSub, setOpenSub] = useState<"order" | "visibility" | null>(null);

  return (
    <div className="min-w-60 py-1" onMouseLeave={() => setOpenSub(null)}>
      <SubmenuRow
        icon={Layers}
        label="Visual order"
        open={openSub === "order"}
        onOpen={() => setOpenSub("order")}
      >
        {VISUAL_ORDER.map((entry) => (
          <MenuItem
            key={entry.id}
            onClick={() => {
              onVisualOrder(entry.id);
              close();
            }}
          >
            <span className="flex-1 pl-6">{entry.label}</span>
          </MenuItem>
        ))}
      </SubmenuRow>
      <SubmenuRow
        icon={Layers}
        label="Visibility on intervals"
        open={openSub === "visibility"}
        onOpen={() => setOpenSub("visibility")}
      >
        {DRAWING_VISIBILITY_SCOPES.map((entry) => (
          <MenuItem
            key={entry.id}
            onClick={() => {
              onVisibility(entry.id);
              close();
            }}
          >
            <span className="flex-1 pl-6">
              {drawing.visibleOn === entry.id ? "✓ " : ""}
              {entry.label}
            </span>
          </MenuItem>
        ))}
      </SubmenuRow>
      <Divider vertical={false} />
      <MenuItem
        onClick={() => {
          onClone();
          close();
        }}
      >
        <Copy className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">Clone</span>
        <Hint>⌘ + Drag</Hint>
      </MenuItem>
      <MenuItem
        onClick={() => {
          onCopy();
          close();
        }}
      >
        <span className="w-4" aria-hidden />
        <span className="flex-1">Copy</span>
        <Hint>⌘ + C</Hint>
      </MenuItem>
      <Divider vertical={false} />
      <MenuItem
        onClick={() => {
          onHide();
          close();
        }}
      >
        <EyeOff className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1">Hide</span>
      </MenuItem>
    </div>
  );
}
