"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface NavDropdownProps {
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  children: ReactNode;
  className?: string;
}

export function NavDropdown({
  label,
  icon: Icon,
  isActive,
  children,
  className,
}: NavDropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className={`
          relative flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
          ${
            isActive
              ? "text-foreground bg-secondary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          }
        `}
      >
        <Icon className="h-4 w-4" />
        <span>{label}</span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 border border-border bg-popover shadow-xl overflow-hidden z-50 ${className || ""}`}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
