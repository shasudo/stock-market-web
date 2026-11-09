import { cn } from "@/lib/utils";

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return <div className={cn("w-full px-4 lg:px-8", className)}>{children}</div>;
}

export default PageShell;
