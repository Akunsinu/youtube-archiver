import logging
from datetime import datetime, time
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.db.database import AsyncSessionLocal
from app.models.sync import SyncConfig

logger = logging.getLogger(__name__)


class SyncScheduler:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.job_id = "auto_sync"
        self._started = False

    def start(self):
        """Start the scheduler"""
        if not self._started:
            self.scheduler.start()
            self._started = True
            # Load config and schedule if enabled
            import asyncio
            asyncio.create_task(self._load_and_configure())
            logger.info("SyncScheduler started")

    def shutdown(self):
        """Shutdown the scheduler"""
        if self._started:
            self.scheduler.shutdown(wait=False)
            self._started = False
            logger.info("SyncScheduler shutdown")

    async def _load_and_configure(self):
        """Load configuration from database and configure scheduler"""
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(SyncConfig).limit(1))
            config = result.scalar_one_or_none()

            if config and config.auto_sync_enabled and config.auto_sync_time:
                self.configure(
                    enabled=config.auto_sync_enabled,
                    sync_time=config.auto_sync_time,
                    sync_type=config.auto_sync_type
                )

    def configure(
        self,
        enabled: bool,
        sync_time: Optional[time],
        sync_type: str = "new_only"
    ):
        """Configure auto-sync schedule"""
        # Remove existing job if any
        if self.scheduler.get_job(self.job_id):
            self.scheduler.remove_job(self.job_id)
            logger.info("Removed existing auto-sync job")

        if enabled and sync_time:
            self.scheduler.add_job(
                self._run_auto_sync,
                CronTrigger(hour=sync_time.hour, minute=sync_time.minute),
                id=self.job_id,
                args=[sync_type],
                replace_existing=True
            )
            logger.info(
                f"Scheduled auto-sync at {sync_time.hour:02d}:{sync_time.minute:02d} "
                f"(type: {sync_type})"
            )

    async def _run_auto_sync(self, sync_type: str):
        """Run the automatic sync"""
        from app.tasks.task_manager import task_manager

        logger.info(f"Starting auto-sync (type: {sync_type})")
        try:
            await task_manager.start_sync(
                job_type=sync_type,
                time_filter="week"  # Auto-sync defaults to past week
            )
        except Exception as e:
            logger.error(f"Auto-sync failed: {e}")

    def get_next_run_time(self) -> Optional[datetime]:
        """Get the next scheduled run time"""
        job = self.scheduler.get_job(self.job_id)
        if job:
            return job.next_run_time
        return None

    def is_enabled(self) -> bool:
        """Check if auto-sync is enabled"""
        return self.scheduler.get_job(self.job_id) is not None


sync_scheduler = SyncScheduler()
