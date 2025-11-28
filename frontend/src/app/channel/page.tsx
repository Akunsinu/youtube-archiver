'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  PlaySquare,
  Eye,
  Settings,
  AlertCircle,
  Check,
} from 'lucide-react';
import { channelAPI, statusAPI } from '@/lib/api';
import type { Channel } from '@/types';

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

export default function ChannelPage() {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<any>(null);

  // Configuration form
  const [showConfig, setShowConfig] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [configuring, setConfiguring] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState(false);

  useEffect(() => {
    loadChannel();
    loadStorageInfo();
  }, []);

  const loadChannel = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await channelAPI.get();
      setChannel(data);
    } catch (err) {
      // No channel configured yet
      setChannel(null);
      setShowConfig(true);
    }

    setLoading(false);
  };

  const loadStorageInfo = async () => {
    try {
      const data = await statusAPI.getStorage();
      setStorageInfo(data);
    } catch (err) {
      // Ignore storage errors
    }
  };

  const handleConfigure = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfiguring(true);
    setConfigError(null);
    setConfigSuccess(false);

    try {
      const data = await channelAPI.configure(channelId, apiKey);
      setChannel(data);
      setConfigSuccess(true);
      setShowConfig(false);
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to configure channel');
    }

    setConfiguring(false);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-48 bg-youtube-gray rounded-xl mb-6" />
        <div className="flex gap-4">
          <div className="w-24 h-24 rounded-full bg-youtube-gray" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-youtube-gray rounded w-1/3" />
            <div className="h-4 bg-youtube-gray rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Configuration success message */}
      {configSuccess && (
        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-500" />
          <span className="text-green-400">Channel configured successfully!</span>
        </div>
      )}

      {/* No channel - show config */}
      {!channel && showConfig && (
        <div className="bg-youtube-gray rounded-xl p-8">
          <h1 className="text-2xl font-bold mb-2">Configure Channel</h1>
          <p className="text-gray-400 mb-6">
            Enter the YouTube channel ID and your API key to start archiving.
          </p>

          <form onSubmit={handleConfigure} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                YouTube Channel ID or URL
              </label>
              <input
                type="text"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="UCxxxxxxx or @channelname"
                className="w-full bg-youtube-dark border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-gray-600"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                You can use the channel ID (UCxxxxx), handle (@name), or username
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                YouTube API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your YouTube Data API v3 key"
                className="w-full bg-youtube-dark border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-gray-600"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Get one from{' '}
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  Google Cloud Console
                </a>
              </p>
            </div>

            {configError && (
              <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-400 text-sm">
                {configError}
              </div>
            )}

            <button
              type="submit"
              disabled={configuring}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 py-2 rounded font-medium"
            >
              {configuring ? 'Configuring...' : 'Configure Channel'}
            </button>
          </form>
        </div>
      )}

      {/* Channel info */}
      {channel && (
        <>
          {/* Banner */}
          {channel.banner_url && (
            <div className="h-48 rounded-xl overflow-hidden mb-6">
              <img
                src={channel.banner_url}
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
                src={channel.avatar_url}
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
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold">{channel.title}</h1>
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="p-2 hover:bg-youtube-gray rounded-full"
                  title="Configure"
                >
                  <Settings className="w-5 h-5 text-gray-400" />
                </button>
              </div>

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
          </div>

          {/* Configuration form (hidden by default) */}
          {showConfig && (
            <div className="bg-youtube-gray rounded-xl p-6 mb-8">
              <h2 className="text-lg font-bold mb-4">Update Configuration</h2>

              <form onSubmit={handleConfigure} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    YouTube Channel ID
                  </label>
                  <input
                    type="text"
                    value={channelId || channel.youtube_channel_id}
                    onChange={(e) => setChannelId(e.target.value)}
                    placeholder={channel.youtube_channel_id}
                    className="w-full bg-youtube-dark border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    YouTube API Key
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter new API key"
                    className="w-full bg-youtube-dark border border-gray-700 rounded px-4 py-2 focus:outline-none focus:border-gray-600"
                    required
                  />
                </div>

                {configError && (
                  <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-400 text-sm">
                    {configError}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={configuring}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded font-medium"
                  >
                    {configuring ? 'Updating...' : 'Update'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfig(false)}
                    className="bg-youtube-lightgray hover:bg-gray-600 px-4 py-2 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Description */}
          {channel.description && (
            <div className="bg-youtube-gray rounded-xl p-6 mb-8">
              <h2 className="text-lg font-bold mb-4">About</h2>
              <p className="text-gray-300 whitespace-pre-wrap">
                {channel.description}
              </p>
            </div>
          )}

          {/* Archive stats */}
          {storageInfo && (
            <div className="bg-youtube-gray rounded-xl p-6">
              <h2 className="text-lg font-bold mb-4">Archive Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-youtube-dark rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-red-500">
                    {storageInfo.quality_breakdown
                      ? Object.values(storageInfo.quality_breakdown as Record<string, number>).reduce(
                          (a: number, b: number) => a + b,
                          0
                        )
                      : 0}
                  </p>
                  <p className="text-sm text-gray-400">Videos Downloaded</p>
                </div>
                <div className="bg-youtube-dark rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-500">
                    {storageInfo.videos_size_formatted}
                  </p>
                  <p className="text-sm text-gray-400">Storage Used</p>
                </div>
                <div className="bg-youtube-dark rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-500">
                    {storageInfo.disk_free_formatted}
                  </p>
                  <p className="text-sm text-gray-400">Disk Free</p>
                </div>
                <div className="bg-youtube-dark rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-500">
                    {storageInfo.disk_used_percent?.toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-400">Disk Used</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
