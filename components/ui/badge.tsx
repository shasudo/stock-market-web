import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-all overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary:
          "border-border bg-muted text-muted-foreground hover:bg-muted-foreground/20",
        destructive:
          "border-error/30 bg-error/10 text-error hover:bg-error/20",
        success:
          "border-success/30 bg-success/10 text-success hover:bg-success/20",
        warning:
          "border-warning/30 bg-warning/10 text-warning hover:bg-warning/20",
        info:
          "border-info/30 bg-info/10 text-info hover:bg-info/20",
        indigo:
          "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
        purple:
          "border-purple/30 bg-purple/10 text-purple hover:bg-purple/20",
        outline:
          "border-border text-muted-foreground hover:bg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };

