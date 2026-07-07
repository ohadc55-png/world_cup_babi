"""FastAPI entry point for Mundial 2026."""
import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.crons.lock_predictions import lock_predictions_now
from app.crons.sync_player_stats import sync_player_stats_now
from app.crons.sync_results import sync_all_active
from app.routes import admin as admin_routes
from app.routes import auth as auth_routes
from app.routes import games as games_routes
from app.routes import leaderboard as leaderboard_routes
from app.routes import matches as matches_routes
from app.routes import predictions as predictions_routes
from app.routes import push as push_routes
from app.routes import users as users_routes
from app.routes import groups as groups_routes
from app.routes import agent as agent_routes
from app.routes import tournament as tournament_routes

logger = logging.getLogger(__name__)


# ============================================================
# In-process scheduler (replaces external Railway crons)
# ============================================================
# 2 background jobs run inside the FastAPI process:
#   - sync_results: every 2 min, pulls ESPN scores into DB
#   - lock_predictions: every 5 min, locks predictions 30 min before kickoff
#
# Gated on ENVIRONMENT=production so local --reload dev doesn't double-schedule.
# If a job crashes, the next cycle still runs (try/except per iteration).
# IMPORTANT: assumes single-replica deployment. If Railway ever scales to
# multiple instances, each will run these jobs — add a DB advisory lock then.

# Watchdog: a hung socket inside fn (e.g. a push provider that never answers)
# would otherwise freeze that job's loop forever — the thread can't be killed,
# but timing out lets the next cycle run instead of silently stopping syncs.
JOB_TIMEOUT_SECONDS = 600


async def _every(seconds: int, name: str, fn) -> None:
    """Run sync fn() every `seconds` seconds; errors don't kill the loop."""
    await asyncio.sleep(20)  # let startup settle before first run
    while True:
        try:
            result = await asyncio.wait_for(asyncio.to_thread(fn), timeout=JOB_TIMEOUT_SECONDS)
            logger.info(f"[scheduler] {name}: {result}")
        except asyncio.TimeoutError:
            logger.error(f"[scheduler] {name} timed out after {JOB_TIMEOUT_SECONDS}s (will retry next cycle)")
        except Exception:
            logger.exception(f"[scheduler] {name} crashed (will retry next cycle)")
        await asyncio.sleep(seconds)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    tasks: list[asyncio.Task] = []
    if settings.ENVIRONMENT == "production":
        tasks = [
            asyncio.create_task(_every(120, "sync_results", sync_all_active)),
            asyncio.create_task(_every(300, "lock_predictions", lock_predictions_now)),
            asyncio.create_task(_every(3600, "sync_player_stats", sync_player_stats_now)),
        ]
        logger.info("[scheduler] started 3 background jobs")
    else:
        logger.info(f"[scheduler] disabled (ENVIRONMENT={settings.ENVIRONMENT})")
    try:
        yield
    finally:
        for t in tasks:
            t.cancel()
        for t in tasks:
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass


app = FastAPI(
    title="Mundial 2026 API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(games_routes.router)
app.include_router(matches_routes.router)
app.include_router(predictions_routes.router)
app.include_router(leaderboard_routes.router)
app.include_router(admin_routes.router)
app.include_router(push_routes.router)
app.include_router(users_routes.router)
app.include_router(groups_routes.router)
app.include_router(agent_routes.router)
app.include_router(tournament_routes.router)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "env": settings.ENVIRONMENT,
        # Railway injects the deployed commit — lets us verify which code is live
        "version": os.getenv("RAILWAY_GIT_COMMIT_SHA", "unknown")[:12],
    }
