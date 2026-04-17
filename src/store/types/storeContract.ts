export interface StandardStoreContract<T> {
  items: Record<string, T[]>;
  loading: boolean;
  error: string | null;
  lastSyncedAt: number | null;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  getItems: (projectId: string) => T[];
}
