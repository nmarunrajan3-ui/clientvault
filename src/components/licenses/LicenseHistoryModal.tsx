import { useState, useEffect } from 'react';
import {
  X,
  History,
  KeyRound,
  RotateCcw,
  Calendar,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useRepository } from '../../contexts/RepositoryContext';
import { maskLicenseKey, formatDaysRemaining } from '../../utils/licenseUtils';
import type { License, Renewal } from '../../types/models';

interface LicenseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  license: License | null;
}

export function LicenseHistoryModal({ isOpen, onClose, license }: LicenseHistoryModalProps) {
  const { repo } = useRepository();
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && license) {
      setLoading(true);
      repo.renewals
        .getByLicense(license.licenseId)
        .then((res) => {
          // Sort oldest first so initial activation is at the top, followed by each renewal
          const sorted = [...res].sort(
            (a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime()
          );
          setRenewals(sorted);
        })
        .finally(() => setLoading(false));
      setRevealedKeys({});
      setCopiedKey(null);
    }
  }, [isOpen, license, repo]);

  if (!isOpen || !license) return null;

  const toggleReveal = (keyId: string) => {
    setRevealedKeys((prev) => ({
      ...prev,
      [keyId]: !prev[keyId],
    }));
  };

  const copyToClipboard = (key: string, keyId: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const daysInfo = formatDaysRemaining(license.expirationDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-2xl max-h-[92vh] flex flex-col shadow-apple-lg border border-border-light dark:border-border-dark overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light dark:border-border-dark bg-surface-secondary/40 dark:bg-surface-dark-tertiary/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-apple bg-primary-500/10 text-primary-500 flex items-center justify-center">
              <History size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
                License & Key History
              </h3>
              <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary font-mono">
                {license.licenseId} &bull; {license.productName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-1.5 rounded-full text-text-tertiary hover:text-text-primary dark:hover:text-text-dark-primary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Status Summary */}
        <div className="p-4 bg-surface-secondary/50 dark:bg-surface-dark-tertiary/50 border-b border-border-light dark:border-border-dark flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">Customer:</span>
            <span className="font-semibold text-text-primary dark:text-text-dark-primary">
              {license.customerId}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">Current Status:</span>
            <span
              className={`badge ${
                license.status === 'active'
                  ? 'badge-success'
                  : license.status === 'expired'
                  ? 'badge-danger'
                  : 'badge-warning'
              }`}
            >
              {license.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-text-tertiary">Valid Until:</span>
            <span className="font-mono font-semibold text-text-primary dark:text-text-dark-primary">
              {new Date(license.expirationDate).toLocaleDateString()}
            </span>
            <span
              className={`text-2xs font-medium px-2 py-0.5 rounded ${
                daysInfo.isOverdue
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
              }`}
            >
              {daysInfo.label}
            </span>
          </div>
        </div>

        {/* Key Timeline List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-text-secondary dark:text-text-dark-secondary pb-1">
            <span className="font-semibold uppercase tracking-wider text-2xs">
              Complete Key Timeline ({1 + renewals.length} total keys recorded)
            </span>
            <span className="text-2xs text-text-tertiary">Unlimited History Preserved</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-border-light dark:before:bg-border-dark">
              {/* Item 1: Initial Activation Key */}
              <div className="relative card p-4 border border-border-light dark:border-border-dark shadow-apple-sm">
                <div className="absolute -left-[27px] top-4 w-3.5 h-3.5 rounded-full bg-primary-500 ring-4 ring-white dark:ring-surface-dark-secondary flex items-center justify-center text-white" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border-light dark:border-border-dark">
                  <div className="flex items-center gap-2">
                    <span className="badge-info text-2xs">Initial Activation</span>
                    <span className="text-xs text-text-tertiary">
                      Issued: {new Date(license.issueDate).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="text-2xs text-text-tertiary">
                    Initial Expiry: {new Date(license.issueDate).toLocaleDateString()}
                  </span>
                </div>

                {/* Key with Mask/Reveal and Copy */}
                <div className="mt-3 flex items-center justify-between gap-3 p-2.5 rounded-apple bg-surface-secondary dark:bg-surface-dark-tertiary">
                  <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-text-primary dark:text-text-dark-primary break-all">
                    {maskLicenseKey(license.activationKey, Boolean(revealedKeys['activation']))}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleReveal('activation')}
                      className="btn-ghost p-1.5 text-text-tertiary hover:text-text-primary"
                      title={revealedKeys['activation'] ? 'Mask Key' : 'Reveal Key'}
                    >
                      {revealedKeys['activation'] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(license.activationKey, 'activation')}
                      className="btn-ghost p-1.5 text-text-tertiary hover:text-primary-500"
                      title="Copy Key to Clipboard"
                    >
                      {copiedKey === 'activation' ? (
                        <Check size={15} className="text-status-success" />
                      ) : (
                        <Copy size={15} />
                      )}
                    </button>
                  </div>
                </div>

                {license.notes && (
                  <p className="text-xs text-text-tertiary mt-2 italic">Note: {license.notes}</p>
                )}
              </div>

              {/* Items 2+: Renewal Keys */}
              {renewals.map((ren, index) => {
                const renKeyId = `ren-${ren.id || index}`;
                return (
                  <div
                    key={ren.id || index}
                    className="relative card p-4 border border-border-light dark:border-border-dark shadow-apple-sm"
                  >
                    <div className="absolute -left-[27px] top-4 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-surface-dark-secondary" />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border-light dark:border-border-dark">
                      <div className="flex items-center gap-2">
                        <span className="badge-success text-2xs">Renewal #{index + 1}</span>
                        <span className="text-xs text-text-tertiary">
                          Renewed: {new Date(ren.renewalDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-2xs font-mono">
                        <span className="text-text-tertiary">
                          {new Date(ren.previousExpirationDate).toLocaleDateString()}
                        </span>
                        <ArrowRight size={11} className="text-emerald-500" />
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {new Date(ren.newExpirationDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Key with Mask/Reveal and Copy */}
                    <div className="mt-3 flex items-center justify-between gap-3 p-2.5 rounded-apple bg-surface-secondary dark:bg-surface-dark-tertiary">
                      <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-text-primary dark:text-text-dark-primary break-all">
                        {maskLicenseKey(ren.renewalKey, Boolean(revealedKeys[renKeyId]))}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => toggleReveal(renKeyId)}
                          className="btn-ghost p-1.5 text-text-tertiary hover:text-text-primary"
                          title={revealedKeys[renKeyId] ? 'Mask Key' : 'Reveal Key'}
                        >
                          {revealedKeys[renKeyId] ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(ren.renewalKey, renKeyId)}
                          className="btn-ghost p-1.5 text-text-tertiary hover:text-primary-500"
                          title="Copy Key to Clipboard"
                        >
                          {copiedKey === renKeyId ? (
                            <Check size={15} className="text-status-success" />
                          ) : (
                            <Copy size={15} />
                          )}
                        </button>
                      </div>
                    </div>

                    {ren.notes && (
                      <p className="text-xs text-text-tertiary mt-2 italic">Note: {ren.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border-light dark:border-border-dark flex items-center justify-end">
          <button onClick={onClose} className="btn-secondary text-xs sm:text-sm">
            Close History
          </button>
        </div>
      </div>
    </div>
  );
}
