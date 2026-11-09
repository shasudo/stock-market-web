"use client";

import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PickerMenuItem {
  readonly id: string;
  readonly label: string;
}

/**
 * Icon button that opens a themed dropdown of choices - "move to X" or
 * "copy to X" wherever there's a small fixed or user-defined list to pick
 * from. A plain `<select>` was tried first (for the watchlist's move-to-
 * folder control); its open option list is native browser chrome and always
 * renders with a white background, clashing with the app's own popover
 * styling, so this replaced it everywhere the same choice comes up.
 */
export function PickerMenu({
  items,
  excludeId,
  icon: Icon,
  label,
  onPick,
}: {
  items: readonly PickerMenuItem[];
  /** Leave out the option matching the row's current value. */
  excludeId?: string | null;
  icon: LucideIcon;
  label: string;
  onPick: (id: string) => void;
}) {
  const targets = items.filter((item) => item.id !== excludeId);
  if (targets.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={label}
          title={label}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Icon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {targets.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => onPick(item.id)}>
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
