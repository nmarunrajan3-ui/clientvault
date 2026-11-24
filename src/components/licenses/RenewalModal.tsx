import { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  Calendar,
  AlertCircle,
  Info,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useRepository } from '../../contexts/RepositoryContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  getTodayKolkata,
  calculateRenewalExpiration,
  DURATION_PRESETS,
  calculateLicenseStatus,
  maskLicenseKey,
  type DurationOption,
} from '../../utils/licenseUtils';
import { renewalInputSchema } from '../../schemas/licenseSchema';
import type { License } from '../../types/models';

interface RenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedLicense: License) => void;
  license: License | null;
}

export function RenewalModal({ isOpen, onClose, onSuccess, license }: RenewalModalProps) {
  const { repo } = useRepository();
  const { refreshNotifications } = useNotifications();

  const [renewalKey, setRenewalKey] = useState<string>('');
  const [renewalDate, setRenewalDate] = useState<string>(getTodayKolkata());
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(DURATION_PRESETS[0]); // 1 year default
  const [newExpirationDate, setNewExpirationDate] = useState<string>('');
  const [calculatedFrom, setCalculatedFrom] = useState<'previous_expiry' | 'renewal_date'>('previous_expiry');
  const [notes, setNotes] = useState<string>('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && license) {
      const today = getTodayKolkata();
      setRenewalDate(today);
      setSelectedDuration(DURATION_PRESETS[0]);
      setRenewalKey('');
      setNotes('');
      setErrors({});

      // Calculate initial new expiry using standard logic
      const calc = calculateRenewalExpiration(
        license.expirationDate,
        today,
        DURATION_PRESETS[0]
      );
      setNewExpirationDate(calc.calculatedExpiry);
      setCalculatedFrom(calc.calculatedFrom);
    }
  }, [isOpen, license]);

  // Recalculate when renewalDate or duration changes
  useEffect(() => {
    if (license && selectedDuration.days > 0) {
      const calc = calculateRenewalExpiration(
        license.expirationDate,
        renewalDate,
        selectedDuration
      );
      setNewExpirationDate(calc.calculatedExpiry);
      setCalculatedFrom(calc.calculatedFrom);
    }
  }, [license, renewalDate, selectedDuration]);

  if (!isOpen || !license) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const payload = {
      licenseId: license.licenseId,
      customerId: license.customerId,
      renewalKey: renewalKey.trim(),
      renewalDate,
      previousExpirationDate: license.expirationDate,
      newExpirationDate,
      duration: selectedDuration.days || undefined,
      notes: notes.trim() || undefined,
    };

    const validation = renewalInputSchema.safeParse(payload);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0].toString()] = issue.message;
        }
      });
      setErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const now = new Date().toISOString();

      // 1. Create historical renewal record (PRESERVES UNLIMITED HISTORY)
      await repo.renewals.create({
        licenseId: payload.licenseId,
        customerId: payload.customerId,
        renewalKey: payload.renewalKey,
        previousExpirationDate: payload.previousExpirationDate,
        newExpirationDate: payload.newExpirationDate,
        renewalDate: payload.renewalDate,
        duration: payload.duration,
        notes: payload.notes,
        createdAt: now,
        schemaVersion: 1,
      });

      // 2. Update active license with new expiration date and latest renewal key
      const newStatus = calculateLicenseStatus(payload.newExpirationDate);
      const updatedLicense = await repo.licenses.update(license.licenseId, {
        expirationDate: payload.newExpirationDate,
        currentRenewalKey: payload.renewalKey,
        status: newStatus,
        updatedAt: now,
      });

      // 3. Log activity timeline
      await repo.activities.create({
        customerId: license.customerId,
        licenseId: license.licenseId,
        type: 'license_renewed',
        description: `Renewed license for "${license.productName}" (${license.licenseId}). Extended from ${new Date(
          payload.previousExpirationDate
        ).toLocaleDateString()} to ${new Date(payload.newExpirationDate).toLocaleDateString()}`,
        createdAt: now,
        schemaVersion: 1,
      });

      // 4. In-app notification
      await repo.notifications.create({
        type: 'renewal',
        title: 'License Renewed Successfully',
        message: `${license.productName} (${license.licenseId}) renewed. New expiry: ${new Date(
          payload.newExpirationDate
        ).toLocaleDateString()}.`,
        isRead: 0,
        relatedId: license.licenseId,
        relatedType: 'license',
        createdAt: now,
        schemaVersion: 1,
      });

      await refreshNotifications();
      onSuccess(updatedLicense);
      onClose();
    } catch (err) {
      console.error('Failed to save renewal:', err);
      setErrors({ form: 'An error occurred during renewal. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-2xl max-h-[92vh] flex flex-col shadow-apple-lg border border-border-light dark:border-border-dark overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light dark:border-border-dark bg-surface-secondary/40 dark:bg-surface-dark-tertiary/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-apple bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
                Renew Software License
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

        {/* Existing License Context Callout */}
        <div className="bg-surface-secondary/60 dark:bg-surface-dark-tertiary/60 px-6 py-3 border-b border-border-light dark:border-border-dark text-xs flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-text-tertiary">Customer: </span>
            <span className="font-semibold text-text-primary dark:text-text-dark-primary">
              {license.customerId}
            </span>
          </div>
          <div>
            <span className="text-text-tertiary">Current Key: </span>
            <span className="font-mono text-text-secondary dark:text-text-dark-secondary">
              {maskLicenseKey(license.currentRenewalKey || license.activationKey, false)}
            </span>
          </div>
          <div>
            <span className="text-text-tertiary">Current Expiration: </span>
            <span className="font-semibold text-text-primary dark:text-text-dark-primary font-mono">
              {new Date(license.expirationDate).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errors.form && (
            <div className="p-3 rounded-apple bg-status-danger-bg text-status-danger text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errors.form}</span>
            </div>
          )}

          {/* Paste Renewal Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary">
                Paste New Renewal Key *
              </label>
              <span className="text-2xs text-text-tertiary">Manually copied from generator</span>
            </div>
            <textarea
              required
              rows={2}
              placeholder="e.g. REN-2027-WXYZ-7890-ABCD"
              value={renewalKey}
              onChange={(e) => setRenewalKey(e.target.value)}
              className="input-base font-mono text-sm tracking-wide uppercase py-2 bg-surface-secondary dark:bg-surface-dark-tertiary"
            />
            {errors.renewalKey && (
              <p className="text-2xs text-status-danger mt-1">{errors.renewalKey}</p>
            )}
          </div>

          {/* Renewal Date & Duration Preset */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Renewal Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
                <input
                  type="date"
                  required
                  value={renewalDate}
                  onChange={(e) => setRenewalDate(e.target.value)}
                  className="input-base pl-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Renewal Duration
              </label>
              <select
                value={selectedDuration.label}
                onChange={(e) => {
                  const opt = DURATION_PRESETS.find((p) => p.label === e.target.value);
                  if (opt) setSelectedDuration(opt);
                }}
                className="input-base text-xs appearance-none cursor-pointer"
              >
                {DURATION_PRESETS.map((p) => (
                  <option key={p.label} value={p.label}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Side-by-side Review Box (SPEC REQUIREMENT) */}
          <div className="p-4 rounded-apple bg-primary-50/40 dark:bg-primary-950/20 border border-primary-200/70 dark:border-primary-800/50 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary-700 dark:text-primary-300">
              <Clock size={15} />
              <span>Expiration Date Review & Confirmation</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-surface-dark rounded-apple border border-border-light dark:border-border-dark text-xs">
              <div>
                <span className="text-2xs text-text-tertiary block">Previous Expiration</span>
                <span className="font-semibold text-sm text-text-primary dark:text-text-dark-primary font-mono">
                  {new Date(license.expirationDate).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-2 text-primary-500 font-medium">
                <ArrowRight size={18} />
                <span className="text-2xs uppercase tracking-wider font-semibold">
                  {selectedDuration.label.split(' ')[0]} Extension
                </span>
              </div>

              <div>
                <span className="text-2xs text-text-tertiary block">New Expiration Date</span>
                <input
                  type="date"
                  required
                  value={newExpirationDate}
                  onChange={(e) => {
                    setNewExpirationDate(e.target.value);
                    const customOpt = DURATION_PRESETS.find((p) => p.days === 0);
                    if (customOpt) setSelectedDuration(customOpt);
                  }}
                  className="input-base text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 py-1 px-2.5 w-36"
                />
              </div>
            </div>

            <div className="text-2xs text-text-secondary dark:text-text-dark-secondary flex items-start gap-1.5 leading-relaxed">
              <Info size={13} className="flex-shrink-0 mt-0.5 text-primary-500" />
              <span>
                {calculatedFrom === 'previous_expiry'
                  ? 'Active License: New expiration is calculated seamlessly from previous expiration date without losing remaining valid days.'
                  : 'Expired License: New expiration is calculated from the renewal date.'}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
              Renewal Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Annual renewal payment received via UPI"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-base text-xs py-2"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-border-light dark:border-border-dark flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary text-xs sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs sm:text-sm min-w-[140px] bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Confirm Renewal'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
