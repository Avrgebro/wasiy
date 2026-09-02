import { WasiyLogo } from '../../components/layout/shared/wasiy-logo'

/**
 * Branded fallback for location covers without a photo (cards grid and the
 * detail header): the Wasiy mark, oversized and cropped by the bottom-right
 * corner as a low-opacity watermark. Strokes follow currentColor from the
 * monochrome text color so it reads in both color schemes.
 */
export function LocationCoverPlaceholder({ logoSize }: { logoSize: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden text-[var(--mantine-color-text)]"
    >
      <div
        className="absolute opacity-[0.25]"
        style={{ bottom: -logoSize * 0.28, right: -logoSize * 0.1 }}
      >
        <WasiyLogo size={logoSize} />
      </div>
    </div>
  )
}
