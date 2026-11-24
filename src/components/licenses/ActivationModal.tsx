import { useState, useEffect } from 'react';
import { X, KeyRound, Calendar, Package, AlertCircle, Info, User, Check, Clock } from 'lucide-react';
import { useRepository } from '../../contexts/RepositoryContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { generateLicenseId } from '../../repositories/LocalRepository';
import {
  getTodayKolkata,
  addDurationToDate,
  DURATION_PRESETS,
  POPULAR_PRODUCTS,
  calculateLicenseStatus,
  type DurationOption,
} from '../../utils/licenseUtils';
import { activationInputSchema } from '../../schemas/licenseSchema';
import type { Customer, License } from '../../types/models';

interface ActivationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (license: License) => void;
  preselectedCustomer?: Customer | null;
}

export function ActivationModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedCustomer,
}: ActivationModalProps) {
  const { repo } = useRepository();
  const { refreshNotifications } = useNotifications();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [productName, setProductName] = useState<string>(POPULAR_PRODUCTS[0]);
  const [customProduct, setCustomProduct] = useState<string>('');
  const [activationKey, setActivationKey] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(getTodayKolkata());
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(DURATION_PRESETS[0]);
  const [customExpirationDate, setCustomExpirationDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [previewId, setPreviewId] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      repo.customers.getAll({ status: 'active', limit: 1000 }).then((res) => {
        setCustomers(res.data);
      });

      if (preselectedCustomer) {
        setSelectedCustomerId(preselectedCustomer.customerId);
      } else {
        setSelectedCustomerId('');
      }

      const today = getTodayKolkata();
      setIssueDate(today);
      setSelectedDuration(DURATION_PRESETS[0]);
      setCustomExpirationDate(addDurationToDate(today, DURATION_PRESETS[0]));
      setProductName(POPULAR_PRODUCTS[0]);
      setCustomProduct('');
      setActivationKey('');
      setNotes('');
      setErrors({});

      setPreviewId('Generating...');
      generateLicenseId().then((id) => setPreviewId(id));
    }
  }, [isOpen, preselectedCustomer, repo]);

  // Recalculate expiration date when issue date or duration changes
  useEffect(() => {
    if (selectedDuration.days > 0) {
      const computed = addDurationToDate(issueDate, selectedDuration);
      setCustomExpirationDate(computed);
    }
  }, [issueDate, selectedDuration]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const effectiveProduct =
      productName === 'Custom Product' && customProduct.trim()
        ? customProduct.trim()
        : productName;

    const payload = {
      customerId: selectedCustomerId,
      productName: effectiveProduct,
      activationKey: activationKey.trim(),
      issueDate,
      expirationDate: customExpirationDate,
      duration: selectedDuration.days || undefined,
      notes: notes.trim() || undefined,
    };

    const validation = activationInputSchema.safeParse(payload);
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
      const licenseId = previewId.startsWith('LIC-') ? previewId : await generateLicenseId();
      const status = calculateLicenseStatus(payload.expirationDate);

      const newLicense = await repo.licenses.create({
        licenseId,
        customerId: payload.customerId,
        productName: payload.productName,
        activationKey: payload.activationKey,
        issueDate: payload.issueDate,
        expirationDate: payload.expirationDate,
        status,
        duration: payload.duration,
        notes: payload.notes,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      });

      // Find customer name for log
      const customer = customers.find((c) => c.customerId === payload.customerId) || preselectedCustomer;

      // Log activity
      await repo.activities.create({
        customerId: payload.customerId,
        licenseId: newLicense.licenseId,
        type: 'license_created',
        description: `Pasted initial activation key for "${payload.productName}" (${licenseId}) assigned to ${customer?.name || payload.customerId}`,
        createdAt: now,
        schemaVersion: 1,
      });

      // Notification
      await repo.notifications.create({
        type: 'system',
        title: 'New License Key Added',
        message: `${payload.productName} license (${licenseId}) issued. Expires on ${new Date(payload.expirationDate).toLocaleDateString()}.`,
        isRead: 0,
        relatedId: newLicense.licenseId,
        relatedType: 'license',
        createdAt: now,
        schemaVersion: 1,
      });

      await refreshNotifications();
      onSuccess(newLicense);
      onClose();
    } catch (err) {
      console.error('Failed to save license:', err);
      setErrors({ form: 'Failed to record activation key. Please try again.' });
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
            <div className="w-8 h-8 rounded-apple bg-primary-500/10 text-primary-500 flex items-center justify-center">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
                Add Activation Key
              </h3>
              <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary font-mono">
                License ID: {previewId}
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

        {/* Info Callout */}
        <div className="bg-primary-50/50 dark:bg-primary-950/20 px-6 py-2.5 border-b border-primary-100 dark:border-primary-900/30 flex items-center gap-2 text-xs text-primary-700 dark:text-primary-300">
          <Info size={15} className="flex-shrink-0" />
          <span>
            ClientVault does not generate keys. Copy the key from your external key generator and paste it below.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errors.form && (
            <div className="p-3 rounded-apple bg-status-danger-bg text-status-danger text-xs flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{errors.form}</span>
            </div>
          )}

          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
              Select Customer *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
              <select
                required
                disabled={Boolean(preselectedCustomer)}
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="input-base pl-9 text-sm appearance-none cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
              >
                <option value="">-- Choose a Customer --</option>
                {customers.map((c) => (
                  <option key={c.customerId} value={c.customerId}>
                    {c.customerId} — {c.name} ({c.businessName})
                  </option>
                ))}
              </select>
            </div>
            {errors.customerId && (
              <p className="text-2xs text-status-danger mt-1">{errors.customerId}</p>
            )}
          </div>

          {/* Product Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Software Product Name *
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
                <select
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="input-base pl-9 text-sm appearance-none cursor-pointer"
                >
                  {POPULAR_PRODUCTS.map((prod) => (
                    <option key={prod} value={prod}>
                      {prod}
                    </option>
                  ))}
                  <option value="Custom Product">Custom / Other Product</option>
                </select>
              </div>
            </div>

            {productName === 'Custom Product' && (
              <div>
                <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                  Specify Custom Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HotelDesk Manager v4"
                  value={customProduct}
                  onChange={(e) => setCustomProduct(e.target.value)}
                  className="input-base text-sm"
                />
              </div>
            )}
          </div>

          {/* Paste Activation Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary">
                Paste Activation Key *
              </label>
              <span className="text-2xs text-text-tertiary">Copied from external software</span>
            </div>
            <textarea
              required
              rows={2}
              placeholder="e.g. POS-2026-ABCD-EFGH-1234-5678"
              value={activationKey}
              onChange={(e) => setActivationKey(e.target.value)}
              className="input-base font-mono text-sm tracking-wide uppercase py-2 bg-surface-secondary dark:bg-surface-dark-tertiary"
            />
            {errors.activationKey && (
              <p className="text-2xs text-status-danger mt-1">{errors.activationKey}</p>
            )}
          </div>

          {/* Date & Duration Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Issue Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="input-base pl-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                License Duration
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

            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Calculated Expiry Date *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
                <input
                  type="date"
                  required
                  value={customExpirationDate}
                  onChange={(e) => {
                    setCustomExpirationDate(e.target.value);
                    const customOpt = DURATION_PRESETS.find((p) => p.days === 0);
                    if (customOpt) setSelectedDuration(customOpt);
                  }}
                  className="input-base pl-9 text-xs font-semibold text-primary-600 dark:text-primary-400"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
              Internal Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Single PC license, HWID bound to cashier machine"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-base text-xs py-2"
            />
          </div>

          {/* Form Actions */}
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
              className="btn-primary text-xs sm:text-sm min-w-[140px]"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Save Activation Key'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
