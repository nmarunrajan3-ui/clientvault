import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  Search,
  Filter,
  User,
  KeyRound,
  RotateCcw,
  CreditCard,
  Settings,
  Clock,
  Archive,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { useRepository } from '../contexts/RepositoryContext';
import type { Activity } from '../types/models';

type FilterType = 'all' | 'customers' | 'licenses' | 'payments' | 'system';

export default function ActivityPage() {
  const { repo } = useRepository();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadActivities = async () => {
    try {
      const all = await repo.activities.getAll(200);
      setActivities(all);
    } catch (err) {
      console.error('Failed to load activity history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [repo]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'customer_created':
      case 'customer_updated':
        return <User size={14} className="text-blue-500" />;
      case 'customer_archived':
      case 'customer_restored':
        return <Archive size={14} className="text-amber-500" />;
      case 'license_created':
        return <KeyRound size={14} className="text-primary-500" />;
      case 'license_renewed':
        return <RotateCcw size={14} className="text-emerald-500" />;
      case 'license_revoked':
        return <Ban size={14} className="text-rose-500" />;
      case 'payment_recorded':
        return <CreditCard size={14} className="text-emerald-600" />;
      default:
        return <Settings size={14} className="text-text-tertiary" />;
    }
  };

  const filteredActivities = activities.filter((act) => {
    // Type filter
    if (filterType === 'customers' && !act.type.startsWith('customer_')) return false;
    if (filterType === 'licenses' && !act.type.startsWith('license_')) return false;
    if (filterType === 'payments' && !act.type.startsWith('payment_')) return false;
    if (filterType === 'system' && (act.type.startsWith('customer_') || act.type.startsWith('license_') || act.type.startsWith('payment_'))) return false;

    // Search query
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      const match =
        act.description.toLowerCase().includes(term) ||
        (act.customerId && act.customerId.toLowerCase().includes(term)) ||
        (act.licenseId && act.licenseId.toLowerCase().includes(term));
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary tracking-tight">
          Activity History
        </h2>
        <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-0.5">
          Auditable, immutable timeline of customer edits, key renewals, and payments ({activities.length} total events)
        </p>
      </div>

      {/* Controls: Search & Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" size={15} />
            <input
              type="text"
              placeholder="Search activity log by description, customer ID, or license ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-9 text-xs sm:text-sm py-2"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border-light dark:border-border-dark text-xs">
          <span className="text-text-tertiary font-medium">Filter Events:</span>
          {(
            [
              { id: 'all', label: 'All Operations' },
              { id: 'customers', label: 'Customers' },
              { id: 'licenses', label: 'Licenses & Keys' },
              { id: 'payments', label: 'Payments' },
              { id: 'system', label: 'System & Backup' },
            ] as const
          ).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilterType(id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                filterType === id
                  ? 'bg-primary-500 text-white shadow-apple-sm'
                  : 'bg-surface-secondary dark:bg-surface-dark-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="card p-12 text-center border-dashed">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-surface-secondary dark:bg-surface-dark-tertiary text-text-tertiary flex items-center justify-center">
              <History size={28} />
            </div>
          </div>
          <h3 className="text-base font-semibold text-text-primary dark:text-text-dark-primary mb-1">
            No activity records match your filter
          </h3>
          <p className="text-xs sm:text-sm text-text-secondary dark:text-text-dark-secondary max-w-sm mx-auto">
            Operations such as creating customers, renewing keys, and recording payments will appear here in chronological order.
          </p>
        </div>
      ) : (
        <div className="card p-6">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border-light dark:before:bg-border-dark">
            {filteredActivities.map((act) => (
              <div key={act.id} className="relative text-xs">
                {/* Dot */}
                <div className="absolute -left-[27px] top-1 w-6 h-6 rounded-full bg-surface-secondary dark:bg-surface-dark-tertiary border border-border-light dark:border-border-dark flex items-center justify-center">
                  {getActivityIcon(act.type)}
                </div>

                <div className="pl-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <p className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                      {act.description}
                    </p>
                    <span className="text-[11px] font-mono text-text-tertiary flex-shrink-0">
                      {new Date(act.createdAt).toLocaleString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Context Links */}
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {act.customerId && (
                      <Link
                        to={`/customers/${act.customerId}`}
                        className="font-mono text-2xs px-2 py-0.5 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold hover:underline border border-primary-200/60 dark:border-primary-800/40"
                      >
                        {act.customerId}
                      </Link>
                    )}

                    {act.licenseId && (
                      <Link
                        to={`/licenses?search=${act.licenseId}`}
                        className="font-mono text-2xs px-2 py-0.5 rounded bg-surface-secondary dark:bg-surface-dark-tertiary text-text-secondary hover:text-text-primary border border-border-light dark:border-border-dark"
                      >
                        {act.licenseId}
                      </Link>
                    )}

                    <span className="text-2xs text-text-tertiary uppercase tracking-wider font-semibold">
                      {act.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
