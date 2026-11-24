import { useState, useEffect } from 'react';
import { Lock, Delete, HelpCircle, X } from 'lucide-react';
import { useSecurity } from '../../contexts/SecurityContext';

export function AppLockModal() {
  const { isLocked, unlockApp } = useSecurity();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRecoveryHelp, setShowRecoveryHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLocked) {
      setPin('');
      setError(false);
      setErrorMessage('');
      setShowRecoveryHelp(false);
    }
  }, [isLocked]);

  // Handle keyboard typing
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 8) {
          handleDigitPress(e.key);
        }
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        if (pin.length >= 4) {
          submitPin(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, pin]);

  if (!isLocked) return null;

  const handleDigitPress = (digit: string) => {
    if (pin.length < 8) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);
      setErrorMessage('');
      if (newPin.length >= 4) {
        // Attempt unlock if length reaches 4
        // (will also auto-verify when user presses unlock or reaches length)
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
    setErrorMessage('');
  };

  const handleClear = () => {
    setPin('');
    setError(false);
    setErrorMessage('');
  };

  const submitPin = async (pinToTest: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const success = await unlockApp(pinToTest);
    setIsSubmitting(false);

    if (!success) {
      setError(true);
      setErrorMessage('Incorrect PIN. Please try again.');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-primary/80 dark:bg-surface-dark-primary/90 backdrop-blur-2xl animate-fade-in select-none">
      <div className="max-w-xs w-full text-center space-y-6">
        {/* Apple-style Padlock Icon */}
        <div className="mx-auto w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary-500 border border-primary-200 dark:border-primary-800 flex items-center justify-center shadow-apple">
          <Lock size={28} className="animate-pulse" />
        </div>

        <div>
          <h2 className="text-xl font-semibold text-text-primary dark:text-text-dark-primary tracking-tight">
            ClientVault Locked
          </h2>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
            Enter your Master PIN to access customer data
          </p>
        </div>

        {/* PIN Indicators (Dots) */}
        <div className="flex justify-center items-center gap-3 py-2">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                idx < pin.length
                  ? 'bg-primary-500 scale-110 shadow-sm'
                  : 'border border-gray-300 dark:border-gray-600 bg-transparent'
              } ${error ? 'bg-status-danger border-status-danger animate-shake' : ''}`}
            />
          ))}
        </div>

        {errorMessage && (
          <p className="text-xs font-medium text-status-danger animate-fade-in">
            {errorMessage}
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto pt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigitPress(digit)}
              className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-xl font-medium bg-surface-secondary dark:bg-surface-dark-tertiary text-text-primary dark:text-text-dark-primary hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all shadow-apple-xs border border-border-light/50 dark:border-border-dark/50"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-xs font-semibold text-text-tertiary hover:text-text-primary dark:hover:text-text-dark-primary active:scale-95 transition-all"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigitPress('0')}
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-xl font-medium bg-surface-secondary dark:bg-surface-dark-tertiary text-text-primary dark:text-text-dark-primary hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all shadow-apple-xs border border-border-light/50 dark:border-border-dark/50"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Backspace"
            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-text-secondary dark:text-text-dark-secondary hover:text-text-primary dark:hover:text-text-dark-primary active:scale-95 transition-all"
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Unlock Action Button */}
        <div>
          <button
            type="button"
            disabled={pin.length < 4 || isSubmitting}
            onClick={() => submitPin(pin)}
            className="btn-primary w-full py-2.5 text-xs font-semibold tracking-wide disabled:opacity-40"
          >
            {isSubmitting ? 'Verifying...' : 'Unlock Application'}
          </button>
        </div>

        {/* Emergency Recovery Guidance */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowRecoveryHelp(true)}
            className="inline-flex items-center gap-1.5 text-2xs text-text-tertiary hover:text-text-secondary dark:hover:text-text-dark-secondary transition-colors"
          >
            <HelpCircle size={13} />
            Forgot Master PIN?
          </button>
        </div>
      </div>

      {/* Recovery Modal */}
      {showRecoveryHelp && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-md w-full p-6 space-y-4 shadow-apple-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary flex items-center gap-2">
                <HelpCircle size={16} className="text-primary-500" />
                Emergency PIN Recovery
              </h3>
              <button
                onClick={() => setShowRecoveryHelp(false)}
                className="btn-ghost p-1 text-text-tertiary"
              >
                <X size={16} />
              </button>
            </div>
            <div className="text-xs text-text-secondary dark:text-text-dark-secondary space-y-2 leading-relaxed">
              <p>
                ClientVault is 100% offline and stores your data securely inside your browser's IndexedDB. Because there is no external cloud or email server, you can reset your PIN locally:
              </p>
              <ol className="list-decimal list-inside space-y-1 bg-surface-secondary dark:bg-surface-dark-tertiary p-3 rounded-apple text-text-primary dark:text-text-dark-primary font-mono text-2xs">
                <li>Press <kbd className="px-1 py-0.5 bg-white dark:bg-gray-800 border rounded">F12</kbd> to open Developer Tools</li>
                <li>Go to the <strong>Application</strong> (or Storage) tab</li>
                <li>Under <strong>IndexedDB &rarr; ClientVaultDB &rarr; settings</strong></li>
                <li>Locate the row with key: <code className="text-primary-500 font-bold">"appLockPinHash"</code></li>
                <li>Right-click and select <strong>Delete</strong></li>
                <li>Refresh the page to regain full access</li>
              </ol>
              <p className="text-2xs text-text-tertiary">
                Your customer and license records will remain completely intact.
              </p>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowRecoveryHelp(false)}
                className="btn-primary text-xs px-4 py-2"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
