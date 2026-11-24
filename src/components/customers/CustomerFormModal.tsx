import { useState, useEffect } from 'react';
import { X, AlertCircle, Building2, User, Phone, Mail, FileText, MapPin, Tag } from 'lucide-react';
import { useRepository } from '../../contexts/RepositoryContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { generateCustomerId } from '../../repositories/LocalRepository';
import { customerInputSchema, BUSINESS_TYPES, type CustomerInput } from '../../schemas/customerSchema';
import type { Customer } from '../../types/models';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (customer: Customer) => void;
  customerToEdit?: Customer | null;
}

export function CustomerFormModal({ isOpen, onClose, onSuccess, customerToEdit }: CustomerFormModalProps) {
  const { repo } = useRepository();
  const { refreshNotifications } = useNotifications();

  const isEdit = Boolean(customerToEdit);

  const [formData, setFormData] = useState<CustomerInput>({
    name: '',
    phone: '',
    businessName: '',
    businessType: BUSINESS_TYPES[0],
    address: '',
    gstin: '',
    email: '',
    notes: '',
    status: 'active',
  });

  const [customBusinessType, setCustomBusinessType] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicatePhoneWarning, setDuplicatePhoneWarning] = useState<Customer | null>(null);
  const [duplicateGstinWarning, setDuplicateGstinWarning] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewId, setPreviewId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (customerToEdit) {
        setFormData({
          name: customerToEdit.name,
          phone: customerToEdit.phone,
          businessName: customerToEdit.businessName,
          businessType: (BUSINESS_TYPES as readonly string[]).includes(customerToEdit.businessType)
            ? customerToEdit.businessType
            : 'Other / Custom',
          address: customerToEdit.address,
          gstin: customerToEdit.gstin || '',
          email: customerToEdit.email || '',
          notes: customerToEdit.notes || '',
          status: customerToEdit.status,
        });

        if (!(BUSINESS_TYPES as readonly string[]).includes(customerToEdit.businessType)) {
          setCustomBusinessType(customerToEdit.businessType);
        } else {
          setCustomBusinessType('');
        }
        setPreviewId(customerToEdit.customerId);
      } else {
        setFormData({
          name: '',
          phone: '',
          businessName: '',
          businessType: BUSINESS_TYPES[0],
          address: '',
          gstin: '',
          email: '',
          notes: '',
          status: 'active',
        });
        setCustomBusinessType('');
        setPreviewId('Generating...');
        generateCustomerId().then((id) => setPreviewId(id));
      }
      setErrors({});
      setDuplicatePhoneWarning(null);
      setDuplicateGstinWarning(null);
    }
  }, [isOpen, customerToEdit]);

  if (!isOpen) return null;

  const handlePhoneBlur = async () => {
    if (!formData.phone || formData.phone.length < 5) return;
    try {
      const existing = await repo.customers.checkDuplicatePhone(
        formData.phone,
        customerToEdit?.customerId
      );
      setDuplicatePhoneWarning(existing || null);
    } catch (err) {
      console.error('Error checking duplicate phone:', err);
    }
  };

  const handleGstinBlur = async () => {
    if (!formData.gstin || formData.gstin.length < 5) return;
    try {
      const existing = await repo.customers.checkDuplicateGstin(
        formData.gstin.toUpperCase(),
        customerToEdit?.customerId
      );
      setDuplicateGstinWarning(existing || null);
    } catch (err) {
      console.error('Error checking duplicate GSTIN:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const effectiveBusinessType =
      formData.businessType === 'Other / Custom' && customBusinessType.trim()
        ? customBusinessType.trim()
        : formData.businessType;

    const payload = {
      ...formData,
      businessType: effectiveBusinessType,
      gstin: formData.gstin ? formData.gstin.toUpperCase().trim() : '',
    };

    const result = customerInputSchema.safeParse(payload);

    if (!result.success) {
      const formattedErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          formattedErrors[issue.path[0].toString()] = issue.message;
        }
      });
      setErrors(formattedErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      const now = new Date().toISOString();
      let savedCustomer: Customer;

      if (isEdit && customerToEdit) {
        savedCustomer = await repo.customers.update(customerToEdit.customerId, {
          name: payload.name,
          phone: payload.phone,
          businessName: payload.businessName,
          businessType: payload.businessType,
          address: payload.address,
          gstin: payload.gstin || undefined,
          email: payload.email || undefined,
          notes: payload.notes || undefined,
          status: payload.status,
          updatedAt: now,
        });

        await repo.activities.create({
          customerId: savedCustomer.customerId,
          type: 'customer_updated',
          description: `Updated customer information for "${savedCustomer.name}" (${savedCustomer.businessName})`,
          createdAt: now,
          schemaVersion: 1,
        });
      } else {
        const customerId = previewId.startsWith('CUS-') ? previewId : await generateCustomerId();

        savedCustomer = await repo.customers.create({
          customerId,
          name: payload.name,
          phone: payload.phone,
          businessName: payload.businessName,
          businessType: payload.businessType,
          address: payload.address,
          gstin: payload.gstin || undefined,
          email: payload.email || undefined,
          notes: payload.notes || undefined,
          status: payload.status,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        });

        await repo.activities.create({
          customerId: savedCustomer.customerId,
          type: 'customer_created',
          description: `Registered new customer "${savedCustomer.name}" (${savedCustomer.businessName}) with ID ${savedCustomer.customerId}`,
          createdAt: now,
          schemaVersion: 1,
        });

        await repo.notifications.create({
          type: 'customer',
          title: 'New Customer Registered',
          message: `${savedCustomer.name} (${savedCustomer.businessName}) added as ${savedCustomer.customerId}.`,
          isRead: 0,
          relatedId: savedCustomer.customerId,
          relatedType: 'customer',
          createdAt: now,
          schemaVersion: 1,
        });

        await refreshNotifications();
      }

      onSuccess(savedCustomer);
      onClose();
    } catch (err) {
      console.error('Failed to save customer:', err);
      setErrors({ form: 'An error occurred while saving. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-2xl max-h-[92vh] flex flex-col shadow-apple-lg border border-border-light dark:border-border-dark overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light dark:border-border-dark bg-surface-secondary/40 dark:bg-surface-dark-tertiary/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-apple bg-primary-500/10 text-primary-500 flex items-center justify-center">
              <User size={18} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
                {isEdit ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary font-mono">
                ID: {previewId}
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

          {/* Section: Customer & Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Customer / Contact Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-base text-sm"
                />
              </div>
              {errors.name && <p className="text-2xs text-status-danger mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Phone Number *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
                <input
                  type="tel"
                  required
                  placeholder="e.g. +91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  onBlur={handlePhoneBlur}
                  className="input-base pl-9 text-sm"
                />
              </div>
              {errors.phone && <p className="text-2xs text-status-danger mt-1">{errors.phone}</p>}
              {duplicatePhoneWarning && (
                <div className="mt-1 p-2 rounded-apple bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-2xs flex items-start gap-1.5 border border-amber-200 dark:border-amber-800">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    Warning: Phone already linked to <strong>{duplicatePhoneWarning.name}</strong> ({duplicatePhoneWarning.customerId}). You may still proceed.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section: Business Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Business / Company Name *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Krishna Traders"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="input-base pl-9 text-sm"
                />
              </div>
              {errors.businessName && (
                <p className="text-2xs text-status-danger mt-1">{errors.businessName}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Business Category / Type *
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
                <select
                  value={formData.businessType}
                  onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  className="input-base pl-9 text-sm appearance-none cursor-pointer"
                >
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              {formData.businessType === 'Other / Custom' && (
                <input
                  type="text"
                  placeholder="Specify custom business category"
                  value={customBusinessType}
                  onChange={(e) => setCustomBusinessType(e.target.value)}
                  className="input-base text-xs mt-2"
                />
              )}
              {errors.businessType && (
                <p className="text-2xs text-status-danger mt-1">{errors.businessType}</p>
              )}
            </div>
          </div>

          {/* Section: GSTIN & Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                GSTIN (Optional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                  onBlur={handleGstinBlur}
                  maxLength={15}
                  className="input-base font-mono text-sm uppercase"
                />
              </div>
              {errors.gstin && <p className="text-2xs text-status-danger mt-1">{errors.gstin}</p>}
              {duplicateGstinWarning && (
                <div className="mt-1 p-2 rounded-apple bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-2xs flex items-start gap-1.5 border border-amber-200 dark:border-amber-800">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    Warning: GSTIN already registered for <strong>{duplicateGstinWarning.businessName}</strong> ({duplicateGstinWarning.customerId}).
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
                Email Address (Optional)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
                <input
                  type="email"
                  placeholder="e.g. billing@krishnatraders.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-base pl-9 text-sm"
                />
              </div>
              {errors.email && <p className="text-2xs text-status-danger mt-1">{errors.email}</p>}
            </div>
          </div>

          {/* Section: Full Address */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
              Full Business Address *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-text-tertiary" size={15} />
              <textarea
                required
                rows={2}
                placeholder="Shop / Unit No., Street, City, State, PIN Code"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="input-base pl-9 text-sm py-2"
              />
            </div>
            {errors.address && <p className="text-2xs text-status-danger mt-1">{errors.address}</p>}
          </div>

          {/* Section: Notes */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary dark:text-text-dark-secondary mb-1">
              Internal Notes (Optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-text-tertiary" size={15} />
              <textarea
                rows={2}
                placeholder="Client preferences, branch count, software version installed, etc."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-base pl-9 text-sm py-2"
              />
            </div>
          </div>

          {/* Status field (Edit mode only) */}
          {isEdit && (
            <div className="flex items-center justify-between p-3 rounded-apple bg-surface-secondary dark:bg-surface-dark-tertiary">
              <div>
                <span className="text-xs font-semibold text-text-primary dark:text-text-dark-primary">
                  Record Status
                </span>
                <p className="text-2xs text-text-tertiary">
                  Archived customers will be hidden from default views
                </p>
              </div>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'archived' })}
                className="input-base w-32 text-xs py-1.5"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}

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
              className="btn-primary text-xs sm:text-sm min-w-[120px]"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Create Customer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
