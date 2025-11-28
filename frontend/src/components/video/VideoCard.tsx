'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, Clock, Eye, Download, AlertCircle } from 'lucide-react';
import type { Video } from '@/types';
import { videosAPI } from '@/lib/api';

interface VideoCardProps {
  video: Video;
}

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

function formatViewCount(count?: number): string {
  if (!count) return '0 views';
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M views`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`;
  }
  return `${count} views`;
}

export function VideoCard({ video }: VideoCardProps) {
  const thumbnailUrl = video.thumbnail_local_path
    ? videosAPI.getThumbnailUrl(video.id)
    : video.thumbnail_url || '/placeholder-thumbnail.jpg';

  const uploadDate = video.upload_date
    ? formatDistanceToNow(new Date(video.upload_date), { addSuffix: true })
    : 'Unknown date';

  return (
    <Link href={`/video/${video.id}`} className="group block">
      <div className="relative aspect-video bg-youtube-gray rounded-xl overflow-hidden mb-3">
        {/* Thumbnail */}
        <img
          src={thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
          {formatDuration(video.duration)}
        </div>

        {/* Status indicators */}
        <div className="absolute top-2 left-2 flex gap-1">
          {video.is_downloaded && (
            <div className="bg-green-600/90 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
              <Download className="w-3 h-3" />
            </div>
          )}
          {!video.is_available && (
            <div className="bg-red-600/90 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Unavailable
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1">
        <h3 className="font-medium text-white line-clamp-2 group-hover:text-gray-300">
          {video.title}
        </h3>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {formatViewCount(video.view_count)}
          </span>
          <span>•</span>
          <span>{uploadDate}</span>
        </div>
        {video.video_quality && video.is_downloaded && (
          <div className="text-xs text-gray-500">
            {video.video_quality}
          </div>
        )}
      </div>
    </Link>
  );
}
