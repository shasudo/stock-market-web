interface UpperWickMarkProps {
  className?: string;
}

/**
 * UpperWick brand mark — a bold U whose right stem breaks high above
 * the cap line like an upper wick shooting skyward, on an espresso
 * tile with a racing-green edge. Fixed colors so it reads identically
 * in light and dark mode.
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
      <g fill="#F4EBD9">
        <rect x="18" y="30" width="10" height="13" />
        <polygon points="36,41 36,15 46,10 46,41" />
      </g>
      <path
        d="M23 30 V40 A9 9 0 0 0 41 40"
        fill="none"
        stroke="#F4EBD9"
        strokeWidth="10"
        strokeLinecap="butt"
      />
    </svg>
  );
}
