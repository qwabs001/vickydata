import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "@/frontend/components/ui/dialog";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";

interface SignupModalProps {
  open: boolean;
  onClose: () => void;
  onLoginClick?: () => void;
  phoneNumber: string;
  editablePhoneNumber?: boolean;
  editableUsername?: boolean;
  mobileSheet?: boolean;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  onSubmit: (payload: {
    username: string;
    phoneNumber: string;
    password: string;
    confirmPassword: string;
  }) => Promise<void> | void;
  isSubmitting?: boolean;
  error?: string | null;
}

export function SignupModal({
  open,
  onClose,
  onLoginClick,
  phoneNumber,
  editablePhoneNumber,
  title,
  subtitle,
  submitLabel,
  onSubmit,
  isSubmitting,
  error,
  mobileSheet
}: SignupModalProps) {
  const [localPhoneNumber, setLocalPhoneNumber] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername("");
    setLocalPhoneNumber(phoneNumber ?? "");
    setPassword("");
    setConfirmPassword("");
    setLocalError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [open, phoneNumber]);

  const isPhoneEditable = editablePhoneNumber ?? true;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (username.trim().length < 3) {
      setLocalError("Username must be at least 3 characters.");
      return;
    }
    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }
    setLocalError(null);
    await onSubmit({
      username: username.trim(),
      phoneNumber: localPhoneNumber,
      password,
      confirmPassword
    });
  };

  return (
    <Dialog open={open} onClose={onClose} mobileBottomSheet={mobileSheet}>
      <form onSubmit={handleSubmit} className="p-6 pb-8 md:p-8">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {title ?? "Quick Signup"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {subtitle ?? "Complete your account to proceed with the payment for your bundle."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">
              Username
            </label>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                className="h-auto border-0 bg-transparent px-0 py-0 text-sm text-slate-700 focus:ring-0"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">
              Phone Number
            </label>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-sm font-semibold text-slate-600">+233</span>
              <Input
                value={localPhoneNumber}
                readOnly={!isPhoneEditable}
                onChange={(event) => setLocalPhoneNumber(event.target.value)}
                autoComplete="tel"
                className="h-auto border-0 bg-transparent px-0 py-0 text-sm text-slate-700 focus:ring-0"
                placeholder="0200000010"
              />
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l4 4L19 7" />
                </svg>
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Create Password</label>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                className="h-auto border-0 bg-transparent px-0 py-0 text-sm text-slate-700 focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-slate-400 transition hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Confirm Password
            </label>
            <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                className="h-auto border-0 bg-transparent px-0 py-0 text-sm text-slate-700 focus:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="text-slate-400 transition hover:text-slate-600"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {localError ? (
          <p className="mt-3 text-sm text-red-500">{localError}</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

        <Button
          type="submit"
          className="mt-6 w-full rounded-xl bg-[#0f172a] text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b1223]"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating account..." : submitLabel ?? "CREATE ACCOUNT & PAY"}
        </Button>

        {onLoginClick ? (
          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-slate-600"
            onClick={onLoginClick}
          >
            Already have an account?{" "}
            <span className="font-semibold text-[#2563eb]">Login</span>
          </button>
        ) : null}
      </form>
    </Dialog>
  );
}
