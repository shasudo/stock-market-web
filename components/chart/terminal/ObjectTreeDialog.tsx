"use client";

import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { getToolDefinition, type Drawing } from "@/lib/chart/drawings";

export interface ObjectTreeIndicator {
  readonly instanceId: string;
  readonly name: string;
  readonly hidden: boolean;
}

interface ObjectTreeContentProps {
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

function TreeButton({
  label,
  pressed,
  onClick,
  danger,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`rounded p-1.5 hover:text-foreground ${
        danger
          ? "text-muted-foreground hover:text-error"
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * TradingView's Object tree rows: every drawing and indicator with
 * visibility, lock, settings, duplicate and remove controls. Shared by the
 * dialog and the docked Objects tab.
 */
export function ObjectTreeContent({
  drawings,
  indicators,
  onToggleDrawingHidden,
  onToggleDrawingLocked,
  onRemoveDrawing,
  onToggleIndicatorHidden,
  onEditIndicator,
  onDuplicateIndicator,
  onRemoveIndicator,
}: ObjectTreeContentProps) {
  return (
    <div>
      <p className="pb-1 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
        Drawings ({drawings.length})
      </p>
      {drawings.length === 0 && (
        <p className="pb-3 text-[13px] text-muted-foreground">
          No drawings on this chart.
        </p>
      )}
      {drawings.map((drawing) => {
        const label = getToolDefinition(drawing.type).label;
        return (
          <div
            key={drawing.id}
            className="flex items-center gap-0.5 rounded px-1 py-1 hover:bg-muted"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
              {label}
              {drawing.hidden && (
                <span className="text-muted-foreground"> (hidden)</span>
              )}
            </span>
            <TreeButton
              label={`${drawing.hidden ? "Show" : "Hide"} ${label}`}
              pressed={!drawing.hidden}
              onClick={() => onToggleDrawingHidden(drawing.id)}
            >
              {drawing.hidden ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </TreeButton>
            <TreeButton
              label={`${drawing.locked ? "Unlock" : "Lock"} ${label}`}
              pressed={drawing.locked}
              onClick={() => onToggleDrawingLocked(drawing.id)}
            >
              {drawing.locked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <LockOpen className="h-4 w-4" />
              )}
            </TreeButton>
            <TreeButton
              label={`Remove ${label}`}
              danger
              onClick={() => onRemoveDrawing(drawing.id)}
            >
              <Trash2 className="h-4 w-4" />
            </TreeButton>
          </div>
        );
      })}
      <p className="pb-1 pt-3 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
        Indicators ({indicators.length})
      </p>
      {indicators.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          No indicators on this chart.
        </p>
      )}
      {indicators.map((indicator) => (
        <div
          key={indicator.instanceId}
          className="flex items-center gap-0.5 rounded px-1 py-1 hover:bg-muted"
        >
          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
            {indicator.name}
            {indicator.hidden && (
              <span className="text-muted-foreground"> (hidden)</span>
            )}
          </span>
          <TreeButton
            label={`${indicator.hidden ? "Show" : "Hide"} ${indicator.name}`}
            pressed={!indicator.hidden}
            onClick={() => onToggleIndicatorHidden(indicator.instanceId)}
          >
            {indicator.hidden ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </TreeButton>
          <TreeButton
            label={`Settings for ${indicator.name}`}
            onClick={() => onEditIndicator(indicator.instanceId)}
          >
            <Settings2 className="h-4 w-4" />
          </TreeButton>
          <TreeButton
            label={`Duplicate ${indicator.name}`}
            onClick={() => onDuplicateIndicator(indicator.instanceId)}
          >
            <Copy className="h-4 w-4" />
          </TreeButton>
          <TreeButton
            label={`Remove ${indicator.name}`}
            danger
            onClick={() => onRemoveIndicator(indicator.instanceId)}
          >
            <Trash2 className="h-4 w-4" />
          </TreeButton>
        </div>
      ))}
    </div>
  );
}

interface ObjectTreeDialogProps extends ObjectTreeContentProps {
  readonly onClose: () => void;
}

export default function ObjectTreeDialog({
  onClose,
  ...content
}: ObjectTreeDialogProps) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/30 px-4 pt-[8vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Object tree"
        className="flex max-h-[84vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-[16px] font-bold text-foreground">Object tree</h2>
          <button
            type="button"
            aria-label="Close object tree"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ObjectTreeContent {...content} />
        </div>
      </div>
    </div>
  );
}
