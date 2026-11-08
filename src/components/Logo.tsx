// The Motoring Central logo: the "M" badge plus the wordmark.
export function LogoMark({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" style={{ flex: "none" }}>
      <rect width="120" height="120" rx="30" fill="#0B1C35" />
      <path
        d="M30.3 89.7 A42 42 0 1 1 89.7 89.7"
        fill="none"
        stroke="#38BDF8"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <polyline
        points="38,82 38,46 60,68 82,46 82,82"
        fill="none"
        stroke="#fff"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="68" r="8" fill="#FFD43B" />
    </svg>
  );
}

export function Logo() {
  return (
    <>
      <LogoMark />
      <span className="logo-words" aria-hidden="true">
        <span className="the">THE</span>
        <span className="motoring">MOTORING</span>
        <span className="central">CENTRAL</span>
        <small className="tagline">Buy. Fix. Clean. Rescue.</small>
      </span>
    </>
  );
}
