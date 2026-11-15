"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/useAuthStore";
import { useTheme } from "@/components/ThemeProvider";
import MarketTicker from "@/components/MarketTicker";
import { Sidebar } from "./Sidebar";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function TerminalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketTicker />
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3 lg:px-4">
          {isAuthenticated && (
            <>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:block"
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            </>
          )}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <BarChart3 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[14px] font-semibold tracking-tight">
                StockMarket<span className="text-primary">Pro</span>
              </span>
              <span className="mt-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Institutional Terminal
              </span>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <div className="hidden text-right sm:block">
                  <p className="max-w-[160px] truncate text-[13px] font-medium">
                    {user?.firstName || user?.username}
                  </p>
                  <p className="max-w-[160px] truncate text-[11px] text-muted-foreground">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Link
                  href="/login"
                  className="rounded-md px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="rounded-md bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Get Started
                </Link>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {isAuthenticated && (
          <aside
            className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 border-r border-border bg-card lg:block ${
              collapsed ? "w-14" : "w-60"
            }`}
          >
            <Sidebar collapsed={collapsed} />
          </aside>
        )}
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-5 lg:px-6">{children}</div>
        </main>
      </div>

      {drawerOpen && isAuthenticated && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-3">
              <span className="text-sm font-semibold">Navigate</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
