'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ThumbsUp,
  Eye,
  Calendar,
  Clock,
  Download,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { CommentSection } from '@/components/comments/CommentSection';
import { videosAPI } from '@/lib/api';
import type { Video } from '@/types';

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num?: number): string {
  if (!num) return '0';
  return num.toLocaleString();
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export default function VideoPage() {
  const params = useParams();
  const videoId = parseInt(params.id as string);

  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);

  useEffect(() => {
    loadVideo();
  }, [videoId]);

  const loadVideo = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await videosAPI.get(videoId);
      setVideo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load video');
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse">
        <div className="aspect-video bg-youtube-gray rounded-xl mb-6" />
        <div className="h-8 bg-youtube-gray rounded w-3/4 mb-4" />
        <div className="h-4 bg-youtube-gray rounded w-1/2" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="max-w-6xl mx-auto text-center py-12">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Video not found</h1>
        <p className="text-gray-400">{error || 'The requested video could not be loaded.'}</p>
      </div>
    );
  }

  const description = video.description || '';
  const shouldTruncate = description.length > 300;
  const displayDescription = showFullDescription
    ? description
    : description.slice(0, 300);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          {/* Video player */}
          {video.is_downloaded && video.video_local_path ? (
            <VideoPlayer
              src={videosAPI.getStreamUrl(video.id)}
              poster={videosAPI.getThumbnailUrl(video.id)}
              title={video.title}
            />
          ) : (
            <div className="aspect-video bg-youtube-gray rounded-xl flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">Video not downloaded</p>
                {video.thumbnail_url && (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="mt-4 rounded-lg opacity-50"
                  />
                )}
              </div>
            </div>
          )}

          {/* Title */}
          <h1 className="text-xl font-bold mt-4 mb-2">{video.title}</h1>

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 mb-4">
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {formatNumber(video.view_count)} views
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-4 h-4" />
              {formatNumber(video.like_count)} likes
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {video.upload_date
                ? format(new Date(video.upload_date), 'MMM d, yyyy')
                : 'Unknown date'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatDuration(video.duration)}
            </span>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {video.is_downloaded && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-400 rounded text-sm">
                <Download className="w-3 h-3" />
                Downloaded ({video.video_quality || 'Unknown quality'})
              </span>
            )}
            {!video.is_available && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-600/20 text-red-400 rounded text-sm">
                <AlertCircle className="w-3 h-3" />
                No longer available on YouTube
              </span>
            )}
            {video.video_size_bytes && (
              <span className="px-2 py-1 bg-youtube-gray text-gray-400 rounded text-sm">
                {formatBytes(video.video_size_bytes)}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="bg-youtube-gray rounded-lg p-4 mb-6">
            <p className="text-gray-300 whitespace-pre-wrap">
              {displayDescription}
              {shouldTruncate && !showFullDescription && '...'}
            </p>
            {shouldTruncate && (
              <button
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="text-blue-400 hover:text-blue-300 text-sm mt-2"
              >
                {showFullDescription ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          {/* Tags */}
          {video.tags && video.tags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-1">
                <Tag className="w-4 h-4" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {video.tags.slice(0, 20).map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-youtube-lightgray text-gray-300 rounded text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="border-t border-gray-800 pt-6">
            <CommentSection videoId={video.id} />
          </div>
        </div>

        {/* Sidebar - could show related videos in future */}
        <div className="hidden lg:block">
          <div className="bg-youtube-gray rounded-lg p-4">
            <h3 className="font-medium mb-4">Video Info</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">YouTube ID</dt>
                <dd className="font-mono text-gray-300">{video.youtube_video_id}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Archived</dt>
                <dd className="text-gray-300">
                  {format(new Date(video.created_at), 'MMM d, yyyy h:mm a')}
                </dd>
              </div>
              {video.downloaded_at && (
                <div>
                  <dt className="text-gray-500">Downloaded</dt>
                  <dd className="text-gray-300">
                    {format(new Date(video.downloaded_at), 'MMM d, yyyy h:mm a')}
                  </dd>
                </div>
              )}
              {video.category && (
                <div>
                  <dt className="text-gray-500">Category</dt>
                  <dd className="text-gray-300">{video.category}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
