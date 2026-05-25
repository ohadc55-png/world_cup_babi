// נקודת הכניסה לאפליקציה — Vite מריץ את הקובץ הזה ראשון
//
// StrictMode = עוטף את האפליקציה במצב פיתוח שמזהיר על דברים שעלולים להישבר
// בעתיד. בייצור (build) הוא לא משפיע על ביצועים.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import "@/index.css";
import { AuthProvider } from "@/hooks/useAuth";
import { App } from "@/App";

// תיקון לבעיית Windows: Windows לא מציג דגלי אמוג'י (מציג "MA" במקום 🇲🇦).
// הפונקציה הזו טוענת פונט Twemoji דק שמספק את הדגלים. רץ פעם אחת בכניסה לאפליקציה.
polyfillCountryFlagEmojis();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* BrowserRouter = הצורה הסטנדרטית של routing ב-React (URL-based) */}
    <BrowserRouter>
      {/* AuthProvider עוטף את כל האפליקציה כדי שכל קומפוננטה תוכל לקרוא ל-useAuth() */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
