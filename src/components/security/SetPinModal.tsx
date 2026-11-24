import React, { useState } from 'react';
import { Lock, ShieldCheck, X, Eye, EyeOff } from 'lucide-react';
import { useSecurity } from '../../contexts/SecurityContext';

interface SetPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'set' | 'remove';
}

export function SetPinModal({ isOpen, onClose, mode }: SetPinModalProps) {
  const { isLockConfigured, setPin, removePin } = useSecurity();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'remove') {
      if (!currentPin) {
        setError('Please enter your current PIN to remove security lock.');
        return;
      }
      setIsSubmitting(true);
      const success = await removePin(currentPin);
      setIsSubmitting(false);
      if (!success) {
        setError('Current PIN is incorrect.');
        return;
      }
      onClose();
      return;
    }

    // mode === 'set'
    if (isLockConfigured && !currentPin) {
      setError('Please enter your current PIN to change it.');
      return;
    }

    if (!/^\d{4,8}$/.test(newPin)) {
      setError('New PIN must be between 4 and 8 digits (numbers only).');
      return;
    }

    if (newPin !== confirmPin) {
      setError('New PIN and confirmation PIN do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLockConfigured) {
        // First verify current PIN
        const verifySuccess = await removePin(currentPin);
        if (!verifySuccess) {
          setError('Current PIN is incorrect.');
          setIsSubmitting(false);
          return;
        }
      }

      await setPin(newPin);
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || 'Failed to update PIN');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="card max-w-sm w-full p-6 space-y-4 shadow-apple-xl border border-border-light dark:border-border-dark">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-apple bg-primary-50 dark:bg-primary-950/30 text-primary-500 flex items-center justify-center">
              {mode === 'remove' ? <Lock size={18} /> : <ShieldCheck size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                {mode === 'remove'
                  ? 'Disable Master PIN'
                  : isLockConfigured
                  ? 'Change Master PIN'
                  : 'Set Master PIN'}
              </h3>
              <p className="text-2xs text-text-tertiary">
                {mode === 'remove'
                  ? 'Remove local passcode protection'
                  : 'Protect local customer and license data'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-1 text-text-tertiary hover:text-text-primary dark:hover:text-text-dark-primary"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="p-2.5 rounded-apple bg-status-danger/10 border border-status-danger/20 text-xs text-status-danger font-medium animate-fade-in">
              {error}
            </div>
          )}

          {/* Current PIN if configured */}
          {(isLockConfigured || mode === 'remove') && (
            <div>
              <label className="block text-2xs font-semibold text-text-secondary dark:text-text-dark-secondary uppercase mb-1">
                Current PIN
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="Enter current PIN"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  className="input-base text-center text-sm font-mono tracking-widest"
                  autoFocus
                />
              </div>
            </div>
          )}

          {mode === 'set' && (
            <>
              <div>
                <label className="block text-2xs font-semibold text-text-secondary dark:text-text-dark-secondary uppercase mb-1">
                  New Master PIN (4–8 Digits)
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={8}
                    placeholder="Enter 4 to 8 digits"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="input-base text-center text-sm font-mono tracking-widest pr-10"
                    autoFocus={!isLockConfigured}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-2xs font-semibold text-text-secondary dark:text-text-dark-secondary uppercase mb-1">
                  Confirm New PIN
                </label>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="Re-enter new PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="input-base text-center text-sm font-mono tracking-widest"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={mode === 'remove' ? 'btn-danger text-xs px-4 py-1.5' : 'btn-primary text-xs px-4 py-1.5'}
            >
              {isSubmitting
                ? 'Processing...'
                : mode === 'remove'
                ? 'Disable Lock'
                : isLockConfigured
                ? 'Update PIN'
                : 'Enable Lock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
