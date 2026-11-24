import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useRepository } from './RepositoryContext';
import type { Notification } from '../types/models';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { repo, isReady } = useRepository();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = useCallback(async () => {
    if (!repo) return;
    try {
      const all = await repo.notifications.getAll(50);
      const count = await repo.notifications.getUnreadCount();
      setNotifications(all);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to refresh notifications:', err);
    }
  }, [repo]);

  useEffect(() => {
    if (isReady) {
      refreshNotifications();
    }
  }, [isReady, refreshNotifications]);

  const markAsRead = async (id: number) => {
    if (!repo) return;
    await repo.notifications.markAsRead(id);
    await refreshNotifications();
  };

  const markAllAsRead = async () => {
    if (!repo) return;
    await repo.notifications.markAllAsRead();
    await refreshNotifications();
  };

  const dismissNotification = async (id: number) => {
    if (!repo) return;
    await repo.notifications.dismiss(id);
    await refreshNotifications();
  };

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, refreshNotifications, markAsRead, markAllAsRead, dismissNotification }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}
