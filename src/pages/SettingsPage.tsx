import React, { useEffect, useState, useRef } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Globe,
  Bell,
  HardDrive,
  Shield,
  Check,
  Download,
  Upload,
  Lock,
  Unlock,
  KeyRound,
  FileSpreadsheet,
  AlertCircle,
  Database,
  RefreshCw,
  Cloud,
  Server,
  ExternalLink,
  Code2,
  DatabaseZap,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useRepository, type StorageMode } from '../contexts/RepositoryContext';
import { useSecurity } from '../contexts/SecurityContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  createFullBackupObject,
  downloadBackupFile,
  validateBackupString,
  restoreDatabase,
  exportPaymentsToCsv,
  type ClientVaultBackup,
} from '../services/backupService';
import { exportCustomersToCsv, exportLicensesToCsv } from '../utils/csvExport';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  clearSupabaseConfig,
  getSupabaseClient,
  testSupabaseConnection,
} from '../services/supabaseClient';
import { migrateLocalDataToSupabase } from '../services/cloudSyncService';
import { RestoreConfirmModal } from '../components/settings/RestoreConfirmModal';
import { SetPinModal } from '../components/security/SetPinModal';
import { SqlSchemaModal } from '../components/settings/SqlSchemaModal';
import type { Customer } from '../types/models';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { repo, storageMode, setStorageMode, isCloudConfigured } = useRepository();
  const {
    isLockConfigured,
    autoLockMinutes,
    lockApp,
    setAutoLockMinutes,
  } = useSecurity();
  const { refreshNotifications } = useNotifications();

  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [dbCounts, setDbCounts] = useState({
    customers: 0,
    licenses: 0,
    renewals: 0,
    payments: 0,
    notifications: 0,
  });
  const [notificationStatus, setNotificationStatus] = useState<string>('default');

  // Backup & Restore State
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<ClientVaultBackup | null>(null);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security Modals
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'set' | 'remove'>('set');

  // Supabase Cloud State
  const [supabaseUrl, setSupabaseUrl] = useState(() => getSupabaseConfig()?.url || '');
  const [supabaseKey, setSupabaseKey] = useState(() => getSupabaseConfig()?.anonKey || '');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<{ success: boolean; message: string } | null>(null);
  const [isSyncingToCloud, setIsSyncingToCloud] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // Load Database stats and settings
  const loadData = async () => {
    try {
      const allSettings = await repo.settings.getAll();
      setSettings(allSettings);

      const [custRes, licRes, notifs, paymentsRes] = await Promise.all([
        repo.customers.getAll({ limit: 5000 }),
        repo.licenses.getAll({ limit: 5000 }),
        repo.notifications.getAll(100),
        repo.payments.getAll({ limit: 5000 }),
      ]);

      setDbCounts({
        customers: custRes.total,
        licenses: licRes.total,
        renewals: 0,
        payments: paymentsRes.total,
        notifications: notifs.length,
      });

      if ('Notification' in window) {
        setNotificationStatus(Notification.permission);
      }
    } catch (err) {
      console.error('Failed to load settings data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [repo, storageMode]);

  const themeOptions = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  const handleToggleDesktopNotifications = async () => {
    if (!('Notification' in window)) {
      alert('Desktop notifications are not supported by this browser.');
      return;
    }

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      if (permission === 'granted') {
        await repo.settings.set('desktopNotifications', true);
        setSettings((prev) => ({ ...prev, desktopNotifications: true }));
        new Notification('ClientVault', {
          body: 'Desktop notifications enabled for license renewals!',
        });
      } else {
        await repo.settings.set('desktopNotifications', false);
        setSettings((prev) => ({ ...prev, desktopNotifications: false }));
      }
    } else {
      const current = settings.desktopNotifications as boolean;
      await repo.settings.set('desktopNotifications', !current);
      setSettings((prev) => ({ ...prev, desktopNotifications: !current }));
    }
  };

  // Full Database JSON Backup Export
  const handleExportJsonBackup = async () => {
    try {
      setIsExportingBackup(true);
      setBackupNotice(null);
      const backup = await createFullBackupObject(repo);
      downloadBackupFile(backup);

      await repo.activities.create({
        type: 'backup_created',
        description: `Exported full database backup archive (${backup.metadata.customersCount} customers, ${backup.metadata.licensesCount} licenses)`,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      });

      setBackupNotice({
        type: 'success',
        message: 'Complete database backup (.json) downloaded successfully.',
      });
    } catch (err: any) {
      console.error('Backup export failed:', err);
      setBackupNotice({
        type: 'error',
        message: 'Failed to generate database backup: ' + (err?.message || 'Unknown error'),
      });
    } finally {
      setIsExportingBackup(false);
    }
  };

  // Handle file select for JSON restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBackupNotice(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const validation = validateBackupString(text);

      if (!validation.isValid || !validation.backup) {
        setBackupNotice({
          type: 'error',
          message: validation.error || 'Corrupted or invalid ClientVault backup file.',
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setPendingBackup(validation.backup);
      setIsRestoreModalOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onerror = () => {
      setBackupNotice({
        type: 'error',
        message: 'Failed to read the backup file. Please try again.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.readAsText(file);
  };

  // Execute restore
  const handleConfirmRestore = async (createSafetySnapshot: boolean) => {
    if (!pendingBackup) return;

    const result = await restoreDatabase(pendingBackup, repo, createSafetySnapshot);
    if (result.success) {
      await loadData();
      await repo.notifications.create({
        type: 'system',
        title: 'Database Restored',
        message: `Successfully restored ${pendingBackup.metadata.customersCount} customers and ${pendingBackup.metadata.licensesCount} licenses from backup.`,
        isRead: 0,
        createdAt: new Date().toISOString(),
        schemaVersion: 1,
      });
      await refreshNotifications();
      setBackupNotice({
        type: 'success',
        message: `Database restored successfully (${pendingBackup.metadata.customersCount} customers, ${pendingBackup.metadata.licensesCount} licenses).`,
      });
    } else {
      setBackupNotice({
        type: 'error',
        message: result.error || 'Failed to restore database.',
      });
    }
  };

  // CSV Exports for Reporting
  const handleExportCustomersCsv = async () => {
    const res = await repo.customers.getAll({ limit: 10000 });
    exportCustomersToCsv(res.data);
  };

  const handleExportLicensesCsv = async () => {
    const [licRes, custRes] = await Promise.all([
      repo.licenses.getAll({ limit: 10000 }),
      repo.customers.getAll({ limit: 10000 }),
    ]);
    const map: Record<string, Customer> = {};
    custRes.data.forEach((c) => {
      map[c.customerId] = c;
    });
    exportLicensesToCsv(licRes.data, map);
  };

  const handleExportPaymentsCsv = async () => {
    const [payRes, custRes] = await Promise.all([
      repo.payments.getAll({ limit: 10000 }),
      repo.customers.getAll({ limit: 10000 }),
    ]);
    const map: Record<string, Customer> = {};
    custRes.data.forEach((c) => {
      map[c.customerId] = c;
    });
    exportPaymentsToCsv(payRes.data, map);
  };

  // Supabase Connection Test
  const handleTestSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setConnectionNotice({
        success: false,
        message: 'Please provide both Project URL and Anon Public Key.',
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionNotice(null);
    const result = await testSupabaseConnection(supabaseUrl, supabaseKey);
    setIsTestingConnection(false);

    if (result.success) {
      setConnectionNotice({
        success: true,
        message: 'Connected to Supabase PostgreSQL successfully!',
      });
    } else {
      setConnectionNotice({
        success: false,
        message: `Connection failed: ${result.error}`,
      });
    }
  };

  // Save Supabase Credentials & Connect
  const handleSaveAndConnectSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setConnectionNotice({
        success: false,
        message: 'Please provide both Project URL and Anon Public Key.',
      });
      return;
    }

    setIsTestingConnection(true);
    const result = await testSupabaseConnection(supabaseUrl, supabaseKey);
    setIsTestingConnection(false);

    if (!result.success) {
      setConnectionNotice({
        success: false,
        message: `Cannot connect: ${result.error}`,
      });
      return;
    }

    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setStorageMode('cloud');
    setConnectionNotice({
      success: true,
      message: 'Supabase credentials saved. Active storage switched to Cloud (PostgreSQL)!',
    });
  };

  // Disconnect Supabase
  const handleDisconnectSupabase = () => {
    clearSupabaseConfig();
    setStorageMode('local');
    setSupabaseUrl('');
    setSupabaseKey('');
    setConnectionNotice(null);
  };

  // 1-Click Sync Local Data to Cloud
  const handleSyncToSupabase = async () => {
    const client = getSupabaseClient();
    if (!client) {
      setConnectionNotice({
        success: false,
        message: 'Supabase is not connected. Please connect first.',
      });
      return;
    }

    setIsSyncingToCloud(true);
    setConnectionNotice(null);
    const summary = await migrateLocalDataToSupabase(client);
    setIsSyncingToCloud(false);

    if (summary.success) {
      setConnectionNotice({
        success: true,
        message: `Sync complete! Uploaded ${summary.customers} customers, ${summary.licenses} licenses, ${summary.renewals} renewals, and ${summary.payments} payments to Supabase PostgreSQL.`,
      });
      await loadData();
    } else {
      setConnectionNotice({
        success: false,
        message: `Sync failed: ${summary.error}`,
      });
    }
  };

  return (
    <div className="max-w-3xl space-y-6 mx-auto animate-fade-in pb-12">
      <div>
        <h2 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary tracking-tight">
          Settings
        </h2>
        <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-0.5">
          Cloud database, hosting deployment, local backups, security, and preferences
        </p>
      </div>

      {backupNotice && (
        <div
          className={`p-3.5 rounded-apple text-xs font-medium flex items-center justify-between animate-fade-in ${
            backupNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-status-danger/10 text-status-danger border border-status-danger/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {backupNotice.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{backupNotice.message}</span>
          </div>
          <button
            onClick={() => setBackupNotice(null)}
            className="text-xs font-bold px-2 py-0.5 opacity-70 hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* 0. FREE CLOUD DATABASE (SUPABASE POSTGRESQL) */}
      <div className="card p-6 space-y-4 border-2 border-primary-500/20 dark:border-primary-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-apple bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200 dark:border-blue-800">
              <Cloud size={20} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary flex items-center gap-2">
                <span>Free Cloud Database (Supabase PostgreSQL)</span>
                <span className="badge-info text-[10px]">100% Free Tier</span>
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                500MB PostgreSQL, Row Level Security, instant cloud synchronization
              </p>
            </div>
          </div>
          <span
            className={`badge ${
              storageMode === 'cloud' && isCloudConfigured ? 'badge-success' : 'badge-neutral'
            }`}
          >
            {storageMode === 'cloud' && isCloudConfigured ? 'Connected (Cloud)' : 'Offline (Local)'}
          </span>
        </div>

        {connectionNotice && (
          <div
            className={`p-3 rounded-apple text-xs font-medium flex items-center gap-2 animate-fade-in ${
              connectionNotice.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-status-danger/10 text-status-danger border border-status-danger/20'
            }`}
          >
            {connectionNotice.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{connectionNotice.message}</span>
          </div>
        )}

        {/* Active Storage Mode Switcher */}
        <div className="p-3 bg-surface-secondary dark:bg-surface-dark-tertiary rounded-apple space-y-2">
          <span className="text-2xs font-semibold text-text-secondary dark:text-text-dark-secondary uppercase tracking-wider block">
            Active Database Repository
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStorageMode('local')}
              className={`p-2.5 rounded-apple border text-left transition-all ${
                storageMode === 'local'
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500'
                  : 'border-border-light dark:border-border-dark text-text-secondary hover:bg-white dark:hover:bg-surface-dark-secondary'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Local IndexedDB</span>
                {storageMode === 'local' && <Check size={14} />}
              </div>
              <p className="text-[11px] text-text-tertiary mt-0.5">100% Offline, on this machine</p>
            </button>

            <button
              type="button"
              disabled={!isCloudConfigured}
              onClick={() => setStorageMode('cloud')}
              className={`p-2.5 rounded-apple border text-left transition-all ${
                storageMode === 'cloud'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                  : 'border-border-light dark:border-border-dark text-text-secondary hover:bg-white dark:hover:bg-surface-dark-secondary disabled:opacity-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Supabase PostgreSQL</span>
                {storageMode === 'cloud' && <Check size={14} />}
              </div>
              <p className="text-[11px] text-text-tertiary mt-0.5">
                {isCloudConfigured ? 'Realtime Cloud Sync' : 'Connect Supabase below first'}
              </p>
            </button>
          </div>
        </div>

        {/* Credentials Form */}
        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-2xs font-semibold text-text-secondary dark:text-text-dark-secondary uppercase mb-1">
              Supabase Project URL
            </label>
            <input
              type="text"
              placeholder="https://your-project-ref.supabase.co"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              className="input-base text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-2xs font-semibold text-text-secondary dark:text-text-dark-secondary uppercase mb-1">
              Supabase Anon / Public API Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              className="input-base text-xs font-mono"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-light dark:border-border-dark">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestSupabase}
                disabled={isTestingConnection}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="button"
                onClick={handleSaveAndConnectSupabase}
                disabled={isTestingConnection}
                className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
              >
                <Cloud size={13} />
                <span>Save & Connect</span>
              </button>
              {isCloudConfigured && (
                <button
                  type="button"
                  onClick={handleDisconnectSupabase}
                  className="btn-ghost text-xs text-status-danger px-2.5 py-1.5"
                >
                  Disconnect
                </button>
              )}
            </div>

            {/* View SQL Schema Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsSqlModalOpen(true)}
              className="text-xs text-primary-500 hover:text-primary-600 font-medium flex items-center gap-1.5"
            >
              <Code2 size={13} />
              <span>View PostgreSQL SQL Schema</span>
            </button>
          </div>
        </div>

        {/* 1-Click Sync Local Data to Cloud */}
        <div className="pt-3 border-t border-border-light dark:border-border-dark flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-text-primary dark:text-text-dark-primary flex items-center gap-1.5">
              <DatabaseZap size={14} className="text-primary-500" />
              <span>Migrate & Sync Local Data to Cloud</span>
            </p>
            <p className="text-2xs text-text-tertiary">
              Pushes all local IndexedDB customers, licenses, renewals, and payments into Supabase PostgreSQL.
            </p>
          </div>
          <button
            type="button"
            disabled={!isCloudConfigured || isSyncingToCloud}
            onClick={handleSyncToSupabase}
            className="btn-secondary text-xs px-4 py-2 flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw size={13} className={isSyncingToCloud ? 'animate-spin' : ''} />
            <span>{isSyncingToCloud ? 'Syncing Records...' : 'Sync Local Data to Cloud'}</span>
          </button>
        </div>
      </div>

      {/* 0.1 FREE HOSTING DEPLOYMENT GUIDE */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-apple bg-purple-50 dark:bg-purple-950/30 text-purple-600 flex items-center justify-center">
            <Server size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
              Completely Free Hosting Options (100% Free Forever)
            </h3>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              Deploy your ClientVault PWA online with zero hosting costs, automated SSL, and global CDN
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Vercel Option */}
          <div className="p-4 rounded-apple border border-border-light dark:border-border-dark bg-surface-secondary/40 dark:bg-surface-dark-tertiary/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary dark:text-text-dark-primary">
                Option 1: Vercel (Recommended)
              </span>
              <span className="badge-success text-[10px]">Free Tier</span>
            </div>
            <p className="text-2xs text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              Configured via <code className="font-mono text-primary-500">vercel.json</code> with SPA client routing. Free global edge deployment, instant HTTPS, and zero maintenance.
            </p>
            <div className="bg-gray-900 text-gray-100 p-2.5 rounded font-mono text-[10px] space-y-1">
              <p className="text-gray-400"># Deploy with 1 command in terminal:</p>
              <p className="text-emerald-400 font-bold">npx vercel</p>
            </div>
          </div>

          {/* Netlify Option */}
          <div className="p-4 rounded-apple border border-border-light dark:border-border-dark bg-surface-secondary/40 dark:bg-surface-dark-tertiary/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-primary dark:text-text-dark-primary">
                Option 2: Netlify / GitHub Pages
              </span>
              <span className="badge-success text-[10px]">Free Tier</span>
            </div>
            <p className="text-2xs text-text-secondary dark:text-text-dark-secondary leading-relaxed">
              Configured via <code className="font-mono text-primary-500">netlify.toml</code> and <code className="font-mono text-primary-500">.github/workflows/deploy.yml</code>. Drag & drop the <code className="font-mono">dist</code> folder or push to GitHub.
            </p>
            <div className="bg-gray-900 text-gray-100 p-2.5 rounded font-mono text-[10px] space-y-1">
              <p className="text-gray-400"># Production build ready in /dist:</p>
              <p className="text-emerald-400 font-bold">npm run build</p>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Database Backup & Disaster Recovery (JSON) */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-apple bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 flex items-center justify-center">
              <Database size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                Full Database Backup & Restoration
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                Export and restore complete versioned JSON archives of all your data
              </p>
            </div>
          </div>
          <span className="badge-info font-mono text-2xs">Schema v1</span>
        </div>

        <p className="text-xs text-text-secondary dark:text-text-dark-secondary leading-relaxed">
          Regularly export a full JSON backup file to keep local copies of all customer records, licenses, renewals, and payments.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Download JSON Backup */}
          <button
            type="button"
            onClick={handleExportJsonBackup}
            disabled={isExportingBackup}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-2"
          >
            <Download size={14} />
            <span>{isExportingBackup ? 'Exporting...' : 'Export Complete Backup (.json)'}</span>
          </button>

          {/* Restore JSON Backup */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-xs px-4 py-2 flex items-center gap-2"
          >
            <Upload size={14} />
            <span>Restore from Backup (.json)</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="text-[11px] text-text-tertiary border-t border-border-light dark:border-border-dark pt-3 flex items-center gap-1.5">
          <RefreshCw size={12} />
          <span>Restoration automatically recalibrates sequential ID counters to prevent collision with future customers or licenses.</span>
        </div>
      </div>

      {/* 2. Spreadsheet Reports (CSV) */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-apple bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
              Data Export (Spreadsheet Reporting)
            </h3>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              Export standard UTF-8 CSV tables for Excel, Numbers, and accounting
            </p>
          </div>
        </div>

        <div className="p-3 bg-surface-secondary dark:bg-surface-dark-tertiary rounded-apple text-2xs text-text-tertiary">
          Note: CSV files are formatted for human reporting and spreadsheets. To restore your entire system, always use the <strong>Full Database Backup (.json)</strong> above.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <button
            onClick={handleExportCustomersCsv}
            className="btn-secondary text-xs py-2.5 flex items-center justify-center gap-2"
          >
            <Download size={14} />
            <span>Customers (.csv)</span>
          </button>
          <button
            onClick={handleExportLicensesCsv}
            className="btn-secondary text-xs py-2.5 flex items-center justify-center gap-2"
          >
            <Download size={14} />
            <span>Licenses (.csv)</span>
          </button>
          <button
            onClick={handleExportPaymentsCsv}
            className="btn-secondary text-xs py-2.5 flex items-center justify-center gap-2"
          >
            <Download size={14} />
            <span>Payments (.csv)</span>
          </button>
        </div>
      </div>

      {/* 3. Application Lock & PIN Security */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-apple bg-blue-50 dark:bg-blue-950/30 text-blue-500 flex items-center justify-center">
              <Lock size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                Application Lock & PIN Security
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                Require a master PIN to access customer data and license keys
              </p>
            </div>
          </div>
          <span
            className={`badge ${
              isLockConfigured ? 'badge-success' : 'badge-neutral'
            }`}
          >
            {isLockConfigured ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        <div className="space-y-4 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-border-light dark:border-border-dark">
            <div>
              <p className="text-xs sm:text-sm font-medium text-text-primary dark:text-text-dark-primary">
                Master Security Passcode
              </p>
              <p className="text-2xs text-text-tertiary">
                Hashed with SHA-256 via Web Crypto API before local storage
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isLockConfigured ? (
                <>
                  <button
                    onClick={() => {
                      setPinModalMode('set');
                      setIsPinModalOpen(true);
                    }}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Change PIN
                  </button>
                  <button
                    onClick={() => {
                      setPinModalMode('remove');
                      setIsPinModalOpen(true);
                    }}
                    className="btn-ghost text-xs text-status-danger px-3 py-1.5"
                  >
                    Disable PIN
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setPinModalMode('set');
                    setIsPinModalOpen(true);
                  }}
                  className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5"
                >
                  <KeyRound size={13} />
                  <span>Set Master PIN</span>
                </button>
              )}
            </div>
          </div>

          {/* Auto-Lock Inactivity */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-2 border-b border-border-light dark:border-border-dark">
            <div>
              <p className="text-xs sm:text-sm font-medium text-text-primary dark:text-text-dark-primary">
                Auto-Lock On Inactivity
              </p>
              <p className="text-2xs text-text-tertiary">
                Automatically lock the application after a period of user inactivity
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(parseInt(e.target.value, 10))}
                disabled={!isLockConfigured}
                className="input-base text-xs py-1.5 px-3 min-w-[130px]"
              >
                <option value={1}>1 Minute</option>
                <option value={5}>5 Minutes</option>
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={0}>Never</option>
              </select>
            </div>
          </div>

          {/* Quick Lock Action */}
          {isLockConfigured && (
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-xs font-medium text-text-primary dark:text-text-dark-primary">
                  Lock Now
                </p>
                <p className="text-2xs text-text-tertiary">
                  Instantly hide all data behind the PIN lock screen
                </p>
              </div>
              <button
                onClick={lockApp}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <Lock size={13} />
                <span>Lock Application</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. Appearance Section */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-apple bg-primary-50 dark:bg-primary-950/30 text-primary-500 flex items-center justify-center">
            <Sun size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
              Appearance
            </h3>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              Select your interface color theme
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          {themeOptions.map(({ value, icon: Icon, label }) => {
            const isSelected = theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-apple border transition-all duration-150 text-xs sm:text-sm font-medium ${
                  isSelected
                    ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400 font-semibold ring-1 ring-primary-500'
                    : 'border-border-light dark:border-border-dark text-text-secondary dark:text-text-dark-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
                {isSelected && <Check size={14} className="ml-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Regional & Timezone */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-apple bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 flex items-center justify-center">
            <Globe size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
              Region & Timezone
            </h3>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              Standardized for Indian business operations and precise expiry calculation
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-xs sm:text-sm py-2 border-b border-border-light dark:border-border-dark">
            <span className="text-text-secondary dark:text-text-dark-secondary">Timezone</span>
            <span className="font-medium text-text-primary dark:text-text-dark-primary font-mono bg-surface-secondary dark:bg-surface-dark-tertiary px-2 py-0.5 rounded">
              Asia/Kolkata (IST, UTC+05:30)
            </span>
          </div>
          <div className="flex items-center justify-between text-xs sm:text-sm py-2 border-b border-border-light dark:border-border-dark">
            <span className="text-text-secondary dark:text-text-dark-secondary">Currency</span>
            <span className="font-medium text-text-primary dark:text-text-dark-primary">
              INR (₹ - Indian Rupee)
            </span>
          </div>
          <div className="flex items-center justify-between text-xs sm:text-sm py-1">
            <span className="text-text-secondary dark:text-text-dark-secondary">Default Date Format</span>
            <span className="font-mono text-xs text-text-primary dark:text-text-dark-primary">
              DD/MM/YYYY
            </span>
          </div>
        </div>
      </div>

      {/* 6. Notifications */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-apple bg-amber-50 dark:bg-amber-950/30 text-amber-500 flex items-center justify-center">
            <Bell size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
              Notifications & Reminders
            </h3>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              In-app alerts and desktop notification permissions
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-text-primary dark:text-text-dark-primary">
                Desktop Notifications
              </p>
              <p className="text-2xs sm:text-xs text-text-tertiary dark:text-text-dark-tertiary">
                System popups when licenses reach 30, 15, 7, 3, or 0 days before expiry
              </p>
            </div>
            <button
              onClick={handleToggleDesktopNotifications}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                Boolean(settings.desktopNotifications) ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  Boolean(settings.desktopNotifications) ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm py-2 border-t border-border-light dark:border-border-dark">
            <span className="text-text-secondary dark:text-text-dark-secondary">
              Browser Permission Status
            </span>
            <span
              className={`badge ${
                notificationStatus === 'granted'
                  ? 'badge-success'
                  : notificationStatus === 'denied'
                  ? 'badge-danger'
                  : 'badge-neutral'
              }`}
            >
              {notificationStatus}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm py-2 border-t border-border-light dark:border-border-dark">
            <span className="text-text-secondary dark:text-text-dark-secondary">
              Default Reminder Schedule
            </span>
            <span className="font-mono text-xs text-text-primary dark:text-text-dark-primary">
              30, 15, 7, 3, 0 days before expiry
            </span>
          </div>

          <div className="pt-2 border-t border-border-light dark:border-border-dark flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-primary dark:text-text-dark-primary">
                Test Desktop Notification
              </p>
              <p className="text-2xs text-text-tertiary">
                Dispatch an immediate test popup via the browser Notification API
              </p>
            </div>
            <button
              onClick={() => {
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('ClientVault Notification Test', {
                    body: 'License alerts are working correctly offline!',
                    icon: '/favicon.svg',
                  });
                } else {
                  handleToggleDesktopNotifications();
                }
              }}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Send Test Alert
            </button>
          </div>
        </div>
      </div>

      {/* 7. Local Database Storage Status */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-apple bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center">
            <HardDrive size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
              Local Database Storage (IndexedDB)
            </h3>
            <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
              Zero cloud dependency. Everything is saved locally on this machine.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-apple bg-surface-secondary dark:bg-surface-dark-tertiary">
            <span className="text-2xs text-text-tertiary uppercase font-medium">Customers</span>
            <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">
              {dbCounts.customers}
            </p>
          </div>
          <div className="p-3 rounded-apple bg-surface-secondary dark:bg-surface-dark-tertiary">
            <span className="text-2xs text-text-tertiary uppercase font-medium">Licenses</span>
            <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">
              {dbCounts.licenses}
            </p>
          </div>
          <div className="p-3 rounded-apple bg-surface-secondary dark:bg-surface-dark-tertiary">
            <span className="text-2xs text-text-tertiary uppercase font-medium">Payments</span>
            <p className="text-lg font-semibold text-text-primary dark:text-text-dark-primary">
              {dbCounts.payments}
            </p>
          </div>
          <div className="p-3 rounded-apple bg-surface-secondary dark:bg-surface-dark-tertiary">
            <span className="text-2xs text-text-tertiary uppercase font-medium">Database Engine</span>
            <p className="text-sm font-semibold text-text-primary dark:text-text-dark-primary mt-1">
              Dexie.js v4
            </p>
          </div>
        </div>
      </div>

      {/* About Box */}
      <div className="card p-6 flex items-center justify-between text-xs text-text-secondary dark:text-text-dark-secondary">
        <div>
          <span className="font-semibold text-text-primary dark:text-text-dark-primary">
            ClientVault
          </span>{' '}
          — Freelancer Customer & License Management
          <p className="text-2xs text-text-tertiary mt-0.5">
            Phase A & B: Offline-First + Supabase Cloud PostgreSQL
          </p>
        </div>
        <span className="badge-info">v1.1.0-online</span>
      </div>

      {/* Modals */}
      <RestoreConfirmModal
        isOpen={isRestoreModalOpen}
        onClose={() => {
          setIsRestoreModalOpen(false);
          setPendingBackup(null);
        }}
        backup={pendingBackup}
        onConfirm={handleConfirmRestore}
      />

      <SetPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        mode={pinModalMode}
      />

      <SqlSchemaModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
      />
    </div>
  );
}
