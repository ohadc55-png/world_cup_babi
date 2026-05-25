# Mundial 2026 Bracket App

PWA פרטית לקבוצת חברים לניחוש תוצאות מונדיאל 2026.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Python 3.11 (my_conda) + FastAPI + Uvicorn
- **DB + Auth + Realtime + Storage:** Supabase (PostgreSQL)
- **Push Notifications:** pywebpush (Web Push native)
- **Hosting:** Railway

## Development

### Backend

```bash
conda activate my_conda
cd backend
uvicorn app.main:app --reload
```

→ Swagger UI: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm run dev
```

→ http://localhost:5173

## Phase Status

- [x] Phase 0 — Bootstrap (directory + deps + .env)
- [ ] Phase 1 — Backend Foundation (auth + Supabase)
- [ ] Phase 2 — Frontend Foundation (Vite + RTL + login)
- [ ] Phase 3 — PWA + Push Foundation
- [ ] Phase 4 — Fixtures + Predictions
- [ ] Phase 5 — Live Data + Scoring
- [ ] Phase 6 — Social + Notifications + Polish
- [ ] Phase 7 — Demo Mode + Deploy + Real Device QA

Plan: `~/.claude/plans/breezy-launching-acorn.md`
