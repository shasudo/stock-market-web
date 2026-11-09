"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";

interface NavLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
}

export function NavLink({ href, label, icon: Icon, isActive }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`
        relative flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs md:text-sm font-semibold transition-all
        ${
          isActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        }
      `}
    >
      <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
      <span>{label}</span>
      {isActive && (
        <motion.div
          layoutId="navbar-indicator"
          className="absolute inset-0 bg-card rounded-xl -z-10 shadow-[0_2px_8px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] border border-border"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
    </Link>
  );
}

