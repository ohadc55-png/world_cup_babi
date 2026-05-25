// רקע משותף לעמודי הפנים של האפליקציה (Home / Predictions / Leaderboard / Bracket / Profile / Rules).
//
// שונה מ-EntryBackground:
// - יותר כהה (משתמש בילה כאן זמן ארוך, הרקע לא צריך לגנוב תשומת לב)
// - blur קל מעל התמונה כדי לרכך פרטים
// - blend עם צבעי המותג
// - fixed positioning (לא נגלל עם התוכן) כדי שהרקע יישאר יציב
//
// שימוש: <PageBackground src="/img/main.png" /> בראש כל עמוד.

type Props = {
  src: string;
  /** ברירת מחדל: "balanced". "subtle" = רקע יותר כהה (לעמודים עם הרבה טקסט) */
  intensity?: "balanced" | "subtle" | "vivid";
};

export function PageBackground({ src, intensity = "balanced" }: Props) {
  // הגדרות לכל רמת intensity
  // הערכים תוקנו 2026-05-24 — חשיפה מספיק גלויה כדי לראות את התמונה.
  const cfg = {
    subtle: {
      imageOpacity: 0.45,
      blur: 2,
      overlayTop: 0.50,
      overlayBottom: 0.80,
    },
    balanced: {
      imageOpacity: 0.60,
      blur: 1,
      overlayTop: 0.40,
      overlayBottom: 0.72,
    },
    vivid: {
      imageOpacity: 0.80,
      blur: 0,
      overlayTop: 0.25,
      overlayBottom: 0.60,
    },
  }[intensity];

  return (
    <>
      {/* תמונה - position fixed כדי שתישאר במקום בזמן גלילה */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: cfg.imageOpacity,
          filter: `blur(${cfg.blur}px) saturate(0.95)`,
          // טריק: scale קל מונע שוליים לבנים בעקבות ה-blur
          transform: "scale(1.05)",
        }}
      />

      {/* שכבת הצללה כהה */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: `linear-gradient(180deg, rgba(10,14,26,${cfg.overlayTop}) 0%, rgba(10,14,26,${cfg.overlayBottom}) 100%)`,
        }}
      />

      {/* גוון מותג בפינות לעומק ויזואלי */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(900px 700px at 0% 0%, rgba(230,57,70,0.06), transparent 60%), radial-gradient(900px 700px at 100% 100%, rgba(6,167,125,0.05), transparent 60%)",
        }}
      />
    </>
  );
}
