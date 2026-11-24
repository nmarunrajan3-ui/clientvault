import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useRepository } from './RepositoryContext';
import { useNotifications } from './NotificationContext';
import { checkAndTriggerDueReminders } from '../services/reminderEngine';

interface ReminderContextType {
  isChecking: boolean;
  lastChecked: Date | null;
  runCheck: () => Promise<void>;
}

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

export function ReminderProvider({ children }: { children: ReactNode }) {
  const { repo, isReady } = useRepository();
  const { refreshNotifications } = useNotifications();
  const [isChecking, setIsChecking] = useState(false);
  const isCheckingRef = useRef(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const runCheck = useCallback(async () => {
    if (!repo || !isReady || isCheckingRef.current) return;
    try {
      isCheckingRef.current = true;
      setIsChecking(true);
      const result = await checkAndTriggerDueReminders(repo);
      setLastChecked(new Date());
      if (result.processedCount > 0) {
        await refreshNotifications();
      }
    } catch (err) {
      console.error('Failed to run reminder check:', err);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [repo, isReady, refreshNotifications]);

  // Check on startup
  useEffect(() => {
    if (isReady) {
      runCheck();
    }
  }, [isReady, runCheck]);

  // Check on app focus / visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runCheck();
      }
    };

    const handleFocus = () => {
      runCheck();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [runCheck]);

  return (
    <ReminderContext.Provider value={{ isChecking, lastChecked, runCheck }}>
      {children}
    </ReminderContext.Provider>
  );
}

export function useReminders() {
  const context = useContext(ReminderContext);
  if (!context) throw new Error('useReminders must be used within ReminderProvider');
  return context;
}
