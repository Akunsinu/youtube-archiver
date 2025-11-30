import yt_dlp
import asyncio
import os
import logging
from typing import Optional, Callable, Dict, Any
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class VideoDownloader:
    def __init__(
        self,
        storage_path: Optional[str] = None,
        max_quality: str = "1080"
    ):
        self.storage_path = Path(storage_path or settings.videos_path)
        self.max_quality = max_quality.replace("p", "")
        self.progress_callback: Optional[Callable] = None
        self.current_video_id: Optional[str] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def _progress_hook(self, d: Dict[str, Any]):
        """yt-dlp progress callback"""
        if d['status'] == 'downloading':
            progress_data = {
                'status': 'downloading',
                'video_id': self.current_video_id,
                'progress': 0,
                'speed': d.get('_speed_str', 'N/A'),
                'eta': d.get('_eta_str', 'N/A'),
                'downloaded_bytes': d.get('downloaded_bytes', 0),
                'total_bytes': d.get('total_bytes') or d.get('total_bytes_estimate', 0),
            }

            # Calculate progress percentage
            if progress_data['total_bytes'] > 0:
                progress_data['progress'] = (
                    progress_data['downloaded_bytes'] / progress_data['total_bytes']
                ) * 100

            if self.progress_callback and self._loop:
                self._loop.call_soon_threadsafe(
                    lambda pd=progress_data: asyncio.run_coroutine_threadsafe(
                        self.progress_callback(pd), self._loop
                    )
                )

        elif d['status'] == 'finished':
            if self.progress_callback and self._loop:
                self._loop.call_soon_threadsafe(
                    lambda: asyncio.run_coroutine_threadsafe(
                        self.progress_callback({
                            'status': 'processing',
                            'video_id': self.current_video_id,
                            'progress': 100,
                        }), self._loop
                    )
                )

    async def download_video(
        self,
        video_id: str,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Download a single video by YouTube video ID"""
        self.progress_callback = progress_callback
        self.current_video_id = video_id
        self._loop = asyncio.get_running_loop()

        output_dir = self.storage_path / video_id
        output_dir.mkdir(parents=True, exist_ok=True)

        video_path = output_dir / "video.mp4"
        thumbnail_path = output_dir / "thumbnail.jpg"

        ydl_opts = {
            'format': f'bestvideo[height<={self.max_quality}]+bestaudio/best[height<={self.max_quality}]',
            'outtmpl': str(output_dir / 'video.%(ext)s'),
            'writethumbnail': True,
            'progress_hooks': [self._progress_hook],
            'merge_output_format': 'mp4',
            'postprocessors': [
                {
                    'key': 'FFmpegVideoConvertor',
                    'preferedformat': 'mp4',
                },
                {
                    'key': 'FFmpegThumbnailsConvertor',
                    'format': 'jpg',
                },
            ],
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }

        url = f"https://www.youtube.com/watch?v={video_id}"

        try:
            info = await self._loop.run_in_executor(
                None,
                lambda: self._download_sync(url, ydl_opts)
            )

            # Find the actual video file (might have different extension before conversion)
            actual_video_path = None
            for ext in ['mp4', 'mkv', 'webm']:
                check_path = output_dir / f"video.{ext}"
                if check_path.exists():
                    if ext != 'mp4':
                        check_path.rename(video_path)
                    actual_video_path = video_path
                    break

            if not actual_video_path or not actual_video_path.exists():
                # Try to find any video file
                for f in output_dir.iterdir():
                    if f.suffix in ['.mp4', '.mkv', '.webm']:
                        f.rename(video_path)
                        actual_video_path = video_path
                        break

            # Find thumbnail
            actual_thumbnail_path = None
            for ext in ['jpg', 'jpeg', 'png', 'webp']:
                for pattern in [f"video.{ext}", f"thumbnail.{ext}", f"*.{ext}"]:
                    for f in output_dir.glob(pattern):
                        if f.name != "video.mp4":
                            if f.name != "thumbnail.jpg":
                                f.rename(thumbnail_path)
                            actual_thumbnail_path = thumbnail_path
                            break
                    if actual_thumbnail_path:
                        break
                if actual_thumbnail_path:
                    break

            file_size = video_path.stat().st_size if video_path.exists() else 0

            # Determine actual quality
            quality = "unknown"
            if info:
                height = info.get('height') or info.get('resolution', '').split('x')[-1]
                if height:
                    try:
                        quality = f"{int(height)}p"
                    except (ValueError, TypeError):
                        pass

            return {
                'success': True,
                'video_path': str(video_path) if video_path.exists() else None,
                'thumbnail_path': str(thumbnail_path) if thumbnail_path.exists() else None,
                'file_size': file_size,
                'quality': quality,
            }

        except Exception as e:
            logger.error(f"Error downloading video {video_id}: {e}")
            return {
                'success': False,
                'error': str(e),
                'video_path': None,
                'thumbnail_path': None,
                'file_size': 0,
            }

    def _download_sync(self, url: str, opts: dict) -> Optional[dict]:
        """Synchronous download function"""
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(url, download=True)

    async def download_thumbnail(self, video_id: str, thumbnail_url: str) -> Optional[str]:
        """Download just the thumbnail for a video"""
        import httpx

        output_dir = self.storage_path / video_id
        output_dir.mkdir(parents=True, exist_ok=True)
        thumbnail_path = output_dir / "thumbnail.jpg"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(thumbnail_url)
                response.raise_for_status()

                with open(thumbnail_path, 'wb') as f:
                    f.write(response.content)

                return str(thumbnail_path)
        except Exception as e:
            logger.error(f"Error downloading thumbnail for {video_id}: {e}")
            return None

    async def check_video_available(self, video_id: str) -> bool:
        """Check if a video is still available on YouTube"""
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
        }

        url = f"https://www.youtube.com/watch?v={video_id}"

        try:
            loop = asyncio.get_running_loop()
            info = await loop.run_in_executor(
                None,
                lambda: self._extract_info_sync(url, ydl_opts)
            )
            return info is not None
        except Exception:
            return False

    def _extract_info_sync(self, url: str, opts: dict) -> Optional[dict]:
        """Extract info without downloading"""
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                return ydl.extract_info(url, download=False)
        except Exception:
            return None

    def get_video_path(self, video_id: str) -> Optional[Path]:
        """Get the path to a downloaded video"""
        video_path = self.storage_path / video_id / "video.mp4"
        return video_path if video_path.exists() else None

    def get_thumbnail_path(self, video_id: str) -> Optional[Path]:
        """Get the path to a video's thumbnail"""
        thumbnail_path = self.storage_path / video_id / "thumbnail.jpg"
        return thumbnail_path if thumbnail_path.exists() else None

    def delete_video(self, video_id: str) -> bool:
        """Delete a downloaded video and its files"""
        video_dir = self.storage_path / video_id
        if video_dir.exists():
            import shutil
            shutil.rmtree(video_dir)
            return True
        return False


video_downloader = VideoDownloader()
