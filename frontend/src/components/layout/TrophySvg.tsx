// SVG וקטורי של גביע המונדיאל — מעוצב באופן סטיליסטי.
// יתרון: חד בכל גודל, ללא תמונה, ללא תלות ב-network.
// אם רוצים את התמונה הפוטוגרפית — Logo עם variant="photo" משתמש ב-/trophy.png.

type TrophySvgProps = {
  size?: number;
  // gradient gold או צבע אחד
  goldGradient?: boolean;
  className?: string;
};

export function TrophySvg({ size = 20, goldGradient = true, className }: TrophySvgProps) {
  // viewBox 24×32 שומר על יחס גביע מאוד מאורך
  return (
    <svg
      viewBox="0 0 24 32"
      width={size}
      height={Math.round(size * 32 / 24)}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="trophy-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE468" />
          <stop offset="45%" stopColor="#FFD93D" />
          <stop offset="100%" stopColor="#C99A1A" />
        </linearGradient>
        <linearGradient id="trophy-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#08C28F" />
          <stop offset="100%" stopColor="#046045" />
        </linearGradient>
        <radialGradient id="trophy-glow" cx="50%" cy="30%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* === גוף עליון (Globe/Cup) === */}
      <path
        d="M 12 1.5 C 7 1.5 5 5.5 5.5 10 C 6 14.5 8 17 12 17 C 16 17 18 14.5 18.5 10 C 19 5.5 17 1.5 12 1.5 Z"
        fill={goldGradient ? "url(#trophy-gold)" : "#FFD93D"}
      />
      {/* highlight על הכדור */}
      <ellipse cx="9" cy="6" rx="2" ry="3" fill="url(#trophy-glow)" />

      {/* === מותן/ידיות סטיליסטיות === */}
      <path
        d="M 5.5 9 C 3 9 2 10.5 2.5 12 C 3 13.5 5 14 6 13 L 5.5 9 Z"
        fill={goldGradient ? "url(#trophy-gold)" : "#FFD93D"}
      />
      <path
        d="M 18.5 9 C 21 9 22 10.5 21.5 12 C 21 13.5 19 14 18 13 L 18.5 9 Z"
        fill={goldGradient ? "url(#trophy-gold)" : "#FFD93D"}
      />

      {/* === גזע מתחבר לבסיס === */}
      <path
        d="M 9 16.5 L 15 16.5 L 14.5 22 L 9.5 22 Z"
        fill={goldGradient ? "url(#trophy-gold)" : "#FFD93D"}
      />

      {/* === בסיס זהב === */}
      <rect
        x="6.5"
        y="22"
        width="11"
        height="2.5"
        rx="0.6"
        fill={goldGradient ? "url(#trophy-gold)" : "#FFD93D"}
      />

      {/* === בסיס ירוק (מלאכיט) === */}
      <rect
        x="5"
        y="24.5"
        width="14"
        height="5"
        rx="1.2"
        fill="url(#trophy-green)"
      />
      {/* פס זהב דק על הבסיס הירוק */}
      <rect x="5" y="26" width="14" height="0.4" fill="#FFD93D" opacity="0.55" />
      <rect x="5" y="28.2" width="14" height="0.4" fill="#FFD93D" opacity="0.55" />

      {/* === קרקעית === */}
      <rect
        x="4"
        y="29.5"
        width="16"
        height="1.5"
        rx="0.5"
        fill={goldGradient ? "url(#trophy-gold)" : "#FFD93D"}
      />
    </svg>
  );
}
