from sqlalchemy import Column, Integer, String, Text, BigInteger, Boolean, DateTime, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    youtube_video_id = Column(String(20), unique=True, nullable=False, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id", ondelete="CASCADE"))
    title = Column(String(500), nullable=False)
    description = Column(Text)
    upload_date = Column(DateTime(timezone=True), index=True)
    duration = Column(Integer)  # seconds
    view_count = Column(BigInteger)
    like_count = Column(BigInteger)
    comment_count = Column(BigInteger)
    thumbnail_url = Column(Text)
    thumbnail_local_path = Column(String(500))
    video_local_path = Column(String(500))
    video_quality = Column(String(20))  # e.g., "1080p", "720p"
    video_size_bytes = Column(BigInteger)
    is_downloaded = Column(Boolean, default=False, index=True)
    is_available = Column(Boolean, default=True)  # false if deleted/private on YouTube
    tags = Column(ARRAY(String))
    category = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    metadata_updated_at = Column(DateTime(timezone=True))
    downloaded_at = Column(DateTime(timezone=True))

    # Relationships
    channel = relationship("Channel", back_populates="videos")
    comments = relationship("Comment", back_populates="video", cascade="all, delete-orphan")
