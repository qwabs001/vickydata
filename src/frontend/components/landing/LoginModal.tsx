import { useEffect, useState, type FormEvent } from "react";
import { Dialog } from "@/frontend/components/ui/dialog";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { username: string; password: string }) => Promise<void> | void;
  onResetPassword?: (payload: {
    username: string;
    phoneNumber: string;
    password: string;
    confirmPassword: string;
  }) => Promise<void> | void;
  onRegisterClick?: () => void;
  isSubmitting?: boolean;
  error?: string | null;
  notice?: string | null;
  mobileSheet?: boolean;
}

export function LoginModal({
  open,
  onClose,
  onSubmit,
  onResetPassword,
  onRegisterClick,
  isSubmitting,
  error,
  notice,
  mobileSheet
}: LoginModalProps) {
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("login");
    setUsername("");
    setPhoneNumber("");
    setPassword("");
    setConfirmPassword("");
    setLocalError(null);
  }, [open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    await onSubmit({ username, password });
  };

  const handleReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!onResetPassword) return;
    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }
    setLocalError(null);
    await onResetPassword({
      username,
      phoneNumber,
      password,
      confirmPassword
    });
  };

  return (
    <Dialog open={open} onClose={onClose} mobileBottomSheet={mobileSheet}>
      <form
        onSubmit={mode === "login" ? handleSubmit : handleReset}
        className="p-6 pb-8 md:p-8"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {mode === "login" ? "Login" : "Reset Password"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "login"
                ? "Access your account to complete orders."
                : "Confirm your username and phone number, then set a new password."}
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
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              className="mt-2 rounded-xl border-slate-200 bg-white text-sm text-slate-700 focus:border-[#0f172a] focus:ring-[#0f172a]/10"
            />
          </div>
          {mode === "forgot" ? (
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Phone Number
              </label>
              <Input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="024 123 4567"
                autoComplete="tel"
                className="mt-2 rounded-xl border-slate-200 bg-white text-sm text-slate-700 focus:border-[#0f172a] focus:ring-[#0f172a]/10"
              />
            </div>
          ) : null}
          <div>
            <label className="text-sm font-semibold text-slate-700">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "forgot" ? "New password" : "Password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="mt-2 rounded-xl border-slate-200 bg-white text-sm text-slate-700 focus:border-[#0f172a] focus:ring-[#0f172a]/10"
            />
          </div>
          {mode === "forgot" ? (
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Confirm Password
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                className="mt-2 rounded-xl border-slate-200 bg-white text-sm text-slate-700 focus:border-[#0f172a] focus:ring-[#0f172a]/10"
              />
            </div>
          ) : null}
        </div>

        {localError ? <p className="mt-3 text-sm text-red-500">{localError}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-emerald-600">{notice}</p> : null}

        <Button
          type="submit"
          className="mt-6 w-full rounded-xl bg-[#0f172a] text-white shadow-sm transition hover:bg-[#0b1223]"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting
            ? mode === "login"
              ? "Signing in..."
              : "Updating password..."
            : mode === "login"
              ? "Login"
              : "Update Password"}
        </Button>

        {mode === "login" ? (
          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              className="hover:text-slate-900 hover:underline"
              onClick={() => setMode("forgot")}
            >
              Forgot password?
            </button>
            {onRegisterClick ? (
              <button
                type="button"
                className="hover:text-slate-900 hover:underline"
                onClick={onRegisterClick}
              >
                New here? Create an account
              </button>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="mt-4 text-sm text-slate-600 hover:text-slate-900 hover:underline"
            onClick={() => setMode("login")}
          >
            Back to login
          </button>
        )}
      </form>
    </Dialog>
  );
}
