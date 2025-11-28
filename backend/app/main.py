from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db.database import init_db
from app.api.v1.router import api_router
from app.tasks.task_manager import task_manager
from app.tasks.scheduler import sync_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await task_manager.initialize()
    sync_scheduler.start()
    # Check for incomplete sync jobs to resume
    await task_manager.check_and_resume_sync()
    yield
    # Shutdown
    sync_scheduler.shutdown()
    await task_manager.shutdown()


app = FastAPI(
    title="YouTube Channel Archiver",
    description="Archive and browse YouTube channel content",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
