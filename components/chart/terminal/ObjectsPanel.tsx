"use client";

import {
  ObjectTreeContent,
  type ObjectTreeIndicator,
} from "./ObjectTreeDialog";
import type { Drawing } from "@/lib/chart/drawings";

interface ObjectsPanelProps {
  readonly drawings: readonly Drawing[];
  readonly indicators: readonly ObjectTreeIndicator[];
  readonly onToggleDrawingHidden: (id: string) => void;
  readonly onToggleDrawingLocked: (id: string) => void;
  readonly onRemoveDrawing: (id: string) => void;
  readonly onToggleIndicatorHidden: (instanceId: string) => void;
  readonly onEditIndicator: (instanceId: string) => void;
  readonly onDuplicateIndicator: (instanceId: string) => void;
  readonly onRemoveIndicator: (instanceId: string) => void;
}

/** TradingView-style docked Object tree tab. */
export default function ObjectsPanel(props: ObjectsPanelProps) {
  return (
    <section aria-label="Object tree" className="px-3 py-2">
      <ObjectTreeContent {...props} />
    </section>
  );
}
