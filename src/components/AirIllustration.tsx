/**
 * Purely decorative, original illustration of a generic air purifier with a soft
 * air-swirl and a couple of leaf accents. It does not depict or copy any specific
 * real product, brand, or logo — it's a simple generic shape (rounded cylinder +
 * LED dot) in the same spirit as the rest of MyAir's iconography.
 */
export function AirIllustration() {
  return (
    <svg viewBox="0 0 220 220" className="airIllustration" aria-hidden="true">
      <defs>
        <radialGradient id="aiGlow" cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor="var(--ai-glow-in)" />
          <stop offset="100%" stopColor="var(--ai-glow-out)" />
        </radialGradient>
        <linearGradient id="aiBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ai-body-top)" />
          <stop offset="100%" stopColor="var(--ai-body-bottom)" />
        </linearGradient>
        <linearGradient id="aiSwirl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity=".05" />
          <stop offset="50%" stopColor="var(--cyan)" stopOpacity=".55" />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity=".05" />
        </linearGradient>
      </defs>
      <circle cx="110" cy="100" r="95" fill="url(#aiGlow)" />
      <path d="M20 128c42 22 88 27 130 10 20-8 35-20 48-33-14 28-37 48-62 59-40 18-84 15-122-6-8-5-13-11-13-18 0-7 10-13 19-12z" fill="url(#aiSwirl)" />
      <path d="M150 150c38 14 70 30 94 54-18-33-47-56-80-68-9-3-17 7-14 14z" fill="url(#aiSwirl)" opacity=".6" />
      <g transform="translate(66,38)">
        <ellipse cx="42" cy="134" rx="40" ry="7" fill="#000" opacity=".08" />
        <rect x="2" y="0" width="80" height="128" rx="26" fill="url(#aiBody)" stroke="var(--ai-body-stroke)" strokeWidth="1.5" />
        <rect x="2" y="0" width="80" height="22" rx="20" fill="var(--ai-cap)" />
        <circle cx="42" cy="34" r="8" fill="none" stroke="var(--cyan)" strokeWidth="3.5" />
        <circle cx="42" cy="34" r="2.6" fill="var(--cyan)" />
        {Array.from({ length: 5 }).map((_, row) => (
          <g key={row}>
            {Array.from({ length: 7 }).map((__, col) => (
              <circle key={col} cx={16 + col * 8.4} cy={72 + row * 9} r="1.4" fill="var(--ai-vent-dot)" />
            ))}
          </g>
        ))}
      </g>
      <g fill="var(--ai-leaf)">
        <path d="M172 54c10-9 22-11 33-7-3 12-12 21-24 25-7-5-10-12-9-18z" />
        <path d="M30 70c-9-6-14-15-14-25 11 1 21 7 27 17-3 6-8 9-13 8z" />
        <path d="M184 118c7-4 15-4 21 0-3 8-10 13-18 14-4-5-5-10-3-14z" opacity=".85" />
      </g>
    </svg>
  );
}

/** Icon for the "no purifier connected" card: a device outline with idle signal dashes
 * on each side, to read as "nothing detected yet" rather than an error state. */
export function NoDeviceIcon() {
  return (
    <svg viewBox="0 0 64 64" className="noDeviceIcon" aria-hidden="true">
      <rect x="22" y="14" width="20" height="36" rx="6" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="32" cy="23" r="2.1" fill="currentColor" />
      <line x1="27" y1="40" x2="37" y2="40" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".55">
        <line x1="10" y1="22" x2="16" y2="25" />
        <line x1="8" y1="32" x2="15" y2="32" />
        <line x1="10" y1="42" x2="16" y2="39" />
        <line x1="54" y1="22" x2="48" y2="25" />
        <line x1="56" y1="32" x2="49" y2="32" />
        <line x1="54" y1="42" x2="48" y2="39" />
      </g>
    </svg>
  );
}
