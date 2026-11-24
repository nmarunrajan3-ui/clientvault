import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AppLockModal } from '../security/AppLockModal';
import { useSidebar } from '../../contexts/SidebarContext';

export function AppLayout() {
  const { isCollapsed, isMobileOpen, closeMobile } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary dark:bg-surface-dark">
      {/* Application Master PIN Lock Screen */}
      <AppLockModal />

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[260px]'
        }`}
      >
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
