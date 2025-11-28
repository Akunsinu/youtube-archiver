'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Activity,
  Download,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { statusAPI } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { OverallStatus, ErrorLog } from '@/types';

export default function StatusPage() {
  const { isConnected, syncProgress, downloadProgress } = useWebSocket();

  const [status, setStatus] = useState<OverallStatus | null>(null);
  const [queue, setQueue] = useState<any>(null);
  const [storage, setStorage] = useState<any>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statusData, queueData, storageData, errorsData] = await Promise.all([
        statusAPI.get(),
        statusAPI.getQueue(),
        statusAPI.getStorage(),
        statusAPI.getErrors({ per_page: 10 }),
      ]);

      setStatus(statusData);
      setQueue(queueData);
      setStorage(storageData);
      setErrors(errorsData.errors);
    } catch (err) {
      console.error('Failed to load status:', err);
    }
    setLoading(false);
  };

  const handleClearErrors = async () => {
    try {
      await statusAPI.clearErrors();
      setErrors([]);
    } catch (err) {
      console.error('Failed to clear errors:', err);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-pulse space-y-6">
        <div className="h-32 bg-youtube-gray rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-youtube-gray rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Status Dashboard</h1>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 bg-youtube-gray rounded-lg p-1">
          <button
            onClick={() => setViewMode('summary')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded ${
              viewMode === 'summary' ? 'bg-youtube-lightgray' : ''
            }`}
          >
            <EyeOff className="w-4 h-4" />
            Summary
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded ${
              viewMode === 'detailed' ? 'bg-youtube-lightgray' : ''
            }`}
          >
            <Eye className="w-4 h-4" />
            Detailed
          </button>
        </div>
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 mb-6">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
        <span className="text-sm text-gray-400">
          {isConnected ? 'Connected to server' : 'Disconnected from server'}
        </span>
      </div>

      {/* Current sync progress */}
      {syncProgress && syncProgress.job_id && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
            <h2 className="text-lg font-bold">Sync in Progress</h2>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">
                {syncProgress.current_video || 'Processing...'}
              </span>
              <span>
                {syncProgress.processed} / {syncProgress.total} ({syncProgress.percent_complete.toFixed(1)}%)
              </span>
            </div>
            <div className="h-3 bg-youtube-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${syncProgress.percent_complete}%` }}
              />
            </div>
          </div>

          {/* Active downloads in detailed view */}
          {viewMode === 'detailed' && Object.keys(downloadProgress).length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-400">Active Downloads</h3>
              {Object.values(downloadProgress).map((dl) => (
                <div
                  key={dl.video_id}
                  className="bg-youtube-dark rounded-lg p-3"
                >
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate max-w-md">{dl.title}</span>
                    <span className="flex items-center gap-2">
                      {dl.speed && <span className="text-gray-400">{dl.speed}</span>}
                      {dl.eta && <span className="text-gray-400">ETA: {dl.eta}</span>}
                      <span>{dl.progress.toFixed(1)}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 transition-all duration-300"
                      style={{ width: `${dl.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total Videos */}
        <div className="bg-youtube-gray rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <span className="text-gray-400">Total Videos</span>
          </div>
          <p className="text-3xl font-bold">{status?.storage.total_videos || 0}</p>
        </div>

        {/* Downloaded */}
        <div className="bg-youtube-gray rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Download className="w-5 h-5 text-green-500" />
            <span className="text-gray-400">Downloaded</span>
          </div>
          <p className="text-3xl font-bold">{status?.storage.downloaded_videos || 0}</p>
        </div>

        {/* Storage Used */}
        <div className="bg-youtube-gray rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <HardDrive className="w-5 h-5 text-yellow-500" />
            <span className="text-gray-400">Storage Used</span>
          </div>
          <p className="text-3xl font-bold">{status?.storage.total_size_formatted || '0 B'}</p>
        </div>

        {/* Errors */}
        <div className="bg-youtube-gray rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="text-gray-400">Errors</span>
          </div>
          <p className="text-3xl font-bold">{status?.errors_count || 0}</p>
        </div>
      </div>

      {/* Last sync info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-youtube-gray rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Last Sync
          </h3>
          {status?.last_sync ? (
            <p className="text-gray-300">
              {format(new Date(status.last_sync), 'MMM d, yyyy h:mm a')}
            </p>
          ) : (
            <p className="text-gray-500">No sync completed yet</p>
          )}
        </div>

        <div className="bg-youtube-gray rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Next Auto-Sync
          </h3>
          {status?.next_auto_sync ? (
            <p className="text-gray-300">
              {format(new Date(status.next_auto_sync), 'MMM d, yyyy h:mm a')}
            </p>
          ) : (
            <p className="text-gray-500">Auto-sync not configured</p>
          )}
        </div>
      </div>

      {/* Storage breakdown (detailed view) */}
      {viewMode === 'detailed' && storage && (
        <div className="bg-youtube-gray rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold mb-4">Storage Details</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-gray-400 text-sm">Videos Size</p>
              <p className="text-xl font-bold">{storage.videos_size_formatted}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Disk Free</p>
              <p className="text-xl font-bold">{storage.disk_free_formatted}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Disk Used</p>
              <p className="text-xl font-bold">{storage.disk_used_percent?.toFixed(1)}%</p>
            </div>
          </div>

          {/* Quality breakdown */}
          {storage.quality_breakdown && Object.keys(storage.quality_breakdown).length > 0 && (
            <div>
              <p className="text-gray-400 text-sm mb-2">Quality Breakdown</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(storage.quality_breakdown).map(([quality, count]) => (
                  <span
                    key={quality}
                    className="px-3 py-1 bg-youtube-dark rounded-full text-sm"
                  >
                    {quality}: {count as number}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Download queue (detailed view) */}
      {viewMode === 'detailed' && queue && queue.items.length > 0 && (
        <div className="bg-youtube-gray rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Download className="w-5 h-5" />
            Download Queue ({queue.total})
          </h3>

          <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              Downloading: {queue.downloading}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-500" />
              Queued: {queue.queued}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Failed: {queue.failed}
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {queue.items.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-youtube-dark rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {item.status === 'downloading' ? (
                    <Download className="w-4 h-4 text-blue-500 animate-bounce" />
                  ) : item.status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-gray-500" />
                  )}
                  <span className="truncate max-w-md">
                    {item.video_title || item.video_youtube_id}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-400">
                  {item.progress > 0 && (
                    <span>{item.progress.toFixed(1)}%</span>
                  )}
                  {item.download_speed && (
                    <span>{item.download_speed}</span>
                  )}
                  {item.retry_count > 0 && (
                    <span className="text-yellow-500">
                      Retry: {item.retry_count}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error logs */}
      <div className="bg-youtube-gray rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Recent Errors ({errors.length})
          </h3>

          {errors.length > 0 && (
            <button
              onClick={handleClearErrors}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>

        {errors.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No errors recorded</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {errors.map((error) => (
              <div
                key={error.id}
                className="bg-red-900/20 border border-red-900 rounded-lg px-4 py-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    {error.video_title && (
                      <p className="font-medium text-red-400 mb-1">
                        {error.video_title}
                      </p>
                    )}
                    <p className="text-sm text-gray-300">
                      {error.error_message || 'Unknown error'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(error.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
