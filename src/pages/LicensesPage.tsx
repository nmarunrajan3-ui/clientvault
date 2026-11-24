import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  KeyRound,
  Plus,
  Search,
  Filter,
  Download,
  RotateCcw,
  History,
  Eye,
  EyeOff,
  Copy,
  Check,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Package,
  User,
  Ban,
  ShieldCheck,
} from 'lucide-react';
import { useRepository } from '../contexts/RepositoryContext';
import { ActivationModal } from '../components/licenses/ActivationModal';
import { RenewalModal } from '../components/licenses/RenewalModal';
import { LicenseHistoryModal } from '../components/licenses/LicenseHistoryModal';
import {
  calculateLicenseStatus,
  formatDaysRemaining,
  maskLicenseKey,
  POPULAR_PRODUCTS,
} from '../utils/licenseUtils';
import type { License, Customer, LicenseStatus } from '../types/models';

type FilterStatus = 'all' | 'active' | 'expiring_soon' | 'urgent' | 'expired' | 'revoked';

export default function LicensesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { repo } = useRepository();

  const [licenses, setLicenses] = useState<License[]>([]);
  const [customersMap, setCustomersMap] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [productFilter, setProductFilter] = useState<string>('all');

  const [isActivationOpen, setIsActivationOpen] = useState(false);
  const [renewalLicense, setRenewalLicense] = useState<License | null>(null);
  const [historyLicense, setHistoryLicense] = useState<License | null>(null);

  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadLicensesData = async () => {
    try {
      const [licRes, custRes] = await Promise.all([
        repo.licenses.getAll({ limit: 1000 }),
        repo.customers.getAll({ limit: 1000 }),
      ]);

      // Map customers by customerId for rapid lookup
      const cMap: Record<string, Customer> = {};
      custRes.data.forEach((c) => {
        cMap[c.customerId] = c;
      });
      setCustomersMap(cMap);

      // Re-calculate live status dynamically based on current date
      const updatedLicenses = licRes.data.map((lic) => {
        const liveStatus = calculateLicenseStatus(lic.expirationDate, lic.status);
        return { ...lic, status: liveStatus };
      });

      setLicenses(updatedLicenses);
    } catch (err) {
      console.error('Failed to load licenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLicensesData();
  }, [repo]);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setIsActivationOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const toggleReveal = (licenseId: string) => {
    setRevealedKeys((prev) => ({
      ...prev,
      [licenseId]: !prev[licenseId],
    }));
  };

  const copyToClipboard = (key: string, licenseId: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(licenseId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRevokeToggle = async (license: License) => {
    const isRevoked = license.status === 'revoked';
    const confirmMsg = isRevoked
      ? `Reactivate license ${license.licenseId}?`
      : `Are you sure you want to revoke license ${license.licenseId}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const now = new Date().toISOString();
      const newStatus: LicenseStatus = isRevoked
        ? calculateLicenseStatus(license.expirationDate)
        : 'revoked';

      await repo.licenses.update(license.licenseId, {
        status: newStatus,
        updatedAt: now,
      });

      await repo.activities.create({
        customerId: license.customerId,
        licenseId: license.licenseId,
        type: isRevoked ? 'license_created' : 'license_revoked',
        description: isRevoked
          ? `Reactivated license ${license.licenseId} (${license.productName})`
          : `Revoked license ${license.licenseId} (${license.productName})`,
        createdAt: now,
        schemaVersion: 1,
      });

      await loadLicensesData();
    } catch (err) {
      console.error('Failed to update revocation:', err);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    const headers = [
      'License ID',
      'Customer ID',
      'Customer Name',
      'Product Name',
      'Current Key',
      'Issue Date',
      'Expiration Date',
      'Status',
      'Notes',
    ];

    const rows = filteredLicenses.map((lic) => {
      const cust = customersMap[lic.customerId];
      return [
        lic.licenseId,
        lic.customerId,
        cust?.name || '',
        lic.productName,
        lic.currentRenewalKey || lic.activationKey,
        new Date(lic.issueDate).toLocaleDateString(),
        new Date(lic.expirationDate).toLocaleDateString(),
        lic.status,
        lic.notes || '',
      ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`);
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientvault-licenses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filtering
  const filteredLicenses = licenses.filter((lic) => {
    // Status Filter
    if (statusFilter !== 'all' && lic.status !== statusFilter) return false;

    // Product Filter
    if (productFilter !== 'all' && lic.productName !== productFilter) return false;

    // Search Query (Product, License ID, Customer ID, Customer Name, or Key)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const cust = customersMap[lic.customerId];
      const currentKey = (lic.currentRenewalKey || lic.activationKey).toLowerCase();

      const match =
        lic.productName.toLowerCase().includes(term) ||
        lic.licenseId.toLowerCase().includes(term) ||
        lic.customerId.toLowerCase().includes(term) ||
        (cust && cust.name.toLowerCase().includes(term)) ||
        (cust && cust.businessName.toLowerCase().includes(term)) ||
        currentKey.includes(term);

      if (!match) return false;
    }

    return true;
  });

  const allProducts = Array.from(new Set(licenses.map((l) => l.productName)));

  // Status counts
  const counts = {
    all: licenses.length,
    active: licenses.filter((l) => l.status === 'active').length,
    expiring_soon: licenses.filter((l) => l.status === 'expiring_soon').length,
    urgent: licenses.filter((l) => l.status === 'urgent').length,
    expired: licenses.filter((l) => l.status === 'expired').length,
    revoked: licenses.filter((l) => l.status === 'revoked').length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary tracking-tight">
            Software Licenses
          </h2>
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {counts.active} active &bull; {counts.expiring_soon + counts.urgent} expiring &bull;{' '}
            {counts.expired} expired
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {licenses.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="btn-secondary text-xs sm:text-sm"
              title="Export licenses to CSV"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          )}

          <button
            onClick={() => setIsActivationOpen(true)}
            className="btn-primary text-xs sm:text-sm font-medium shadow-apple-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Activation</span>
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary dark:text-text-dark-tertiary"
              size={16}
            />
            <input
              type="text"
              placeholder="Search by product, customer, license ID, or pasted key..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-base pl-10 pr-4 py-2 text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Product Filter */}
          <div className="w-full md:w-60">
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="input-base text-xs sm:text-sm py-2 cursor-pointer"
            >
              <option value="all">All Software Products</option>
              {allProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border-light dark:border-border-dark text-xs">
          <span className="text-text-tertiary font-medium">Status:</span>
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'active', label: `Active (${counts.active})` },
              { id: 'expiring_soon', label: `Expiring Soon (${counts.expiring_soon})` },
              { id: 'urgent', label: `Urgent (${counts.urgent})` },
              { id: 'expired', label: `Expired (${counts.expired})` },
              { id: 'revoked', label: `Revoked (${counts.revoked})` },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setStatusFilter(id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                statusFilter === id
                  ? 'bg-primary-500 text-white shadow-apple-sm'
                  : 'bg-surface-secondary dark:bg-surface-dark-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Licenses List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredLicenses.length === 0 ? (
        <div className="card p-12 text-center border-dashed">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/30 text-primary-500 flex items-center justify-center">
              <KeyRound size={28} />
            </div>
          </div>
          <h3 className="text-base font-semibold text-text-primary dark:text-text-dark-primary mb-1">
            {searchTerm || productFilter !== 'all' || statusFilter !== 'all'
              ? 'No matching licenses found'
              : 'No software licenses recorded yet'}
          </h3>
          <p className="text-xs sm:text-sm text-text-secondary dark:text-text-dark-secondary mb-6 max-w-sm mx-auto">
            {searchTerm || productFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search criteria or resetting filters.'
              : 'Add your first customer, then copy and paste activation keys from your external software to track renewals.'}
          </p>
          {!searchTerm && productFilter === 'all' && (
            <button
              onClick={() => setIsActivationOpen(true)}
              className="btn-primary text-xs sm:text-sm font-medium"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Add Activation Key</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLicenses.map((lic) => {
            const customer = customersMap[lic.customerId];
            const currentKey = lic.currentRenewalKey || lic.activationKey;
            const daysInfo = formatDaysRemaining(lic.expirationDate);
            const isRevealed = Boolean(revealedKeys[lic.licenseId]);

            return (
              <div
                key={lic.licenseId}
                className="card p-5 hover:shadow-apple transition-shadow border border-border-light dark:border-border-dark"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Product & Customer */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold border border-primary-200 dark:border-primary-800">
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
                        {lic.status === 'urgent'
                          ? 'Urgent (≤ 7d)'
                          : lic.status === 'expiring_soon'
                          ? 'Expiring Soon'
                          : lic.status}
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

                    <div>
                      <h4 className="text-base font-semibold text-text-primary dark:text-text-dark-primary truncate">
                        {lic.productName}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
                        <User size={13} className="text-text-tertiary" />
                        <Link
                          to={`/customers/${lic.customerId}`}
                          className="hover:text-primary-500 font-medium hover:underline flex items-center gap-1"
                        >
                          <span>{customer?.name || lic.customerId}</span>
                          {customer?.businessName && (
                            <span className="text-text-tertiary">({customer.businessName})</span>
                          )}
                        </Link>
                      </div>
                    </div>

                    {/* Key box with Mask/Reveal & Copy */}
                    <div className="flex items-center gap-2 max-w-lg p-2 rounded-apple bg-surface-secondary dark:bg-surface-dark-tertiary border border-border-light dark:border-border-dark">
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
                          title="Copy Key to Clipboard"
                        >
                          {copiedKey === lic.licenseId ? (
                            <Check size={14} className="text-status-success" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Dates & Action Buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 text-xs">
                    <div className="space-y-1 text-left lg:text-right">
                      <div className="text-text-tertiary">
                        Issued: <span className="text-text-secondary dark:text-text-dark-secondary font-mono">{new Date(lic.issueDate).toLocaleDateString()}</span>
                      </div>
                      <div className="font-medium text-text-primary dark:text-text-dark-primary">
                        Expires: <span className="font-mono font-bold text-sm text-primary-600 dark:text-primary-400">{new Date(lic.expirationDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch sm:self-auto">
                      <button
                        onClick={() => setHistoryLicense(lic)}
                        className="btn-secondary text-xs px-2.5 py-1.5"
                        title="View Full Unlimited Renewal History"
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
                        <span>Renew</span>
                      </button>

                      <button
                        onClick={() => handleRevokeToggle(lic)}
                        className="btn-ghost p-1.5 text-text-tertiary hover:text-status-danger"
                        title={lic.status === 'revoked' ? 'Reactivate' : 'Revoke'}
                      >
                        <Ban size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Activation Modal */}
      <ActivationModal
        isOpen={isActivationOpen}
        onClose={() => setIsActivationOpen(false)}
        onSuccess={() => {
          loadLicensesData();
        }}
      />

      {/* Renewal Modal */}
      <RenewalModal
        isOpen={Boolean(renewalLicense)}
        onClose={() => setRenewalLicense(null)}
        license={renewalLicense}
        onSuccess={() => {
          loadLicensesData();
        }}
      />

      {/* License History Modal */}
      <LicenseHistoryModal
        isOpen={Boolean(historyLicense)}
        onClose={() => setHistoryLicense(null)}
        license={historyLicense}
      />
    </div>
  );
}
