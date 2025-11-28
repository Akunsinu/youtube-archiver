from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime
import os

from app.db.database import get_db
from app.models.video import Video
from app.schemas.video import VideoResponse, VideoListResponse
from app.services.video_downloader import video_downloader

router = APIRouter()


@router.get("", response_model=VideoListResponse)
async def list_videos(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    sort_by: str = Query("upload_date", regex="^(upload_date|title|view_count|duration)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    downloaded_only: bool = False,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """List videos with filtering and pagination"""
    query = select(Video)

    # Apply filters
    if search:
        query = query.where(
            or_(
                Video.title.ilike(f"%{search}%"),
                Video.description.ilike(f"%{search}%")
            )
        )

    if downloaded_only:
        query = query.where(Video.is_downloaded == True)

    if date_from:
        query = query.where(Video.upload_date >= date_from)

    if date_to:
        query = query.where(Video.upload_date <= date_to)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply sorting
    sort_column = getattr(Video, sort_by)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    videos = result.scalars().all()

    total_pages = (total + per_page - 1) // per_page

    return VideoListResponse(
        videos=[VideoResponse.model_validate(v) for v in videos],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a single video by ID"""
    result = await db.execute(
        select(Video).where(Video.id == video_id)
    )
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    return VideoResponse.model_validate(video)


@router.get("/{video_id}/stream")
async def stream_video(
    video_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Stream a video file"""
    result = await db.execute(
        select(Video).where(Video.id == video_id)
    )
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    if not video.is_downloaded or not video.video_local_path:
        raise HTTPException(status_code=404, detail="Video not downloaded")

    if not os.path.exists(video.video_local_path):
        raise HTTPException(status_code=404, detail="Video file not found")

    return FileResponse(
        video.video_local_path,
        media_type="video/mp4",
        filename=f"{video.youtube_video_id}.mp4"
    )


@router.get("/{video_id}/thumbnail")
async def get_thumbnail(
    video_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a video's thumbnail"""
    result = await db.execute(
        select(Video).where(Video.id == video_id)
    )
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # Try local thumbnail first
    if video.thumbnail_local_path and os.path.exists(video.thumbnail_local_path):
        return FileResponse(
            video.thumbnail_local_path,
            media_type="image/jpeg"
        )

    # Try to get from storage
    thumbnail_path = video_downloader.get_thumbnail_path(video.youtube_video_id)
    if thumbnail_path and thumbnail_path.exists():
        return FileResponse(
            str(thumbnail_path),
            media_type="image/jpeg"
        )

    raise HTTPException(status_code=404, detail="Thumbnail not found")


@router.get("/youtube/{youtube_id}", response_model=VideoResponse)
async def get_video_by_youtube_id(
    youtube_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a video by YouTube video ID"""
    result = await db.execute(
        select(Video).where(Video.youtube_video_id == youtube_id)
    )
    video = result.scalar_one_or_none()

    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    return VideoResponse.model_validate(video)
