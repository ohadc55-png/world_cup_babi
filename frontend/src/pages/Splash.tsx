// מסך פתיחה — מוצג בזמן שאנחנו מאמתים את ה-JWT עם השרת
// (נמשך פחות משנייה ברוב המקרים)

import { Logo } from "@/components/layout/Logo";
import { EntryBackground } from "@/components/layout/EntryBackground";

export function Splash() {
  return (
    <div className="phone-shell relative flex min-h-dvh items-center justify-center overflow-hidden">
      <EntryBackground />
      <div className="relative z-10 flex flex-col items-center gap-4 animate-pulse">
        <Logo size={64} />
        <div className="num text-[12px] font-bold uppercase tracking-[0.30em] text-[color:var(--color-muted)]">
          Loading
        </div>
      </div>
    </div>
  );
}
