export interface Job {
  job_id: string;
  status: 'queued' | 'processing' | 'complete' | 'failed';
  progress: number;
  phase?: string;
  avatar_name?: string;
  avatar_index?: number;
  orientation?: string;
  resolution?: string;
  download_url?: string;
  minio_url?: string;
  error?: string;
  duration?: number;
  file_size?: number;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  failed_at?: string;
}

export interface Avatar {
  name: string;
  index: number;
  thumbnail?: string;
  type: 'custom' | 'public';
}

export interface ApiKey {
  key_hash: string;
  name: string;
  created_at: string;
}

export interface SessionStatus {
  status: 'connected' | 'expired' | 'unknown';
  account?: string;
  last_verified?: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  session: string;
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  storage?: {
    videos_cached: number;
    disk_usage_mb: number;
  };
  uptime_seconds?: number;
}

export interface GenerateRequest {
  avatar_name: string;
  avatar_index?: number;
  title?: string;
  orientation?: 'landscape' | 'portrait' | '16:9' | '9:16';
  resolution?: '720p' | '1080p';
}

export interface Database {
  jobs: Job[];
  api_keys: ApiKey[];
  settings: Record<string, string>;
}
