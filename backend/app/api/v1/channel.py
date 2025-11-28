from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import os

from app.db.database import get_db
from app.models.channel import Channel
from app.schemas.channel import ChannelResponse, ChannelConfig
from app.services.youtube_api import youtube_api
from app.config import settings

router = APIRouter()


@router.get("", response_model=ChannelResponse)
async def get_channel(db: AsyncSession = Depends(get_db)):
    """Get the configured channel information"""
    result = await db.execute(select(Channel).limit(1))
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="No channel configured")

    return ChannelResponse.model_validate(channel)


@router.put("/config", response_model=ChannelResponse)
async def configure_channel(
    config: ChannelConfig,
    db: AsyncSession = Depends(get_db)
):
    """Configure or update the channel to archive"""
    # Validate API key and channel
    youtube_api.api_key = config.youtube_api_key

    # Try to get channel info
    channel_info = await youtube_api.get_channel_info(config.youtube_channel_id)

    if not channel_info:
        # Try as username/handle
        channel_info = await youtube_api.get_channel_by_username(config.youtube_channel_id)

    if not channel_info:
        raise HTTPException(status_code=400, detail="Could not find channel")

    # Check if channel already exists
    result = await db.execute(
        select(Channel).where(
            Channel.youtube_channel_id == channel_info["youtube_channel_id"]
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Update existing
        existing.title = channel_info.get("title", existing.title)
        existing.description = channel_info.get("description")
        existing.custom_url = channel_info.get("custom_url")
        existing.subscriber_count = channel_info.get("subscriber_count")
        existing.video_count = channel_info.get("video_count")
        existing.view_count = channel_info.get("view_count")
        existing.avatar_url = channel_info.get("avatar_url")
        existing.banner_url = channel_info.get("banner_url")
        channel = existing
    else:
        # Remove any existing channel (single channel mode)
        await db.execute(select(Channel))  # This doesn't delete, let's fix
        result = await db.execute(select(Channel))
        old_channels = result.scalars().all()
        for old in old_channels:
            await db.delete(old)

        # Create new channel
        channel = Channel(
            youtube_channel_id=channel_info["youtube_channel_id"],
            title=channel_info.get("title", ""),
            description=channel_info.get("description"),
            custom_url=channel_info.get("custom_url"),
            subscriber_count=channel_info.get("subscriber_count"),
            video_count=channel_info.get("video_count"),
            view_count=channel_info.get("view_count"),
            avatar_url=channel_info.get("avatar_url"),
            banner_url=channel_info.get("banner_url"),
        )
        db.add(channel)

    await db.commit()
    await db.refresh(channel)

    return ChannelResponse.model_validate(channel)


@router.get("/banner")
async def get_channel_banner(db: AsyncSession = Depends(get_db)):
    """Get the channel banner image"""
    result = await db.execute(select(Channel).limit(1))
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="No channel configured")

    # Try local path first
    if channel.banner_local_path and os.path.exists(channel.banner_local_path):
        return FileResponse(channel.banner_local_path, media_type="image/jpeg")

    # Check storage path
    banner_path = os.path.join(settings.channel_path, "banner.jpg")
    if os.path.exists(banner_path):
        return FileResponse(banner_path, media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Banner not found")


@router.get("/avatar")
async def get_channel_avatar(db: AsyncSession = Depends(get_db)):
    """Get the channel avatar image"""
    result = await db.execute(select(Channel).limit(1))
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="No channel configured")

    # Try local path first
    if channel.avatar_local_path and os.path.exists(channel.avatar_local_path):
        return FileResponse(channel.avatar_local_path, media_type="image/jpeg")

    # Check storage path
    avatar_path = os.path.join(settings.channel_path, "avatar.jpg")
    if os.path.exists(avatar_path):
        return FileResponse(avatar_path, media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Avatar not found")
