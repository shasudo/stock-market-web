"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Bug,
  ClipboardCopy,
  ClipboardPaste,
  Copy,
  Layers,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
} from "lucide-react";
import { SEGMENTS, getSegment } from "@/lib/screener/catalog";
import type { DebugCount } from "@/lib/screener/runner";
import {
  emptyGroup,
  newId,
  type Clause,
  type Group,
  type GroupMatch,
  type ScanNode,
} from "@/lib/screener/scan-types";
import { cn } from "@/lib/utils";
import { ClauseEditor } from "./ClauseEditor";
import { MeasurePicker, type PickerChoice } from "./MeasurePicker";
import { MenuItem, MenuLabel, Popover } from "./Popover";

export interface GroupActions {
  readonly update: (id: string, update: (node: ScanNode) => ScanNode) => void;
  readonly remove: (id: string) => void;
  readonly duplicate: (id: string) => void;
  readonly move: (id: string, direction: -1 | 1) => void;
  readonly append: (groupId: string, nodes: readonly ScanNode[]) => void;
  readonly copy: (node: ScanNode) => void;
  readonly paste: (groupId: string) => void;
  readonly debug: () => void;
  readonly browse: () => void;
}

interface FilterGroupViewProps {
  readonly group: Group;
  readonly actions: GroupActions;
  readonly debugCounts: Readonly<Record<string, DebugCount>> | null;
  readonly depth?: number;
  readonly segment?: string;
  readonly onSegmentChange?: (segment: string) => void;
}

const MATCHES: readonly GroupMatch[] = ["all", 1, 2, 3, 4, 5];

function DebugBadge({ count }: { readonly count: DebugCount | undefined }) {
  if (!count || count.total === 0) return null;
  const share = (count.passed / count.total) * 100;
  return (
    <span
      title={`${count.passed} of ${count.total} stocks meet this filter on its own`}
      className={cn(
        "rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold",
        share === 0 ? "bg-error/10 text-error" : share < 5 ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
      )}
    >
      {share.toFixed(share < 1 && share > 0 ? 2 : 1)}% · {count.passed}
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn("rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", className)}
    >
      {children}
    </button>
  );
}

function AddFilterButton({
  onPick,
}: {
  readonly onPick: (choice: PickerChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          aria-label="Add filter"
          title="Add filter"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
        </button>
      }
    >
      <MeasurePicker
        allowGroup
        onPick={(choice) => {
          setOpen(false);
          onPick(choice);
        }}
      />
    </Popover>
  );
}

function SelectMenu<T extends string | number>({
  value,
  options,
  render,
  onChange,
  label,
  groups,
}: {
  readonly value: T;
  readonly options: readonly T[];
  readonly render: (value: T) => string;
  readonly onChange: (value: T) => void;
  readonly label: string;
  readonly groups?: (value: T) => string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="max-h-[360px] overflow-y-auto"
      trigger={
        <button
          type="button"
          aria-label={label}
          onClick={() => setOpen((current) => !current)}
          className="rounded-md px-1 font-bold text-foreground underline decoration-border decoration-dotted underline-offset-4 hover:bg-primary/10 hover:text-primary"
        >
          {render(value)}
        </button>
      }
    >
      {options.map((option, index) => {
        const group = groups?.(option) ?? "";
        const previous = index > 0 ? (groups?.(options[index - 1]!) ?? "") : "";
        const header = group && group !== previous ? <MenuLabel>{group}</MenuLabel> : null;
        return (
          <span key={String(option)}>
            {header}
            <MenuItem
              active={option === value}
              onSelect={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {render(option)}
            </MenuItem>
          </span>
        );
      })}
    </Popover>
  );
}

function newClauseFrom(choice: PickerChoice): ScanNode | null {
  if (choice.kind === "group") return emptyGroup();
  if (choice.kind !== "term") return null;
  const clause: Clause = {
    kind: "clause",
    id: newId("c"),
    enabled: true,
    left: { terms: [choice.term], ops: [] },
    op: null,
    right: null,
  };
  return clause;
}

export function FilterGroupView({
  group,
  actions,
  debugCounts,
  depth = 0,
  segment,
  onSegmentChange,
}: FilterGroupViewProps) {
  const isRoot = depth === 0;

  const header = (
    <div className="flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
      <span>{isRoot ? "Stock" : "Sub-group:"}</span>
      <SelectMenu
        label="Change passes"
        value={group.mode}
        options={["passes", "fails"] as const}
        render={(value) => value}
        onChange={(mode) => actions.update(group.id, (node) => ({ ...(node as Group), mode }))}
      />
      <SelectMenu
        label="Change all"
        value={group.match}
        options={MATCHES}
        render={(value) => (value === "all" ? "all" : `any ${value}`)}
        onChange={(match) => actions.update(group.id, (node) => ({ ...(node as Group), match }))}
      />
      <span>of the below filters</span>
      {isRoot && segment && onSegmentChange && (
        <>
          <span>in</span>
          <SelectMenu
            label="Change segment"
            value={segment}
            options={SEGMENTS.map((item) => item.id)}
            render={(id) => getSegment(id)?.label ?? id}
            groups={(id) => getSegment(id)?.group ?? ""}
            onChange={onSegmentChange}
          />
          <span>segment:</span>
        </>
      )}
      <IconButton label="Copy group to clipboard" onClick={() => actions.copy(group)} className="text-warning">
        <ClipboardCopy className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="Debug group filters" onClick={actions.debug}>
        <Bug className="h-3.5 w-3.5" />
      </IconButton>
      <DebugBadge count={debugCounts?.[group.id]} />
      {!isRoot && (
        <>
          <IconButton
            label={group.enabled ? "Disable group" : "Enable group"}
            onClick={() => actions.update(group.id, (node) => ({ ...node, enabled: !node.enabled }))}
          >
            {group.enabled ? (
              <ToggleRight className="h-4 w-4 text-success" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
          </IconButton>
          <IconButton label="Delete group" onClick={() => actions.remove(group.id)} className="hover:text-error">
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        !isRoot && "rounded-xl border border-primary/25 bg-primary/5 px-3 py-2",
        !group.enabled && "opacity-50",
      )}
    >
      {header}
      <div className="mt-2 space-y-1.5">
        {group.items.map((item, index) =>
          item.kind === "group" ? (
            <FilterGroupView
              key={item.id}
              group={item}
              actions={actions}
              debugCounts={debugCounts}
              depth={depth + 1}
            />
          ) : (
            <div
              key={item.id}
              className={cn(
                "group/row flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2 py-1.5 hover:bg-muted",
                !item.enabled && "opacity-45",
              )}
            >
              <span className="w-4 shrink-0 text-right font-mono text-[10px] text-muted-foreground/60">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <ClauseEditor
                  clause={item}
                  onChange={(clause) => actions.update(item.id, () => clause)}
                />
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <DebugBadge count={debugCounts?.[item.id]} />
                <IconButton label="Move filter up" onClick={() => actions.move(item.id, -1)} className="hidden group-hover/row:inline-flex">
                  <ArrowUp className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Move filter down" onClick={() => actions.move(item.id, 1)} className="hidden group-hover/row:inline-flex">
                  <ArrowDown className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Copy filter to clipboard" onClick={() => actions.copy(item)} className="text-warning">
                  <ClipboardCopy className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Duplicate filter" onClick={() => actions.duplicate(item.id)} className="text-info">
                  <Copy className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton
                  label={item.enabled ? "Disable filter" : "Enable filter"}
                  onClick={() => actions.update(item.id, (node) => ({ ...node, enabled: !node.enabled }))}
                >
                  {item.enabled ? (
                    <ToggleRight className="h-4 w-4 text-success" />
                  ) : (
                    <ToggleLeft className="h-4 w-4" />
                  )}
                </IconButton>
                <IconButton label="Debug filter (identify % of stocks meeting this filter)" onClick={actions.debug}>
                  <Bug className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Delete filter" onClick={() => actions.remove(item.id)} className="hover:text-error">
                  <Trash2 className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 pl-2">
        <AddFilterButton
          onPick={(choice) => {
            if (choice.kind === "browse") {
              actions.browse();
              return;
            }
            const node = newClauseFrom(choice);
            if (node) actions.append(group.id, [node]);
          }}
        />
        <button
          type="button"
          aria-label="Add sub-group"
          title="Add sub-group"
          onClick={() => actions.append(group.id, [emptyGroup()])}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-info/15 text-info hover:bg-info/25"
        >
          <Layers className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Paste copied filters or groups"
          title="Paste copied filters or groups"
          onClick={() => actions.paste(group.id)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground hover:bg-border"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
