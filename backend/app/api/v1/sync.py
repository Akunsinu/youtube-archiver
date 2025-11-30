from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import time

from app.db.database import get_db
from app.models.sync import SyncConfig, SyncJob, SyncHistory
from app.schemas.sync import (
    SyncConfigResponse, SyncConfigUpdate, SyncJobCreate,
    SyncJobResponse, SyncJobListResponse, SyncHistoryResponse
)
from app.tasks.task_manager import task_manager
from app.tasks.scheduler import sync_scheduler

router = APIRouter()


@router.post("/start", response_model=SyncJobResponse)
async def start_sync(
    job: SyncJobCreate,
    db: AsyncSession = Depends(get_db)
):
    """Start a new sync job for a specific channel"""
    try:
        job_id = await task_manager.start_sync(
            job_type=job.job_type,
            time_filter=job.time_filter or "all",
            channel_id=job.channel_id
        )

        result = await db.execute(
            select(SyncJob).where(SyncJob.id == job_id)
        )
        sync_job = result.scalar_one_or_none()

        return SyncJobResponse.model_validate(sync_job)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/stop")
async def stop_sync():
    """Stop the current sync job"""
    await task_manager.stop_sync()
    return {"status": "stopped"}


@router.get("/status")
async def get_sync_status():
    """Get current sync status"""
    return task_manager.get_current_status()


@router.get("/config", response_model=SyncConfigResponse)
async def get_sync_config(db: AsyncSession = Depends(get_db)):
    """Get sync configuration"""
    result = await db.execute(select(SyncConfig).limit(1))
    config = result.scalar_one_or_none()

    if not config:
        # Create default config
        config = SyncConfig()
        db.add(config)
        await db.commit()
        await db.refresh(config)

    return SyncConfigResponse.model_validate(config)


@router.put("/config", response_model=SyncConfigResponse)
async def update_sync_config(
    config_update: SyncConfigUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update sync configuration"""
    result = await db.execute(select(SyncConfig).limit(1))
    config = result.scalar_one_or_none()

    if not config:
        config = SyncConfig()
        db.add(config)

    # Update fields
    config.auto_sync_enabled = config_update.auto_sync_enabled
    config.auto_sync_time = config_update.auto_sync_time
    config.auto_sync_type = config_update.auto_sync_type
    config.max_video_quality = config_update.max_video_quality
    config.sync_comments = config_update.sync_comments

    await db.commit()
    await db.refresh(config)

    # Update scheduler
    sync_scheduler.configure(
        enabled=config.auto_sync_enabled,
        sync_time=config.auto_sync_time,
        sync_type=config.auto_sync_type
    )

    return SyncConfigResponse.model_validate(config)


@router.get("/history", response_model=SyncJobListResponse)
async def get_sync_history(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get sync job history"""
    query = select(SyncJob).order_by(SyncJob.created_at.desc())

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    jobs = result.scalars().all()

    return SyncJobListResponse(
        jobs=[SyncJobResponse.model_validate(j) for j in jobs],
        total=total,
        page=page,
        per_page=per_page
    )


@router.get("/job/{job_id}", response_model=SyncJobResponse)
async def get_sync_job(
    job_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific sync job"""
    result = await db.execute(
        select(SyncJob).where(SyncJob.id == job_id)
    )
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return SyncJobResponse.model_validate(job)
