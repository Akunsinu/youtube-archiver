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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

// Channel API
export const channelAPI = {
  get: () => fetchAPI<Channel>('/channel'),

  configure: (youtube_channel_id: string, youtube_api_key: string) =>
    fetchAPI<Channel>('/channel/config', {
      method: 'PUT',
      body: JSON.stringify({ youtube_channel_id, youtube_api_key }),
    }),
};

// Videos API
export const videosAPI = {
  list: (params?: {
    page?: number;
    per_page?: number;
    search?: string;
    sort_by?: string;
    sort_order?: string;
    downloaded_only?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
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
  start: (job_type: string, time_filter?: string) =>
    fetchAPI<SyncJob>('/sync/start', {
      method: 'POST',
      body: JSON.stringify({ job_type, time_filter }),
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
