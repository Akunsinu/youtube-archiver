from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ChannelBase(BaseModel):
    youtube_channel_id: str
    title: str
    description: Optional[str] = None
    custom_url: Optional[str] = None
    subscriber_count: Optional[int] = None
    video_count: Optional[int] = None
    view_count: Optional[int] = None


class ChannelCreate(ChannelBase):
    pass


class ChannelUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subscriber_count: Optional[int] = None
    video_count: Optional[int] = None
    view_count: Optional[int] = None


class ChannelResponse(ChannelBase):
    id: int
    banner_url: Optional[str] = None
    avatar_url: Optional[str] = None
    banner_local_path: Optional[str] = None
    avatar_local_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChannelConfig(BaseModel):
    youtube_channel_id: str
    youtube_api_key: str


class ChannelListResponse(BaseModel):
    channels: list[ChannelResponse]
    total: int
