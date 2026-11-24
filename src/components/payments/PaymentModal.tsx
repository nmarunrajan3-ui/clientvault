import { useState, useEffect } from 'react';
import { X, CreditCard, Calendar, User, KeyRound, AlertCircle, IndianRupee, Hash } from 'lucide-react';
import { useRepository } from '../../contexts/RepositoryContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { getTodayKolkata } from '../../utils/licenseUtils';
import { paymentInputSchema, PAYMENT_METHODS } from '../../schemas/paymentSchema';
import type { Customer, License, Payment } from '../../types/models';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (payment: Payment) => void;
  preselectedCustomer?: Customer | null;
  preselectedLicense?: License | null;
}

export function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedCustomer,
  preselectedLicense,
}: PaymentModalProps) {
  const { repo } = useRepository();
  const { refreshNotifications } = useNotifications();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerLicenses, setCustomerLicenses] = useState<License[]>([]);

  const [customerId, setCustomerId] = useState<string>('');
  const [licenseId, setLicenseId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(getTodayKolkata());
  const [paymentMethod, setPaymentMethod] = useState<typeof PAYMENT_METHODS[number]>('UPI');
  const [status, setStatus] = useState<'paid' | 'partially_paid' | 'unpaid'>('paid');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      repo.customers.getAll({ status: 'active', limit: 1000 }).then((res) => {
        setCustomers(res.data);
      });

      const initialCusId = preselectedCustomer?.customerId || '';
      setCustomerId(initialCusId);

      const initialLicId = preselectedLicense?.licenseId || '';
      setLicenseId(initialLicId);

      setPaymentDate(getTodayKolkata());
      setPaymentMethod('UPI');
      setStatus('paid');
      setAmount('');
      setTransactionRef('');
      setNotes('');
      setErrors({});

      if (initialCusId) {
        repo.licenses.getByCustomer(initialCusId).then((lics) => {
          setCustomerLicenses(lics);
        });
      } else {
        setCustomerLicenses([]);
      }
    }
  }, [isOpen, preselectedCustomer, preselectedLicense, repo]);

  // When customer selection changes, fetch their licenses
  useEffect(() => {
    if (customerId) {
      repo.licenses.getByCustomer(customerId).then((lics) => {
        setCustomerLicenses(lics);
        if (!preselectedLicense) {
          setLicenseId('');
        }
      });
    } else {
      setCustomerLicenses([]);
      setLicenseId('');
    }
  }, [customerId, preselectedLicense, repo]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const payload = {
      customerId,
      licenseId: licenseId || undefined,
      amount: Number(amount),
      paymentDate,
      paymentMethod,
      status,
      transactionRef: transactionRef.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    const validation = paymentInputSchema.safeParse(payload);
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

      const newPayment = await repo.payments.create({
        customerId: payload.customerId,
        licenseId: payload.licenseId,
        amount: payload.amount,
        paymentDate: payload.paymentDate,
        paymentMethod: payload.paymentMethod,
        status: payload.status,
        transactionRef: payload.transactionRef,
        notes: payload.notes,
        createdAt: now,
        schemaVersion: 1,
      });

      const customer = customers.find((c) => c.customerId === payload.customerId) || preselectedCustomer;

      // Log activity
      await repo.activities.create({
        customerId: payload.customerId,
        licenseId: payload.licenseId,
        type: 'payment_recorded',
        description: `Recorded payment of ₹${payload.amount.toLocaleString('en-IN')} (${payload.paymentMethod}, ${payload.status}) from ${customer?.name || payload.customerId}`,
        createdAt: now,
        schemaVersion: 1,
      });

      // Notification
      await repo.notifications.create({
        type: 'payment',
        title: 'Payment Recorded',
        message: `Received ₹${payload.amount.toLocaleString('en-IN')} via ${payload.paymentMethod} from ${customer?.name || payload.customerId}.`,
        isRead: 0,
        relatedId: payload.customerId,
        relatedType: 'customer',
        createdAt: now,
        schemaVersion: 1,
      });

      await refreshNotifications();
      onSuccess(newPayment);
      onClose();
    } catch (err) {
      console.error('Failed to save payment:', err);
      setErrors({ form: 'Failed to record payment. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickAmounts = [5000, 10000, 15000, 25000, 50000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-xl max-h-[92vh] flex flex-col shadow-apple-lg border border-border-light dark:border-border-dark overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light dark:border-border-dark bg-surface-secondary/40 dark:bg-surface-dark-tertiary/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-apple bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
                Record Payment
              </h3>
              <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary">
                Track revenue, payment methods & outstanding balances in INR (₹)
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
              Customer *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
              <select
                required
                disabled={Boolean(preselectedCustomer)}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
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

          {/* Optional Linked License */}
          {customerLicenses.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Link to Software License (Optional)
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
                <select
                  value={licenseId}
                  onChange={(e) => setLicenseId(e.target.value)}
                  className="input-base pl-9 text-xs appearance-none cursor-pointer"
                >
                  <option value="">-- General Payment / Unlinked --</option>
                  {customerLicenses.map((lic) => (
                    <option key={lic.licenseId} value={lic.licenseId}>
                      {lic.licenseId} — {lic.productName} (Expires {new Date(lic.expirationDate).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Amount in INR */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
              Amount in INR (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-text-secondary">
                ₹
              </span>
              <input
                type="number"
                required
                min="1"
                step="1"
                placeholder="e.g. 15000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-base pl-8 text-base font-semibold"
              />
            </div>
            {/* Quick preset chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String(q))}
                  className="px-2.5 py-1 text-2xs rounded-apple bg-surface-secondary dark:bg-surface-dark-tertiary hover:bg-surface-tertiary text-text-secondary font-medium"
                >
                  ₹{q.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
            {errors.amount && <p className="text-2xs text-status-danger mt-1">{errors.amount}</p>}
          </div>

          {/* Date & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Payment Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="input-base pl-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as typeof PAYMENT_METHODS[number])}
                className="input-base text-xs appearance-none cursor-pointer"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Status & Transaction Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Payment Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'paid' | 'partially_paid' | 'unpaid')}
                className="input-base text-xs appearance-none cursor-pointer"
              >
                <option value="paid">Paid (Fully Collected)</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="unpaid">Unpaid / Invoiced</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Transaction Reference / UTR (Optional)
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={14} />
                <input
                  type="text"
                  placeholder="e.g. UPI Ref / NEFT UTR"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="input-base pl-8 text-xs font-mono"
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
              placeholder="e.g. Annual renewal payment received via Google Pay"
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
              className="btn-primary text-xs sm:text-sm min-w-[130px] bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Save Payment'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
