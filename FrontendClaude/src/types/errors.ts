export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'SYNC_ERROR'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED';

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    
    // Check if captureStackTrace is available (V8 engines like Node/Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}
