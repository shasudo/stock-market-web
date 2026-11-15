import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import TerminalShell from "@/components/shell/TerminalShell";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StockMarket Pro - Free Trading Platform",
  description: "Institutional-grade stock market data and portfolio management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("smp-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        <ThemeProvider>
          <TerminalShell>{children}</TerminalShell>
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#221A12",
                color: "#F8F5EF",
                border: "1px solid #3A3129",
                borderRadius: "8px",
                padding: "14px 20px",
                fontSize: "14px",
                fontWeight: "500",
              },
              success: {
                iconTheme: {
                  primary: "#1E8E4E",
                  secondary: "#F8F5EF",
                },
              },
              error: {
                iconTheme: {
                  primary: "#C0392B",
                  secondary: "#F8F5EF",
                },
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
