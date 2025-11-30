import asyncio
import logging
from typing import Optional, List, Set, Dict, Any
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum

from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal
from app.models.sync import SyncJob, DownloadQueue, SyncConfig, ErrorLog, SyncHistory
from app.models.video import Video
from app.models.channel import Channel
from app.models.comment import Comment
from app.services.youtube_api import youtube_api
from app.services.video_downloader import video_downloader

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    IDLE = "idle"
    SYNCING = "syncing"
    DOWNLOADING = "downloading"


@dataclass
class SyncProgress:
    job_id: Optional[int] = None
    status: TaskStatus = TaskStatus.IDLE
    job_type: Optional[str] = None
    channel_id: Optional[int] = None
    total_items: int = 0
    processed_items: int = 0
    current_item: Optional[str] = None
    error: Optional[str] = None


@dataclass
class DownloadProgress:
    video_id: int
    youtube_id: str
    title: str
    progress: float = 0
    speed: Optional[str] = None
    eta: Optional[str] = None
    status: str = "queued"


class TaskManager:
    def __init__(self):
        self.current_task: Optional[asyncio.Task] = None
        self.sync_progress: SyncProgress = SyncProgress()
        self.download_progress: Dict[int, DownloadProgress] = {}
        self.websocket_connections: Set = set()
        self.cancel_requested: bool = False
        self._initialized: bool = False

    async def initialize(self):
        """Initialize the task manager"""
        self._initialized = True
        logger.info("TaskManager initialized")

    async def shutdown(self):
        """Shutdown the task manager"""
        if self.current_task and not self.current_task.done():
            self.cancel_requested = True
            self.current_task.cancel()
            try:
                await self.current_task
            except asyncio.CancelledError:
                pass
        self._initialized = False
        logger.info("TaskManager shutdown")

    def add_websocket(self, websocket):
        """Add a WebSocket connection"""
        self.websocket_connections.add(websocket)

    def remove_websocket(self, websocket):
        """Remove a WebSocket connection"""
        self.websocket_connections.discard(websocket)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected WebSocket clients"""
        disconnected = set()
        for ws in self.websocket_connections:
            try:
                await ws.send_json(message)
            except Exception:
                disconnected.add(ws)
        self.websocket_connections -= disconnected

    async def check_and_resume_sync(self):
        """Check for incomplete sync jobs and resume them"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SyncJob).where(SyncJob.status == "running")
            )
            incomplete_job = result.scalar_one_or_none()

            if incomplete_job:
                logger.info(f"Resuming incomplete sync job {incomplete_job.id}")
                # Don't await - let it run in background
                asyncio.create_task(
                    self._resume_sync(incomplete_job.id)
                )

    async def _resume_sync(self, job_id: int):
        """Resume an incomplete sync job"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SyncJob).where(SyncJob.id == job_id)
            )
            job = result.scalar_one_or_none()

            if job and job.channel_id:
                await self.start_sync(
                    job_type=job.job_type,
                    time_filter=job.time_filter,
                    channel_id=job.channel_id,
                    resume_job_id=job_id
                )

    async def start_sync(
        self,
        job_type: str,
        time_filter: str = "all",
        channel_id: Optional[int] = None,
        resume_job_id: Optional[int] = None
    ) -> int:
        """Start a new sync job for a specific channel"""
        if self.current_task and not self.current_task.done():
            raise Exception("A sync is already in progress")

        if not channel_id and not resume_job_id:
            raise Exception("channel_id is required")

        self.cancel_requested = False

        async with AsyncSessionLocal() as db:
            if resume_job_id:
                result = await db.execute(
                    select(SyncJob).where(SyncJob.id == resume_job_id)
                )
                job = result.scalar_one_or_none()
                if not job:
                    raise Exception(f"Job {resume_job_id} not found")
                channel_id = job.channel_id
            else:
                # Verify channel exists
                channel_result = await db.execute(
                    select(Channel).where(Channel.id == channel_id)
                )
                if not channel_result.scalar_one_or_none():
                    raise Exception(f"Channel {channel_id} not found")

                job = SyncJob(
                    job_type=job_type,
                    time_filter=time_filter,
                    channel_id=channel_id,
                    status="running",
                    started_at=datetime.utcnow()
                )
                db.add(job)
                await db.commit()
                await db.refresh(job)

            job_id = job.id

        self.sync_progress = SyncProgress(
            job_id=job_id,
            status=TaskStatus.SYNCING,
            job_type=job_type,
            channel_id=channel_id
        )

        self.current_task = asyncio.create_task(
            self._run_sync(job_id, job_type, time_filter, channel_id)
        )

        return job_id

    async def stop_sync(self):
        """Stop the current sync job"""
        if self.current_task and not self.current_task.done():
            self.cancel_requested = True
            self.current_task.cancel()

            async with AsyncSessionLocal() as db:
                if self.sync_progress.job_id:
                    await db.execute(
                        update(SyncJob)
                        .where(SyncJob.id == self.sync_progress.job_id)
                        .values(status="cancelled", completed_at=datetime.utcnow())
                    )
                    await db.commit()

            await self.broadcast({
                "type": "sync_cancelled",
                "data": {"job_id": self.sync_progress.job_id}
            })

            self.sync_progress = SyncProgress()

    async def _run_sync(self, job_id: int, job_type: str, time_filter: str, channel_id: int):
        """Main sync orchestration"""
        try:
            async with AsyncSessionLocal() as db:
                # Get the specific channel
                result = await db.execute(
                    select(Channel).where(Channel.id == channel_id)
                )
                channel = result.scalar_one_or_none()

                if not channel:
                    raise Exception(f"Channel {channel_id} not found")

                # Update channel info first
                await self._sync_channel_info(db, channel)

                if self.cancel_requested:
                    return

                # Get videos list from YouTube
                time_filter_date = youtube_api.get_time_filter_date(time_filter)
                videos_to_sync = await self._fetch_video_list(
                    db, channel, time_filter_date, job_type
                )

                if self.cancel_requested:
                    return

                self.sync_progress.total_items = len(videos_to_sync)
                await self._update_job_progress(db, job_id)

                # Process videos
                for i, video_data in enumerate(videos_to_sync):
                    if self.cancel_requested:
                        break

                    self.sync_progress.current_item = video_data.get("title", "Unknown")
                    await self.broadcast({
                        "type": "sync_progress",
                        "data": {
                            "job_id": job_id,
                            "total": self.sync_progress.total_items,
                            "processed": self.sync_progress.processed_items,
                            "current_video": self.sync_progress.current_item,
                            "percent_complete": (i / len(videos_to_sync)) * 100 if videos_to_sync else 0
                        }
                    })

                    try:
                        await self._process_video(db, channel, video_data, job_type, job_id)
                    except Exception as e:
                        logger.error(f"Error processing video {video_data.get('youtube_video_id')}: {e}")
                        await self._log_error(db, job_id, None, str(e))

                    self.sync_progress.processed_items += 1
                    await self._update_job_progress(db, job_id)

                # Complete the job
                await db.execute(
                    update(SyncJob)
                    .where(SyncJob.id == job_id)
                    .values(
                        status="completed",
                        completed_at=datetime.utcnow()
                    )
                )
                await db.commit()

                # Create sync history entry
                history = SyncHistory(
                    sync_job_id=job_id,
                    videos_synced=self.sync_progress.processed_items,
                    duration_seconds=int(
                        (datetime.utcnow() - (await self._get_job_start_time(db, job_id))).total_seconds()
                    )
                )
                db.add(history)
                await db.commit()

                await self.broadcast({
                    "type": "sync_completed",
                    "data": {
                        "job_id": job_id,
                        "total_synced": self.sync_progress.processed_items
                    }
                })

        except asyncio.CancelledError:
            logger.info(f"Sync job {job_id} was cancelled")
            raise
        except Exception as e:
            logger.error(f"Sync job {job_id} failed: {e}")
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(SyncJob)
                    .where(SyncJob.id == job_id)
                    .values(
                        status="failed",
                        error_message=str(e),
                        completed_at=datetime.utcnow()
                    )
                )
                await db.commit()

            await self.broadcast({
                "type": "sync_error",
                "data": {"job_id": job_id, "error": str(e)}
            })
        finally:
            self.sync_progress = SyncProgress()

    async def _sync_channel_info(self, db: AsyncSession, channel: Channel):
        """Update channel information from YouTube"""
        try:
            info = await youtube_api.get_channel_info(channel.youtube_channel_id)
            if info:
                channel.title = info.get("title", channel.title)
                channel.description = info.get("description")
                channel.subscriber_count = info.get("subscriber_count")
                channel.video_count = info.get("video_count")
                channel.view_count = info.get("view_count")
                channel.avatar_url = info.get("avatar_url")
                channel.banner_url = info.get("banner_url")
                await db.commit()
        except Exception as e:
            logger.error(f"Error syncing channel info: {e}")

    async def _fetch_video_list(
        self,
        db: AsyncSession,
        channel: Channel,
        published_after: Optional[datetime],
        job_type: str
    ) -> List[Dict[str, Any]]:
        """Fetch list of videos to sync"""
        all_videos = []
        page_token = None

        while True:
            if self.cancel_requested:
                break

            result = await youtube_api.get_channel_videos(
                channel.youtube_channel_id,
                max_results=50,
                published_after=published_after,
                page_token=page_token
            )

            videos = result.get("videos", [])
            all_videos.extend(videos)

            page_token = result.get("next_page_token")
            if not page_token:
                break

        # For 'new_only', filter out already downloaded videos
        if job_type == "new_only":
            existing_ids = set()
            result = await db.execute(
                select(Video.youtube_video_id).where(Video.is_downloaded == True)
            )
            existing_ids = {row[0] for row in result.fetchall()}
            all_videos = [v for v in all_videos if v["youtube_video_id"] not in existing_ids]

        return all_videos

    async def _process_video(
        self,
        db: AsyncSession,
        channel: Channel,
        video_data: Dict[str, Any],
        job_type: str,
        job_id: int
    ):
        """Process a single video (metadata, download, comments)"""
        youtube_id = video_data["youtube_video_id"]

        # Get detailed info
        details = await youtube_api.get_video_details([youtube_id])
        if details:
            video_data.update(details[0])

        # Check if video exists
        result = await db.execute(
            select(Video).where(Video.youtube_video_id == youtube_id)
        )
        video = result.scalar_one_or_none()

        if video:
            # Update metadata
            video.title = video_data.get("title", video.title)
            video.description = video_data.get("description")
            video.view_count = video_data.get("view_count")
            video.like_count = video_data.get("like_count")
            video.comment_count = video_data.get("comment_count")
            video.metadata_updated_at = datetime.utcnow()
        else:
            # Create new video
            video = Video(
                youtube_video_id=youtube_id,
                channel_id=channel.id,
                title=video_data.get("title", ""),
                description=video_data.get("description"),
                upload_date=video_data.get("upload_date"),
                duration=video_data.get("duration"),
                view_count=video_data.get("view_count"),
                like_count=video_data.get("like_count"),
                comment_count=video_data.get("comment_count"),
                thumbnail_url=video_data.get("thumbnail_url"),
                tags=video_data.get("tags"),
                category=video_data.get("category"),
            )
            db.add(video)

        await db.commit()
        await db.refresh(video)

        # Download video if needed
        if job_type in ["full", "new_only"] and not video.is_downloaded:
            await self._download_video(db, video, job_id)

        # Sync comments if needed
        if job_type in ["full", "new_only", "comments"]:
            await self._sync_comments(db, video)

    async def _download_video(self, db: AsyncSession, video: Video, job_id: int):
        """Download a video"""
        self.sync_progress.status = TaskStatus.DOWNLOADING

        async def progress_callback(progress: Dict[str, Any]):
            self.download_progress[video.id] = DownloadProgress(
                video_id=video.id,
                youtube_id=video.youtube_video_id,
                title=video.title,
                progress=progress.get("progress", 0),
                speed=progress.get("speed"),
                eta=progress.get("eta"),
                status=progress.get("status", "downloading")
            )
            await self.broadcast({
                "type": "download_progress",
                "data": {
                    "video_id": video.id,
                    "youtube_id": video.youtube_video_id,
                    "title": video.title,
                    "progress": progress.get("progress", 0),
                    "speed": progress.get("speed"),
                    "eta": progress.get("eta"),
                    "status": progress.get("status", "downloading")
                }
            })

        result = await video_downloader.download_video(
            video.youtube_video_id,
            progress_callback=progress_callback
        )

        if result.get("success"):
            video.is_downloaded = True
            video.video_local_path = result.get("video_path")
            video.thumbnail_local_path = result.get("thumbnail_path")
            video.video_size_bytes = result.get("file_size")
            video.video_quality = result.get("quality")
            video.downloaded_at = datetime.utcnow()
            await db.commit()
        else:
            await self._log_error(db, job_id, video.id, result.get("error", "Download failed"))

        self.download_progress.pop(video.id, None)
        self.sync_progress.status = TaskStatus.SYNCING

    async def _sync_comments(self, db: AsyncSession, video: Video):
        """Sync comments for a video"""
        page_token = None

        while True:
            if self.cancel_requested:
                break

            result = await youtube_api.get_video_comments(
                video.youtube_video_id,
                max_results=100,
                page_token=page_token
            )

            for comment_data in result.get("comments", []):
                await self._save_comment(db, video.id, comment_data)

            page_token = result.get("next_page_token")
            if not page_token:
                break

        await db.commit()

    async def _save_comment(
        self,
        db: AsyncSession,
        video_id: int,
        comment_data: Dict[str, Any],
        parent_id: Optional[int] = None
    ):
        """Save a comment and its replies"""
        # Check if comment exists
        result = await db.execute(
            select(Comment).where(
                Comment.youtube_comment_id == comment_data["youtube_comment_id"]
            )
        )
        comment = result.scalar_one_or_none()

        if comment:
            # Update existing
            comment.text_original = comment_data.get("text_original", comment.text_original)
            comment.like_count = comment_data.get("like_count", comment.like_count)
            comment.reply_count = comment_data.get("reply_count", comment.reply_count)
        else:
            # Create new
            comment = Comment(
                youtube_comment_id=comment_data["youtube_comment_id"],
                video_id=video_id,
                parent_comment_id=parent_id,
                author_name=comment_data.get("author_name"),
                author_channel_id=comment_data.get("author_channel_id"),
                author_profile_image_url=comment_data.get("author_profile_image_url"),
                text_original=comment_data.get("text_original", ""),
                text_display=comment_data.get("text_display"),
                like_count=comment_data.get("like_count", 0),
                reply_count=comment_data.get("reply_count", 0),
                published_at=comment_data.get("published_at"),
                is_top_level=comment_data.get("is_top_level", True),
            )
            db.add(comment)
            await db.flush()

        # Process replies
        for reply_data in comment_data.get("replies", []):
            await self._save_comment(db, video_id, reply_data, comment.id)

    async def _update_job_progress(self, db: AsyncSession, job_id: int):
        """Update job progress in database"""
        await db.execute(
            update(SyncJob)
            .where(SyncJob.id == job_id)
            .values(
                total_items=self.sync_progress.total_items,
                processed_items=self.sync_progress.processed_items
            )
        )
        await db.commit()

    async def _log_error(
        self,
        db: AsyncSession,
        job_id: int,
        video_id: Optional[int],
        error_message: str
    ):
        """Log an error"""
        error = ErrorLog(
            sync_job_id=job_id,
            video_id=video_id,
            error_message=error_message
        )
        db.add(error)
        await db.commit()

    async def _get_job_start_time(self, db: AsyncSession, job_id: int) -> datetime:
        """Get the start time of a job"""
        result = await db.execute(
            select(SyncJob.started_at).where(SyncJob.id == job_id)
        )
        started_at = result.scalar_one_or_none()
        return started_at or datetime.utcnow()

    def get_current_status(self) -> Dict[str, Any]:
        """Get current sync status"""
        return {
            "status": self.sync_progress.status.value,
            "job_id": self.sync_progress.job_id,
            "job_type": self.sync_progress.job_type,
            "channel_id": self.sync_progress.channel_id,
            "total_items": self.sync_progress.total_items,
            "processed_items": self.sync_progress.processed_items,
            "current_item": self.sync_progress.current_item,
            "percent_complete": (
                (self.sync_progress.processed_items / self.sync_progress.total_items) * 100
                if self.sync_progress.total_items > 0 else 0
            ),
            "downloads": list(self.download_progress.values())
        }


task_manager = TaskManager()
