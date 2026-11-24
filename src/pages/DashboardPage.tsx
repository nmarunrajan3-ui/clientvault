import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  KeyRound,
  AlertTriangle,
  Clock,
  TrendingUp,
  RotateCcw,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  History,
  Calendar,
  Building2,
  ChevronRight,
  IndianRupee,
} from 'lucide-react';
import { useRepository } from '../contexts/RepositoryContext';
import { RenewalModal } from '../components/licenses/RenewalModal';
import { PaymentModal } from '../components/payments/PaymentModal';
import {
  getTodayKolkata,
  formatDaysRemaining,
  getDaysRemaining,
  calculateLicenseStatus,
  maskLicenseKey,
} from '../utils/licenseUtils';
import type { Customer, License, Renewal, Payment, Activity } from '../types/models';

interface DashboardData {
  totalCustomers: number;
  activeCustomers: number;
  totalLicenses: number;
  activeLicenses: number;
  expiringIn30Count: number;
  expiringIn7Count: number;
  expiredCount: number;
  renewalsThisMonthCount: number;

  totalRevenue: number;
  outstandingBalance: number;

  upcomingExpiringLicenses: License[];
  recentCustomers: Customer[];
  recentRenewals: Renewal[];
  recentActivities: Activity[];
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { repo } = useRepository();

  const [data, setData] = useState<DashboardData>({
    totalCustomers: 0,
    activeCustomers: 0,
    totalLicenses: 0,
    activeLicenses: 0,
    expiringIn30Count: 0,
    expiringIn7Count: 0,
    expiredCount: 0,
    renewalsThisMonthCount: 0,
    totalRevenue: 0,
    outstandingBalance: 0,
    upcomingExpiringLicenses: [],
    recentCustomers: [],
    recentRenewals: [],
    recentActivities: [],
  });

  const [customersMap, setCustomersMap] = useState<Map<string, Customer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [renewalLicense, setRenewalLicense] = useState<License | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const loadDashboardData = async () => {
    try {
      const today = getTodayKolkata();
      const currentMonthPrefix = today.substring(0, 7); // YYYY-MM

      const [
        allCustRes,
        allLicRes,
        allRenewals,
        paymentSummary,
        allActivities,
      ] = await Promise.all([
        repo.customers.getAll({ limit: 1000 }),
        repo.licenses.getAll({ limit: 1000 }),
        repo.renewals.getRecent(100),
        repo.payments.getSummary(),
        repo.activities.getRecent(10),
      ]);

      const custs = allCustRes.data;
      const lics = allLicRes.data;

      // Populate customer lookup map
      const cMap = new Map<string, Customer>();
      custs.forEach((c) => cMap.set(c.customerId, c));
      setCustomersMap(cMap);

      // Active / Expiring / Expired licenses computed dynamically
      let activeCount = 0;
      let exp30Count = 0;
      let exp7Count = 0;
      let expCount = 0;

      const upcoming: License[] = [];

      lics.forEach((lic) => {
        if (lic.status === 'revoked') return;
        const days = getDaysRemaining(lic.expirationDate);
        if (days < 0) {
          expCount++;
        } else {
          activeCount++;
          if (days <= 30) {
            exp30Count++;
            upcoming.push(lic);
            if (days <= 7) {
              exp7Count++;
            }
          }
        }
      });

      // Sort upcoming by closest expiration date first
      upcoming.sort(
        (a, b) => new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
      );

      // Renewals this month
      const renewalsThisMonth = allRenewals.filter(
        (r) => r.renewalDate && r.renewalDate.startsWith(currentMonthPrefix)
      );

      setData({
        totalCustomers: custs.length,
        activeCustomers: custs.filter((c) => c.status === 'active').length,
        totalLicenses: lics.length,
        activeLicenses: activeCount,
        expiringIn30Count: exp30Count,
        expiringIn7Count: exp7Count,
        expiredCount: expCount,
        renewalsThisMonthCount: renewalsThisMonth.length,
        totalRevenue: paymentSummary.paid,
        outstandingBalance: paymentSummary.outstanding,
        upcomingExpiringLicenses: upcoming.slice(0, 5),
        recentCustomers: custs.slice(0, 5),
        recentRenewals: allRenewals.slice(0, 5),
        recentActivities: allActivities,
      });
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [repo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Total Customers',
      value: data.totalCustomers,
      subtitle: `${data.activeCustomers} active clients`,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      link: '/customers',
    },
    {
      label: 'Active Licenses',
      value: data.activeLicenses,
      subtitle: `${data.totalLicenses} registered products`,
      icon: KeyRound,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      link: '/licenses',
    },
    {
      label: 'Expiring in 30 Days',
      value: data.expiringIn30Count,
      subtitle: `${data.expiringIn7Count} urgent (≤ 7 days)`,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      link: '/reminders',
    },
    {
      label: 'Expired Licenses',
      value: data.expiredCount,
      subtitle: 'Require renewal',
      icon: AlertTriangle,
      color: 'text-rose-500',
      bgColor: 'bg-rose-50 dark:bg-rose-950/30',
      link: '/licenses',
    },
    {
      label: 'Renewals This Month',
      value: data.renewalsThisMonthCount,
      subtitle: 'Recorded extensions',
      icon: RotateCcw,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
      link: '/licenses',
    },
    {
      label: 'Total Collected Revenue',
      value: `₹${data.totalRevenue.toLocaleString('en-IN')}`,
      subtitle: 'All-time payments collected',
      icon: IndianRupee,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      link: '/settings',
    },
    {
      label: 'Outstanding Balance',
      value: `₹${data.outstandingBalance.toLocaleString('en-IN')}`,
      subtitle: 'Pending invoice balances',
      icon: CreditCard,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      link: '/settings',
    },
    {
      label: 'Storage Health',
      value: 'IndexedDB',
      subtitle: '100% Offline / Local',
      icon: ShieldCheck,
      color: 'text-primary-500',
      bgColor: 'bg-primary-50 dark:bg-primary-950/30',
      link: '/settings',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Banner & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-text-primary dark:text-text-dark-primary tracking-tight">
            Dashboard
          </h2>
          <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-0.5">
            Real-time business analytics and license telemetry (IndexedDB Offline Engine)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="btn-secondary text-xs sm:text-sm font-medium"
          >
            <CreditCard size={15} />
            <span>Record Payment</span>
          </button>

          <Link
            to="/licenses?new=true"
            className="btn-secondary text-xs sm:text-sm font-medium"
          >
            <KeyRound size={15} />
            <span>Add License</span>
          </Link>

          <Link
            to="/customers?new=true"
            className="btn-primary text-xs sm:text-sm font-medium shadow-apple-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Add Customer</span>
          </Link>
        </div>
      </div>

      {/* 8 Metric KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, subtitle, icon: Icon, color, bgColor, link }) => (
          <Link
            to={link}
            key={label}
            className="card p-5 group hover:border-primary-400 dark:hover:border-primary-600 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-secondary dark:text-text-dark-secondary">
                {label}
              </span>
              <div className={`w-8 h-8 rounded-apple flex items-center justify-center ${bgColor} ${color}`}>
                <Icon size={17} />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold text-text-primary dark:text-text-dark-primary tracking-tight font-mono">
                {value}
              </span>
              <ArrowUpRight
                size={15}
                className="text-text-tertiary group-hover:text-primary-500 transition-colors"
              />
            </div>
            <p className="text-2xs text-text-tertiary dark:text-text-dark-tertiary mt-2">
              {subtitle}
            </p>
          </Link>
        ))}
      </div>

      {/* Grid: Upcoming Expirations & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Expirations Widget */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-light dark:border-border-dark">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                  Upcoming License Expirations
                </h3>
              </div>
              <Link
                to="/reminders"
                className="text-xs text-primary-500 hover:text-primary-600 font-medium"
              >
                View Reminders
              </Link>
            </div>

            {data.upcomingExpiringLicenses.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center mb-2">
                  <ShieldCheck size={24} />
                </div>
                <p className="text-sm font-medium text-text-primary dark:text-text-dark-primary">
                  All licenses are up to date
                </p>
                <p className="text-xs text-text-tertiary dark:text-text-dark-tertiary mt-1">
                  No software licenses due for renewal in the next 30 days.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.upcomingExpiringLicenses.map((lic) => {
                  const cust = customersMap.get(lic.customerId);
                  const daysInfo = formatDaysRemaining(lic.expirationDate);

                  return (
                    <div
                      key={lic.licenseId}
                      className="p-3 rounded-apple bg-surface-secondary/70 dark:bg-surface-dark-tertiary/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-2xs text-primary-500 font-semibold">
                            {lic.licenseId}
                          </span>
                          <span
                            className={`text-2xs font-semibold px-2 py-0.5 rounded ${
                              daysInfo.days <= 7
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                            }`}
                          >
                            {daysInfo.label}
                          </span>
                        </div>
                        <p className="font-semibold text-text-primary dark:text-text-dark-primary truncate mt-0.5">
                          {lic.productName}
                        </p>
                        <p className="text-2xs text-text-tertiary truncate">
                          {cust?.name || lic.customerId} &bull; Expires {new Date(lic.expirationDate).toLocaleDateString()}
                        </p>
                      </div>

                      <button
                        onClick={() => setRenewalLicense(lic)}
                        className="btn-primary text-xs px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 flex-shrink-0"
                      >
                        <RotateCcw size={13} />
                        <span>Renew</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity Timeline Widget */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-light dark:border-border-dark">
              <div className="flex items-center gap-2">
                <History size={18} className="text-primary-500" />
                <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                  Recent Activity Timeline
                </h3>
              </div>
              <Link
                to="/activity"
                className="text-xs text-primary-500 hover:text-primary-600 font-medium"
              >
                View Full Audit
              </Link>
            </div>

            {data.recentActivities.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-tertiary">
                No activity recorded yet.
              </div>
            ) : (
              <div className="relative pl-5 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-light dark:before:bg-border-dark">
                {data.recentActivities.slice(0, 5).map((act) => (
                  <div key={act.id} className="relative text-xs">
                    <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-primary-500 ring-2 ring-white dark:ring-surface-dark-secondary" />
                    <p className="font-medium text-text-primary dark:text-text-dark-primary">
                      {act.description}
                    </p>
                    <span className="text-[10px] text-text-tertiary">
                      {new Date(act.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Recent Customers & Recent Renewals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Customers */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-light dark:border-border-dark">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-500" />
              <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                Recently Added Customers
              </h3>
            </div>
            <Link
              to="/customers"
              className="text-xs text-primary-500 hover:text-primary-600 font-medium"
            >
              All Customers ({data.totalCustomers})
            </Link>
          </div>

          {data.recentCustomers.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-tertiary">
              No customers added yet.
            </div>
          ) : (
            <div className="divide-y divide-border-light dark:divide-border-dark">
              {data.recentCustomers.map((cust) => (
                <div
                  key={cust.customerId}
                  onClick={() => navigate(`/customers/${cust.customerId}`)}
                  className="py-2.5 flex items-center justify-between cursor-pointer hover:bg-surface-secondary/50 dark:hover:bg-surface-dark-tertiary/40 px-2 rounded-apple transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-2xs text-primary-500 font-medium">
                        {cust.customerId}
                      </span>
                      <h5 className="text-xs font-semibold text-text-primary dark:text-text-dark-primary">
                        {cust.name}
                      </h5>
                    </div>
                    <p className="text-2xs text-text-tertiary mt-0.5">
                      {cust.businessName} &bull; {cust.businessType}
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-text-tertiary" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Renewals */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-light dark:border-border-dark">
            <div className="flex items-center gap-2">
              <RotateCcw size={18} className="text-emerald-500" />
              <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                Recent Renewals
              </h3>
            </div>
            <Link
              to="/licenses"
              className="text-xs text-primary-500 hover:text-primary-600 font-medium"
            >
              All Licenses
            </Link>
          </div>

          {data.recentRenewals.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-tertiary">
              No renewal keys recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-border-light dark:divide-border-dark">
              {data.recentRenewals.map((ren, idx) => (
                <div key={ren.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-2xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {ren.licenseId}
                      </span>
                      <span className="text-text-tertiary font-mono">
                        {maskLicenseKey(ren.renewalKey, false)}
                      </span>
                    </div>
                    <p className="text-2xs text-text-tertiary mt-0.5 font-mono">
                      Extended: {new Date(ren.previousExpirationDate).toLocaleDateString()} &rarr;{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {new Date(ren.newExpirationDate).toLocaleDateString()}
                      </strong>
                    </p>
                  </div>
                  <span className="text-2xs text-text-tertiary">
                    {new Date(ren.renewalDate).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Renewal Modal */}
      <RenewalModal
        isOpen={Boolean(renewalLicense)}
        onClose={() => setRenewalLicense(null)}
        license={renewalLicense}
        onSuccess={() => {
          loadDashboardData();
        }}
      />

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSuccess={() => {
          loadDashboardData();
        }}
      />
    </div>
  );
}
