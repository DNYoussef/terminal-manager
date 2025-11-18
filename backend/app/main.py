"""
Terminal Manager API
FastAPI application for secure terminal management
"""
import sys
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

# Load environment variables early
from dotenv import load_dotenv
load_dotenv()

# Fix for Windows: Use ProactorEventLoop for subprocess support
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

# Import database initialization
from app.db_setup import init_db

# Import routers
from app.routers import projects, terminals, sessions, mcp, scheduled_tasks, memory, logs, events, best_of_n, metrics, health, scheduled_claude_tasks

# Import scheduler service
from app.services.claude_scheduler import init_scheduler, shutdown_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    print("Starting Terminal Manager API...")

    # Initialize database tables
    init_db()

    # Initialize Claude Code scheduler
    init_scheduler()
    print("Claude Code Scheduler started")

    yield

    # Shutdown
    print("Shutting down Terminal Manager API...")

    # Shutdown scheduler gracefully
    shutdown_scheduler()
    print("Claude Code Scheduler stopped")


# Initialize FastAPI app
app = FastAPI(
    title="Terminal Manager API",
    description="Secure terminal management system with project selection and filesystem browsing",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(projects.router, prefix="/api/v1", tags=["projects"])
app.include_router(terminals.router, prefix="/api/v1", tags=["terminals"])
app.include_router(sessions.router, prefix="/api/v1", tags=["sessions"])
app.include_router(mcp.router, prefix="/api/v1", tags=["mcp"])
app.include_router(scheduled_tasks.router, prefix="/api/v1", tags=["scheduled-tasks"])
app.include_router(memory.router, prefix="/api/v1", tags=["memory"])
app.include_router(logs.router, prefix="/api/v1", tags=["logs"])
app.include_router(events.router, prefix="/api/v1", tags=["events"])
app.include_router(best_of_n.router, tags=["best-of-n"])
app.include_router(metrics.router, prefix="/api/v1", tags=["metrics"])
app.include_router(scheduled_claude_tasks.router, prefix="/api/v1", tags=["scheduled-claude-tasks"])


# Health check endpoint
@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "status": "ok",
        "message": "Terminal Manager API is running",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
