import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// פונקציית עזר לחיבור class names ב-Tailwind בצורה חכמה
// בדומה ל-` + ` ב-Python אבל עם מיזוג תקלות (למשל אם יש px-2 ו-px-4, אחד יבטל את השני)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
