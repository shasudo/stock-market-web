interface UpperWickMarkProps {
  className?: string;
}

/**
 * UpperWick brand mark — a cream ₹ whose leg bounces into a rising
 * chart arrow, on an espresso tile with a racing-green edge.
 * Fixed colors so it reads identically in light and dark mode.
 */
export function UpperWickMark({ className = "h-8 w-8" }: UpperWickMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="UpperWick"
    >
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#251A12" />
      <rect
        x="6.5"
        y="6.5"
        width="51"
        height="51"
        rx="11.5"
        fill="none"
        stroke="#1F7A4D"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      <g
        fill="none"
        stroke="#F4EBD9"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 16 H42" />
        <path d="M18 26 H38" />
        <path d="M23 16 V26" />
        <path d="M42 16 C42 23 37 26 31 26" />
        <path d="M31 26 L21 44 L30 35 L36 39 L50 21" />
        <path d="M50 21 L43.4 23.4" />
        <path d="M50 21 L47.5 27.6" />
      </g>
    </svg>
  );
}
