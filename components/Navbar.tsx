"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { BarChart3, Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { NavDesktop } from "./navbar/NavDesktop";
import { NavMobile } from "./navbar/NavMobile";
import { useTheme } from "./ThemeProvider";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/10 transition-colors"
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}

export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    router.push("/login");
  };

  return (
    <nav className="sticky top-0 z-50 w-full apple-glass border-b border-border">
      <div className="w-full px-6 lg:px-10">
        <div className="flex h-16 items-center justify-between">
          {/* Apple HIG Brand Mark */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-xl bg-primary dark:bg-indigo-400 flex items-center justify-center shadow-[0_2px_10px_rgba(0,122,255,0.3)] dark:shadow-[0_2px_10px_rgba(129,140,248,0.3)] group-hover:scale-105 transition-transform">
              <BarChart3 className="h-4.5 w-4.5 text-primary-foreground dark:text-zinc-950" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold text-foreground tracking-[-0.025em] leading-tight">
                StockMarket<span className="text-primary dark:text-indigo-400">Pro</span>
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">
                Institutional Terminal
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          {isAuthenticated && (
            <NavDesktop user={user} onLogout={handleLogout} />
          )}

          {!isAuthenticated && (
            <div className="hidden md:flex items-center space-x-2">
              <Link
                href="/login"
                className="px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted dark:hover:bg-white/10 rounded-xl transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 py-1.5 text-xs font-semibold text-primary-foreground dark:text-zinc-950 bg-primary dark:bg-indigo-400 hover:bg-primary/90 dark:hover:bg-indigo-300 rounded-xl transition-all shadow-[0_2px_8px_rgba(0,122,255,0.25)] dark:shadow-[0_2px_8px_rgba(129,140,248,0.25)] hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started
              </Link>
            </div>
          )}

          {/* Theme toggle (all viewports) + mobile menu button */}
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              className="md:hidden p-2 rounded-xl text-foreground hover:bg-muted dark:hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-border overflow-hidden"
            >
              {isAuthenticated ? (
                <NavMobile
                  user={user}
                  onLogout={handleLogout}
                  onClose={() => setMobileMenuOpen(false)}
                />
              ) : (
                <div className="space-y-2 px-4 py-4">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-6 py-2 text-xs font-semibold text-center text-primary-foreground dark:text-zinc-950 bg-primary dark:bg-indigo-400 rounded-xl hover:bg-primary/90 dark:hover:bg-indigo-300 transition-all"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
