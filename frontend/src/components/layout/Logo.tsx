// רכיב הלוגו הראשי — מופיע בכותרת, מסכי כניסה, וכו'.
// **שינוי לוגו = שינוי בקובץ אחד בלבד.**
//
// שני variants:
//   - "svg" (ברירת מחדל): TrophySvg וקטורי, חד בכל גודל
//   - "photo": תמונת PNG שקופה של הגביע (טכן יותר ריאליסטי)
//
// כל אחד נעטף במסגרת תלת-צבעית (אדום/נייבי/ירוק = מקסיקו/ארה"ב/קנדה).

import { cn } from "@/lib/utils";
import { TrophySvg } from "./TrophySvg";

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
  variant?: "svg" | "photo";
  className?: string;
};

export function Logo({
  size = 24,
  showWordmark = false,
  showTagline = false,
  variant = "photo",
  className,
}: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showWordmark && (
        <div className="text-end leading-none">
          <div className="text-[13.5px] font-extrabold tracking-tight text-white">
            מונדיאל <span className="num">2026</span>
          </div>
          {showTagline && (
            <div
              className="num mt-0.5 text-[9px] font-bold uppercase"
              style={{ letterSpacing: "0.24em", color: "rgba(255, 217, 61, 0.55)" }}
            >
              Babi Group
            </div>
          )}
        </div>
      )}

      {/* === BADGE: מסגרת תלת-צבעית עם הגביע במרכז === */}
      <LogoBadge size={size} variant={variant} />
    </div>
  );
}

// ============================================================
// LogoBadge — מסגרת מלבנית מאורכת + הגביע ממלא
// ============================================================
function LogoBadge({ size, variant }: { size: number; variant: "svg" | "photo" }) {
  // מלבן אנכי — יחס 1:1.5 (size=24 → 24×36, size=64 → 64×96)
  const width = size;
  const height = Math.round(size * 1.5);

  const ringWidth = Math.max(1, Math.round(size * 0.06));
  const outerRadius = Math.round(size * 0.22);
  const innerRadius = Math.round(size * 0.16);

  // הגביע ממלא את החלל הפנימי כמעט לחלוטין
  const trophyHeight = Math.round(height * 0.88);

  return (
    <div
      className="relative shrink-0 grid place-items-center"
      style={{
        width,
        height,
        borderRadius: outerRadius,
        // מסגרת תלת-צבעית (אדום/נייבי/ירוק) — gradient ליניארי אנכי כי המלבן ארוך
        background:
          "linear-gradient(180deg, #E63946 0%, #E63946 33%, #1D3557 33%, #1D3557 66%, #06A77D 66%, #06A77D 100%)",
        padding: ringWidth,
        boxShadow:
          "0 0 0 1px rgba(255,217,61,0.25), 0 6px 18px -6px rgba(230,57,70,0.40)",
      }}
      aria-hidden="true"
    >
      {/* רקע פנימי כהה */}
      <div
        className="relative grid h-full w-full place-items-center overflow-hidden"
        style={{
          borderRadius: innerRadius,
          background:
            "radial-gradient(ellipse at 50% 30%, #1D3557 0%, #0A0E1A 85%)",
          boxShadow: "inset 0 0 0 1px rgba(255,217,61,0.18)",
        }}
      >
        {/* glow זהוב עדין מאחורי הגביע */}
        <div
          className="absolute"
          style={{
            left: "50%",
            top: "55%",
            transform: "translate(-50%, -50%)",
            width: "85%",
            height: "70%",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(255,217,61,0.35) 0%, transparent 70%)",
            filter: "blur(2px)",
          }}
        />

        {/* === הגביע עצמו === */}
        {variant === "svg" ? (
          <TrophySvg size={Math.round(trophyHeight * 24 / 32)} />
        ) : (
          <img
            src="/trophy.png"
            alt=""
            className="relative"
            style={{
              height: trophyHeight,
              width: "auto",
              filter:
                "drop-shadow(0 1px 3px rgba(0,0,0,0.6)) saturate(1.18) brightness(1.06)",
            }}
          />
        )}
      </div>
    </div>
  );
}
