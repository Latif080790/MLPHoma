import { toast } from 'sonner';
import { AppError } from '../types/errors';

export async function handleAsync<T>(
  fn: () => Promise<T>,
  options?: {
    onError?: (err: AppError) => void;
    toastOnError?: boolean;
    errorMessage?: string;
  }
): Promise<[T | null, AppError | null]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (err) {
    const appError = err instanceof AppError 
      ? err 
      : new AppError('NETWORK_ERROR', err instanceof Error ? err.message : String(err));
    
    if (options?.toastOnError) {
      toast.error(options.errorMessage ?? appError.message);
    }
    
    if (options?.onError) {
      options.onError(appError);
    }
    
    return [null, appError];
  }
}
