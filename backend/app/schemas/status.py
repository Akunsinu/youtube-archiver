from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class StorageStats(BaseModel):
    total_videos: int
    downloaded_videos: int
    total_size_bytes: int
    total_size_formatted: str


class SyncProgress(BaseModel):
    job_id: Optional[int] = None
    status: str  # 'idle', 'syncing', 'downloading'
    job_type: Optional[str] = None
    total_items: int = 0
    processed_items: int = 0
    current_item: Optional[str] = None
    percent_complete: float = 0


class OverallStatus(BaseModel):
    sync_progress: SyncProgress
    storage: StorageStats
    last_sync: Optional[datetime] = None
    next_auto_sync: Optional[datetime] = None
    queue_length: int = 0
    errors_count: int = 0


class ErrorLogResponse(BaseModel):
    id: int
    sync_job_id: Optional[int] = None
    video_id: Optional[int] = None
    video_title: Optional[str] = None
    error_type: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ErrorLogListResponse(BaseModel):
    errors: List[ErrorLogResponse]
    total: int
    page: int
    per_page: int


# WebSocket message types
class WSMessage(BaseModel):
    type: str  # 'sync_progress', 'download_progress', 'sync_completed', 'error', 'queue_update'
    data: dict


class WSSyncProgress(BaseModel):
    job_id: int
    total: int
    processed: int
    current_video: Optional[str] = None
    percent_complete: float


class WSDownloadProgress(BaseModel):
    video_id: int
    youtube_id: str
    title: str
    progress: float
    speed: Optional[str] = None
    eta: Optional[str] = None
    status: str


class WSQueueUpdate(BaseModel):
    queue_length: int
    downloading: int
    current_download: Optional[str] = None
