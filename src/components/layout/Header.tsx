import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Menu, WifiOff, CheckCircle2, Trash2, Lock, Cloud } from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useSecurity } from '../../contexts/SecurityContext';
import { useRepository } from '../../contexts/RepositoryContext';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/customers': 'Customers',
  '/licenses': 'Licenses',
  '/reminders': 'Reminders',
  '/activity': 'Activity History',
  '/settings': 'Settings',
};

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');
  const { toggleMobileOpen } = useSidebar();
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismissNotification } = useNotifications();
  const { isLockConfigured, lockApp } = useSecurity();
  const { storageMode } = useRepository();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const title = pageTitles[location.pathname] || 'ClientVault';

  // Close notifications dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 border-b border-border-light dark:border-border-dark bg-white/80 dark:bg-surface-dark-secondary/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 flex-shrink-0 z-30 sticky top-0">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button
          onClick={toggleMobileOpen}
          className="btn-ghost p-2 -ml-2 lg:hidden text-text-secondary dark:text-text-dark-secondary"
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>

        <h1 className="text-lg font-semibold text-text-primary dark:text-text-dark-primary tracking-tight">
          {title}
        </h1>

        {storageMode === 'cloud' ? (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <Cloud size={11} />
            Supabase Cloud
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <WifiOff size={11} />
            Offline Mode
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Global Search Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (globalSearch.trim()) {
              navigate(`/customers?search=${encodeURIComponent(globalSearch.trim())}`);
              setGlobalSearch('');
            }
          }}
          className="hidden md:flex items-center"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary dark:text-text-dark-tertiary" size={15} />
            <input
              type="text"
              placeholder="Search customers, keys, GSTIN..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="input-base pl-9 pr-4 py-1.5 w-64 text-xs font-normal"
            />
          </div>
        </form>

        {/* Lock App Quick Action (Visible when Master PIN is configured) */}
        {isLockConfigured && (
          <button
            onClick={lockApp}
            className="btn-ghost p-2 text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary"
            title="Lock ClientVault (Master PIN)"
            aria-label="Lock Application"
          >
            <Lock size={18} />
          </button>
        )}

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="btn-ghost p-2 relative text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary"
            aria-label="View notifications"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-status-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-surface-dark-secondary">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 card shadow-apple-lg border border-border-light dark:border-border-dark p-0 overflow-hidden z-50 animate-scale-in">
              <div className="p-3 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-surface-secondary/50 dark:bg-surface-dark-tertiary/50">
                <span className="text-xs font-semibold text-text-primary dark:text-text-dark-primary uppercase tracking-wider">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="text-xs text-primary-500 hover:text-primary-600 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border-light dark:divide-border-dark">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-tertiary dark:text-text-dark-tertiary">
                    No notifications right now
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (n.id) markAsRead(n.id);
                        setShowNotifications(false);
                        if (n.relatedType === 'customer' && n.relatedId) {
                          navigate(`/customers/${n.relatedId}`);
                        } else if (n.relatedType === 'license' && n.relatedId) {
                          navigate(`/licenses?search=${n.relatedId}`);
                        } else if (n.type === 'reminder') {
                          navigate('/reminders');
                        }
                      }}
                      className={`p-3 flex items-start gap-3 transition-colors cursor-pointer ${
                        n.isRead === 0
                          ? 'bg-primary-50/50 dark:bg-primary-950/30'
                          : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-text-primary dark:text-text-dark-primary truncate">
                            {n.title}
                          </p>
                          <span className="text-[10px] text-text-tertiary dark:text-text-dark-tertiary ml-2">
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {n.isRead === 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (n.id) markAsRead(n.id);
                            }}
                            className="p-1 text-primary-500 hover:text-primary-600 rounded"
                            title="Mark as read"
                          >
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (n.id) dismissNotification(n.id);
                          }}
                          className="p-1 text-text-tertiary hover:text-status-danger rounded"
                          title="Dismiss"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
