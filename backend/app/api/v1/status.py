from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import os

from app.db.database import get_db
from app.models.video import Video
from app.models.sync import SyncJob, DownloadQueue, ErrorLog
from app.schemas.status import (
    OverallStatus, StorageStats, SyncProgress,
    ErrorLogResponse, ErrorLogListResponse,
    DownloadQueueResponse, DownloadQueueItemResponse
)
from app.tasks.task_manager import task_manager
from app.tasks.scheduler import sync_scheduler
from app.config import settings

router = APIRouter()


def format_bytes(size_bytes: int) -> str:
    """Format bytes to human readable string"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


@router.get("", response_model=OverallStatus)
async def get_overall_status(db: AsyncSession = Depends(get_db)):
    """Get overall system status"""
    # Get storage stats
    total_videos_result = await db.execute(select(func.count(Video.id)))
    total_videos = total_videos_result.scalar()

    downloaded_videos_result = await db.execute(
        select(func.count(Video.id)).where(Video.is_downloaded == True)
    )
    downloaded_videos = downloaded_videos_result.scalar()

    total_size_result = await db.execute(
        select(func.coalesce(func.sum(Video.video_size_bytes), 0))
        .where(Video.is_downloaded == True)
    )
    total_size = total_size_result.scalar() or 0

    storage_stats = StorageStats(
        total_videos=total_videos,
        downloaded_videos=downloaded_videos,
        total_size_bytes=total_size,
        total_size_formatted=format_bytes(total_size)
    )

    # Get sync progress
    current_status = task_manager.get_current_status()
    sync_progress = SyncProgress(
        job_id=current_status.get("job_id"),
        status=current_status.get("status", "idle"),
        job_type=current_status.get("job_type"),
        total_items=current_status.get("total_items", 0),
        processed_items=current_status.get("processed_items", 0),
        current_item=current_status.get("current_item"),
        percent_complete=current_status.get("percent_complete", 0)
    )

    # Get last sync time
    last_sync_result = await db.execute(
        select(SyncJob.completed_at)
        .where(SyncJob.status == "completed")
        .order_by(SyncJob.completed_at.desc())
        .limit(1)
    )
    last_sync = last_sync_result.scalar_one_or_none()

    # Get next auto-sync time
    next_auto_sync = sync_scheduler.get_next_run_time()

    # Get queue length
    queue_result = await db.execute(
        select(func.count(DownloadQueue.id))
        .where(DownloadQueue.status.in_(["queued", "downloading"]))
    )
    queue_length = queue_result.scalar()

    # Get recent errors count
    errors_result = await db.execute(
        select(func.count(ErrorLog.id))
    )
    errors_count = errors_result.scalar()

    return OverallStatus(
        sync_progress=sync_progress,
        storage=storage_stats,
        last_sync=last_sync,
        next_auto_sync=next_auto_sync,
        queue_length=queue_length,
        errors_count=errors_count
    )


@router.get("/queue", response_model=DownloadQueueResponse)
async def get_download_queue(db: AsyncSession = Depends(get_db)):
    """Get download queue status"""
    result = await db.execute(
        select(DownloadQueue, Video)
        .join(Video, DownloadQueue.video_id == Video.id)
        .where(DownloadQueue.status.in_(["queued", "downloading", "failed"]))
        .order_by(DownloadQueue.priority.desc(), DownloadQueue.created_at.asc())
    )
    rows = result.all()

    items = []
    downloading = 0
    queued = 0
    failed = 0

    for queue_item, video in rows:
        items.append(DownloadQueueItemResponse(
            id=queue_item.id,
            video_id=queue_item.video_id,
            video_title=video.title,
            video_youtube_id=video.youtube_video_id,
            status=queue_item.status,
            priority=queue_item.priority,
            progress=queue_item.progress,
            download_speed=queue_item.download_speed,
            eta=queue_item.eta,
            error_message=queue_item.error_message,
            retry_count=queue_item.retry_count,
            created_at=queue_item.created_at,
            started_at=queue_item.started_at
        ))

        if queue_item.status == "downloading":
            downloading += 1
        elif queue_item.status == "queued":
            queued += 1
        elif queue_item.status == "failed":
            failed += 1

    return DownloadQueueResponse(
        items=items,
        total=len(items),
        downloading=downloading,
        queued=queued,
        failed=failed
    )


@router.get("/storage")
async def get_storage_info(db: AsyncSession = Depends(get_db)):
    """Get detailed storage information"""
    # Get total size from database
    total_size_result = await db.execute(
        select(func.coalesce(func.sum(Video.video_size_bytes), 0))
        .where(Video.is_downloaded == True)
    )
    db_total = total_size_result.scalar() or 0

    # Try to get actual disk usage
    disk_total = 0
    disk_free = 0
    try:
        if os.path.exists(settings.storage_path):
            stat = os.statvfs(settings.storage_path)
            disk_total = stat.f_blocks * stat.f_frsize
            disk_free = stat.f_bavail * stat.f_frsize
    except Exception:
        pass

    # Get video count by quality
    quality_result = await db.execute(
        select(Video.video_quality, func.count(Video.id))
        .where(Video.is_downloaded == True)
        .group_by(Video.video_quality)
    )
    quality_breakdown = {row[0] or "unknown": row[1] for row in quality_result.all()}

    return {
        "videos_size_bytes": db_total,
        "videos_size_formatted": format_bytes(db_total),
        "disk_total_bytes": disk_total,
        "disk_total_formatted": format_bytes(disk_total),
        "disk_free_bytes": disk_free,
        "disk_free_formatted": format_bytes(disk_free),
        "disk_used_percent": ((disk_total - disk_free) / disk_total * 100) if disk_total > 0 else 0,
        "quality_breakdown": quality_breakdown
    }


@router.get("/errors", response_model=ErrorLogListResponse)
async def get_error_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get error logs"""
    query = select(ErrorLog).order_by(ErrorLog.created_at.desc())

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    errors = result.scalars().all()

    # Get video titles
    error_responses = []
    for error in errors:
        video_title = None
        if error.video_id:
            video_result = await db.execute(
                select(Video.title).where(Video.id == error.video_id)
            )
            video_title = video_result.scalar_one_or_none()

        error_responses.append(ErrorLogResponse(
            id=error.id,
            sync_job_id=error.sync_job_id,
            video_id=error.video_id,
            video_title=video_title,
            error_type=error.error_type,
            error_message=error.error_message,
            created_at=error.created_at
        ))

    total_pages = (total + per_page - 1) // per_page

    return ErrorLogListResponse(
        errors=error_responses,
        total=total,
        page=page,
        per_page=per_page
    )


@router.delete("/errors")
async def clear_error_logs(db: AsyncSession = Depends(get_db)):
    """Clear all error logs"""
    await db.execute(select(ErrorLog))  # Placeholder
    result = await db.execute(select(ErrorLog))
    errors = result.scalars().all()
    for error in errors:
        await db.delete(error)
    await db.commit()
    return {"status": "cleared"}
