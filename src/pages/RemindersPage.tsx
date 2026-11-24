import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Phone,
  RotateCcw,
  RefreshCw,
  User,
  Calendar,
  Check,
  Trash2,
  Copy,
  Building2,
  Archive,
} from 'lucide-react';
import { useRepository } from '../contexts/RepositoryContext';
import { useReminders } from '../contexts/ReminderContext';
import { RenewalModal } from '../components/licenses/RenewalModal';
import {
  getTodayKolkata,
  getDaysRemaining,
  formatDaysRemaining,
} from '../utils/licenseUtils';
import type { Reminder, License, Customer } from '../types/models';

type ReminderCategory = 'today' | 'upcoming' | 'urgent' | 'overdue' | 'completed';

interface EnrichedReminder {
  reminder: Reminder;
  license?: License;
  customer?: Customer;
  daysRemaining: number;
}

export default function RemindersPage() {
  const { repo } = useRepository();
  const { isChecking, lastChecked, runCheck } = useReminders();

  const [activeCategory, setActiveCategory] = useState<ReminderCategory>('today');
  const [enrichedReminders, setEnrichedReminders] = useState<EnrichedReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [renewalLicense, setRenewalLicense] = useState<License | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const loadRemindersData = async () => {
    try {
      const [allReminders, allLicenses, allCustomers] = await Promise.all([
        repo.reminders.getUpcoming(365), // all reminders for the year
        repo.licenses.getAll({ limit: 1000 }),
        repo.customers.getAll({ limit: 1000 }),
      ]);

      const licMap = new Map<string, License>();
      allLicenses.data.forEach((l) => licMap.set(l.licenseId, l));

      const custMap = new Map<string, Customer>();
      allCustomers.data.forEach((c) => custMap.set(c.customerId, c));

      // Fetch pending & all status reminders
      const pendingList = await repo.reminders.getPending();

      // Combine unique reminders
      const combinedMap = new Map<number, Reminder>();
      [...allReminders, ...pendingList].forEach((r) => {
        if (r.id) combinedMap.set(r.id, r);
      });

      const enriched: EnrichedReminder[] = Array.from(combinedMap.values()).map((r) => {
        const lic = licMap.get(r.licenseId);
        const cust = custMap.get(r.customerId);
        const daysRemaining = lic ? getDaysRemaining(lic.expirationDate) : 0;
        return {
          reminder: r,
          license: lic,
          customer: cust,
          daysRemaining,
        };
      });

      setEnrichedReminders(enriched);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRemindersData();
  }, [repo]);

  const copyPhone = (phone: string, remId: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(remId);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const markReminderCompleted = async (rem: Reminder) => {
    if (!rem.id) return;
    try {
      await repo.reminders.update(rem.id, { status: 'completed' });
      await loadRemindersData();
    } catch (err) {
      console.error('Failed to mark completed:', err);
    }
  };

  const dismissReminder = async (rem: Reminder) => {
    if (!rem.id) return;
    try {
      await repo.reminders.update(rem.id, { status: 'dismissed' });
      await loadRemindersData();
    } catch (err) {
      console.error('Failed to dismiss reminder:', err);
    }
  };

  const todayStr = getTodayKolkata();

  // Categorization
  const categorized = {
    today: enrichedReminders.filter(
      (e) =>
        (e.reminder.status === 'pending' || e.reminder.status === 'sent') &&
        e.reminder.reminderDate <= todayStr &&
        e.daysRemaining >= 0
    ),
    urgent: enrichedReminders.filter(
      (e) =>
        (e.reminder.status === 'pending' || e.reminder.status === 'sent') &&
        e.daysRemaining <= 7 &&
        e.daysRemaining >= 0
    ),
    upcoming: enrichedReminders.filter(
      (e) =>
        (e.reminder.status === 'pending' || e.reminder.status === 'sent') &&
        e.reminder.reminderDate > todayStr &&
        e.daysRemaining > 7
    ),
    overdue: enrichedReminders.filter(
      (e) =>
        (e.reminder.status === 'pending' || e.reminder.status === 'sent') &&
        e.daysRemaining < 0
    ),
    completed: enrichedReminders.filter(
      (e) => e.reminder.status === 'completed' || e.reminder.status === 'dismissed'
    ),
  };

  const currentList = categorized[activeCategory];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary tracking-tight">
            Renewal Reminders
          </h2>
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-0.5">
            Automated alerts for expiring software licenses (30d, 15d, 7d, 3d, 0d)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              await runCheck();
              await loadRemindersData();
            }}
            disabled={isChecking}
            className="btn-secondary text-xs sm:text-sm"
            title="Scan database and trigger pending alerts"
          >
            <RefreshCw size={15} className={isChecking ? 'animate-spin' : ''} />
            <span>{isChecking ? 'Checking...' : 'Check Reminders Now'}</span>
          </button>
        </div>
      </div>

      {/* Categories Tabs */}
      <div className="border-b border-border-light dark:border-border-dark flex flex-wrap items-center gap-2 sm:gap-6 text-sm font-medium">
        {(
          [
            { id: 'today', label: "Today's Due", count: categorized.today.length, icon: Clock },
            { id: 'urgent', label: 'Urgent (≤ 7d)', count: categorized.urgent.length, icon: AlertTriangle },
            { id: 'upcoming', label: 'Upcoming', count: categorized.upcoming.length, icon: Calendar },
            { id: 'overdue', label: 'Overdue / Expired', count: categorized.overdue.length, icon: AlertTriangle },
            { id: 'completed', label: 'Completed', count: categorized.completed.length, icon: CheckCircle2 },
          ] as const
        ).map(({ id, label, count, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveCategory(id)}
            className={`pb-3 relative transition-colors flex items-center gap-2 ${
              activeCategory === id
                ? 'text-primary-500 font-semibold border-b-2 border-primary-500'
                : 'text-text-secondary dark:text-text-dark-secondary hover:text-text-primary'
            }`}
          >
            <Icon size={16} />
            <span>{label}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-2xs font-semibold ${
                activeCategory === id
                  ? 'bg-primary-500 text-white'
                  : 'bg-surface-secondary dark:bg-surface-dark-tertiary text-text-tertiary'
              }`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Reminder Cards List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : currentList.length === 0 ? (
        <div className="card p-12 text-center border-dashed">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 size={28} />
            </div>
          </div>
          <h3 className="text-base font-semibold text-text-primary dark:text-text-dark-primary mb-1">
            No reminders in this section
          </h3>
          <p className="text-xs sm:text-sm text-text-secondary dark:text-text-dark-secondary max-w-sm mx-auto">
            {activeCategory === 'today'
              ? 'Great! There are no license reminders scheduled for today.'
              : activeCategory === 'urgent'
              ? 'No urgent expirations due within the next 7 days.'
              : activeCategory === 'overdue'
              ? 'All software licenses are currently active and valid.'
              : 'Reminders will appear automatically as licenses near expiration.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentList.map(({ reminder, license, customer, daysRemaining }) => {
            const daysInfo = license
              ? formatDaysRemaining(license.expirationDate)
              : { label: 'Unknown', isOverdue: false };

            return (
              <div
                key={reminder.id}
                className="card p-5 border border-border-light dark:border-border-dark hover:shadow-apple transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Customer, Product, Message */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-2xs px-2 py-0.5 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-semibold border border-primary-200 dark:border-primary-800">
                        {reminder.licenseId}
                      </span>
                      <span
                        className={`badge ${
                          reminder.status === 'sent'
                            ? 'badge-warning'
                            : reminder.status === 'completed'
                            ? 'badge-success'
                            : 'badge-info'
                        }`}
                      >
                        {reminder.status === 'sent' ? 'Alert Triggered' : reminder.status}
                      </span>
                      <span
                        className={`text-2xs font-semibold px-2 py-0.5 rounded ${
                          daysRemaining < 0
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                            : daysRemaining <= 7
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}
                      >
                        {daysInfo.label}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
                        {license?.productName || 'Software Product'}
                      </h4>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
                        <Link
                          to={`/customers/${reminder.customerId}`}
                          className="hover:text-primary-500 font-medium hover:underline flex items-center gap-1.5"
                        >
                          <User size={13} className="text-text-tertiary" />
                          <span>{customer?.name || reminder.customerId}</span>
                          {customer?.businessName && (
                            <span className="text-text-tertiary">({customer.businessName})</span>
                          )}
                        </Link>

                        {customer?.phone && (
                          <div className="flex items-center gap-1 bg-surface-secondary dark:bg-surface-dark-tertiary px-2 py-0.5 rounded">
                            <Phone size={12} className="text-text-tertiary" />
                            <a href={`tel:${customer.phone}`} className="hover:text-primary-500 font-mono">
                              {customer.phone}
                            </a>
                            <button
                              onClick={() => copyPhone(customer.phone, String(reminder.id))}
                              className="p-0.5 hover:text-primary-500 text-text-tertiary"
                              title="Copy Phone"
                            >
                              {copiedPhone === String(reminder.id) ? (
                                <Check size={11} className="text-status-success" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {reminder.message && (
                      <p className="text-xs text-text-tertiary leading-relaxed pt-1">
                        {reminder.message}
                      </p>
                    )}
                  </div>

                  {/* Right: Dates & Action Buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 text-xs">
                    <div className="space-y-0.5 text-left lg:text-right">
                      <div className="text-text-tertiary text-2xs">
                        Reminder Date: <span className="font-mono text-text-secondary">{new Date(reminder.reminderDate).toLocaleDateString()}</span>
                      </div>
                      <div className="font-semibold text-text-primary dark:text-text-dark-primary">
                        Expires: <span className="font-mono text-primary-600 dark:text-primary-400 font-bold">{license ? new Date(license.expirationDate).toLocaleDateString() : 'N/A'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch sm:self-auto">
                      {license && (
                        <button
                          onClick={() => setRenewalLicense(license)}
                          className="btn-primary text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700"
                          title="Paste Renewal Key"
                        >
                          <RotateCcw size={14} />
                          <span>Renew Now</span>
                        </button>
                      )}

                      {reminder.status !== 'completed' && (
                        <button
                          onClick={() => markReminderCompleted(reminder)}
                          className="btn-secondary text-xs px-2.5 py-1.5"
                          title="Mark reminder completed"
                        >
                          <Check size={14} />
                          <span>Done</span>
                        </button>
                      )}

                      {reminder.status !== 'dismissed' && (
                        <button
                          onClick={() => dismissReminder(reminder)}
                          className="btn-ghost p-1.5 text-text-tertiary hover:text-status-danger"
                          title="Dismiss"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Renewal Modal */}
      <RenewalModal
        isOpen={Boolean(renewalLicense)}
        onClose={() => setRenewalLicense(null)}
        license={renewalLicense}
        onSuccess={() => {
          loadRemindersData();
        }}
      />
    </div>
  );
}
