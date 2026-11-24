import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useRepository } from './RepositoryContext';
import { hashPin, verifyPin } from '../services/securityService';

interface SecurityContextType {
  isLockConfigured: boolean;
  isLocked: boolean;
  autoLockMinutes: number;
  lockApp: () => void;
  unlockApp: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  removePin: (currentPin: string) => Promise<boolean>;
  setAutoLockMinutes: (minutes: number) => Promise<void>;
  isLoading: boolean;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

const SESSION_KEY = 'clientvault_session_unlocked';

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { repo } = useRepository();
  const [isLockConfigured, setIsLockConfigured] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [autoLockMinutes, setAutoLockMinutesState] = useState<number>(15);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load security settings from IndexedDB
  const refreshSecuritySettings = useCallback(async () => {
    try {
      const [storedPinHash, storedAutoLock] = await Promise.all([
        repo.settings.get<string>('appLockPinHash'),
        repo.settings.get<number>('autoLockMinutes'),
      ]);

      const configured = Boolean(storedPinHash && typeof storedPinHash === 'string');
      setIsLockConfigured(configured);

      if (typeof storedAutoLock === 'number') {
        setAutoLockMinutesState(storedAutoLock);
      }

      // Check session lock status
      if (configured) {
        const isSessionUnlocked = sessionStorage.getItem(SESSION_KEY) === 'true';
        setIsLocked(!isSessionUnlocked);
      } else {
        setIsLocked(false);
      }
    } catch (err) {
      console.error('Failed to load security settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    refreshSecuritySettings();
  }, [refreshSecuritySettings]);

  const lockApp = useCallback(() => {
    if (isLockConfigured) {
      sessionStorage.removeItem(SESSION_KEY);
      setIsLocked(true);
    }
  }, [isLockConfigured]);

  const unlockApp = async (pin: string): Promise<boolean> => {
    try {
      const storedPinHash = await repo.settings.get<string>('appLockPinHash');
      if (!storedPinHash) {
        setIsLocked(false);
        return true;
      }

      const isValid = await verifyPin(pin, storedPinHash);
      if (isValid) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        setIsLocked(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error during unlock verification:', err);
      return false;
    }
  };

  const setPin = async (pin: string): Promise<void> => {
    const hashed = await hashPin(pin);
    await repo.settings.set('appLockPinHash', hashed);
    sessionStorage.setItem(SESSION_KEY, 'true');
    setIsLockConfigured(true);
    setIsLocked(false);

    await repo.activities.create({
      type: 'settings_changed',
      description: 'Master PIN security lock configured',
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    });
  };

  const removePin = async (currentPin: string): Promise<boolean> => {
    const storedPinHash = await repo.settings.get<string>('appLockPinHash');
    if (!storedPinHash) return true;

    const isValid = await verifyPin(currentPin, storedPinHash);
    if (!isValid) {
      return false;
    }

    await repo.settings.set('appLockPinHash', null);
    sessionStorage.removeItem(SESSION_KEY);
    setIsLockConfigured(false);
    setIsLocked(false);

    await repo.activities.create({
      type: 'settings_changed',
      description: 'Master PIN security lock removed',
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
    });

    return true;
  };

  const setAutoLockMinutes = async (minutes: number): Promise<void> => {
    await repo.settings.set('autoLockMinutes', minutes);
    setAutoLockMinutesState(minutes);
  };

  // Inactivity auto-lock timer
  useEffect(() => {
    if (!isLockConfigured || isLocked || autoLockMinutes <= 0) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    const resetTimer = () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = setTimeout(() => {
        lockApp();
      }, autoLockMinutes * 60 * 1000);
    };

    // User activity listeners
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    // Start initial timer
    resetTimer();

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [isLockConfigured, isLocked, autoLockMinutes, lockApp]);

  return (
    <SecurityContext.Provider
      value={{
        isLockConfigured,
        isLocked,
        autoLockMinutes,
        lockApp,
        unlockApp,
        setPin,
        removePin,
        setAutoLockMinutes,
        isLoading,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
