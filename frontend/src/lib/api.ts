import type {
  Channel,
  Video,
  VideoListResponse,
  CommentListResponse,
  SyncConfig,
  SyncJob,
  OverallStatus,
  ErrorLog,
} from '@/types';

// Get API base URL - use same host as frontend but different port
function getApiBase(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
  }
  // In browser, use the same hostname with backend port
  const host = window.location.hostname;
  return `http://${host}:8081`;
}

const API_BASE = getApiBase();

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}/api/v1${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP error ${response.status}`);
  }

  return response.json();
}

// Channel API (multi-channel support)
export const channelAPI = {
  // List all channels
  list: () => fetchAPI<{ channels: Channel[]; total: number }>('/channels'),

  // Get a specific channel by ID
  get: (id: number) => fetchAPI<Channel>(`/channels/${id}`),

  // Add a new channel
  create: (youtube_channel_id: string, youtube_api_key: string) =>
    fetchAPI<Channel>('/channels', {
      method: 'POST',
      body: JSON.stringify({ youtube_channel_id, youtube_api_key }),
    }),

  // Delete a channel
  delete: (id: number, deleteVideos: boolean = false) =>
    fetchAPI<{ status: string; channel_id: number; videos_deleted: number }>(
      `/channels/${id}?delete_videos=${deleteVideos}`,
      { method: 'DELETE' }
    ),

  // Legacy: configure channel (calls create)
  configure: (youtube_channel_id: string, youtube_api_key: string) =>
    fetchAPI<Channel>('/channel/config', {
      method: 'PUT',
      body: JSON.stringify({ youtube_channel_id, youtube_api_key }),
    }),

  // Get banner URL for a channel
  getBannerUrl: (id: number) => `${API_BASE}/api/v1/channels/${id}/banner`,

  // Get avatar URL for a channel
  getAvatarUrl: (id: number) => `${API_BASE}/api/v1/channels/${id}/avatar`,
};

// Videos API
export const videosAPI = {
  list: (params?: {
    page?: number;
    per_page?: number;
    channel_id?: number;
    search?: string;
    sort_by?: string;
    sort_order?: string;
    downloaded_only?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.channel_id) searchParams.set('channel_id', params.channel_id.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params?.sort_order) searchParams.set('sort_order', params.sort_order);
    if (params?.downloaded_only) searchParams.set('downloaded_only', 'true');

    const query = searchParams.toString();
    return fetchAPI<VideoListResponse>(`/videos${query ? `?${query}` : ''}`);
  },

  get: (id: number) => fetchAPI<Video>(`/videos/${id}`),

  getByYoutubeId: (youtubeId: string) =>
    fetchAPI<Video>(`/videos/youtube/${youtubeId}`),

  getStreamUrl: (id: number) => `${API_BASE}/api/v1/videos/${id}/stream`,

  getThumbnailUrl: (id: number) => `${API_BASE}/api/v1/videos/${id}/thumbnail`,
};

// Comments API
export const commentsAPI = {
  getForVideo: (videoId: number, params?: { page?: number; per_page?: number; sort_by?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.sort_by) searchParams.set('sort_by', params.sort_by);

    const query = searchParams.toString();
    return fetchAPI<CommentListResponse>(`/comments/video/${videoId}${query ? `?${query}` : ''}`);
  },

  getReplies: (commentId: number, params?: { page?: number; per_page?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());

    const query = searchParams.toString();
    return fetchAPI<CommentListResponse>(`/comments/${commentId}/replies${query ? `?${query}` : ''}`);
  },
};

// Sync API
export const syncAPI = {
  start: (job_type: string, channel_id: number, time_filter?: string) =>
    fetchAPI<SyncJob>('/sync/start', {
      method: 'POST',
      body: JSON.stringify({ job_type, channel_id, time_filter }),
    }),

  stop: () =>
    fetchAPI<{ status: string }>('/sync/stop', { method: 'POST' }),

  getStatus: () => fetchAPI<any>('/sync/status'),

  getConfig: () => fetchAPI<SyncConfig>('/sync/config'),

  updateConfig: (config: Partial<SyncConfig>) =>
    fetchAPI<SyncConfig>('/sync/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  getHistory: (params?: { page?: number; per_page?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());

    const query = searchParams.toString();
    return fetchAPI<{ jobs: SyncJob[]; total: number; page: number; per_page: number }>(
      `/sync/history${query ? `?${query}` : ''}`
    );
  },
};

// Status API
export const statusAPI = {
  get: () => fetchAPI<OverallStatus>('/status'),

  getQueue: () =>
    fetchAPI<{
      items: any[];
      total: number;
      downloading: number;
      queued: number;
      failed: number;
    }>('/status/queue'),

  getStorage: () =>
    fetchAPI<{
      videos_size_bytes: number;
      videos_size_formatted: string;
      disk_total_bytes: number;
      disk_total_formatted: string;
      disk_free_bytes: number;
      disk_free_formatted: string;
      disk_used_percent: number;
      quality_breakdown: Record<string, number>;
    }>('/status/storage'),

  getErrors: (params?: { page?: number; per_page?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());

    const query = searchParams.toString();
    return fetchAPI<{ errors: ErrorLog[]; total: number; page: number; per_page: number }>(
      `/status/errors${query ? `?${query}` : ''}`
    );
  },

  clearErrors: () =>
    fetchAPI<{ status: string }>('/status/errors', { method: 'DELETE' }),
};
