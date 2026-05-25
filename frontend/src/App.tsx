// הקומפוננטה הראשית — מגדירה את כל ה-routes.
//
// זרימת המסכים (multi-game model 2026-05-23):
//   public:    /login (username+PIN), /onboarding (signup), /splash
//   protected: /game-select (אם user.game_id == null)
//              /home, /predictions, /leaderboard, /bracket, /profile (אם יש game)
//
// אם user.game_id == null — תמיד מנותב ל-/game-select.
// אם user.game_id != null — תמיד מנותב ל-/home (לא יכול להגיע ל-/game-select בטעות).

import { Navigate, Route, Routes, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/layout/BottomNav";
import { IOSInstallBanner } from "@/components/layout/IOSInstallBanner";
import { Splash } from "@/pages/Splash";
import { Login } from "@/pages/Login";
import { Onboarding } from "@/pages/Onboarding";
import { GameSelect } from "@/pages/GameSelect";
import { Home } from "@/pages/Home";
import { Predictions } from "@/pages/Predictions";
import { Leaderboard } from "@/pages/Leaderboard";
import { Bracket } from "@/pages/Bracket";
import { Profile } from "@/pages/Profile";
import { Rules } from "@/pages/Rules";
import { MatchDetail } from "@/pages/MatchDetail";
import { UserProfile } from "@/pages/UserProfile";
import { GroupDetail } from "@/pages/GroupDetail";
import { AgentButton } from "@/components/agent/AgentButton";

// Layout למסכים שדורשים user מחובר + game
function ProtectedLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <Splash />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.game_id) return <Navigate to="/game-select" replace />;

  return (
    <>
      <Outlet />
      <AgentButton />
      <BottomNav />
    </>
  );
}

// Layout למסך GameSelect — דורש user מחובר, אבל בלי game
function GameSelectGate() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <Splash />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // אם כבר יש game — לא חוקי להישאר ב-/game-select
  if (user?.game_id) return <Navigate to="/home" replace />;

  return <Outlet />;
}

// Layout למסכים ציבוריים (login, onboarding)
function PublicLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <Splash />;
  if (isAuthenticated) {
    return <Navigate to={user?.game_id ? "/home" : "/game-select"} replace />;
  }
  return <Outlet />;
}

export function App() {
  return (
    <>
    <IOSInstallBanner />
    <Routes>
      <Route path="/splash" element={<Splash />} />

      <Route element={<PublicLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={<Onboarding />} />
      </Route>

      <Route element={<GameSelectGate />}>
        <Route path="/game-select" element={<GameSelect />} />
      </Route>

      <Route element={<ProtectedLayout />}>
        <Route path="/home" element={<Home />} />
        <Route path="/predictions" element={<Predictions />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/bracket" element={<Bracket />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/match/:id" element={<MatchDetail />} />
        <Route path="/user/:id" element={<UserProfile />} />
        <Route path="/group/:name" element={<GroupDetail />} />
      </Route>

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
    </>
  );
}
