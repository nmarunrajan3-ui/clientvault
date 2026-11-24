import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  KeyRound,
  CreditCard,
  History,
  Edit,
  Archive,
  RotateCcw,
  Plus,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useRepository } from '../contexts/RepositoryContext';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { ActivationModal } from '../components/licenses/ActivationModal';
import { RenewalModal } from '../components/licenses/RenewalModal';
import { LicenseHistoryModal } from '../components/licenses/LicenseHistoryModal';
import { PaymentModal } from '../components/payments/PaymentModal';
import {
  calculateLicenseStatus,
  formatDaysRemaining,
  maskLicenseKey,
} from '../utils/licenseUtils';
import type { Customer, License, Renewal, Payment, Activity } from '../types/models';

type ProfileTab = 'licenses' | 'payments' | 'activity' | 'notes';

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { repo } = useRepository();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ProfileTab>('licenses');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [renewalLicense, setRenewalLicense] = useState<License | null>(null);
  const [historyLicense, setHistoryLicense] = useState<License | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  const loadCustomerData = async () => {
    if (!id) return;
    try {
      const cust = await repo.customers.getById(id);
      if (!cust) {
        setCustomer(null);
        return;
      }
      setCustomer(cust);

      const [licList, renList, payList, actList] = await Promise.all([
        repo.licenses.getByCustomer(id),
        repo.renewals.getByCustomer(id),
        repo.payments.getByCustomer(id),
        repo.activities.getByCustomer(id, 50),
      ]);

      // Calculate dynamic live statuses
      const updatedLicenses = licList.map((lic) => ({
        ...lic,
        status: calculateLicenseStatus(lic.expirationDate, lic.status),
      }));

      setLicenses(updatedLicenses);
      setRenewals(renList);
      setPayments(payList);
      setActivities(actList);
    } catch (err) {
      console.error('Failed to load customer profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomerData();
  }, [id, repo]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleReveal = (licenseId: string) => {
    setRevealedKeys((prev) => ({
      ...prev,
      [licenseId]: !prev[licenseId],
    }));
  };

  const handleToggleArchive = async () => {
    if (!customer) return;
    const isArchived = customer.status === 'archived';
    const confirmMsg = isArchived
      ? `Restore "${customer.name}" to active status?`
      : `Archive "${customer.name}"? They will be hidden from default views.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const now = new Date().toISOString();
      if (isArchived) {
        await repo.customers.restore(customer.customerId);
        await repo.activities.create({
          customerId: customer.customerId,
          type: 'customer_restored',
          description: `Restored customer ${customer.name} to active records.`,
          createdAt: now,
          schemaVersion: 1,
        });
      } else {
        await repo.customers.archive(customer.customerId);
        await repo.activities.create({
          customerId: customer.customerId,
          type: 'customer_archived',
          description: `Archived customer ${customer.name}.`,
          createdAt: now,
          schemaVersion: 1,
        });
      }
      await loadCustomerData();
    } catch (err) {
      console.error('Failed to update archive status:', err);
      alert('Error updating status.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-status-danger-bg text-status-danger flex items-center justify-center">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary">
          Customer Not Found
        </h2>
        <p className="text-xs sm:text-sm text-text-secondary dark:text-text-dark-secondary">
          No customer record found with ID "{id}".
        </p>
        <Link to="/customers" className="btn-primary inline-flex text-xs sm:text-sm mt-4">
          <ArrowLeft size={16} />
          <span>Back to Customers</span>
        </Link>
      </div>
    );
  }

  // Calculate License Summary metrics dynamically
  const totalLic = licenses.length;
  const activeLic = licenses.filter((l) => l.status === 'active').length;
  const expiringLic = licenses.filter((l) => l.status === 'expiring_soon' || l.status === 'urgent').length;
  const expiredLic = licenses.filter((l) => l.status === 'expired').length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Back button & Action Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/customers')}
          className="btn-ghost text-xs sm:text-sm -ml-2 text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          <span>Back to Customers</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsActivationModalOpen(true)}
            className="btn-primary text-xs sm:text-sm font-medium shadow-apple-sm"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Add Activation Key</span>
          </button>

          <button
            onClick={handleToggleArchive}
            className="btn-secondary text-xs sm:text-sm"
            title={customer.status === 'archived' ? 'Restore customer' : 'Archive customer'}
          >
            {customer.status === 'archived' ? (
              <>
                <RotateCcw size={15} />
                <span>Restore</span>
              </>
            ) : (
              <>
                <Archive size={15} />
                <span>Archive</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="btn-secondary text-xs sm:text-sm"
          >
            <Edit size={15} />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Customer Header Profile Card */}
      <div className="card p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs px-2.5 py-1 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold border border-primary-200 dark:border-primary-800">
                {customer.customerId}
              </span>
              <span
                className={`badge ${
                  customer.status === 'active' ? 'badge-success' : 'badge-neutral'
                }`}
              >
                {customer.status === 'active' ? 'Active Client' : 'Archived'}
              </span>
              <span className="badge-neutral">{customer.businessType}</span>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-text-primary dark:text-text-dark-primary tracking-tight">
                {customer.name}
              </h1>
              <p className="text-base text-text-secondary dark:text-text-dark-secondary flex items-center gap-2 mt-0.5">
                <Building2 size={18} className="text-primary-500" />
                <span className="font-medium">{customer.businessName}</span>
              </p>
            </div>

            {/* Contact quick actions */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-text-secondary dark:text-text-dark-secondary">
              <div className="flex items-center gap-1.5 bg-surface-secondary dark:bg-surface-dark-tertiary px-3 py-1.5 rounded-apple">
                <Phone size={14} className="text-text-tertiary" />
                <a href={`tel:${customer.phone}`} className="hover:text-primary-500 font-medium">
                  {customer.phone}
                </a>
                <button
                  onClick={() => copyToClipboard(customer.phone, 'phone')}
                  className="p-1 hover:text-primary-500 ml-1"
                  title="Copy Phone"
                >
                  {copiedField === 'phone' ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
                </button>
              </div>

              {customer.email && (
                <div className="flex items-center gap-1.5 bg-surface-secondary dark:bg-surface-dark-tertiary px-3 py-1.5 rounded-apple">
                  <Mail size={14} className="text-text-tertiary" />
                  <a href={`mailto:${customer.email}`} className="hover:text-primary-500 font-medium">
                    {customer.email}
                  </a>
                  <button
                    onClick={() => copyToClipboard(customer.email!, 'email')}
                    className="p-1 hover:text-primary-500 ml-1"
                    title="Copy Email"
                  >
                    {copiedField === 'email' ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
                  </button>
                </div>
              )}

              {customer.gstin && (
                <div className="flex items-center gap-1.5 bg-surface-secondary dark:bg-surface-dark-tertiary px-3 py-1.5 rounded-apple">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span className="font-mono">{customer.gstin}</span>
                  <button
                    onClick={() => copyToClipboard(customer.gstin!, 'gstin')}
                    className="p-1 hover:text-primary-500 ml-1"
                    title="Copy GSTIN"
                  >
                    {copiedField === 'gstin' ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
                  </button>
                </div>
              )}
            </div>

            {/* Address */}
            <div className="flex items-start gap-2 text-xs text-text-tertiary dark:text-text-dark-tertiary pt-1">
              <MapPin size={14} className="flex-shrink-0 mt-0.5" />
              <span>{customer.address}</span>
            </div>
          </div>

          <div className="text-right flex flex-col md:items-end justify-between self-stretch text-xs text-text-tertiary">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} />
              <span>Registered: {new Date(customer.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* License Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between text-xs text-text-secondary dark:text-text-dark-secondary mb-1">
            <span>Total Licenses</span>
            <KeyRound size={16} className="text-primary-500" />
          </div>
          <p className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">{totalLic}</p>
          <span className="text-2xs text-text-tertiary">All keys registered</span>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-xs text-text-secondary dark:text-text-dark-secondary mb-1">
            <span>Active Licenses</span>
            <CheckCircle2 size={16} className="text-status-success" />
          </div>
          <p className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">{activeLic}</p>
          <span className="text-2xs text-text-tertiary">Current & valid</span>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-xs text-text-secondary dark:text-text-dark-secondary mb-1">
            <span>Expiring Soon</span>
            <Clock size={16} className="text-status-warning" />
          </div>
          <p className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">{expiringLic}</p>
          <span className="text-2xs text-text-tertiary">Within 30 days</span>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-xs text-text-secondary dark:text-text-dark-secondary mb-1">
            <span>Expired</span>
            <AlertTriangle size={16} className="text-status-danger" />
          </div>
          <p className="text-2xl font-bold text-text-primary dark:text-text-dark-primary">{expiredLic}</p>
          <span className="text-2xs text-text-tertiary">Needs renewal</span>
        </div>
      </div>

      {/* Tabbed Navigation */}
      <div className="border-b border-border-light dark:border-border-dark flex items-center gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('licenses')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'licenses'
              ? 'text-primary-500 font-semibold border-b-2 border-primary-500'
              : 'text-text-secondary dark:text-text-dark-secondary hover:text-text-primary'
          }`}
        >
          <span className="flex items-center gap-2">
            <KeyRound size={16} />
            <span>Licenses & Keys ({totalLic})</span>
          </span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'payments'
              ? 'text-primary-500 font-semibold border-b-2 border-primary-500'
              : 'text-text-secondary dark:text-text-dark-secondary hover:text-text-primary'
          }`}
        >
          <span className="flex items-center gap-2">
            <CreditCard size={16} />
            <span>Payments ({payments.length})</span>
          </span>
        </button>

        <button
          onClick={() => setActiveTab('activity')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'activity'
              ? 'text-primary-500 font-semibold border-b-2 border-primary-500'
              : 'text-text-secondary dark:text-text-dark-secondary hover:text-text-primary'
          }`}
        >
          <span className="flex items-center gap-2">
            <History size={16} />
            <span>Activity Timeline</span>
          </span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'notes'
              ? 'text-primary-500 font-semibold border-b-2 border-primary-500'
              : 'text-text-secondary dark:text-text-dark-secondary hover:text-text-primary'
          }`}
        >
          <span>Notes & Details</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'licenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                Software Licenses & Keys
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                Keys pasted manually from external software &bull; Unlimited historical tracking
              </p>
            </div>
            <button
              onClick={() => setIsActivationModalOpen(true)}
              className="btn-primary text-xs font-medium"
            >
              <Plus size={15} />
              <span>Add Activation Key</span>
            </button>
          </div>

          {licenses.length === 0 ? (
            <div className="card p-12 text-center border-dashed">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/30 text-primary-500 flex items-center justify-center mb-3">
                <KeyRound size={24} />
              </div>
              <h4 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                No licenses recorded for this customer
              </h4>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1 max-w-sm mx-auto">
                Paste activation keys generated by your external software into ClientVault to track their expiration.
              </p>
              <button
                onClick={() => setIsActivationModalOpen(true)}
                className="btn-primary text-xs font-medium mt-4"
              >
                <Plus size={15} />
                <span>Add Activation Key</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {licenses.map((lic) => {
                const currentKey = lic.currentRenewalKey || lic.activationKey;
                const daysInfo = formatDaysRemaining(lic.expirationDate);
                const isRevealed = Boolean(revealedKeys[lic.licenseId]);

                return (
                  <div key={lic.licenseId} className="card p-5 border border-border-light dark:border-border-dark">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Product & Key */}
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-2xs px-2 py-0.5 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold border border-primary-200 dark:border-primary-800">
                            {lic.licenseId}
                          </span>
                          <span
                            className={`badge ${
                              lic.status === 'active'
                                ? 'badge-success'
                                : lic.status === 'urgent'
                                ? 'badge-danger'
                                : lic.status === 'expiring_soon'
                                ? 'badge-warning'
                                : lic.status === 'expired'
                                ? 'badge-danger'
                                : 'badge-neutral'
                            }`}
                          >
                            {lic.status}
                          </span>
                          <span
                            className={`text-2xs font-medium px-2 py-0.5 rounded ${
                              daysInfo.isOverdue
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                                : daysInfo.days <= 7
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            }`}
                          >
                            {daysInfo.label}
                          </span>
                        </div>

                        <h4 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
                          {lic.productName}
                        </h4>

                        {/* Masked Key Display with Eye & Copy */}
                        <div className="flex items-center gap-2 max-w-md p-2 rounded-apple bg-surface-secondary dark:bg-surface-dark-tertiary border border-border-light dark:border-border-dark">
                          <KeyRound size={14} className="text-text-tertiary flex-shrink-0 ml-1" />
                          <span className="font-mono text-xs font-semibold tracking-wider text-text-primary dark:text-text-dark-primary flex-1 truncate">
                            {maskLicenseKey(currentKey, isRevealed)}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => toggleReveal(lic.licenseId)}
                              className="p-1 rounded text-text-tertiary hover:text-text-primary"
                              title={isRevealed ? 'Mask Key' : 'Reveal Key'}
                            >
                              {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button
                              onClick={() => copyToClipboard(currentKey, lic.licenseId)}
                              className="p-1 rounded text-text-tertiary hover:text-primary-500"
                              title="Copy Key"
                            >
                              {copiedField === lic.licenseId ? (
                                <Check size={14} className="text-status-success" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        </div>

                        {lic.notes && (
                          <p className="text-2xs text-text-tertiary italic">Note: {lic.notes}</p>
                        )}
                      </div>

                      {/* Right: Expiry & Actions */}
                      <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 text-xs">
                        <div className="space-y-0.5 text-left md:text-right">
                          <div className="text-text-tertiary text-2xs">
                            Issued: {new Date(lic.issueDate).toLocaleDateString()}
                          </div>
                          <div className="font-semibold text-text-primary dark:text-text-dark-primary">
                            Expires: <span className="font-mono text-primary-600 dark:text-primary-400 font-bold">{new Date(lic.expirationDate).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setHistoryLicense(lic)}
                            className="btn-secondary text-xs px-2.5 py-1.5"
                            title="View Full Renewal History"
                          >
                            <History size={14} />
                            <span>History</span>
                          </button>

                          <button
                            onClick={() => setRenewalLicense(lic)}
                            className="btn-primary text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700"
                            title="Paste New Renewal Key"
                          >
                            <RotateCcw size={14} />
                            <span>Renew License</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                Payment History & Invoices
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
                Track payments and outstanding balances in INR (₹)
              </p>
            </div>
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="btn-primary text-xs font-medium self-start sm:self-auto bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus size={15} />
              <span>Record Payment</span>
            </button>
          </div>

          {/* Financial summary for customer */}
          {payments.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-3 bg-surface-secondary/50 dark:bg-surface-dark-tertiary/50">
                <span className="text-2xs text-text-tertiary uppercase font-medium">Total Recorded</span>
                <p className="text-lg font-bold text-text-primary dark:text-text-dark-primary font-mono mt-0.5">
                  ₹{payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="card p-3 bg-emerald-50/50 dark:bg-emerald-950/20">
                <span className="text-2xs text-emerald-600 dark:text-emerald-400 uppercase font-medium">Collected</span>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  ₹{payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="card p-3 bg-rose-50/50 dark:bg-rose-950/20">
                <span className="text-2xs text-rose-600 dark:text-rose-400 uppercase font-medium">Outstanding</span>
                <p className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                  ₹{payments.filter((p) => p.status === 'unpaid' || p.status === 'partially_paid').reduce((sum, p) => sum + p.amount, 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          )}

          {payments.length === 0 ? (
            <div className="card p-12 text-center border-dashed">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center mb-3">
                <CreditCard size={24} />
              </div>
              <h4 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                No payment records found
              </h4>
              <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                Record manual payments received via UPI, Bank Transfer, or Cash for this customer.
              </p>
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="btn-primary text-xs font-medium mt-4 bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus size={15} />
                <span>Record First Payment</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {payments.map((p) => (
                <div key={p.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border border-border-light dark:border-border-dark">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base font-mono text-text-primary dark:text-text-dark-primary">
                        ₹{p.amount.toLocaleString('en-IN')}
                      </span>
                      <span
                        className={`badge ${
                          p.status === 'paid'
                            ? 'badge-success'
                            : p.status === 'partially_paid'
                            ? 'badge-warning'
                            : 'badge-danger'
                        }`}
                      >
                        {p.status === 'paid' ? 'Paid' : p.status === 'partially_paid' ? 'Partially Paid' : 'Unpaid'}
                      </span>
                      <span className="badge-neutral font-medium">{p.paymentMethod}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-text-tertiary text-2xs">
                      <span>Date: {new Date(p.paymentDate).toLocaleDateString()}</span>
                      {p.licenseId && (
                        <span>Linked License: <strong className="font-mono text-text-secondary">{p.licenseId}</strong></span>
                      )}
                      {p.transactionRef && (
                        <span>Ref / UTR: <strong className="font-mono text-text-secondary">{p.transactionRef}</strong></span>
                      )}
                    </div>

                    {p.notes && (
                      <p className="text-text-secondary italic text-2xs mt-0.5">{p.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
            Customer Activity Timeline
          </h3>

          {activities.length === 0 ? (
            <div className="card p-12 text-center border-dashed text-xs text-text-tertiary">
              No recorded activity for this client yet.
            </div>
          ) : (
            <div className="card p-6">
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-light dark:before:bg-border-dark">
                {activities.map((act) => (
                  <div key={act.id} className="relative">
                    <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-primary-500 ring-4 ring-white dark:ring-surface-dark-secondary" />
                    <p className="text-xs font-semibold text-text-primary dark:text-text-dark-primary">
                      {act.description}
                    </p>
                    <span className="text-[11px] text-text-tertiary">
                      {new Date(act.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
            Customer Notes & Configuration
          </h3>
          {customer.notes ? (
            <p className="text-xs sm:text-sm text-text-secondary dark:text-text-dark-secondary whitespace-pre-wrap leading-relaxed">
              {customer.notes}
            </p>
          ) : (
            <p className="text-xs text-text-tertiary italic">No notes added for this customer.</p>
          )}
        </div>
      )}

      {/* Edit Customer Modal */}
      <CustomerFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        customerToEdit={customer}
        onSuccess={(updated) => {
          setCustomer(updated);
          loadCustomerData();
        }}
      />

      {/* Activation Modal */}
      <ActivationModal
        isOpen={isActivationModalOpen}
        onClose={() => setIsActivationModalOpen(false)}
        preselectedCustomer={customer}
        onSuccess={() => {
          loadCustomerData();
        }}
      />

      {/* Renewal Modal */}
      <RenewalModal
        isOpen={Boolean(renewalLicense)}
        onClose={() => setRenewalLicense(null)}
        license={renewalLicense}
        onSuccess={() => {
          loadCustomerData();
        }}
      />

      {/* License History Modal */}
      <LicenseHistoryModal
        isOpen={Boolean(historyLicense)}
        onClose={() => setHistoryLicense(null)}
        license={historyLicense}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        preselectedCustomer={customer}
        onSuccess={() => {
          loadCustomerData();
        }}
      />
    </div>
  );
}
