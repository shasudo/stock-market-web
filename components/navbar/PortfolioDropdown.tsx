"use client";

import Link from "next/link";
import { Briefcase } from "lucide-react";
import { NavDropdown } from "./NavDropdown";
import { portfolioLinks } from "@/lib/nav-config";

interface PortfolioDropdownProps {
  isActive: boolean;
  pathname: string;
}

export function PortfolioDropdown({ isActive }: PortfolioDropdownProps) {
  return (
    <NavDropdown label="Portfolio" icon={Briefcase} isActive={isActive}>
      <div className="min-w-[180px]">
        <div className="px-4 py-2 text-sm font-bold text-foreground border-b border-border bg-muted">
          Portfolio
        </div>
        {portfolioLinks.map((link) => {
          const Icon = link.icon!;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center space-x-3 px-4 py-1.5 text-sm text-foreground hover:bg-muted hover:outline hover:outline-1 hover:outline-border border-b border-border"
            >
              <Icon className="h-4 w-4" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </NavDropdown>
  );
}
