// טיפוסים של ה-API שאנחנו מקבלים מה-backend
// בדומה ל-Pydantic models בצד השרת, אבל ב-TypeScript

export type AuthSuccessResponse = {
  token: string;
  user_id: string;
  username: string;
  is_admin: boolean;
  avatar_url: string | null;
  game_id: string | null;
};

export type CurrentUser = {
  id: string;
  username: string;
  is_admin: boolean;
  game_id: string | null;
  avatar_url: string | null;
  created_at: string | null;
  // true אם המשתמש בחלון חסד שמאפשר עריכת ניחושי טווח-ארוך אחרי תחילת הטורניר
  longterm_grace_active: boolean;
};

// ============================================
// Push notification preferences
// ============================================

export type NotificationPrefs = {
  reminder: boolean;
  result: boolean;
  overtaken: boolean;
  kickoff: boolean;
  stage: boolean;
  weekly: boolean;
};

export type PrefsResponse = {
  has_subscription: boolean;
  prefs: NotificationPrefs;
};

// ============================================
// Games (multi-tenant)
// ============================================

export type Game = {
  id: string;
  name: string;
  invite_code: string;
  owner_user_id: string;
  is_owner: boolean;
  member_count: number;
  created_at: string;
  tournament_has_started: boolean;
};

// טיפוס לשגיאה מה-API
export type ApiError = {
  detail: string | { msg: string; loc: string[] }[];
};

// ============================================
// Matches
// ============================================

export type Stage = "group" | "r32" | "r16" | "qf" | "sf" | "third_place" | "final";

export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

export type Match = {
  id: number;
  stage: Stage;
  group_name: string | null;
  group_round: number | null;
  match_number: number | null;
  team_home: string;
  team_away: string;
  team_home_fifa_rank: number | null;
  team_away_fifa_rank: number | null;
  kickoff_utc: string; // ISO 8601 from server
  venue: string | null;
  status: MatchStatus;
  score_home: number | null;
  score_away: number | null;
  score_home_ht: number | null;
  score_away_ht: number | null;
  score_home_pen: number | null;   // פנדלים (NULL אם המשחק לא הסתיים בפנדלים)
  score_away_pen: number | null;
  finished_at: string | null;
  predictions_locked: boolean;
  display_clock: string | null;    // "67'", "45+2'", "HT" — רק במשחק חי
  updated_at: string;
};

// ============================================
// Match events — goals + red cards from ESPN
// ============================================

export type MatchEvent = {
  id: string;
  event_type: "goal" | "red_card";
  minute: string;             // "21'", "45+2'"
  minute_value: number;       // לסידור כרונולוגי
  team: "home" | "away";
  primary_player: string;     // שם המשער או מקבל הכרטיס
  assister: string | null;    // רק לשערים
  is_penalty: boolean;
  is_own_goal: boolean;
};

// ============================================
// Tournament top athletes — מלך שערים + מלך בישולים
// ============================================

export type PlayerStat = {
  rank: number;
  player_name: string;
  team_name: string | null;
  matches: number;
  value: number;                  // goals או assists
  display_value: string | null;   // "Matches: 5, Goals: 7"
};

// ============================================
// Predictions
// ============================================

export type Direction = "1" | "X" | "2";

export type MatchPrediction = {
  id: string;
  match_id: number;
  direction: Direction;
  score_home: number | null;
  score_away: number | null;
  locked_at: string | null;
  updated_at: string;
  points_earned: number | null;
  points_breakdown: Record<string, unknown> | null;
};

export type DDStatus = "available" | "active" | "used";
export type RoundKey = "group_r1" | "group_r2" | "group_r3" | "r32" | "r16" | "qf" | "sf" | "final";

export type DoubleDownToken = {
  id: string;
  round_key: RoundKey;
  match_id: number | null;
  status: DDStatus;
  points_earned: number | null;
  activated_at: string | null;
  finalized_at: string | null;
};

export type GroupPrediction = {
  group_name: string;
  team_1st: string;
  team_2nd: string;
  team_3rd: string;
  team_4th: string;
  locked_at: string | null;
  updated_at: string;
  points_earned: number | null;
  points_breakdown: Record<string, unknown> | null;
};

// ============================================
// Public match predictions (visible to all members of game after lock)
// ============================================

export type MemberPrediction = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  direction: Direction | null;
  score_home: number | null;
  score_away: number | null;
  points_earned: number | null;
  points_breakdown: Record<string, number> | null;
  has_double_down: boolean;
  is_me: boolean;
};

// ============================================
// Leaderboard
// ============================================

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_points: number;
  group_stage_pts: number;
  knockout_pts: number;
  awards_pts: number;
  double_down_pts: number;
  correct_count: number;
  total_predictions: number;
  last_calculated: string | null;
};

export type MyScoreDetail = {
  rank: number | null;
  total_users: number;
  total_points: number;
  group_stage_pts: number;
  knockout_pts: number;
  awards_pts: number;
  double_down_pts: number;
  correct_count: number;
  total_predictions: number;
  points_to_next: number | null;
  points_above_below: number | null;
};

// ============================================
// Leaderboard timeline (Bumps Chart — last 5 finished matches)
// ============================================

export type TimelineResult = "exact" | "direction" | "miss";

export type TimelineCheckpoint = {
  match_id: number;
  label: string;       // "POR-CGO"
  sub_label: string;   // "מ3" / "R32" / "1/4" / ...
  finished_at: string; // ISO 8601
};

export type TimelineMember = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_me: boolean;
  ranks: number[];          // 1 = first place; aligned with checkpoints
  pts: number[];            // cumulative points after each checkpoint
  results: TimelineResult[];
};

export type TimelineResponse = {
  checkpoints: TimelineCheckpoint[];   // empty if <2 finished matches
  members: TimelineMember[];
};

export type TournamentPredictions = {
  winner: string | null;
  finalist_1: string | null;
  finalist_2: string | null;
  semifinalist_1: string | null;
  semifinalist_2: string | null;
  semifinalist_3: string | null;
  semifinalist_4: string | null;
  top_scorer: string | null;
  top_assister: string | null;
  golden_ball: string | null;
  locked_at: string | null;
  updated_at: string;
  points_earned: number | null;
  points_breakdown: Record<string, unknown> | null;
};

// ניחושי טווח-ארוך של חבר אחר בקבוצה — לתצוגת "מי ניחש מה"
export type MemberTournamentPrediction = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  // קבוצות
  winner: string | null;
  finalist_1: string | null;
  finalist_2: string | null;
  semifinalist_1: string | null;
  semifinalist_2: string | null;
  semifinalist_3: string | null;
  semifinalist_4: string | null;
  // שחקנים — טקסט גולמי + שם קנוני אופציונלי
  top_scorer: string | null;
  top_scorer_canonical: string | null;
  top_assister: string | null;
  top_assister_canonical: string | null;
  golden_ball: string | null;
};

// ============================================
// User profile (public view of another member)
// ============================================

export type UserScore = {
  total_points: number;
  group_stage_pts: number;
  knockout_pts: number;
  awards_pts: number;
  double_down_pts: number;
  correct_count: number;
  total_predictions: number;
  rank: number | null;
};

export type ProfileMatchPrediction = {
  match_id: number;
  stage: Stage;
  group_name: string | null;
  group_round: number | null;
  kickoff_utc: string;
  team_home: string;
  team_away: string;
  match_status: MatchStatus;
  match_score_home: number | null;
  match_score_away: number | null;
  match_score_home_pen: number | null;
  match_score_away_pen: number | null;
  direction: Direction | null;
  pred_score_home: number | null;
  pred_score_away: number | null;
  points_earned: number | null;
  has_double_down: boolean;
};

export type ProfileGroupPrediction = {
  group_name: string;
  team_1st: string | null;
  team_2nd: string | null;
  team_3rd: string | null;
  team_4th: string | null;
  points_earned: number | null;
  locked_at: string | null;
};

export type ProfileTournament = {
  winner: string | null;
  finalist_1: string | null;
  finalist_2: string | null;
  semifinalist_1: string | null;
  semifinalist_2: string | null;
  semifinalist_3: string | null;
  semifinalist_4: string | null;
  top_scorer: string | null;
  top_assister: string | null;
  golden_ball: string | null;
  points_earned: number | null;
};

// ============================================
// Group standings (live tables for group stage)
// ============================================

export type TeamStanding = {
  position: number;        // 1..4
  team: string;            // English name (map to Hebrew via getTeamInfo)
  played: number;          // P
  won: number;             // W
  drawn: number;           // D
  lost: number;            // L
  goals_for: number;       // GF
  goals_against: number;   // GA
  goal_diff: number;       // GD
  points: number;          // Pts
};

export type GroupStanding = {
  group_name: string;      // A..L
  matches_played: number;  // 0..6
  matches_total: number;   // always 6
  is_complete: boolean;
  table: TeamStanding[];
};

// ============================================
// AI Agent (Phase 8)
// ============================================

export type AgentRole = "user" | "assistant";

export type AgentMessage = {
  role: AgentRole;
  content: string;
};

export type AgentChatResponse = {
  response: string;
};

export type AgentHistoryResponse = {
  messages: AgentMessage[];
  welcome: string | null;
  suggestions: string[];
};

export type UserProfile = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_me: boolean;
  is_owner: boolean;
  tournament_has_started: boolean;
  score: UserScore;
  match_predictions: ProfileMatchPrediction[];
  group_predictions: ProfileGroupPrediction[];
  tournament_predictions: ProfileTournament | null;
};

