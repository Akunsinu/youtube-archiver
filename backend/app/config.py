from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://ytarchive:ytarchive@localhost:5432/ytarchive"

    # YouTube API
    youtube_api_key: str = ""

    # Storage
    storage_path: str = "/storage"

    # CORS
    cors_origins: str = "http://localhost:3000"

    # App settings
    max_video_quality: str = "1080"
    default_sync_type: str = "new_only"

    @property
    def cors_origins_list(self) -> List[str]:
        # Handle wildcard CORS - return ["*"] for all origins
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def videos_path(self) -> str:
        return os.path.join(self.storage_path, "videos")

    @property
    def channel_path(self) -> str:
        return os.path.join(self.storage_path, "channel")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
