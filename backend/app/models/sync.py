from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float, Time, ForeignKey
from sqlalchemy.sql import func
from app.db.database import Base


class SyncConfig(Base):
    __tablename__ = "sync_config"

    id = Column(Integer, primary_key=True, index=True)
    auto_sync_enabled = Column(Boolean, default=False)
    auto_sync_time = Column(Time)  # e.g., 03:00:00
    auto_sync_type = Column(String(20), default="new_only")  # 'new_only', 'full'
    max_video_quality = Column(String(10), default="1080p")
    sync_comments = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id = Column(Integer, primary_key=True, index=True)
    job_type = Column(String(50), nullable=False)  # 'full', 'new_only', 'metadata', 'comments'
    status = Column(String(20), default="pending", index=True)  # 'pending', 'running', 'completed', 'failed', 'cancelled'
    time_filter = Column(String(20))  # 'week', 'month', 'year', 'all'
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    total_items = Column(Integer, default=0)
    processed_items = Column(Integer, default=0)
    failed_items = Column(Integer, default=0)
    error_message = Column(Text)
    resume_from = Column(String(50))  # video_id to resume from
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class DownloadQueue(Base):
    __tablename__ = "download_queue"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"))
    sync_job_id = Column(Integer, ForeignKey("sync_jobs.id", ondelete="SET NULL"))
    status = Column(String(20), default="queued", index=True)  # 'queued', 'downloading', 'completed', 'failed', 'cancelled'
    priority = Column(Integer, default=0)
    progress = Column(Float, default=0)  # 0-100
    download_speed = Column(String(50))  # e.g., "5.2 MB/s"
    eta = Column(String(50))  # e.g., "2m 30s"
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))


class ErrorLog(Base):
    __tablename__ = "error_logs"

    id = Column(Integer, primary_key=True, index=True)
    sync_job_id = Column(Integer, ForeignKey("sync_jobs.id", ondelete="SET NULL"))
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="SET NULL"))
    error_type = Column(String(100))
    error_message = Column(Text)
    stack_trace = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class SyncHistory(Base):
    __tablename__ = "sync_history"

    id = Column(Integer, primary_key=True, index=True)
    sync_job_id = Column(Integer, ForeignKey("sync_jobs.id", ondelete="SET NULL"))
    videos_synced = Column(Integer, default=0)
    comments_synced = Column(Integer, default=0)
    storage_used_bytes = Column(Integer, default=0)
    duration_seconds = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
