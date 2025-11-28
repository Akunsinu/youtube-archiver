from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CommentBase(BaseModel):
    youtube_comment_id: str
    author_name: Optional[str] = None
    author_channel_id: Optional[str] = None
    author_profile_image_url: Optional[str] = None
    text_original: str
    text_display: Optional[str] = None
    like_count: int = 0
    reply_count: int = 0
    published_at: Optional[datetime] = None


class CommentCreate(CommentBase):
    video_id: int
    parent_comment_id: Optional[int] = None
    is_top_level: bool = True


class CommentResponse(CommentBase):
    id: int
    video_id: int
    parent_comment_id: Optional[int] = None
    is_top_level: bool
    created_at: datetime
    replies: List["CommentResponse"] = []

    class Config:
        from_attributes = True


class CommentListResponse(BaseModel):
    comments: List[CommentResponse]
    total: int
    page: int
    per_page: int
    total_pages: int
