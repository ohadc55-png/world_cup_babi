"""Final tournament standings."""
from pathlib import Path
from app.db.supabase import supabase_admin

_lines = []
def p(s=''):
    _lines.append(str(s))

game_id = (supabase_admin.table('games').select('id').eq('invite_code', '8FW22JGA').execute()).data[0]['id']
users = supabase_admin.table('users').select('id,username').eq('game_id', game_id).execute().data

p('=== FINAL STANDINGS ===')
rows = []
for u in users:
    sc = supabase_admin.table('scores').select('*').eq('user_id', u['id']).execute().data
    if sc:
        s = sc[0]
        rows.append((
            u['username'],
            s.get('total_points', 0),
            s.get('group_stage_pts', 0),
            s.get('knockout_pts', 0),
            s.get('awards_pts', 0),
            s.get('double_down_pts', 0),
        ))
rows.sort(key=lambda r: -r[1])
medals = ['🥇', '🥈', '🥉', '4.', '5.']
p(f'{"":3}{"username":<16}{"total":>7}{"group":>7}{"knock":>7}{"awards":>7}{"dd":>5}')
for i, r in enumerate(rows):
    medal = medals[i] if i < len(medals) else f'{i+1}.'
    name = r[0]
    pad = 16 - sum(2 if ord(c) > 127 else 1 for c in name)
    p(f'{medal:3}{name}{" "*max(pad,1)}{r[1]:>7}{r[2]:>7}{r[3]:>7}{r[4]:>7}{r[5]:>5}')

p('')
p('=== FINAL MATCH RESULTS ===')
m104 = supabase_admin.table('matches').select('*').eq('id', 104).execute().data[0]
m103 = supabase_admin.table('matches').select('*').eq('id', 103).execute().data[0]
p(f'הגמר #104: {m104["team_home"]} vs {m104["team_away"]} → {m104["score_home"]}-{m104["score_away"]}')
champion = m104["team_home"] if m104["score_home"] > m104["score_away"] else m104["team_away"]
runner_up = m104["team_away"] if m104["score_home"] > m104["score_away"] else m104["team_home"]
p(f'  🏆 אלוף: {champion}')
p(f'  🥈 משנה: {runner_up}')
pen = ''
if m103.get('score_home_pen') is not None:
    pen = f' (pen {m103["score_home_pen"]}-{m103["score_away_pen"]})'
third_winner = m103["team_home"] if (m103["score_home"] > m103["score_away"]) or (m103["score_home"] == m103["score_away"] and (m103.get("score_home_pen") or 0) > (m103.get("score_away_pen") or 0)) else m103["team_away"]
p(f'מקום 3-4 #103: {m103["team_home"]} {m103["score_home"]}-{m103["score_away"]} {m103["team_away"]}{pen}')
p(f'  🥉 שלישית: {third_winner}')

p('')
p('=== USER FINAL POINTS BREAKDOWN ===')
my_user = next((u for u in users if 'אוהד' in u['username']), None)
if my_user:
    final_preds = (
        supabase_admin.table('predictions_matches')
        .select('match_id,direction,score_home,score_away,points_earned')
        .eq('user_id', my_user['id'])
        .in_('match_id', [103, 104])
        .execute()
    ).data or []
    for pred in final_preds:
        m = m104 if pred['match_id'] == 104 else m103
        stage_name = 'הגמר' if pred['match_id'] == 104 else 'מקום 3-4'
        p(f'  {stage_name}: ניחשת {pred["direction"]} ({pred.get("score_home")}-{pred.get("score_away")}) → {pred.get("points_earned") or 0} נק׳')

Path('status_out.txt').write_text('\n'.join(_lines), encoding='utf-8')
print('wrote status_out.txt')
