// הניווט התחתון של האפליקציה — 5 טאבים קבועים
// משתמש ב-react-router-dom כדי לדעת איזה טאב פעיל לפי ה-URL הנוכחי

import { NavLink, useLocation } from "react-router-dom";
import { Home, ListChecks, BarChart3, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";

// הגדרת הטאבים במקום אחד — לשינוי בעתיד
const TABS = [
  { to: "/home", label: "בית", Icon: Home },
  { to: "/predictions", label: "ניחושים", Icon: ListChecks },
  { to: "/leaderboard", label: "דירוג", Icon: BarChart3 },
  { to: "/bracket", label: "טורניר", Icon: Trophy },
  { to: "/profile", label: "פרופיל", Icon: User },
] as const;

export function BottomNav() {
  // useLocation מחזיר את ה-URL הנוכחי
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 no-tap"
      style={{
        background: "rgba(10, 14, 26, 0.88)",
        backdropFilter: "saturate(160%) blur(22px)",
        WebkitBackdropFilter: "saturate(160%) blur(22px)",
        borderTop: "1px solid rgba(255, 255, 255, 0.04)",
        // iOS Home Indicator: max(18px, safe-area) כדי לא להיתקע מתחת לבר
        paddingBottom: "max(18px, env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex items-stretch justify-around px-2 pt-1.5">
        {TABS.map(({ to, label, Icon }) => {
          const active = location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 px-2 py-1.5",
                "transition-opacity"
              )}
            >
              <Icon
                size={20}
                strokeWidth={active ? 2 : 1.7}
                color={active ? "#F4F6FB" : "rgba(138,147,166,0.5)"}
                fill={active ? "rgba(230,57,70,0.18)" : "none"}
              />
              <span
                className={cn(
                  "text-[10px]",
                  active ? "font-bold text-white" : "font-medium"
                )}
                style={!active ? { color: "rgba(138,147,166,0.5)" } : undefined}
              >
                {label}
              </span>
              {active && (
                <span
                  className="absolute -bottom-px left-1/2 -translate-x-1/2"
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    background: "#E63946",
                    boxShadow:
                      "0 0 8px rgba(230,57,70,0.9), 0 0 16px rgba(230,57,70,0.5)",
                  }}
                  aria-hidden="true"
                />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
