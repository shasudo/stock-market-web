import Link from "next/link";
import { Home, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card shadow-[var(--card-shadow)]">
          <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="font-display text-6xl font-semibold tracking-tight text-foreground mb-2">404</h1>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Page not found
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Go home
        </Link>
      </div>
    </div>
  );
}
