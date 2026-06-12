// Hero Card — המשחק הבא עם תמונת רקע + countdown + CTA
// פורט מ-home_hero_v4.html. כל ה-CSS שלא ניתן ל-Tailwind טהור נמצא ב-inline style.

import { ArrowLeft } from "lucide-react";
import type { MatchEvent } from "@/types";

type HeroNextMatchProps = {
  teamHome: { flag: string; nameHe: string };
  teamAway: { flag: string; nameHe: string };
  // countdown מקבל מספר של שניות והקומפוננטה מציגה HH:MM:SS
  countdownSeconds: number;
  venue: string;
  city: string;
  kickoffLocal: string; // למשל "22:00"
  matchLabel: string; // למשל "בית A · משחק 1"
  onPredictClick?: () => void;
  // אם הוגדר — המשחק LIVE עכשיו. במקום countdown מציגים תוצאה ענקית + תווית LIVE.
  // CTA משתנה ל"ראה משחק" וה-pill למעלה הופך לאדום פועם.
  liveScore?: { home: number; away: number };
  // דקה נוכחית מ-ESPN ("67'", "45+2'", "HT"). אופציונלי — מוצג רק במצב live.
  liveClock?: string | null;
  // אירועי משחק (שערים + כרטיסים אדומים) מסודרים כרונולוגית.
  // מוצגים כטיימליין דחוסה מתחת לתוצאה במצב LIVE.
  goalEvents?: MatchEvent[];
};

function formatCountdown(totalSeconds: number): { d: string; h: string; m: string; s: string } {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(safe / 86400);
  const h = Math.floor((safe % 86400) / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return {
    d: String(d),                       // ימים — בלי padding (יכול להיות 3 ספרות)
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}

export function HeroNextMatch({
  teamHome,
  teamAway,
  countdownSeconds,
  venue,
  city,
  kickoffLocal,
  matchLabel,
  onPredictClick,
  liveScore,
  liveClock,
  goalEvents,
}: HeroNextMatchProps) {
  const isLive = liveScore !== undefined;
  const { d, h, m, s } = formatCountdown(countdownSeconds);
  // מספר שעות+דקות לתצוגת ה-pill בכותרת
  const hoursLeft = Math.floor(countdownSeconds / 3600);
  const minutesLeft = Math.floor((countdownSeconds % 3600) / 60);

  return (
    <section
      className="relative overflow-hidden"
      style={{
        height: 500,
        // רקע כחול-נייבי כמו הצבע הדומיננטי של wc10 — מתמזג עם קצוות התמונה
        background: "#1a3a6e",
      }}
    >
      {/* רקע - תמונת wc10 ב-contain (כל התמונה נראית, כל הצבעים בולטים) */}
      <img
        src="/img/wc10.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        style={{
          objectFit: "contain",
          objectPosition: "center",
          opacity: 0.95,
        }}
      />
      {/* overlay עדין רק בקצוות (לקריאות הטקסט למעלה ולמטה) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,14,26,0.55) 0%, rgba(10,14,26,0.05) 25%, rgba(10,14,26,0.05) 70%, rgba(10,14,26,0.85) 100%)",
        }}
      />

      {/* Light leak top-right */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: -60,
          right: -100,
          width: 320,
          height: 320,
          background:
            "radial-gradient(closest-side, rgba(255,235,200,0.18), rgba(255,235,200,0) 70%)",
          filter: "blur(40px)",
          mixBlendMode: "screen",
          opacity: 0.7,
        }}
      />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* תוכן */}
      <div className="relative z-10 flex h-full flex-col px-5 pt-5 pb-5">
        {/* Top meta strip */}
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold text-white"
            style={{
              background: isLive ? "rgba(230,57,70,0.30)" : "rgba(0,0,0,0.32)",
              border: `1px solid ${isLive ? "rgba(230,57,70,0.65)" : "rgba(255,255,255,0.16)"}`,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              letterSpacing: isLive ? "0.10em" : undefined,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand-red)]"
              style={{
                boxShadow: "0 0 0 0 rgba(230,57,70,0.7)",
                animation: "livePulseInline 1.2s ease-out infinite",
              }}
            />
            {isLive ? (
              <span>LIVE</span>
            ) : (
              <>
                בעוד <span className="num">{hoursLeft}</span> שעות <span className="num">{minutesLeft % 60}</span> דקות
              </>
            )}
          </span>
          <span className="eyebrow text-white/55 num">{matchLabel}</span>
        </div>

        {/* spacer קטן בלבד — דוחף את התוכן לאמצע */}
        <div className="flex-1" />

        {/* Teams row */}
        <div className="mb-5 flex items-center justify-center gap-4">
          {/* Right team (RTL visual start) */}
          <div className="flex items-center gap-2 text-end">
            <span
              className="text-[28px]"
              style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.5))" }}
            >
              {teamHome.flag}
            </span>
            <div className="text-[17px] font-bold leading-tight text-white">{teamHome.nameHe}</div>
          </div>

          <div className="h-10 w-px" style={{ background: "rgba(255,217,61,0.3)" }} />

          {/* Left team */}
          <div className="flex items-center gap-2">
            <div className="text-[17px] font-bold leading-tight text-white">{teamAway.nameHe}</div>
            <span
              className="text-[28px]"
              style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.5))" }}
            >
              {teamAway.flag}
            </span>
          </div>
        </div>

        {/* אמצע: countdown לפני המשחק, או תוצאה ענקית במצב LIVE */}
        {isLive ? (
          // RTL inherited — first child renders on the right.
          // Home renders right (matches the flag/name on the right above);
          // away renders left.
          <div className="text-center">
            <div className="mx-auto flex items-end justify-center gap-3">
              <ScoreDigit value={liveScore!.home} />
              <span
                className="num text-white/40"
                style={{ fontSize: 56, fontWeight: 700, lineHeight: 1, marginBottom: 8 }}
              >
                —
              </span>
              <ScoreDigit value={liveScore!.away} />
            </div>
            {liveClock ? (
              <p
                className="num mt-3 text-[22px] font-extrabold"
                style={{
                  color: "#FFD93D",
                  textShadow: "0 0 18px rgba(255,217,61,0.35)",
                  letterSpacing: "0.04em",
                }}
              >
                {liveClock}
              </p>
            ) : (
              <p
                className="mt-3 text-[10px] font-bold uppercase text-white/55"
                style={{ letterSpacing: "0.22em" }}
              >
                תוצאה חיה
              </p>
            )}
            {goalEvents && goalEvents.length > 0 && (
              <EventsTicker events={goalEvents} />
            )}
          </div>
        ) : (
          <div className="text-center" style={{ direction: "ltr" }}>
            <div className="mx-auto flex max-w-[340px] items-end justify-center gap-2">
              <CountdownUnit num={d} label="ימים" />
              <CountdownSep />
              <CountdownUnit num={h} label="שעות" />
              <CountdownSep />
              <CountdownUnit num={m} label="דקות" />
              <CountdownSep />
              <CountdownUnit num={s} label="שניות" />
            </div>
          </div>
        )}

        {/* spacer שני - דוחף את ה-CTA לתחתית */}
        <div className="flex-1" />

        {/* CTA + metadata */}
        <div>
          <button
            onClick={onPredictClick}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-full text-[16px] font-extrabold text-white tracking-tight no-tap"
            style={{
              height: 52,
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.22)",
              backdropFilter: "saturate(180%) blur(24px)",
              WebkitBackdropFilter: "saturate(180%) blur(24px)",
              boxShadow:
                "0 14px 38px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.22)",
            }}
          >
            <span>{isLive ? "ראה משחק" : "נחש עכשיו"}</span>
            <ArrowLeft size={16} strokeWidth={2.4} />
          </button>

          <p
            className="mt-3 text-center text-[9.5px] font-medium uppercase text-white/55"
            style={{ letterSpacing: "0.18em" }}
          >
            <span>{venue}</span>
            <span className="mx-1.5 text-white/25">·</span>
            <span>{city}</span>
            <span className="mx-1.5 text-white/25">·</span>
            <span className="num">{kickoffLocal}</span>
          </p>
        </div>
      </div>

      {/* CSS keyframe inline (פעם אחת לכל הרכיב) */}
      <style>{`
        @keyframes livePulseInline {
          0%   { box-shadow: 0 0 0 0 rgba(230,57,70,0.7); }
          70%  { box-shadow: 0 0 0 7px rgba(230,57,70,0); }
          100% { box-shadow: 0 0 0 0 rgba(230,57,70,0); }
        }
      `}</style>
    </section>
  );
}

// ============================================================
// Countdown helpers
// ============================================================

function CountdownUnit({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span
        className="num text-white"
        style={{
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          textShadow: "0 6px 30px rgba(0,0,0,0.55), 0 0 50px rgba(255,255,255,0.06)",
        }}
      >
        {num}
      </span>
      <span
        className="mt-1.5 font-bold text-white/55"
        style={{ fontSize: 9, letterSpacing: "0.18em" }}
      >
        {label}
      </span>
    </div>
  );
}

function CountdownSep() {
  return (
    <span
      className="num text-white/30"
      style={{ fontSize: 38, fontWeight: 700, lineHeight: 1, marginBottom: 18 }}
    >
      :
    </span>
  );
}

// תוצאה במצב LIVE — ספרה ענקית עם זוהר זהוב.
function ScoreDigit({ value }: { value: number }) {
  return (
    <span
      className="num text-white"
      style={{
        fontSize: 80,
        fontWeight: 900,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        textShadow:
          "0 6px 30px rgba(0,0,0,0.55), 0 0 50px rgba(255,217,61,0.18)",
      }}
    >
      {value}
    </span>
  );
}

// ============================================================
// EventsTicker — שורה דחוסה של אירועים (שערים + כרטיסים אדומים)
// מוצגת מתחת לדקה במצב LIVE. מוגבל ל-4 אירועים אחרונים.
// ============================================================
function EventsTicker({ events }: { events: MatchEvent[] }) {
  // מסדרים כרונולוגית ולוקחים 4 אחרונים (התצוגה בהירו צרה)
  const recent = [...events].sort((a, b) => a.minute_value - b.minute_value).slice(-4);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-2">
      {recent.map((ev) => (
        <EventChip key={ev.id} event={ev} />
      ))}
    </div>
  );
}

function EventChip({ event }: { event: MatchEvent }) {
  const isGoal = event.event_type === "goal";
  const icon = isGoal ? "⚽" : "🟥";
  const player = lastNameOnly(event.primary_player);
  const assister = event.assister ? lastNameOnly(event.assister) : null;

  return (
    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-white/80">
      <span className="text-[12px]">{icon}</span>
      <span className="font-bold text-white">{player}</span>
      <span className="num text-white/55">{event.minute}</span>
      {isGoal && event.is_penalty && (
        <span
          className="rounded-sm px-1 text-[8.5px] font-extrabold"
          style={{
            color: "#FFD93D",
            border: "1px solid rgba(255,217,61,0.50)",
            background: "rgba(255,217,61,0.10)",
          }}
        >
          פ׳
        </span>
      )}
      {isGoal && event.is_own_goal && (
        <span
          className="rounded-sm px-1 text-[8.5px] font-extrabold"
          style={{
            color: "#FF7A85",
            border: "1px solid rgba(255,122,133,0.55)",
            background: "rgba(230,57,70,0.10)",
          }}
        >
          ש״ע
        </span>
      )}
      {assister && (
        <span className="text-white/45">({assister})</span>
      )}
    </span>
  );
}

// "Cyle Larin" → "Larin" — מקצר שמות לטיימליין דחוסה ב-Hero.
function lastNameOnly(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
}
