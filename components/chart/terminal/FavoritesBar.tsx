"use client";

import { useRef, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Star } from "lucide-react";
import { getToolDefinition, type DrawingType } from "@/lib/chart/drawings";
import { ToolIcon } from "./tool-icons";
import { ToolbarButton } from "./ui";

interface FavoritesBarProps {
  readonly tools: readonly DrawingType[];
  readonly active: DrawingType | null;
  readonly onPick: (tool: DrawingType) => void;
  readonly onRemove: (tool: DrawingType) => void;
}

/** The floating bar of starred tools. It can be dragged anywhere over the chart and collapsed. */
export default function FavoritesBar({
  tools,
  active,
  onPick,
  onRemove,
}: FavoritesBarProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState(false);
  const dragRef = useRef<{
    x: number;
    y: number;
    origin: { x: number; y: number };
  } | null>(null);

  if (tools.length === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Favorite drawing tools"
      className="pointer-events-auto absolute right-24 top-12 z-20 flex items-center rounded-lg border border-border bg-card shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <span
        title="Drag to move"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            x: event.clientX,
            y: event.clientY,
            origin: offset,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          setOffset({
            x: drag.origin.x + event.clientX - drag.x,
            y: drag.origin.y + event.clientY - drag.y,
          });
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        className="flex h-10 w-6 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <Star
        className="mr-1 h-4 w-4 shrink-0 text-warning"
        fill="currentColor"
        stroke="currentColor"
        aria-hidden
      />
      {!collapsed &&
        tools.map((type) => {
          const definition = getToolDefinition(type);
          return (
            <ToolbarButton
              key={type}
              label={`${definition.label} (right-click to unstar)`}
              active={active === type}
              onClick={() => onPick(type)}
              onContextMenu={(event) => {
                event.preventDefault();
                onRemove(type);
              }}
              className="h-10 w-10"
            >
              <ToolIcon type={type} className="h-[22px] w-[22px]" />
            </ToolbarButton>
          );
        })}
      <ToolbarButton
        label={collapsed ? "Expand favorites" : "Collapse favorites"}
        onClick={() => setCollapsed((value) => !value)}
        className="h-10 w-7 px-0"
      >
        {collapsed ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronUp className="h-4 w-4" />
        )}
      </ToolbarButton>
    </div>
  );
}
