// מילון של 48 הקבוצות במונדיאל 2026
// מקבל את השם באנגלית מ-openfootball, מחזיר עברית + דגל emoji.

type TeamInfo = { he: string; flag: string };

const TEAMS: Record<string, TeamInfo> = {
  // CONCACAF
  "Mexico": { he: "מקסיקו", flag: "🇲🇽" },
  "USA": { he: "ארה״ב", flag: "🇺🇸" },
  "United States": { he: "ארה״ב", flag: "🇺🇸" }, // alias אם openfootball ישנה את הפורמט
  "Canada": { he: "קנדה", flag: "🇨🇦" },
  "Costa Rica": { he: "קוסטה ריקה", flag: "🇨🇷" },
  "Panama": { he: "פנמה", flag: "🇵🇦" },
  "Jamaica": { he: "ג׳מייקה", flag: "🇯🇲" },
  "Honduras": { he: "הונדורס", flag: "🇭🇳" },
  "Haiti": { he: "האיטי", flag: "🇭🇹" },
  "Curaçao": { he: "קוראסאו", flag: "🇨🇼" },
  "El Salvador": { he: "אל סלבדור", flag: "🇸🇻" },

  // CONMEBOL
  "Argentina": { he: "ארגנטינה", flag: "🇦🇷" },
  "Brazil": { he: "ברזיל", flag: "🇧🇷" },
  "Uruguay": { he: "אורוגוואי", flag: "🇺🇾" },
  "Colombia": { he: "קולומביה", flag: "🇨🇴" },
  "Ecuador": { he: "אקוודור", flag: "🇪🇨" },
  "Paraguay": { he: "פרגוואי", flag: "🇵🇾" },
  "Chile": { he: "צ׳ילה", flag: "🇨🇱" },
  "Peru": { he: "פרו", flag: "🇵🇪" },
  "Bolivia": { he: "בוליביה", flag: "🇧🇴" },

  // UEFA
  "England": { he: "אנגליה", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  "France": { he: "צרפת", flag: "🇫🇷" },
  "Germany": { he: "גרמניה", flag: "🇩🇪" },
  "Spain": { he: "ספרד", flag: "🇪🇸" },
  "Portugal": { he: "פורטוגל", flag: "🇵🇹" },
  "Netherlands": { he: "הולנד", flag: "🇳🇱" },
  "Italy": { he: "איטליה", flag: "🇮🇹" },
  "Belgium": { he: "בלגיה", flag: "🇧🇪" },
  "Croatia": { he: "קרואטיה", flag: "🇭🇷" },
  "Switzerland": { he: "שווייץ", flag: "🇨🇭" },
  "Denmark": { he: "דנמרק", flag: "🇩🇰" },
  "Poland": { he: "פולין", flag: "🇵🇱" },
  "Austria": { he: "אוסטריה", flag: "🇦🇹" },
  "Sweden": { he: "שבדיה", flag: "🇸🇪" },
  "Norway": { he: "נורווגיה", flag: "🇳🇴" },
  "Turkey": { he: "טורקיה", flag: "🇹🇷" },
  "Serbia": { he: "סרביה", flag: "🇷🇸" },
  "Ukraine": { he: "אוקראינה", flag: "🇺🇦" },
  "Czech Republic": { he: "צ׳כיה", flag: "🇨🇿" },
  "Scotland": { he: "סקוטלנד", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  "Wales": { he: "ויילס", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  "Republic of Ireland": { he: "אירלנד", flag: "🇮🇪" },
  "Bosnia & Herzegovina": { he: "בוסניה", flag: "🇧🇦" },

  // CAF
  "Morocco": { he: "מרוקו", flag: "🇲🇦" },
  "Senegal": { he: "סנגל", flag: "🇸🇳" },
  "Tunisia": { he: "תוניסיה", flag: "🇹🇳" },
  "Algeria": { he: "אלג׳יריה", flag: "🇩🇿" },
  "Egypt": { he: "מצרים", flag: "🇪🇬" },
  "Nigeria": { he: "ניגריה", flag: "🇳🇬" },
  "Ghana": { he: "גאנה", flag: "🇬🇭" },
  "Cameroon": { he: "קמרון", flag: "🇨🇲" },
  "Ivory Coast": { he: "חוף השנהב", flag: "🇨🇮" },
  "South Africa": { he: "דרום אפריקה", flag: "🇿🇦" },
  "Cape Verde": { he: "כף ורדה", flag: "🇨🇻" },
  "DR Congo": { he: "קונגו", flag: "🇨🇩" },

  // AFC
  "Japan": { he: "יפן", flag: "🇯🇵" },
  "South Korea": { he: "דרום קוריאה", flag: "🇰🇷" },
  "Iran": { he: "איראן", flag: "🇮🇷" },
  "Iraq": { he: "עיראק", flag: "🇮🇶" },
  "Australia": { he: "אוסטרליה", flag: "🇦🇺" },
  "Saudi Arabia": { he: "ערב הסעודית", flag: "🇸🇦" },
  "Qatar": { he: "קטאר", flag: "🇶🇦" },
  "Uzbekistan": { he: "אוזבקיסטן", flag: "🇺🇿" },
  "Jordan": { he: "ירדן", flag: "🇯🇴" },

  // OFC
  "New Zealand": { he: "ניו זילנד", flag: "🇳🇿" },
};

/**
 * מחזיר את התרגום לעברית + דגל. אם הקבוצה לא ידועה (למשל "W101" placeholder לפלייאוף),
 * מחזיר את השם המקורי + דגל לבן.
 */
export function getTeamInfo(englishName: string): TeamInfo {
  return TEAMS[englishName] ?? { he: englishName, flag: "🏳️" };
}
