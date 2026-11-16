import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  Phone,
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  RotateCw,
  UserPlus
} from 'lucide-react';

interface CustomerAuthModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  inline?: boolean;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen = true,
  onClose,
  inline = false
}) => {
  const {
    loginWithEmail,
    signupWithEmail,
    showNotification
  } = useStore();

  // Email mode: 'signin' (Existing customers only) or 'signup' (New customer registration)
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');

  // Email form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Loading & error state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle Email Submit
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorCode(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    setLoading(true);
    try {
      if (emailMode === 'signup') {
        if (!fullName.trim()) {
          setErrorMessage('Please enter your full name to create an account.');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMessage('Passwords do not match.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMessage('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }

        const res = await signupWithEmail(
          fullName.trim(),
          email.trim(),
          password,
          phoneNumber.trim() || undefined
        );
        if (res.success) {
          setSuccessMessage('Account created and saved to database.');
          showNotification('Welcome to FRAGMORÉ Customer Suite.');
          if (onClose) onClose();
        } else {
          setErrorCode(res.code || null);
          setErrorMessage(res.message || 'Failed to create account.');
        }
      } else {
        const res = await loginWithEmail(email.trim(), password);
        if (res.success) {
          setSuccessMessage('Signed in successfully.');
          showNotification('Welcome back.');
          if (onClose) onClose();
        } else {
          setErrorCode(res.code || null);
          setErrorMessage(res.message || 'Invalid email or password.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className="w-full max-w-md mx-auto my-auto max-h-[88vh] overflow-y-auto bg-[#FFFFFF] border border-[#DED7CC] rounded-2xl sm:rounded-3xl p-5 sm:p-7 text-[#24211D] shadow-[0_24px_60px_rgba(36,33,29,0.12)] relative">
      {/* Close button if in modal mode */}
      {onClose && (
        <button
          onClick={onClose}
          className="
            absolute top-4 right-4 p-2 text-[#686158] hover:text-[#24211D]
            rounded-full bg-[#F1EDE5] hover:bg-[#DED7CC] transition-colors cursor-pointer z-10
          "
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header Wordmark & Title */}
      <div className="text-center space-y-1.5 mb-4 pr-6 pl-6">
        <span className="font-serif tracking-[0.25em] text-base sm:text-lg font-normal text-[#24211D] uppercase block">
          FRAGMOR<span className="text-[#9A783E]">É</span>
        </span>
        <h2 className="font-serif text-xl sm:text-2xl uppercase tracking-wider text-[#24211D]">
          {emailMode === 'signin' ? 'Customer Sign In' : 'Create New Account'}
        </h2>
        <p className="text-[11px] text-[#686158] font-mono leading-relaxed">
          {emailMode === 'signin'
            ? 'Existing customers can sign in with their registered Email ID.'
            : 'New customers can create an account below.'}
        </p>
      </div>

      {/* Feedback Messages */}
      {errorMessage && (
        <div className="p-3 mb-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs font-mono space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          {errorCode === 'USER_NOT_FOUND' && (
            <button
              type="button"
              onClick={() => {
                setEmailMode('signup');
                setErrorMessage(null);
                setErrorCode(null);
              }}
              className="w-full py-2 px-3 rounded-lg bg-[#24211D] text-[#FAF8F4] hover:bg-[#9A783E] font-bold text-[11px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Your Account →</span>
            </button>
          )}
          {errorCode === 'EMAIL_EXISTS' && (
            <button
              type="button"
              onClick={() => {
                setEmailMode('signin');
                setErrorMessage(null);
                setErrorCode(null);
              }}
              className="w-full py-2 px-3 rounded-lg bg-[#24211D] text-[#FAF8F4] hover:bg-[#9A783E] font-bold text-[11px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Switch to Sign In →</span>
            </button>
          )}
        </div>
      )}

      {successMessage && (
        <div className="p-3 mb-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* EMAIL ID & PASSWORD LOGIN / SIGNUP */}
      <form onSubmit={handleEmailSubmit} className="space-y-3">
        {emailMode === 'signup' && (
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase text-[#686158]">
              Full Name *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#686158] absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="e.g. Rohan Mehra"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#24211D] font-mono placeholder:text-[#686158]/60 focus:border-[#9A783E] focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-[10px] font-mono uppercase text-[#686158]">
            Email Address *
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#686158] absolute left-3.5 top-3" />
            <input
              type="email"
              required
              placeholder="customer@fragmore.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#24211D] font-mono placeholder:text-[#686158]/60 focus:border-[#9A783E] focus:outline-none"
            />
          </div>
        </div>

        {emailMode === 'signup' && (
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase text-[#686158]">
              Mobile Number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#686158] absolute left-3.5 top-3" />
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#24211D] font-mono placeholder:text-[#686158]/60 focus:border-[#9A783E] focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-[10px] font-mono uppercase text-[#686158]">
            Password *
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#686158] absolute left-3.5 top-3" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#24211D] font-mono placeholder:text-[#686158]/60 focus:border-[#9A783E] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-3 text-[#686158] hover:text-[#24211D] cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {emailMode === 'signup' && (
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase text-[#686158]">
              Confirm Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#686158] absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#FAF8F4] border border-[#DED7CC] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#24211D] font-mono placeholder:text-[#686158]/60 focus:border-[#9A783E] focus:outline-none"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#24211D] hover:bg-[#9A783E] text-[#FAF8F4] font-bold text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2 cursor-pointer"
        >
          {loading ? (
            <>
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>{emailMode === 'signup' ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Bottom Mode Switch Helper */}
        <div className="text-center pt-2 border-t border-[#DED7CC]/60">
          {emailMode === 'signin' ? (
            <button
              type="button"
              onClick={() => {
                setEmailMode('signup');
                setErrorMessage(null);
                setErrorCode(null);
              }}
              className="text-xs font-mono text-[#24211D] hover:text-[#9A783E] font-medium underline underline-offset-4 cursor-pointer"
            >
              New customer? Create your account
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEmailMode('signin');
                setErrorMessage(null);
                setErrorCode(null);
              }}
              className="text-xs font-mono text-[#24211D] hover:text-[#9A783E] font-medium underline underline-offset-4 cursor-pointer"
            >
              Existing customer? Sign in here
            </button>
          )}
        </div>
      </form>
    </div>
  );

  if (inline) {
    return content;
  }

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#24211D]/35 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      {content}
    </div>
  );
};
