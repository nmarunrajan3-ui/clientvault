import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  KeyRound,
  Bell,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useSidebar } from '../../contexts/SidebarContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/licenses', icon: KeyRound, label: 'Licenses' },
  { to: '/reminders', icon: Bell, label: 'Reminders' },
  { to: '/activity', icon: Clock, label: 'Activity' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { isCollapsed, isMobileOpen, toggleCollapsed, closeMobile } = useSidebar();
  const location = useLocation();

  return (
    <aside
      className={`
        fixed top-0 left-0 z-50 h-full
        bg-white dark:bg-surface-dark-secondary
        border-r border-border-light dark:border-border-dark
        flex flex-col
        transition-all duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        ${isCollapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'}
        w-[260px]
      `}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-border-light dark:border-border-dark flex-shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-apple bg-primary-500 text-white flex-shrink-0 shadow-apple-sm">
          <ShieldCheck size={20} strokeWidth={2.2} />
        </div>
        {!isCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="font-semibold text-text-primary dark:text-text-dark-primary text-base tracking-tight truncate">
              ClientVault
            </span>
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary dark:text-text-dark-tertiary font-semibold">
              Offline First
            </span>
          </div>
        )}
      </div>

      {/* Add Customer Quick Action */}
      <div className="px-3 pt-4 pb-2">
        <button
          className={`btn-primary w-full text-sm font-medium py-2.5 ${
            isCollapsed ? 'px-0 justify-center' : 'px-3'
          }`}
          title="Add Customer"
          onClick={() => {
            closeMobile();
            navigate('/customers?new=true');
          }}
        >
          <Plus size={18} strokeWidth={2.5} />
          {!isCollapsed && <span className="truncate">Add Customer</span>}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || (to !== '/dashboard' && location.pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              onClick={closeMobile}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-apple text-sm font-medium
                transition-all duration-150
                ${
                  isActive
                    ? 'bg-primary-500/10 text-primary-500 dark:text-primary-400 font-semibold'
                    : 'text-text-secondary dark:text-text-dark-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary hover:text-text-primary dark:hover:text-text-dark-primary'
                }
                ${isCollapsed ? 'justify-center px-0' : ''}
              `}
              title={isCollapsed ? label : undefined}
            >
              <Icon size={19} className="flex-shrink-0" />
              {!isCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Collapse Toggle (Desktop only) */}
      <div className="hidden lg:flex items-center justify-end px-3 py-3 border-t border-border-light dark:border-border-dark">
        <button
          onClick={toggleCollapsed}
          className="btn-ghost p-2 rounded-apple text-text-tertiary hover:text-text-primary dark:text-text-dark-tertiary dark:hover:text-text-dark-primary"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}
