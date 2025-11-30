from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.comment import Comment
from app.models.video import Video
from app.schemas.comment import CommentResponse, CommentListResponse

router = APIRouter()


@router.get("/video/{video_id}", response_model=CommentListResponse)
async def get_video_comments(
    video_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    sort_by: str = Query("top", regex="^(top|newest)$"),
    db: AsyncSession = Depends(get_db)
):
    """Get comments for a video"""
    # Check video exists
    video_result = await db.execute(
        select(Video).where(Video.id == video_id)
    )
    if not video_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Video not found")

    # Get top-level comments only
    query = select(Comment).where(
        Comment.video_id == video_id,
        Comment.is_top_level == True
    )

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply sorting
    if sort_by == "top":
        query = query.order_by(Comment.like_count.desc())
    else:
        query = query.order_by(Comment.published_at.desc())

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    comments = result.scalars().all()

    # Load replies for each comment
    comment_responses = []
    for comment in comments:
        replies_result = await db.execute(
            select(Comment)
            .where(Comment.parent_comment_id == comment.id)
            .order_by(Comment.published_at.asc())
            .limit(5)  # Limit initial replies
        )
        replies = replies_result.scalars().all()

        # Build replies list first
        reply_responses = [CommentResponse.model_validate(r) for r in replies]

        # Create comment response with replies included
        comment_data = {
            "id": comment.id,
            "youtube_comment_id": comment.youtube_comment_id,
            "video_id": comment.video_id,
            "parent_comment_id": comment.parent_comment_id,
            "author_name": comment.author_name,
            "author_channel_id": comment.author_channel_id,
            "author_profile_image_url": comment.author_profile_image_url,
            "text_original": comment.text_original,
            "text_display": comment.text_display,
            "like_count": comment.like_count,
            "reply_count": comment.reply_count,
            "published_at": comment.published_at,
            "is_top_level": comment.is_top_level,
            "created_at": comment.created_at,
            "replies": reply_responses
        }
        comment_responses.append(CommentResponse(**comment_data))

    total_pages = (total + per_page - 1) // per_page

    return CommentListResponse(
        comments=comment_responses,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )


@router.get("/{comment_id}/replies", response_model=CommentListResponse)
async def get_comment_replies(
    comment_id: int,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get replies for a specific comment"""
    # Check comment exists
    comment_result = await db.execute(
        select(Comment).where(Comment.id == comment_id)
    )
    if not comment_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Comment not found")

    query = select(Comment).where(
        Comment.parent_comment_id == comment_id
    ).order_by(Comment.published_at.asc())

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Apply pagination
    offset = (page - 1) * per_page
    query = query.offset(offset).limit(per_page)

    result = await db.execute(query)
    replies = result.scalars().all()

    total_pages = (total + per_page - 1) // per_page

    return CommentListResponse(
        comments=[CommentResponse.model_validate(r) for r in replies],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages
    )
