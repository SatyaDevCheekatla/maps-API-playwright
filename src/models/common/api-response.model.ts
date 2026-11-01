export interface ApiRequestOptions {
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  data?: unknown;
  timeout?: number;
}

export interface ApiResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  durationMs: number;
  url: string;
  method: string;
  correlationId: string;
  rawText: string;
}

export interface ApiErrorResponse {
  msg?: string;
  error?: string;
  status?: string;
  statusCode?: number;
}
