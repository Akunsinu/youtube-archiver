from sqlalchemy import Column, Integer, String, Text, BigInteger, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base


class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    youtube_channel_id = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    custom_url = Column(String(100))
    subscriber_count = Column(BigInteger)
    video_count = Column(Integer)
    view_count = Column(BigInteger)
    banner_url = Column(Text)
    avatar_url = Column(Text)
    banner_local_path = Column(String(500))
    avatar_local_path = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    videos = relationship("Video", back_populates="channel", cascade="all, delete-orphan")
