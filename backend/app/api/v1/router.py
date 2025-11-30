from fastapi import APIRouter
from app.api.v1 import videos, comments, channel, sync, status, websocket

api_router = APIRouter()

api_router.include_router(videos.router, prefix="/videos", tags=["videos"])
api_router.include_router(comments.router, prefix="/comments", tags=["comments"])
# Support both /channel (legacy) and /channels (new multi-channel)
api_router.include_router(channel.router, prefix="/channel", tags=["channel"])
api_router.include_router(channel.router, prefix="/channels", tags=["channels"])
api_router.include_router(sync.router, prefix="/sync", tags=["sync"])
api_router.include_router(status.router, prefix="/status", tags=["status"])
api_router.include_router(websocket.router, tags=["websocket"])
