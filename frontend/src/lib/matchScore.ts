// פורמט הצגת תוצאת משחק — כולל פנדלים אם רלוונטי.
//
// דוגמאות:
//   formatScore(2, 1)              → "2"  + "1"
//   formatScore(2, 2, 4, 5)        → "2(4)" + "2(5)" — פנדלים בסוגריים
//   formatScore(null, null)        → "—"  + "—"
//
// בכל הפלייאוף — אם זמן רגיל היה תיקו והיו פנדלים, ננחה את ה-frontend
// להציג עם סוגריים כדי שלא יהיה אי-בהירות מי עבר הלאה.

export type ScoreParts = {
  home: string;
  away: string;
  hasPenalties: boolean;
};

export function formatScore(
  scoreHome: number | null,
  scoreAway: number | null,
  pensHome: number | null = null,
  pensAway: number | null = null,
): ScoreParts {
  if (scoreHome === null || scoreAway === null) {
    return { home: "—", away: "—", hasPenalties: false };
  }

  const hasPenalties =
    pensHome !== null && pensAway !== null;

  if (hasPenalties) {
    return {
      home: `${scoreHome}(${pensHome})`,
      away: `${scoreAway}(${pensAway})`,
      hasPenalties: true,
    };
  }

  return {
    home: String(scoreHome),
    away: String(scoreAway),
    hasPenalties: false,
  };
}

/** מי עבר הלאה (בפלייאוף בלבד) — כולל פנדלים. שימוש: זרימת הברקט, ניחושי טווח-ארוך. */
export function advancerSide(
  scoreHome: number | null,
  scoreAway: number | null,
  pensHome: number | null = null,
  pensAway: number | null = null,
): "home" | "away" | null {
  if (scoreHome === null || scoreAway === null) return null;
  if (scoreHome > scoreAway) return "home";
  if (scoreHome < scoreAway) return "away";
  // תיקו — בודקים פנדלים
  if (pensHome === null || pensAway === null) return null;
  if (pensHome > pensAway) return "home";
  if (pensHome < pensAway) return "away";
  return null;
}

/**
 * כיוון התוצאה בזמן הרגיל (90 דקות) — לצרכי ניקוד וצביעת ניחוש.
 * מחזיר "home" | "away" | "draw" | null (null = משחק לא נגמר/חסר מידע).
 *
 * שימו לב: זה שונה מ-advancerSide. בפלייאוף, גם אם הקבוצה לא עלתה,
 * תיקו בזמן רגיל = "draw" לצרכי ניקוד הניחוש. מי שעלה בפועל = advancerSide.
 */
export function regularTimeDirection(
  scoreHome: number | null,
  scoreAway: number | null,
): "home" | "away" | "draw" | null {
  if (scoreHome === null || scoreAway === null) return null;
  if (scoreHome > scoreAway) return "home";
  if (scoreHome < scoreAway) return "away";
  return "draw";
}
