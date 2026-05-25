"""
Re-score all finished knockout matches with the new rule:
  direction = regular time only (90 min), penalties don't affect match scoring.

Iterates all finished knockout matches → revert + recalculate.
"""
from pathlib import Path
from app.db.supabase import supabase_admin
from app.services import scoring

_lines = []
def p(s=''):
    _lines.append(str(s))

# all finished knockout matches
ko = (
    supabase_admin.table('matches')
    .select('id,stage,team_home,team_away,score_home,score_away,score_home_pen,score_away_pen')
    .in_('stage', ['r32', 'r16', 'qf', 'sf', 'third_place', 'final'])
    .eq('status', 'finished')
    .order('kickoff_utc')
    .execute()
).data or []

p(f'Re-scoring {len(ko)} finished knockout matches\n')

for m in ko:
    mid = m['id']
    # revert
    try:
        rev = scoring.revert_match_score(mid)
        p(f'  match #{mid:3d} ({m["stage"]}): reverted {rev.get("reverted_events", 0)} events')
    except Exception as e:
        p(f'  match #{mid}: revert failed → {e}')
        continue
    # recalc with new rules
    try:
        new = scoring.calculate_match_score(mid)
        pen_info = ''
        if m.get('score_home_pen') is not None:
            pen_info = f' [pen {m["score_home_pen"]}-{m["score_away_pen"]}]'
        p(f'    → {m["score_home"]}-{m["score_away"]}{pen_info}: scored {new.get("predictions_scored", 0)} preds, {new.get("total_points_awarded", 0)} pts (DD: +{new.get("double_down_bonuses", 0)})')
    except Exception as e:
        p(f'    → recalc failed: {e}')

p('\n=== UPDATED LEADERBOARD ===')
game_id = (supabase_admin.table('games').select('id').eq('invite_code', '8FW22JGA').execute()).data[0]['id']
users = supabase_admin.table('users').select('id,username').eq('game_id', game_id).execute().data
rows = []
for u in users:
    sc = supabase_admin.table('scores').select('*').eq('user_id', u['id']).execute().data
    if sc:
        s = sc[0]
        rows.append((u['username'], s.get('total_points', 0), s.get('knockout_pts', 0), s.get('double_down_pts', 0)))
rows.sort(key=lambda r: -r[1])
p(f'{"username":<16}{"total":>7}{"knock":>7}{"dd":>5}')
for r in rows:
    name = r[0]
    pad = 16 - sum(2 if ord(c) > 127 else 1 for c in name)
    p(f'{name}{" "*max(pad,1)}{r[1]:>7}{r[2]:>7}{r[3]:>5}')

Path('resync_out.txt').write_text('\n'.join(_lines), encoding='utf-8')
print('wrote resync_out.txt')
