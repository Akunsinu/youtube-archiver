'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import {
  Play,
  Square,
  Clock,
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { syncAPI, channelAPI } from '@/lib/api';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { SyncConfig, SyncJob, Channel } from '@/types';

function SyncContent() {
  const searchParams = useSearchParams();
  const preselectedChannel = searchParams.get('channel');

  const { syncProgress, isConnected } = useWebSocket();

  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [history, setHistory] = useState<SyncJob[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync controls
  const [selectedChannel, setSelectedChannel] = useState<number | ''>('');
  const [syncType, setSyncType] = useState('new_only');
  const [timeFilter, setTimeFilter] = useState('week');
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);

  // Config edit
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState({
    auto_sync_enabled: false,
    auto_sync_time: '03:00',
    auto_sync_type: 'new_only',
    max_video_quality: '1080p',
    sync_comments: true,
  });
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Set preselected channel from URL
  useEffect(() => {
    if (preselectedChannel && channels.length > 0) {
      const channelId = parseInt(preselectedChannel, 10);
      if (channels.some((c) => c.id === channelId)) {
        setSelectedChannel(channelId);
      }
    }
  }, [preselectedChannel, channels]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configData, historyData, channelsData] = await Promise.all([
        syncAPI.getConfig(),
        syncAPI.getHistory({ per_page: 10 }),
        channelAPI.list(),
      ]);
      setConfig(configData);
      setHistory(historyData.jobs);
      setChannels(channelsData.channels);

      // Initialize config form
      setConfigForm({
        auto_sync_enabled: configData.auto_sync_enabled,
        auto_sync_time: configData.auto_sync_time || '03:00',
        auto_sync_type: configData.auto_sync_type,
        max_video_quality: configData.max_video_quality,
        sync_comments: configData.sync_comments,
      });

      // Auto-select first channel if only one
      if (channelsData.channels.length === 1) {
        setSelectedChannel(channelsData.channels[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sync data');
    }
    setLoading(false);
  };

  const handleStartSync = async () => {
    if (!selectedChannel) {
      setError('Please select a channel to sync');
      return;
    }

    setStarting(true);
    setError(null);

    try {
      await syncAPI.start(syncType, selectedChannel, timeFilter);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sync');
    }

    setStarting(false);
  };

  const handleStopSync = async () => {
    setStopping(true);
    try {
      await syncAPI.stop();
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop sync');
    }
    setStopping(false);
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const updated = await syncAPI.updateConfig({
        auto_sync_enabled: configForm.auto_sync_enabled,
        auto_sync_time: configForm.auto_sync_time,
        auto_sync_type: configForm.auto_sync_type,
        max_video_quality: configForm.max_video_quality,
        sync_comments: configForm.sync_comments,
      });
      setConfig(updated);
      setEditingConfig(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    }
    setSavingConfig(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const isSyncing = !!(syncProgress && syncProgress.percent_complete > 0);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Sync Management</h1>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Current sync progress */}
      {syncProgress && syncProgress.job_id && (
        <div className="bg-youtube-gray rounded-xl p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
            Sync in Progress
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">
                  {syncProgress.current_video || 'Processing...'}
                </span>
                <span>
                  {syncProgress.processed} / {syncProgress.total}
                </span>
              </div>
              <div className="h-2 bg-youtube-dark rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all duration-300"
                  style={{ width: `${syncProgress.percent_complete}%` }}
                />
              </div>
            </div>

            <button
              onClick={handleStopSync}
              disabled={stopping}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded"
            >
              <Square className="w-4 h-4" />
              {stopping ? 'Stopping...' : 'Stop Sync'}
            </button>
          </div>
        </div>
      )}

      {/* Manual sync controls */}
      <div className="bg-youtube-gray rounded-xl p-6 mb-6">
        <h2 className="text-lg font-bold mb-4">Manual Sync</h2>

        {channels.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">No channels configured yet.</p>
            <a
              href="/channels"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-medium"
            >
              Add a Channel
            </a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Channel</label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value ? parseInt(e.target.value, 10) : '')}
                  disabled={isSyncing}
                  className="w-full bg-youtube-dark border border-gray-700 rounded px-4 py-2"
                >
                  <option value="">Select a channel...</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sync Type</label>
                <select
                  value={syncType}
                  onChange={(e) => setSyncType(e.target.value)}
                  disabled={isSyncing}
                  className="w-full bg-youtube-dark border border-gray-700 rounded px-4 py-2"
                >
                  <option value="new_only">New Videos Only</option>
                  <option value="full">Full Sync</option>
                  <option value="metadata">Metadata Only</option>
                  <option value="comments">Comments Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Time Filter</label>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  disabled={isSyncing}
                  className="w-full bg-youtube-dark border border-gray-700 rounded px-4 py-2"
                >
                  <option value="week">Past Week</option>
                  <option value="month">Past Month</option>
                  <option value="year">Past Year</option>
                  <option value="all">All Time</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleStartSync}
              disabled={starting || isSyncing || !selectedChannel}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-6 py-2 rounded font-medium"
            >
              <Play className="w-4 h-4" />
              {starting ? 'Starting...' : 'Start Sync'}
            </button>
          </>
        )}
      </div>

      {/* Auto-sync configuration */}
      <div className="bg-youtube-gray rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Automatic Sync</h2>
          <button
            onClick={() => setEditingConfig(!editingConfig)}
            className="p-2 hover:bg-youtube-lightgray rounded"
          >
            <Settings className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {editingConfig ? (
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={configForm.auto_sync_enabled}
                onChange={(e) =>
                  setConfigForm({ ...configForm, auto_sync_enabled: e.target.checked })
                }
                className="w-5 h-5 rounded border-gray-600 bg-youtube-dark text-red-600"
              />
              <span>Enable automatic daily sync</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Sync Time</label>
                <input
                  type="time"
                  value={configForm.auto_sync_time}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, auto_sync_time: e.target.value })
                  }
                  className="w-full bg-youtube-dark border border-gray-700 rounded px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sync Type</label>
                <select
                  value={configForm.auto_sync_type}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, auto_sync_type: e.target.value })
                  }
                  className="w-full bg-youtube-dark border border-gray-700 rounded px-4 py-2"
                >
                  <option value="new_only">New Videos Only</option>
                  <option value="full">Full Sync</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Max Quality</label>
                <select
                  value={configForm.max_video_quality}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, max_video_quality: e.target.value })
                  }
                  className="w-full bg-youtube-dark border border-gray-700 rounded px-4 py-2"
                >
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                </select>
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={configForm.sync_comments}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, sync_comments: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-gray-600 bg-youtube-dark text-red-600"
                  />
                  <span>Sync comments</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded"
              >
                {savingConfig ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditingConfig(false)}
                className="bg-youtube-lightgray hover:bg-gray-600 px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-gray-300">
            <p>
              <span className="text-gray-500">Status:</span>{' '}
              {config?.auto_sync_enabled ? (
                <span className="text-green-400">Enabled</span>
              ) : (
                <span className="text-gray-400">Disabled</span>
              )}
            </p>
            {config?.auto_sync_enabled && (
              <>
                <p>
                  <span className="text-gray-500">Time:</span> {config.auto_sync_time || 'Not set'}
                </p>
                <p>
                  <span className="text-gray-500">Type:</span> {config.auto_sync_type}
                </p>
              </>
            )}
            <p>
              <span className="text-gray-500">Max Quality:</span> {config?.max_video_quality}
            </p>
            <p>
              <span className="text-gray-500">Comments:</span>{' '}
              {config?.sync_comments ? 'Yes' : 'No'}
            </p>
          </div>
        )}
      </div>

      {/* Sync history */}
      <div className="bg-youtube-gray rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4">Sync History</h2>

        {loading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-youtube-dark rounded" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No sync history yet</p>
        ) : (
          <div className="space-y-2">
            {history.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between bg-youtube-dark rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <p className="font-medium">
                      {job.job_type} sync
                      {job.time_filter && ` (${job.time_filter})`}
                    </p>
                    <p className="text-sm text-gray-400">
                      {job.started_at
                        ? format(new Date(job.started_at), 'MMM d, yyyy h:mm a')
                        : 'Not started'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm">
                    {job.processed_items} / {job.total_items} videos
                  </p>
                  {job.failed_items > 0 && (
                    <p className="text-sm text-red-400">
                      {job.failed_items} failed
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SyncPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto animate-pulse"><div className="h-8 bg-youtube-gray rounded w-48 mb-6" /></div>}>
      <SyncContent />
    </Suspense>
  );
}
