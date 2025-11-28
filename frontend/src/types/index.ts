export interface Channel {
  id: number;
  youtube_channel_id: string;
  title: string;
  description?: string;
  custom_url?: string;
  subscriber_count?: number;
  video_count?: number;
  view_count?: number;
  banner_url?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: number;
  youtube_video_id: string;
  channel_id?: number;
  title: string;
  description?: string;
  upload_date?: string;
  duration?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  thumbnail_url?: string;
  thumbnail_local_path?: string;
  video_local_path?: string;
  video_quality?: string;
  video_size_bytes?: number;
  is_downloaded: boolean;
  is_available: boolean;
  tags?: string[];
  category?: string;
  created_at: string;
  updated_at: string;
  downloaded_at?: string;
}

export interface VideoListResponse {
  videos: Video[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface Comment {
  id: number;
  youtube_comment_id: string;
  video_id: number;
  parent_comment_id?: number;
  author_name?: string;
  author_channel_id?: string;
  author_profile_image_url?: string;
  text_original: string;
  text_display?: string;
  like_count: number;
  reply_count: number;
  published_at?: string;
  is_top_level: boolean;
  created_at: string;
  replies: Comment[];
}

export interface CommentListResponse {
  comments: Comment[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SyncConfig {
  id: number;
  auto_sync_enabled: boolean;
  auto_sync_time?: string;
  auto_sync_type: string;
  max_video_quality: string;
  sync_comments: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncJob {
  id: number;
  job_type: string;
  status: string;
  time_filter?: string;
  started_at?: string;
  completed_at?: string;
  total_items: number;
  processed_items: number;
  failed_items: number;
  error_message?: string;
  created_at: string;
}

export interface DownloadQueueItem {
  id: number;
  video_id: number;
  video_title?: string;
  video_youtube_id?: string;
  status: string;
  priority: number;
  progress: number;
  download_speed?: string;
  eta?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
  started_at?: string;
}

export interface StorageStats {
  total_videos: number;
  downloaded_videos: number;
  total_size_bytes: number;
  total_size_formatted: string;
}

export interface SyncProgress {
  job_id?: number;
  status: string;
  job_type?: string;
  total_items: number;
  processed_items: number;
  current_item?: string;
  percent_complete: number;
}

export interface OverallStatus {
  sync_progress: SyncProgress;
  storage: StorageStats;
  last_sync?: string;
  next_auto_sync?: string;
  queue_length: number;
  errors_count: number;
}

export interface ErrorLog {
  id: number;
  sync_job_id?: number;
  video_id?: number;
  video_title?: string;
  error_type?: string;
  error_message?: string;
  created_at: string;
}

// WebSocket message types
export interface WSMessage {
  type: 'connected' | 'sync_progress' | 'download_progress' | 'sync_completed' | 'sync_error' | 'sync_cancelled' | 'pong' | 'status';
  data: any;
}

export interface WSSyncProgress {
  job_id: number;
  total: number;
  processed: number;
  current_video?: string;
  percent_complete: number;
}

export interface WSDownloadProgress {
  video_id: number;
  youtube_id: string;
  title: string;
  progress: number;
  speed?: string;
  eta?: string;
  status: string;
}
