from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    youtube_comment_id = Column(String(50), unique=True, nullable=False, index=True)
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), index=True)
    parent_comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"))
    author_name = Column(String(255))
    author_channel_id = Column(String(50))
    author_profile_image_url = Column(Text)
    text_original = Column(Text, nullable=False)
    text_display = Column(Text)
    like_count = Column(Integer, default=0)
    reply_count = Column(Integer, default=0)
    published_at = Column(DateTime(timezone=True), index=True)
    updated_at = Column(DateTime(timezone=True))
    is_top_level = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    video = relationship("Video", back_populates="comments")
    replies = relationship("Comment", backref="parent", remote_side=[id])
