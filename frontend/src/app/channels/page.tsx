'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Users,
  PlaySquare,
  Eye,
  Trash2,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import { channelAPI } from '@/lib/api';
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

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add channel form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChannelId, setNewChannelId] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleteVideos, setDeleteVideos] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await channelAPI.list();
      setChannels(data.channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels');
    }

    setLoading(false);
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError(null);

    try {
      const newChannel = await channelAPI.create(newChannelId, newApiKey);
      setChannels([...channels, newChannel]);
      setShowAddForm(false);
      setNewChannelId('');
      setNewApiKey('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add channel');
    }

    setAdding(false);
  };

  const handleDeleteChannel = async (id: number) => {
    setDeleting(true);

    try {
      await channelAPI.delete(id, deleteVideos);
      setChannels(channels.filter((c) => c.id !== id));
      setDeleteConfirm(null);
      setDeleteVideos(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete channel');
    }

    setDeleting(false);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 bg-youtube-gray rounded w-48 animate-pulse" />
          <div className="h-10 bg-youtube-gray rounded w-32 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-youtube-gray rounded-xl p-6 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-youtube-lightgray" />
                <div className="flex-1">
                  <div className="h-5 bg-youtube-lightgray rounded w-3/4 mb-2" />
                  <div className="h-4 bg-youtube-lightgray rounded w-1/2" />
                </div>
              </div>
              <div className="h-4 bg-youtube-lightgray rounded w-full mb-2" />
              <div className="h-4 bg-youtube-lightgray rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Channels</h1>
          <p className="text-gray-400 text-sm mt-1">
            {channels.length} channel{channels.length !== 1 ? 's' : ''} configured
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Channel
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-400">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Add Channel Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-youtube-gray rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Add New Channel</h2>

            <form onSubmit={handleAddChannel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  YouTube Channel ID or URL
                </label>
                <input
                  type="text"
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
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
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
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

              {addError && (
                <div className="bg-red-900/30 border border-red-700 rounded p-3 text-red-400 text-sm">
                  {addError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 py-2 rounded font-medium"
                >
                  {adding ? 'Adding...' : 'Add Channel'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddError(null);
                  }}
                  className="px-4 py-2 bg-youtube-lightgray hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-youtube-gray rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Delete Channel</h2>
            <p className="text-gray-400 mb-4">
              Are you sure you want to delete this channel?
            </p>

            <label className="flex items-center gap-2 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteVideos}
                onChange={(e) => setDeleteVideos(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-youtube-dark text-red-600 focus:ring-red-600"
              />
              <span className="text-sm text-gray-300">
                Also delete all downloaded videos for this channel
              </span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => handleDeleteChannel(deleteConfirm)}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 py-2 rounded font-medium"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setDeleteConfirm(null);
                  setDeleteVideos(false);
                }}
                className="px-4 py-2 bg-youtube-lightgray hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No channels */}
      {channels.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Channels Configured</h2>
          <p className="text-gray-400 mb-6">
            Add a YouTube channel to start archiving videos.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-medium"
          >
            <Plus className="w-5 h-5" />
            Add Your First Channel
          </button>
        </div>
      )}

      {/* Channel grid */}
      {channels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="bg-youtube-gray rounded-xl overflow-hidden group"
            >
              {/* Banner */}
              <div className="h-24 bg-youtube-lightgray relative">
                {channel.banner_url && (
                  <img
                    src={channelAPI.getBannerUrl(channel.id)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteConfirm(channel.id);
                  }}
                  className="absolute top-2 right-2 p-2 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Delete channel"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <Link href={`/channels/${channel.id}`} className="block p-4">
                <div className="flex items-center gap-4 mb-3">
                  {/* Avatar */}
                  {channel.avatar_url ? (
                    <img
                      src={channelAPI.getAvatarUrl(channel.id)}
                      alt={channel.title}
                      className="w-14 h-14 rounded-full"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-youtube-lightgray flex items-center justify-center text-xl font-bold">
                      {channel.title[0]}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold truncate group-hover:text-red-500 transition-colors">
                      {channel.title}
                    </h3>
                    {channel.custom_url && (
                      <p className="text-sm text-gray-400 truncate">
                        {channel.custom_url}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{formatNumber(channel.subscriber_count)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <PlaySquare className="w-4 h-4" />
                    <span>{formatNumber(channel.video_count)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    <span>{formatNumber(channel.view_count)}</span>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
