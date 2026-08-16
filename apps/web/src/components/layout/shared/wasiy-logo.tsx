type WasiyLogoProps = {
  size?: number
  className?: string
}

/**
 * The Wasiy mark. Strokes follow `currentColor` so callers set the color per
 * colorschema.md rule 7 (petróleo on light, inverted paper on dark, monochrome
 * text color as fallback); the amber dot is constant across modes.
 */
export function WasiyLogo({ size = 32, className }: WasiyLogoProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 12 v16 a8 8 0 0 0 16 0 v-16
          M24 12 v16 a8 8 0 0 0 16 0 v-16
          M40 28 v6 a2 2 0 0 1 -2 2 h-6"
        stroke="currentColor"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <circle cx="32" cy="19" r="3.5" fill="#E0A438" />
    </svg>
  )
}
