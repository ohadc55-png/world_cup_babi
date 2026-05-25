"""FastAPI entry point for Mundial 2026."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
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


app = FastAPI(
    title="Mundial 2026 API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
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


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.ENVIRONMENT}
