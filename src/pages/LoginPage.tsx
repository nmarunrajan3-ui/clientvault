import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { signIn, signUp, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // If already authenticated, redirect
  React.useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both your email/username and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (res.success) {
          const from = (location.state as any)?.from?.pathname || '/dashboard';
          navigate(from, { replace: true });
        } else {
          setError(res.error || 'Invalid credentials.');
        }
      } else {
        // Sign Up
        const res = await signUp(email, password);
        if (res.success) {
          if (res.requiresEmailConfirmation) {
            setNotice(
              'Account created! A confirmation email has been sent. Please verify your email before logging in.'
            );
            setMode('signin');
          } else {
            const from = (location.state as any)?.from?.pathname || '/dashboard';
            navigate(from, { replace: true });
          }
        } else {
          setError(res.error || 'Failed to create account.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-secondary dark:bg-surface-dark select-none animate-fade-in">
      <div className="w-full max-w-sm space-y-6">
        {/* App Logo & Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 text-primary-500 items-center justify-center shadow-apple mb-1">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-xl font-bold text-text-primary dark:text-text-dark-primary tracking-tight">
            ClientVault
          </h1>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
            {mode === 'signin'
              ? 'Sign in to access your customer and license vault'
              : 'Create your secure administrator account'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="card p-6 shadow-apple-xl border border-border-light dark:border-border-dark space-y-5">
          {/* Tabs: Sign In / Create Account */}
          <div className="grid grid-cols-2 p-1 bg-surface-secondary dark:bg-surface-dark-tertiary rounded-apple text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
                setNotice(null);
              }}
              className={`py-1.5 rounded-md transition-all ${
                mode === 'signin'
                  ? 'bg-white dark:bg-surface-dark-secondary text-text-primary dark:text-text-dark-primary shadow-apple-xs'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setNotice(null);
              }}
              className={`py-1.5 rounded-md transition-all ${
                mode === 'signup'
                  ? 'bg-white dark:bg-surface-dark-secondary text-text-primary dark:text-text-dark-primary shadow-apple-xs'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Feedback Notices */}
          {error && (
            <div className="p-3 rounded-apple bg-status-danger/10 border border-status-danger/20 text-xs text-status-danger flex items-start gap-2 animate-fade-in">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="p-3 rounded-apple bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2 animate-fade-in">
              <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-2xs font-semibold text-text-secondary dark:text-text-dark-secondary uppercase mb-1">
                Email / Username
              </label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                />
                <input
                  type="email"
                  required
                  placeholder="admin@yourbusiness.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-base pl-9 pr-3 text-xs"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-2xs font-semibold text-text-secondary dark:text-text-dark-secondary uppercase mb-1">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base pl-9 pr-9 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="text-[11px] text-text-tertiary mt-1">
                  Minimum 6 characters with letters and numbers.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to Vault' : 'Create Master Account'}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Assurance Badge */}
        <div className="text-center text-[11px] text-text-tertiary space-y-1">
          <p>End-to-End Encrypted Session</p>
          <p className="text-[10px]">
            Protected by Supabase Auth & Web Crypto SHA-256
          </p>
        </div>
      </div>
    </div>
  );
}
