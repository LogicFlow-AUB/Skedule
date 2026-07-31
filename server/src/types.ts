export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export type SupabaseConnectionStatus = 'connected' | 'unconfigured' | 'unreachable';

export type ApiHealthResponse = {
  status: 'ok' | 'degraded';
  supabase: {
    status: SupabaseConnectionStatus;
  };
};
