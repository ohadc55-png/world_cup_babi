// Mock dataset for /leaderboard?mock=1 — לתצוגת עיצוב כשה-DB עוד ריק מנקודות.
// 18 משתמשים עם דירוג ריאליסטי, פערים אמיתיים, אחוזי דיוק שונים, ו-DD bonuses.
//
// המשתמש מסומן ע"י username "אוהד" (אם זה ה-username של המתחבר — הוא יראה את עצמו במקום 7).

import type { LeaderboardEntry, MyScoreDetail } from "@/types";

type MockSeed = {
  username: string;
  total_points: number;
  group_stage_pts: number;
  knockout_pts: number;
  awards_pts: number;
  double_down_pts: number;
  correct_count: number;
  total_predictions: number;
};

const SEED: MockSeed[] = [
  { username: "מנכ\"ל כוסילמלם", total_points: 1247, group_stage_pts: 545, knockout_pts: 502, awards_pts: 0, double_down_pts: 200, correct_count: 31, total_predictions: 42 },
  { username: "ברק",            total_points: 1180, group_stage_pts: 490, knockout_pts: 510, awards_pts: 0, double_down_pts: 180, correct_count: 29, total_predictions: 42 },
  { username: "דור צבר",         total_points: 1120, group_stage_pts: 460, knockout_pts: 500, awards_pts: 0, double_down_pts: 160, correct_count: 28, total_predictions: 42 },
  { username: "גיא מאור",        total_points: 1098, group_stage_pts: 450, knockout_pts: 488, awards_pts: 0, double_down_pts: 160, correct_count: 27, total_predictions: 42 },
  { username: "Mosco",          total_points: 1042, group_stage_pts: 420, knockout_pts: 482, awards_pts: 0, double_down_pts: 140, correct_count: 26, total_predictions: 42 },
  { username: "Shaked",         total_points:  998, group_stage_pts: 410, knockout_pts: 448, awards_pts: 0, double_down_pts: 140, correct_count: 25, total_predictions: 42 },
  { username: "אוהד",            total_points:  892, group_stage_pts: 380, knockout_pts: 372, awards_pts: 0, double_down_pts: 140, correct_count: 23, total_predictions: 42 },
  { username: "יותם",            total_points:  854, group_stage_pts: 360, knockout_pts: 374, awards_pts: 0, double_down_pts: 120, correct_count: 22, total_predictions: 42 },
  { username: "אילן קינס",        total_points:  812, group_stage_pts: 340, knockout_pts: 352, awards_pts: 0, double_down_pts: 120, correct_count: 21, total_predictions: 42 },
  { username: "רני",              total_points:  786, group_stage_pts: 326, knockout_pts: 340, awards_pts: 0, double_down_pts: 120, correct_count: 20, total_predictions: 42 },
  { username: "Aviv",             total_points:  742, group_stage_pts: 310, knockout_pts: 312, awards_pts: 0, double_down_pts: 120, correct_count: 19, total_predictions: 42 },
  { username: "אודי",              total_points:  708, group_stage_pts: 295, knockout_pts: 293, awards_pts: 0, double_down_pts: 120, correct_count: 18, total_predictions: 42 },
  { username: "Van Der Bill",     total_points:  672, group_stage_pts: 280, knockout_pts: 292, awards_pts: 0, double_down_pts: 100, correct_count: 17, total_predictions: 42 },
  { username: "יובל כהן",          total_points:  638, group_stage_pts: 265, knockout_pts: 273, awards_pts: 0, double_down_pts: 100, correct_count: 16, total_predictions: 42 },
  { username: "יוני דניאל",        total_points:  594, group_stage_pts: 250, knockout_pts: 244, awards_pts: 0, double_down_pts: 100, correct_count: 15, total_predictions: 42 },
  { username: "Kings nirgawa",     total_points:  548, group_stage_pts: 230, knockout_pts: 218, awards_pts: 0, double_down_pts: 100, correct_count: 14, total_predictions: 42 },
  { username: "דורון",             total_points:  502, group_stage_pts: 210, knockout_pts: 212, awards_pts: 0, double_down_pts:  80, correct_count: 13, total_predictions: 42 },
  { username: "יאניס",             total_points:  448, group_stage_pts: 190, knockout_pts: 178, awards_pts: 0, double_down_pts:  80, correct_count: 11, total_predictions: 42 },
];

export const MOCK_LEADERBOARD: LeaderboardEntry[] = SEED.map((s, i) => ({
  rank: i + 1,
  user_id: `mock-${i + 1}`,
  username: s.username,
  avatar_url: null,
  total_points: s.total_points,
  group_stage_pts: s.group_stage_pts,
  knockout_pts: s.knockout_pts,
  awards_pts: s.awards_pts,
  double_down_pts: s.double_down_pts,
  correct_count: s.correct_count,
  total_predictions: s.total_predictions,
  last_calculated: null,
}));

// MyScoreDetail עבור המשתמש "אוהד" שיושב במקום 7
const meIdx = SEED.findIndex((s) => s.username === "אוהד");
const me = SEED[meIdx];
const next = meIdx > 0 ? SEED[meIdx - 1] : null;
const below = meIdx < SEED.length - 1 ? SEED[meIdx + 1] : null;

export const MOCK_MY_SCORE: MyScoreDetail = {
  rank: meIdx + 1,
  total_users: SEED.length,
  total_points: me.total_points,
  group_stage_pts: me.group_stage_pts,
  knockout_pts: me.knockout_pts,
  awards_pts: me.awards_pts,
  double_down_pts: me.double_down_pts,
  correct_count: me.correct_count,
  total_predictions: me.total_predictions,
  points_to_next: next ? next.total_points - me.total_points : null,
  points_above_below: below ? me.total_points - below.total_points : null,
};
