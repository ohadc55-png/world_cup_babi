# Demo Simulator

סימולטור end-to-end לבדיקת כל מערכת הניקוד וההתראות לפני המונדיאל.

## למה זה חשוב?
**במונדיאל אין הזדמנות שניה.** באג שיתגלה ב-11.6 בלילה = לאיש מהקבוצה לא ניתן לפצות. הסימולטור הזה מאפשר להריץ את כל הטורניר אצלך לוקאלית ולגלות בעיות מראש.

---

## שימוש מהיר

### 1. Setup — הוספת בוטים למשחק שלך
```bash
cd backend
conda activate my_conda
python -m scripts.demo setup 8FW22JGA    # החלף בקוד שלך
```

מוסיף 4 בוטים למשחק שלך:
- 🎯 **demo_pro** — תמיד מנחש exact (יקבל max points)
- 👍 **demo_good** — 65% direction, 35% מהם exact
- 😐 **demo_meh** — 40% direction, 10% exact
- 🎲 **demo_lucky** — אקראי טהור

לכל בוט: ניחושי 104 משחקים + 12 טבלאות בתים + ניחושי טווח-ארוך.

### 2. Status — ראה מצב נוכחי
```bash
python -m scripts.demo status
```

מציג:
- כמה משחקים בכל סטטוס
- כל הבוטים שקיימים + הניקוד שלהם
- ה-leaderboard של המשחק

### 3. Simulate — סמלץ משחקים

**משחק יחיד:**
```bash
python -m scripts.demo simulate 1
```

**מחזור שלם של שלב הבתים:**
```bash
python -m scripts.demo round 1
python -m scripts.demo round 2
python -m scripts.demo round 3
```

**שלב פלייאוף שלם:**
```bash
python -m scripts.demo stage r32
python -m scripts.demo stage r16
python -m scripts.demo stage qf
python -m scripts.demo stage sf
python -m scripts.demo stage third_place
python -m scripts.demo stage final
```

**הכל בבת אחת (כל 104 המשחקים בסדר כרונולוגי):**
```bash
python -m scripts.demo all
python -m scripts.demo all --delay 1.0    # 1 שנייה בין משחקים
```

### 4. Reset — ניקוי לשעת חירום
```bash
python -m scripts.demo reset
```

- מוחק את כל הבוטים (CASCADE מנקה את הניחושים שלהם)
- מאפס את כל ה-104 משחקים למצב `scheduled`
- מוחק את כל ה-score_events של המשתמש שלך
- מרענן את הניקוד הכולל ל-0

**הניחושים שלך נשמרים** — רק תוצאות + ניקוד מתאפסים.

---

## תרחישי בדיקה מומלצים

### תרחיש 1: זרימה בסיסית
```bash
python -m scripts.demo setup 8FW22JGA
python -m scripts.demo round 1
python -m scripts.demo status        # ודא שיש ניקוד לכולם
```

### תרחיש 2: בדיקת push notifications
1. הכנס לאפליקציה כעצמך, אפשר התראות
2. הרץ `python -m scripts.demo round 1`
3. אמורות להגיע התראות "תוצאת משחק" + "שינוי דירוג"

### תרחיש 3: בדיקת פנדלים
1. `python -m scripts.demo setup 8FW22JGA`
2. `python -m scripts.demo stage r32`
3. בדוק שיש משחק עם פנדלים — ניקוד חושב נכון

### תרחיש 4: סימולציה מלאה
1. `python -m scripts.demo setup 8FW22JGA`
2. עשה לעצמך כמה ניחושים באפליקציה
3. `python -m scripts.demo all --delay 0.5`
4. בסוף: בדוק את ה-leaderboard, תראה איך אתה נדרגת מול הבוטים

### תרחיש 5: בדיקת UI עם תוצאות אמיתיות
1. הכנס לאפליקציה
2. `python -m scripts.demo simulate 1` (משחק 1)
3. רענן את האפליקציה — ודא:
   - המשחק מופיע כ"סיים" בעמוד הבית
   - ניחוש שלך מקבל ✓ או X
   - ה-leaderboard מתעדכן
   - ניקוד החדש מופיע בכותרת

---

## אם משהו השתבש

**הסקריפט לא רץ:**
- ודא שאתה במצב `my_conda` activated
- ודא שאתה בתיקיית `backend/`
- בדוק שה-backend uvicorn לא קורא לאותם משחקים בו-זמנית

**הניקוד מוזר אחרי reset:**
- הרץ `reset` שוב
- אם עדיין: בדוק `score-verify` ב-admin: `curl http://localhost:8000/api/admin/score-verify`

**יש בוט תקוע:**
- `python -m scripts.demo reset` — אמור לנקות הכל

---

## איך זה עובד מאחורי הקלעים

1. **Setup** יוצר 4 בוטים ב-DB (כמשתמשים רגילים, עם PIN שאפשר להיכנס איתו)
2. ה-state file `demo_state.json` שומר תוצאות "עתידיות" deterministic לכל 104 המשחקים (seeded random)
3. כל בוט מקבל ניחושים לפי ה-accuracy שלו (`pro` יודע את התוצאה מראש מה-state)
4. **Simulate** מעדכן את ה-DB עם התוצאה השמורה + קורא ל-`scoring.calculate_match_score()`
5. ה-scoring engine כותב ל-`score_events`, מעדכן `scores`, ומפעיל אוטומטית push notifications

הניחושים של הבוטים נשמרים ב-`predictions_matches`/`predictions_groups`/`predictions_tournament` — זהה ל-real users.

---

## פקודות שיעזרו לאדמין במהלך הסימולציה

מ-Swagger (`http://localhost:8000/docs`):

- `GET /api/admin/score-verify` — בדיקת consistency של ניקוד (חייב להיות `ok: true`)
- `GET /api/admin/score-audit/{user_id}` — כל ה-score_events של משתמש
- `POST /api/admin/matches/{id}/revert` — ביטול תוצאה של משחק ספציפי

מ-CLI:

- `python -m app.crons.sync_results --recompute MATCH_ID` — חישוב מחדש של ניקוד למשחק
- `python -m app.crons.lock_predictions --match-id N` — לוק ידני למשחק (לבדיקת flow)
