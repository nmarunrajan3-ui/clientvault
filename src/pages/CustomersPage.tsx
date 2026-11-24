import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Filter,
  Download,
  Building2,
  Phone,
  Mail,
  ShieldCheck,
  MoreVertical,
  Edit,
  Archive,
  RotateCcw,
  ExternalLink,
  LayoutGrid,
  List,
  Check,
  Copy,
} from 'lucide-react';
import { useRepository } from '../contexts/RepositoryContext';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { exportCustomersToCsv } from '../utils/csvExport';
import { BUSINESS_TYPES } from '../schemas/customerSchema';
import type { Customer } from '../types/models';

type StatusFilter = 'all' | 'active' | 'archived';

export default function CustomersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { repo } = useRepository();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCustomers = async () => {
    try {
      // Fetch all customers; query filtering in memory or via repo
      const result = await repo.customers.getAll({ limit: 1000 });
      setCustomers(result.data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [repo]);

  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setCustomerToEdit(null);
      setIsModalOpen(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
    const searchParam = searchParams.get('search');
    if (searchParam) {
      setSearchTerm(searchParam);
    }
  }, [searchParams, setSearchParams]);

  const copyToClipboard = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleArchiveToggle = async (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
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
          description: `Restored customer "${customer.name}" (${customer.customerId}) to active status`,
          createdAt: now,
          schemaVersion: 1,
        });
      } else {
        await repo.customers.archive(customer.customerId);
        await repo.activities.create({
          customerId: customer.customerId,
          type: 'customer_archived',
          description: `Archived customer "${customer.name}" (${customer.customerId})`,
          createdAt: now,
          schemaVersion: 1,
        });
      }
      await loadCustomers();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    // Status Filter
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;

    // Category Filter
    if (categoryFilter !== 'all' && c.businessType !== categoryFilter) return false;

    // Search Query (name, businessName, phone, gstin, customerId)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const match =
        c.name.toLowerCase().includes(term) ||
        c.businessName.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.customerId.toLowerCase().includes(term) ||
        (c.gstin && c.gstin.toLowerCase().includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term));
      if (!match) return false;
    }

    return true;
  });

  const activeCount = customers.filter((c) => c.status === 'active').length;
  const archivedCount = customers.filter((c) => c.status === 'archived').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary tracking-tight">
            Customers
          </h2>
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {activeCount} active client{activeCount === 1 ? '' : 's'} &bull; {archivedCount} archived
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {customers.length > 0 && (
            <button
              onClick={() => exportCustomersToCsv(filteredCustomers)}
              className="btn-secondary text-xs sm:text-sm"
              title="Export filtered records to CSV"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          )}

          <button
            onClick={() => {
              setCustomerToEdit(null);
              setIsModalOpen(true);
            }}
            className="btn-primary text-xs sm:text-sm font-medium shadow-apple-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
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
              placeholder="Search by name, business, phone, GSTIN, or ID (e.g. CUS-000001)..."
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

          {/* Business Category Dropdown */}
          <div className="w-full md:w-56">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-base text-xs sm:text-sm py-2 cursor-pointer"
            >
              <option value="all">All Business Types</option>
              {BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-border-light dark:border-border-dark rounded-apple p-1 bg-surface-secondary dark:bg-surface-dark-tertiary self-end md:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-surface-dark shadow-apple-sm text-primary-500'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-surface-dark shadow-apple-sm text-primary-500'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
              title="Table View"
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 pt-1 border-t border-border-light dark:border-border-dark text-xs">
          <span className="text-text-tertiary font-medium">Status:</span>
          {(['active', 'all', 'archived'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                statusFilter === status
                  ? 'bg-primary-500 text-white shadow-apple-sm'
                  : 'bg-surface-secondary dark:bg-surface-dark-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              {status === 'active'
                ? `Active (${activeCount})`
                : status === 'archived'
                ? `Archived (${archivedCount})`
                : `All (${customers.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Customer List Display */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="card p-12 text-center border-dashed">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-950/30 text-primary-500 flex items-center justify-center">
              <Users size={28} />
            </div>
          </div>
          <h3 className="text-base font-semibold text-text-primary dark:text-text-dark-primary mb-1">
            {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'No matching customers found'
              : 'No customers registered yet'}
          </h3>
          <p className="text-xs sm:text-sm text-text-secondary dark:text-text-dark-secondary mb-6 max-w-sm mx-auto">
            {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search criteria or resetting filters.'
              : 'Add your first business client to start organizing customer details, GSTIN, and software licenses.'}
          </p>
          {!searchTerm && categoryFilter === 'all' && (
            <button
              onClick={() => {
                setCustomerToEdit(null);
                setIsModalOpen(true);
              }}
              className="btn-primary text-xs sm:text-sm font-medium"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Add Your First Customer</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((cust) => (
            <div
              key={cust.customerId}
              onClick={() => navigate(`/customers/${cust.customerId}`)}
              className="card p-5 hover:shadow-apple hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                {/* Top ID + Status */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-2xs px-2 py-0.5 rounded bg-surface-secondary dark:bg-surface-dark-tertiary text-primary-600 dark:text-primary-400 font-semibold border border-border-light dark:border-border-dark">
                      {cust.customerId}
                    </span>
                    <button
                      onClick={(e) => copyToClipboard(cust.customerId, cust.customerId, e)}
                      className="p-1 text-text-tertiary hover:text-primary-500 rounded"
                      title="Copy Customer ID"
                    >
                      {copiedId === cust.customerId ? (
                        <Check size={12} className="text-status-success" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                  <span
                    className={`badge ${
                      cust.status === 'active' ? 'badge-success' : 'badge-neutral'
                    }`}
                  >
                    {cust.status}
                  </span>
                </div>

                {/* Name & Business */}
                <div className="mt-3">
                  <h4 className="text-base font-semibold text-text-primary dark:text-text-dark-primary group-hover:text-primary-500 transition-colors">
                    {cust.name}
                  </h4>
                  <p className="text-xs text-text-secondary dark:text-text-dark-secondary flex items-center gap-1.5 mt-0.5">
                    <Building2 size={13} className="text-primary-500 flex-shrink-0" />
                    <span className="font-medium truncate">{cust.businessName}</span>
                  </p>
                  <span className="inline-block mt-1.5 text-2xs px-2 py-0.5 rounded bg-surface-secondary dark:bg-surface-dark-tertiary text-text-tertiary">
                    {cust.businessType}
                  </span>
                </div>

                {/* Contact information */}
                <div className="mt-4 pt-3 border-t border-border-light dark:border-border-dark space-y-1.5 text-xs text-text-secondary dark:text-text-dark-secondary">
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-text-tertiary flex-shrink-0" />
                    <span>{cust.phone}</span>
                  </div>
                  {cust.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail size={13} className="text-text-tertiary flex-shrink-0" />
                      <span className="truncate">{cust.email}</span>
                    </div>
                  )}
                  {cust.gstin && (
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={13} className="text-emerald-500 flex-shrink-0" />
                      <span className="font-mono text-2xs">{cust.gstin}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Quick Actions */}
              <div className="mt-4 pt-3 border-t border-border-light dark:border-border-dark flex items-center justify-between text-xs text-text-tertiary">
                <span>Joined {new Date(cust.createdAt).toLocaleDateString()}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomerToEdit(cust);
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 rounded hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary text-text-secondary hover:text-text-primary"
                    title="Edit Customer"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={(e) => handleArchiveToggle(cust, e)}
                    className="p-1.5 rounded hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary text-text-secondary hover:text-text-primary"
                    title={cust.status === 'archived' ? 'Restore' : 'Archive'}
                  >
                    {cust.status === 'archived' ? (
                      <RotateCcw size={14} />
                    ) : (
                      <Archive size={14} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="card p-0 overflow-hidden shadow-apple-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-secondary/70 dark:bg-surface-dark-tertiary/70 border-b border-border-light dark:border-border-dark text-text-secondary dark:text-text-dark-secondary font-medium uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Customer ID</th>
                  <th className="py-3 px-4">Customer / Contact</th>
                  <th className="py-3 px-4">Business Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">GSTIN</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {filteredCustomers.map((cust) => (
                  <tr
                    key={cust.customerId}
                    onClick={() => navigate(`/customers/${cust.customerId}`)}
                    className="hover:bg-surface-secondary/50 dark:hover:bg-surface-dark-tertiary/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-primary-500">
                      {cust.customerId}
                    </td>
                    <td className="py-3 px-4 font-semibold text-text-primary dark:text-text-dark-primary">
                      {cust.name}
                    </td>
                    <td className="py-3 px-4 text-text-secondary dark:text-text-dark-secondary font-medium">
                      {cust.businessName}
                    </td>
                    <td className="py-3 px-4 text-text-tertiary">
                      {cust.businessType}
                    </td>
                    <td className="py-3 px-4 font-mono text-text-secondary dark:text-text-dark-secondary">
                      {cust.phone}
                    </td>
                    <td className="py-3 px-4 font-mono text-2xs text-text-tertiary">
                      {cust.gstin || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`badge ${
                          cust.status === 'active' ? 'badge-success' : 'badge-neutral'
                        }`}
                      >
                        {cust.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomerToEdit(cust);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 rounded hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary text-text-secondary hover:text-text-primary"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={(e) => handleArchiveToggle(cust, e)}
                          className="p-1.5 rounded hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary text-text-secondary hover:text-text-primary"
                          title={cust.status === 'archived' ? 'Restore' : 'Archive'}
                        >
                          {cust.status === 'archived' ? (
                            <RotateCcw size={14} />
                          ) : (
                            <Archive size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Form Modal */}
      <CustomerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        customerToEdit={customerToEdit}
        onSuccess={() => {
          loadCustomers();
        }}
      />
    </div>
  );
}
