import type { ReactNode } from "react";

export interface IconProps {
  readonly className?: string;
}

/**
 * Drawing-tool icons in the charting-terminal style: 28px grid, thin strokes,
 * and small hollow circles marking the anchor points a drawing is built from.
 */
export function Glyph({
  className,
  children,
}: IconProps & { readonly children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 28 28"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export function Node({ x, y }: { readonly x: number; readonly y: number }) {
  return <circle cx={x} cy={y} r="2.3" fill="currentColor" />;
}

export function Dash({ d }: { readonly d: string }) {
  return <path d={d} strokeDasharray="2 2.5" />;
}

export type IconRenderer = (props: IconProps) => ReactNode;
