"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { NavDropdown } from "./NavDropdown";
import { analysisLinks } from "@/lib/nav-config";

const columnHeader =
  "px-4 py-2 text-sm font-bold text-foreground border-b border-border bg-muted";
const linkClass =
  "block px-4 py-1 text-sm text-foreground hover:bg-muted hover:outline hover:outline-1 hover:outline-border border-b border-border";

interface AnalysisDropdownProps {
  isActive: boolean;
}

export function AnalysisDropdown({ isActive }: AnalysisDropdownProps) {
  return (
    <NavDropdown
      label="Analysis"
      icon={BarChart3}
      isActive={isActive}
      className="rounded-xl"
    >
      <div className="flex">
        <div className="min-w-[200px] border-r border-border">
          <div className={columnHeader}>Technicals</div>
          {analysisLinks.technicals.map((link) => (
            <Link key={link.label} href={link.href} className={linkClass}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="min-w-[180px]">
          <div className={columnHeader}>Fundamentals</div>
          {analysisLinks.fundamentals.length === 0 ? (
            <div className="px-4 py-2 text-sm text-muted-foreground">
              Coming soon
            </div>
          ) : (
            analysisLinks.fundamentals.map((link) => (
              <Link key={link.label} href={link.href} className={linkClass}>
                {link.label}
              </Link>
            ))
          )}
        </div>
      </div>
    </NavDropdown>
  );
}
