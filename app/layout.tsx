import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { MarketStrip } from "@/components/MarketStrip";
import { WatchlistRail } from "@/components/WatchlistRail";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Terminal — Indian Markets",
  description: "A full-time trader's terminal for NSE/BSE stocks, F&O and indices.",
};

// Dark-first default; the inline script applies the stored (or OS) theme
// before first paint so there is no flash.
function themeScript(): string {
  return `(function(){try{var t=localStorage.getItem("smw-theme");var d=t?t==="dark":!window.matchMedia("(prefers-color-scheme: light)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){document.documentElement.classList.add("dark")}}})();`;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript() }} />
      </head>
      <body>
        <ThemeProvider>
          <div className="flex min-h-screen flex-col">
            <MarketStrip />
            <div className="flex flex-1">
              <WatchlistRail />
              <main className="min-w-0 flex-1 pb-20 md:pb-6">{children}</main>
            </div>
            <BottomNav />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
