from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import asyncio
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class YouTubeAPIService:
    def __init__(self, api_key: Optional[str] = None):
        self._api_key = api_key or settings.youtube_api_key
        self._youtube = None

    @property
    def api_key(self):
        return self._api_key

    @api_key.setter
    def api_key(self, value: str):
        if value != self._api_key:
            self._api_key = value
            self._youtube = None  # Reset client to force rebuild with new key

    @property
    def youtube(self):
        if self._youtube is None and self._api_key:
            self._youtube = build("youtube", "v3", developerKey=self._api_key)
        return self._youtube

    def _run_sync(self, func):
        """Run synchronous API call in executor"""
        loop = asyncio.get_event_loop()
        return loop.run_in_executor(None, func)

    async def get_channel_info(self, channel_id: str) -> Optional[Dict[str, Any]]:
        """Fetch channel information by channel ID"""
        if not self.youtube:
            raise ValueError("YouTube API key not configured")

        def fetch():
            request = self.youtube.channels().list(
                part="snippet,statistics,brandingSettings",
                id=channel_id
            )
            return request.execute()

        try:
            response = await self._run_sync(fetch)
            if not response.get("items"):
                return None

            item = response["items"][0]
            snippet = item.get("snippet", {})
            stats = item.get("statistics", {})
            branding = item.get("brandingSettings", {})

            return {
                "youtube_channel_id": channel_id,
                "title": snippet.get("title", ""),
                "description": snippet.get("description", ""),
                "custom_url": snippet.get("customUrl", ""),
                "subscriber_count": int(stats.get("subscriberCount", 0)),
                "video_count": int(stats.get("videoCount", 0)),
                "view_count": int(stats.get("viewCount", 0)),
                "avatar_url": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                "banner_url": branding.get("image", {}).get("bannerExternalUrl", ""),
            }
        except HttpError as e:
            logger.error(f"YouTube API error fetching channel: {e}")
            # Extract meaningful error message
            error_msg = str(e)
            if "accessNotConfigured" in error_msg or "has not been used" in error_msg:
                raise ValueError("YouTube Data API v3 is not enabled. Please enable it in Google Cloud Console.")
            elif "API key not valid" in error_msg:
                raise ValueError("Invalid YouTube API key. Please check your API key.")
            elif "quotaExceeded" in error_msg:
                raise ValueError("YouTube API quota exceeded. Please try again later.")
            raise ValueError(f"YouTube API error: {error_msg}")

    async def get_channel_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Fetch channel information by username or handle"""
        if not self.youtube:
            raise ValueError("YouTube API key not configured")

        def fetch():
            # Try forHandle first (for @username)
            if username.startswith("@"):
                request = self.youtube.channels().list(
                    part="snippet,statistics,brandingSettings",
                    forHandle=username[1:]
                )
            else:
                request = self.youtube.channels().list(
                    part="snippet,statistics,brandingSettings",
                    forUsername=username
                )
            return request.execute()

        try:
            response = await self._run_sync(fetch)
            if not response.get("items"):
                return None

            item = response["items"][0]
            return await self.get_channel_info(item["id"])
        except HttpError as e:
            logger.error(f"YouTube API error fetching channel by username: {e}")
            error_msg = str(e)
            if "accessNotConfigured" in error_msg or "has not been used" in error_msg:
                raise ValueError("YouTube Data API v3 is not enabled. Please enable it in Google Cloud Console.")
            elif "API key not valid" in error_msg:
                raise ValueError("Invalid YouTube API key. Please check your API key.")
            elif "quotaExceeded" in error_msg:
                raise ValueError("YouTube API quota exceeded. Please try again later.")
            raise ValueError(f"YouTube API error: {error_msg}")

    async def get_channel_videos(
        self,
        channel_id: str,
        max_results: int = 50,
        published_after: Optional[datetime] = None,
        page_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fetch videos from a channel's uploads playlist"""
        if not self.youtube:
            raise ValueError("YouTube API key not configured")

        # First get the uploads playlist ID
        def get_uploads_playlist():
            request = self.youtube.channels().list(
                part="contentDetails",
                id=channel_id
            )
            return request.execute()

        try:
            channel_response = await self._run_sync(get_uploads_playlist)
            if not channel_response.get("items"):
                return {"videos": [], "next_page_token": None}

            uploads_playlist_id = channel_response["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]

            # Now fetch videos from the uploads playlist
            def fetch_videos():
                request_params = {
                    "part": "snippet,contentDetails",
                    "playlistId": uploads_playlist_id,
                    "maxResults": min(max_results, 50),
                }
                if page_token:
                    request_params["pageToken"] = page_token

                request = self.youtube.playlistItems().list(**request_params)
                return request.execute()

            response = await self._run_sync(fetch_videos)
            videos = []

            for item in response.get("items", []):
                snippet = item.get("snippet", {})
                published_at = datetime.fromisoformat(
                    snippet.get("publishedAt", "").replace("Z", "+00:00")
                )

                # Filter by published_after if specified
                if published_after and published_at < published_after:
                    continue

                videos.append({
                    "youtube_video_id": snippet.get("resourceId", {}).get("videoId", ""),
                    "title": snippet.get("title", ""),
                    "description": snippet.get("description", ""),
                    "upload_date": published_at,
                    "thumbnail_url": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                })

            return {
                "videos": videos,
                "next_page_token": response.get("nextPageToken"),
            }
        except HttpError as e:
            logger.error(f"YouTube API error fetching videos: {e}")
            raise

    async def get_video_details(self, video_ids: List[str]) -> List[Dict[str, Any]]:
        """Fetch detailed information for specific videos"""
        if not self.youtube:
            raise ValueError("YouTube API key not configured")

        if not video_ids:
            return []

        def fetch():
            # API allows max 50 IDs per request
            request = self.youtube.videos().list(
                part="snippet,contentDetails,statistics",
                id=",".join(video_ids[:50])
            )
            return request.execute()

        try:
            response = await self._run_sync(fetch)
            videos = []

            for item in response.get("items", []):
                snippet = item.get("snippet", {})
                stats = item.get("statistics", {})
                content = item.get("contentDetails", {})

                # Parse duration (ISO 8601 format like PT1H2M3S)
                duration_str = content.get("duration", "PT0S")
                duration = self._parse_duration(duration_str)

                published_at = None
                if snippet.get("publishedAt"):
                    published_at = datetime.fromisoformat(
                        snippet["publishedAt"].replace("Z", "+00:00")
                    )

                videos.append({
                    "youtube_video_id": item["id"],
                    "title": snippet.get("title", ""),
                    "description": snippet.get("description", ""),
                    "upload_date": published_at,
                    "duration": duration,
                    "view_count": int(stats.get("viewCount", 0)),
                    "like_count": int(stats.get("likeCount", 0)),
                    "comment_count": int(stats.get("commentCount", 0)),
                    "thumbnail_url": snippet.get("thumbnails", {}).get("maxres",
                                     snippet.get("thumbnails", {}).get("high", {})).get("url", ""),
                    "tags": snippet.get("tags", []),
                    "category": snippet.get("categoryId", ""),
                })

            return videos
        except HttpError as e:
            logger.error(f"YouTube API error fetching video details: {e}")
            raise

    async def get_video_comments(
        self,
        video_id: str,
        max_results: int = 100,
        page_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fetch comments for a video"""
        if not self.youtube:
            raise ValueError("YouTube API key not configured")

        def fetch():
            request_params = {
                "part": "snippet,replies",
                "videoId": video_id,
                "maxResults": min(max_results, 100),
                "order": "relevance",
                "textFormat": "plainText",
            }
            if page_token:
                request_params["pageToken"] = page_token

            request = self.youtube.commentThreads().list(**request_params)
            return request.execute()

        try:
            response = await self._run_sync(fetch)
            comments = []

            for item in response.get("items", []):
                top_comment = item.get("snippet", {}).get("topLevelComment", {})
                top_snippet = top_comment.get("snippet", {})

                published_at = None
                if top_snippet.get("publishedAt"):
                    published_at = datetime.fromisoformat(
                        top_snippet["publishedAt"].replace("Z", "+00:00")
                    )

                updated_at = None
                if top_snippet.get("updatedAt"):
                    updated_at = datetime.fromisoformat(
                        top_snippet["updatedAt"].replace("Z", "+00:00")
                    )

                comment = {
                    "youtube_comment_id": top_comment.get("id", ""),
                    "author_name": top_snippet.get("authorDisplayName", ""),
                    "author_channel_id": top_snippet.get("authorChannelId", {}).get("value", ""),
                    "author_profile_image_url": top_snippet.get("authorProfileImageUrl", ""),
                    "text_original": top_snippet.get("textOriginal", ""),
                    "text_display": top_snippet.get("textDisplay", ""),
                    "like_count": int(top_snippet.get("likeCount", 0)),
                    "reply_count": item.get("snippet", {}).get("totalReplyCount", 0),
                    "published_at": published_at,
                    "updated_at": updated_at,
                    "is_top_level": True,
                    "replies": [],
                }

                # Get replies if available
                replies = item.get("replies", {}).get("comments", [])
                for reply in replies:
                    reply_snippet = reply.get("snippet", {})
                    reply_published = None
                    if reply_snippet.get("publishedAt"):
                        reply_published = datetime.fromisoformat(
                            reply_snippet["publishedAt"].replace("Z", "+00:00")
                        )

                    comment["replies"].append({
                        "youtube_comment_id": reply.get("id", ""),
                        "author_name": reply_snippet.get("authorDisplayName", ""),
                        "author_channel_id": reply_snippet.get("authorChannelId", {}).get("value", ""),
                        "author_profile_image_url": reply_snippet.get("authorProfileImageUrl", ""),
                        "text_original": reply_snippet.get("textOriginal", ""),
                        "text_display": reply_snippet.get("textDisplay", ""),
                        "like_count": int(reply_snippet.get("likeCount", 0)),
                        "reply_count": 0,
                        "published_at": reply_published,
                        "is_top_level": False,
                    })

                comments.append(comment)

            return {
                "comments": comments,
                "next_page_token": response.get("nextPageToken"),
            }
        except HttpError as e:
            if e.resp.status == 403:
                # Comments might be disabled
                logger.warning(f"Comments disabled or inaccessible for video {video_id}")
                return {"comments": [], "next_page_token": None}
            logger.error(f"YouTube API error fetching comments: {e}")
            raise

    def _parse_duration(self, duration_str: str) -> int:
        """Parse ISO 8601 duration to seconds"""
        import re
        match = re.match(
            r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?',
            duration_str
        )
        if not match:
            return 0

        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)

        return hours * 3600 + minutes * 60 + seconds

    def get_time_filter_date(self, time_filter: str) -> Optional[datetime]:
        """Convert time filter string to datetime (timezone-aware UTC)"""
        from datetime import timezone
        now = datetime.now(timezone.utc)
        if time_filter == "week":
            return now - timedelta(days=7)
        elif time_filter == "month":
            return now - timedelta(days=30)
        elif time_filter == "year":
            return now - timedelta(days=365)
        return None  # 'all' or invalid


youtube_api = YouTubeAPIService()
