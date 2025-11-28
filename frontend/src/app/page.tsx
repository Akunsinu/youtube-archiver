'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SortAsc, Download } from 'lucide-react';
import { VideoGrid } from '@/components/video/VideoGrid';
import { videosAPI } from '@/lib/api';
import type { Video } from '@/types';

function HomeContent() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [sortBy, setSortBy] = useState('upload_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [downloadedOnly, setDownloadedOnly] = useState(false);

  useEffect(() => {
    loadVideos();
  }, [page, sortBy, sortOrder, downloadedOnly, searchQuery]);

  const loadVideos = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await videosAPI.list({
        page,
        per_page: 20,
        search: searchQuery || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        downloaded_only: downloadedOnly,
      });
      setVideos(response.videos);
      setTotalPages(response.total_pages);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load videos');
    }

    setLoading(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {searchQuery ? `Search: "${searchQuery}"` : 'All Videos'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {total} video{total !== 1 ? 's' : ''} found
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

      {/* Error state */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadVideos}
            className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Video grid */}
      <VideoGrid videos={videos} loading={loading} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
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
                  disabled={loading}
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
            disabled={page === totalPages || loading}
            className="px-4 py-2 bg-youtube-gray rounded hover:bg-youtube-lightgray disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<VideoGrid videos={[]} loading={true} />}>
      <HomeContent />
    </Suspense>
  );
}
