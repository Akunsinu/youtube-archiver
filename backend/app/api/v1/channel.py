from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import os

from app.db.database import get_db
from app.models.channel import Channel
from app.models.video import Video
from app.schemas.channel import ChannelResponse, ChannelConfig, ChannelListResponse
from app.services.youtube_api import youtube_api
from app.config import settings

router = APIRouter()


@router.get("", response_model=ChannelListResponse)
async def list_channels(db: AsyncSession = Depends(get_db)):
    """List all configured channels"""
    result = await db.execute(
        select(Channel).order_by(Channel.title)
    )
    channels = result.scalars().all()

    return ChannelListResponse(
        channels=[ChannelResponse.model_validate(c) for c in channels],
        total=len(channels)
    )


@router.get("/{channel_id}", response_model=ChannelResponse)
async def get_channel(channel_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific channel by ID"""
    result = await db.execute(
        select(Channel).where(Channel.id == channel_id)
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    return ChannelResponse.model_validate(channel)


@router.post("", response_model=ChannelResponse)
async def create_channel(
    config: ChannelConfig,
    db: AsyncSession = Depends(get_db)
):
    """Add a new channel to archive"""
    # Validate API key and channel
    youtube_api.api_key = config.youtube_api_key

    try:
        # Try to get channel info
        channel_info = await youtube_api.get_channel_info(config.youtube_channel_id)

        if not channel_info:
            # Try as username/handle
            channel_info = await youtube_api.get_channel_by_username(config.youtube_channel_id)

        if not channel_info:
            raise HTTPException(status_code=400, detail="Could not find channel. Check the channel ID or handle.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"YouTube API error: {str(e)}")

    # Check if channel already exists
    result = await db.execute(
        select(Channel).where(
            Channel.youtube_channel_id == channel_info["youtube_channel_id"]
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Update existing channel info
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
        # Create new channel (don't delete existing ones - multi-channel support)
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


@router.delete("/{channel_id}")
async def delete_channel(
    channel_id: int,
    delete_videos: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Delete a channel and optionally its videos"""
    result = await db.execute(
        select(Channel).where(Channel.id == channel_id)
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Get video count for this channel
    video_count_result = await db.execute(
        select(func.count(Video.id)).where(Video.channel_id == channel_id)
    )
    video_count = video_count_result.scalar()

    if video_count > 0 and not delete_videos:
        raise HTTPException(
            status_code=400,
            detail=f"Channel has {video_count} videos. Set delete_videos=true to delete them."
        )

    # Delete the channel (videos will cascade delete if configured)
    await db.delete(channel)
    await db.commit()

    return {"status": "deleted", "channel_id": channel_id, "videos_deleted": video_count if delete_videos else 0}


@router.get("/{channel_id}/banner")
async def get_channel_banner(channel_id: int, db: AsyncSession = Depends(get_db)):
    """Get the channel banner image"""
    result = await db.execute(
        select(Channel).where(Channel.id == channel_id)
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Try local path first
    if channel.banner_local_path and os.path.exists(channel.banner_local_path):
        return FileResponse(channel.banner_local_path, media_type="image/jpeg")

    # Check storage path
    banner_path = os.path.join(settings.channel_path, f"{channel.id}_banner.jpg")
    if os.path.exists(banner_path):
        return FileResponse(banner_path, media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Banner not found")


@router.get("/{channel_id}/avatar")
async def get_channel_avatar(channel_id: int, db: AsyncSession = Depends(get_db)):
    """Get the channel avatar image"""
    result = await db.execute(
        select(Channel).where(Channel.id == channel_id)
    )
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Try local path first
    if channel.avatar_local_path and os.path.exists(channel.avatar_local_path):
        return FileResponse(channel.avatar_local_path, media_type="image/jpeg")

    # Check storage path
    avatar_path = os.path.join(settings.channel_path, f"{channel.id}_avatar.jpg")
    if os.path.exists(avatar_path):
        return FileResponse(avatar_path, media_type="image/jpeg")

    raise HTTPException(status_code=404, detail="Avatar not found")


# Keep legacy endpoint for backward compatibility
@router.put("/config", response_model=ChannelResponse)
async def configure_channel_legacy(
    config: ChannelConfig,
    db: AsyncSession = Depends(get_db)
):
    """Legacy endpoint - redirects to create_channel"""
    return await create_channel(config, db)
