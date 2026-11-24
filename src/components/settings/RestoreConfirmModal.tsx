import { useState } from 'react';
import { AlertTriangle, Database, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import type { ClientVaultBackup } from '../../services/backupService';

interface RestoreConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  backup: ClientVaultBackup | null;
  onConfirm: (createSafetySnapshot: boolean) => Promise<void>;
}

export function RestoreConfirmModal({
  isOpen,
  onClose,
  backup,
  onConfirm,
}: RestoreConfirmModalProps) {
  const [createSnapshot, setCreateSnapshot] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !backup) return null;

  const handleRestore = async () => {
    setError(null);
    setIsRestoring(true);
    try {
      await onConfirm(createSnapshot);
      setIsRestoring(false);
      onClose();
    } catch (err: any) {
      setIsRestoring(false);
      setError(err?.message || 'Failed to restore backup');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="card max-w-lg w-full p-6 space-y-5 shadow-apple-xl border border-border-light dark:border-border-dark">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-apple bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
                Restore Database from Backup
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                Validated ClientVault archive ready for restoration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRestoring}
            className="btn-ghost p-1 text-text-tertiary hover:text-text-primary dark:hover:text-text-dark-primary"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-apple bg-status-danger/10 border border-status-danger/20 text-xs text-status-danger flex items-start gap-2">
            <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Backup Archive Metadata */}
        <div className="space-y-3 bg-surface-secondary dark:bg-surface-dark-tertiary p-4 rounded-apple text-xs">
          <div className="flex justify-between items-center pb-2 border-b border-border-light dark:border-border-dark">
            <span className="text-text-tertiary">Exported Timestamp</span>
            <span className="font-mono font-medium text-text-primary dark:text-text-dark-primary">
              {new Date(backup.exportedAt).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-border-light dark:border-border-dark">
            <span className="text-text-tertiary">Schema Version</span>
            <span className="font-medium text-text-primary dark:text-text-dark-primary">
              v{backup.schemaVersion} ({backup.app} {backup.version})
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2 bg-white dark:bg-surface-dark-secondary rounded border border-border-light dark:border-border-dark">
              <span className="text-[10px] text-text-tertiary uppercase">Customers</span>
              <p className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                {backup.metadata.customersCount}
              </p>
            </div>
            <div className="p-2 bg-white dark:bg-surface-dark-secondary rounded border border-border-light dark:border-border-dark">
              <span className="text-[10px] text-text-tertiary uppercase">Licenses</span>
              <p className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                {backup.metadata.licensesCount}
              </p>
            </div>
            <div className="p-2 bg-white dark:bg-surface-dark-secondary rounded border border-border-light dark:border-border-dark">
              <span className="text-[10px] text-text-tertiary uppercase">Payments</span>
              <p className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                {backup.metadata.paymentsCount}
              </p>
            </div>
          </div>
        </div>

        {/* Warning Alert */}
        <div className="p-3 rounded-apple bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <p className="leading-relaxed">
            <strong>Warning:</strong> Restoring will replace all current customers, licenses, renewals, and payments with the records in this backup archive.
          </p>
        </div>

        {/* Pre-restore safety snapshot checkbox */}
        <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
          <input
            type="checkbox"
            checked={createSnapshot}
            onChange={(e) => setCreateSnapshot(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
          />
          <div>
            <span className="font-medium text-text-primary dark:text-text-dark-primary">
              Download pre-restore safety snapshot (Recommended)
            </span>
            <p className="text-2xs text-text-tertiary mt-0.5">
              Automatically creates and downloads a full JSON backup of your current database before replacing it.
            </p>
          </div>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-light dark:border-border-dark">
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRestore}
            disabled={isRestoring}
            className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isRestoring ? (
              'Restoring Database...'
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>Confirm & Restore Database</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
