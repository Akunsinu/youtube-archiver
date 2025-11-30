from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, time


class SyncConfigBase(BaseModel):
    auto_sync_enabled: bool = False
    auto_sync_time: Optional[time] = None
    auto_sync_type: str = "new_only"
    max_video_quality: str = "1080p"
    sync_comments: bool = True


class SyncConfigUpdate(SyncConfigBase):
    pass


class SyncConfigResponse(SyncConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SyncJobCreate(BaseModel):
    job_type: str  # 'full', 'new_only', 'metadata', 'comments'
    time_filter: Optional[str] = "all"  # 'week', 'month', 'year', 'all'
    channel_id: int  # Required: which channel to sync


class SyncJobResponse(BaseModel):
    id: int
    job_type: str
    status: str
    time_filter: Optional[str] = None
    channel_id: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_items: int = 0
    processed_items: int = 0
    failed_items: int = 0
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SyncJobListResponse(BaseModel):
    jobs: List[SyncJobResponse]
    total: int
    page: int
    per_page: int


class DownloadQueueItemResponse(BaseModel):
    id: int
    video_id: int
    video_title: Optional[str] = None
    video_youtube_id: Optional[str] = None
    status: str
    priority: int
    progress: float
    download_speed: Optional[str] = None
    eta: Optional[str] = None
    error_message: Optional[str] = None
    retry_count: int
    created_at: datetime
    started_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DownloadQueueResponse(BaseModel):
    items: List[DownloadQueueItemResponse]
    total: int
    downloading: int
    queued: int
    failed: int


class SyncHistoryResponse(BaseModel):
    id: int
    sync_job_id: Optional[int] = None
    videos_synced: int
    comments_synced: int
    storage_used_bytes: int
    duration_seconds: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True
