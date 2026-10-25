/** Original compass-star mark used for the broadcast branding. */
export function CompassLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
      <path d="M32 4 L37 27 L32 32 L27 27 Z" fill="#e3192b" />
      <path d="M32 60 L27 37 L32 32 L37 37 Z" fill="currentColor" />
      <path d="M4 32 L27 27 L32 32 L27 37 Z" fill="currentColor" opacity="0.85" />
      <path d="M60 32 L37 37 L32 32 L37 27 Z" fill="currentColor" opacity="0.85" />
      <circle cx="32" cy="32" r="3" fill="#0b1430" />
    </svg>
  );
}
