'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Users,
  PlaySquare,
  Eye,
  ArrowLeft,
  SortAsc,
  Download,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { channelAPI, videosAPI } from '@/lib/api';
import { VideoGrid } from '@/components/video/VideoGrid';
import type { Channel, Video } from '@/types';

function formatNumber(num?: number): string {
  if (!num) return '0';
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ChannelDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const channelId = parseInt(id, 10);

  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [videosLoading, setVideosLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [sortBy, setSortBy] = useState('upload_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [downloadedOnly, setDownloadedOnly] = useState(false);

  useEffect(() => {
    loadChannel();
  }, [channelId]);

  useEffect(() => {
    if (channel) {
      loadVideos();
    }
  }, [channel, page, sortBy, sortOrder, downloadedOnly]);

  const loadChannel = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await channelAPI.get(channelId);
      setChannel(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channel');
    }

    setLoading(false);
  };

  const loadVideos = async () => {
    setVideosLoading(true);

    try {
      const response = await videosAPI.list({
        channel_id: channelId,
        page,
        per_page: 20,
        sort_by: sortBy,
        sort_order: sortOrder,
        downloaded_only: downloadedOnly,
      });
      setVideos(response.videos);
      setTotalPages(response.total_pages);
      setTotal(response.total);
    } catch (err) {
      // Don't override channel error
      if (!error) {
        setError(err instanceof Error ? err.message : 'Failed to load videos');
      }
    }

    setVideosLoading(false);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse">
        <div className="h-48 bg-youtube-gray rounded-xl mb-6" />
        <div className="flex gap-4 mb-8">
          <div className="w-24 h-24 rounded-full bg-youtube-gray" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-youtube-gray rounded w-1/3" />
            <div className="h-4 bg-youtube-gray rounded w-1/2" />
          </div>
        </div>
        <div className="h-8 bg-youtube-gray rounded w-32 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-youtube-gray rounded-lg aspect-video" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !channel) {
    return (
      <div className="max-w-6xl mx-auto">
        <Link
          href="/channels"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Channels
        </Link>

        <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Channel Not Found</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <Link
            href="/channels"
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Go to Channels
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back link */}
      <Link
        href="/channels"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Channels
      </Link>

      {channel && (
        <>
          {/* Banner */}
          {channel.banner_url && (
            <div className="h-48 rounded-xl overflow-hidden mb-6">
              <img
                src={channelAPI.getBannerUrl(channel.id)}
                alt="Channel banner"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Channel header */}
          <div className="flex items-start gap-6 mb-8">
            {/* Avatar */}
            {channel.avatar_url ? (
              <img
                src={channelAPI.getAvatarUrl(channel.id)}
                alt={channel.title}
                className="w-24 h-24 rounded-full"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-youtube-gray flex items-center justify-center text-3xl font-bold">
                {channel.title[0]}
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-1">{channel.title}</h1>

              {channel.custom_url && (
                <p className="text-gray-400 mb-4">{channel.custom_url}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-6 text-gray-300">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-500" />
                  <span>{formatNumber(channel.subscriber_count)} subscribers</span>
                </div>
                <div className="flex items-center gap-2">
                  <PlaySquare className="w-5 h-5 text-gray-500" />
                  <span>{formatNumber(channel.video_count)} videos</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-gray-500" />
                  <span>{formatNumber(channel.view_count)} views</span>
                </div>
              </div>
            </div>

            {/* Sync button */}
            <Link
              href={`/sync?channel=${channel.id}`}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium"
            >
              <RefreshCw className="w-5 h-5" />
              Sync Channel
            </Link>
          </div>

          {/* Description */}
          {channel.description && (
            <div className="bg-youtube-gray rounded-xl p-6 mb-8">
              <h2 className="text-lg font-bold mb-4">About</h2>
              <p className="text-gray-300 whitespace-pre-wrap line-clamp-4">
                {channel.description}
              </p>
            </div>
          )}

          {/* Videos section */}
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">Videos</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {total} video{total !== 1 ? 's' : ''} in archive
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-4">
                {/* Sort */}
                <div className="flex items-center gap-2">
                  <SortAsc className="w-4 h-4 text-gray-400" />
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [sort, order] = e.target.value.split('-');
                      setSortBy(sort);
                      setSortOrder(order);
                      setPage(1);
                    }}
                    className="bg-youtube-gray border border-gray-700 rounded px-3 py-2 text-sm"
                  >
                    <option value="upload_date-desc">Newest first</option>
                    <option value="upload_date-asc">Oldest first</option>
                    <option value="view_count-desc">Most viewed</option>
                    <option value="title-asc">Title A-Z</option>
                    <option value="title-desc">Title Z-A</option>
                    <option value="duration-desc">Longest</option>
                    <option value="duration-asc">Shortest</option>
                  </select>
                </div>

                {/* Downloaded only toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={downloadedOnly}
                    onChange={(e) => {
                      setDownloadedOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="w-4 h-4 rounded border-gray-600 bg-youtube-gray text-red-600 focus:ring-red-600"
                  />
                  <Download className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Downloaded only</span>
                </label>
              </div>
            </div>

            {/* Video grid */}
            <VideoGrid videos={videos} loading={videosLoading} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || videosLoading}
                  className="px-4 py-2 bg-youtube-gray rounded hover:bg-youtube-lightgray disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <div className="flex items-center gap-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        disabled={videosLoading}
                        className={`w-10 h-10 rounded ${
                          page === pageNum
                            ? 'bg-red-600 text-white'
                            : 'bg-youtube-gray hover:bg-youtube-lightgray'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || videosLoading}
                  className="px-4 py-2 bg-youtube-gray rounded hover:bg-youtube-lightgray disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
