import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { LocalRepository } from '../repositories/LocalRepository';
import { SupabaseRepository } from '../repositories/SupabaseRepository';
import { getSupabaseClient, getSupabaseConfig } from '../services/supabaseClient';
import type { IRepository } from '../types/repository';

export type StorageMode = 'local' | 'cloud';

interface RepositoryContextType {
  repo: IRepository;
  storageMode: StorageMode;
  setStorageMode: (mode: StorageMode) => void;
  isCloudConfigured: boolean;
  isReady: boolean;
  error: Error | null;
}

const RepositoryContext = createContext<RepositoryContextType | undefined>(undefined);

const localRepo = new LocalRepository();
const STORAGE_MODE_KEY = 'clientvault_storage_mode';

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const [storageMode, setStorageModeState] = useState<StorageMode>(() => {
    const saved = localStorage.getItem(STORAGE_MODE_KEY);
    return saved === 'cloud' && getSupabaseClient() ? 'cloud' : 'local';
  });
  const [activeRepo, setActiveRepo] = useState<IRepository>(localRepo);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isCloudConfigured = Boolean(getSupabaseConfig() && getSupabaseClient());

  const setStorageMode = (mode: StorageMode) => {
    if (mode === 'cloud') {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase client is not configured. Please enter project URL & API key.');
      }
      setActiveRepo(new SupabaseRepository(client));
    } else {
      setActiveRepo(localRepo);
    }
    setStorageModeState(mode);
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  };

  useEffect(() => {
    localRepo
      .initialize()
      .then(() => {
        if (storageMode === 'cloud') {
          const client = getSupabaseClient();
          if (client) {
            setActiveRepo(new SupabaseRepository(client));
          } else {
            setStorageModeState('local');
            setActiveRepo(localRepo);
          }
        } else {
          setActiveRepo(localRepo);
        }
        setIsReady(true);
      })
      .catch((err) => {
        console.error('Failed to initialize database:', err);
        setError(err);
      });
  }, [storageMode]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-secondary dark:bg-surface-dark">
        <div className="card p-8 max-w-md text-center">
          <h2 className="text-lg font-semibold text-status-danger mb-2">Database Error</h2>
          <p className="text-text-secondary dark:text-text-dark-secondary">
            Failed to initialize the database repository. Please try refreshing the page.
          </p>
          <p className="text-xs text-text-tertiary mt-2 font-mono">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary mt-4"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-secondary dark:bg-surface-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary">Loading ClientVault...</p>
        </div>
      </div>
    );
  }

  return (
    <RepositoryContext.Provider
      value={{
        repo: activeRepo,
        storageMode,
        setStorageMode,
        isCloudConfigured,
        isReady,
        error,
      }}
    >
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository() {
  const context = useContext(RepositoryContext);
  if (!context) throw new Error('useRepository must be used within RepositoryProvider');
  return context;
}
