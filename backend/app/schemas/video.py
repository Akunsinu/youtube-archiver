from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class VideoBase(BaseModel):
    youtube_video_id: str
    title: str
    description: Optional[str] = None
    upload_date: Optional[datetime] = None
    duration: Optional[int] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    comment_count: Optional[int] = None


class VideoCreate(VideoBase):
    channel_id: int


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    comment_count: Optional[int] = None
    is_available: Optional[bool] = None


class VideoResponse(VideoBase):
    id: int
    channel_id: Optional[int] = None
    thumbnail_url: Optional[str] = None
    thumbnail_local_path: Optional[str] = None
    video_local_path: Optional[str] = None
    video_quality: Optional[str] = None
    video_size_bytes: Optional[int] = None
    is_downloaded: bool = False
    is_available: bool = True
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    downloaded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VideoListResponse(BaseModel):
    videos: List[VideoResponse]
    total: int
    page: int
    per_page: int
    total_pages: int


class VideoSearchParams(BaseModel):
    search: Optional[str] = None
    sort_by: str = "upload_date"
    sort_order: str = "desc"
    downloaded_only: bool = False
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
