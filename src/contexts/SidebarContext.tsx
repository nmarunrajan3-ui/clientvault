import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface SidebarContextType {
  isCollapsed: boolean;
  isMobileOpen: boolean;
  toggleCollapsed: () => void;
  toggleMobileOpen: () => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('cv-sidebar-collapsed');
    return saved === 'true';
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('cv-sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  // Close mobile sidebar on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        isMobileOpen,
        toggleCollapsed: () => setIsCollapsed(!isCollapsed),
        toggleMobileOpen: () => setIsMobileOpen(!isMobileOpen),
        closeMobile: () => setIsMobileOpen(false),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error('useSidebar must be used within SidebarProvider');
  return context;
}
