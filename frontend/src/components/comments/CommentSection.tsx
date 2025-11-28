'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { commentsAPI } from '@/lib/api';
import type { Comment, CommentListResponse } from '@/types';

interface CommentSectionProps {
  videoId: number;
}

function CommentItem({ comment, onLoadReplies }: { comment: Comment; onLoadReplies?: (commentId: number) => void }) {
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Comment[]>(comment.replies || []);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const handleShowReplies = async () => {
    if (!showReplies && replies.length === 0 && comment.reply_count > 0) {
      setLoadingReplies(true);
      try {
        const response = await commentsAPI.getReplies(comment.id);
        setReplies(response.comments);
      } catch (error) {
        console.error('Failed to load replies:', error);
      }
      setLoadingReplies(false);
    }
    setShowReplies(!showReplies);
  };

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {comment.author_profile_image_url ? (
          <img
            src={comment.author_profile_image_url}
            alt={comment.author_name || 'User'}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-youtube-lightgray flex items-center justify-center text-gray-400">
            {comment.author_name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{comment.author_name || 'Unknown'}</span>
          <span className="text-xs text-gray-500">
            {comment.published_at
              ? formatDistanceToNow(new Date(comment.published_at), { addSuffix: true })
              : ''}
          </span>
        </div>

        <p className="text-sm text-gray-300 whitespace-pre-wrap">{comment.text_original}</p>

        <div className="flex items-center gap-4 mt-2">
          <button className="flex items-center gap-1 text-gray-400 text-sm hover:text-white">
            <ThumbsUp className="w-4 h-4" />
            {comment.like_count > 0 && <span>{comment.like_count}</span>}
          </button>

          {comment.reply_count > 0 && (
            <button
              onClick={handleShowReplies}
              className="flex items-center gap-1 text-blue-400 text-sm hover:text-blue-300"
            >
              {showReplies ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>

        {/* Replies */}
        {showReplies && (
          <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-700">
            {loadingReplies ? (
              <div className="text-gray-400 text-sm">Loading replies...</div>
            ) : (
              replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentSection({ videoId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<'top' | 'newest'>('top');

  useEffect(() => {
    loadComments();
  }, [videoId, page, sortBy]);

  const loadComments = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await commentsAPI.getForVideo(videoId, {
        page,
        per_page: 20,
        sort_by: sortBy,
      });
      setComments(response.comments);
      setTotalPages(response.total_pages);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comments');
    }

    setLoading(false);
  };

  if (loading && page === 1) {
    return (
      <div className="animate-pulse space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-youtube-gray" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-youtube-gray rounded w-1/4" />
              <div className="h-4 bg-youtube-gray rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>{error}</p>
        <button
          onClick={loadComments}
          className="mt-2 text-blue-400 hover:text-blue-300"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <span className="font-medium">{total} Comments</span>
        </div>

        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value as 'top' | 'newest');
            setPage(1);
          }}
          className="bg-youtube-gray border border-gray-700 rounded px-3 py-1 text-sm"
        >
          <option value="top">Top comments</option>
          <option value="newest">Newest first</option>
        </select>
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-center py-8 text-gray-400">No comments yet</p>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-youtube-gray rounded hover:bg-youtube-lightgray disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-youtube-gray rounded hover:bg-youtube-lightgray disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
