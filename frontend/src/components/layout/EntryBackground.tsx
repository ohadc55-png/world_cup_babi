// רקע משותף לכל עמודי הכניסה (Splash / Login / Onboarding / GameSelect).
//
// 3 שכבות:
//   1. תמונת הפליקנים-עם-הגביע (login.png) - object-cover, ממלאת את כל המסך
//   2. שכבת הצללה כהה - גראדיינט אנכי מ-40% למעלה ל-85% למטה, כדי שטקסט יישאר קריא
//   3. גוון דק של צבעי המותג מצדדים - מסיף עומק ויזואלי
//
// הרכיב מציב את עצמו absolute inset-0 כך שמופיע מאחורי כל התוכן.
// כל קומפוננטה שמשתמשת בו חייבת להיות עם position:relative או להציב את התוכן עם z-10.

export function EntryBackground() {
  return (
    <>
      {/* תמונת רקע */}
      <img
        src="/img/login.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{
          // saturation מעט נמוכה כדי שלא יגנוב את התשומת לב מהתוכן
          filter: "saturate(0.95) brightness(0.95)",
        }}
      />

      {/* שכבת הצללה כהה - חזקה למטה (איפה שהטופס) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,14,26,0.55) 0%, rgba(10,14,26,0.78) 60%, rgba(10,14,26,0.92) 100%)",
        }}
      />

      {/* גוון מותג עדין מצדדים */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(800px 600px at 0% 0%, rgba(230,57,70,0.10), transparent 60%), radial-gradient(800px 600px at 100% 100%, rgba(6,167,125,0.08), transparent 60%)",
        }}
      />
    </>
  );
}
