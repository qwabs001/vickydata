"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getDefaultRouteForRole } from "@/frontend/lib/authRoutes";
import { useAuth } from "@/frontend/hooks/useAuth";
import { isValidGhanaPhone } from "@/shared/utils/validators";

type AuthMode = "login" | "signup" | "reset";

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (/^233\d{9}$/.test(digits)) return `0${digits.slice(3)}`;
  return digits;
};

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, login } = useAuth();

  const initialMode = useMemo<AuthMode>(() => {
    const mode = searchParams.get("mode");
    if (mode === "signup" || mode === "reset") return mode;
    return "login";
  }, [searchParams]);

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setMode(initialMode);
    setError(null);
    setNotice(null);
  }, [initialMode]);

  useEffect(() => {
    if (!isAuthenticated || !user?.role) return;
    router.replace(getDefaultRouteForRole(user.role));
  }, [isAuthenticated, user?.role, router]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.id) {
        setError(data?.error ?? "Unable to sign in.");
        return;
      }
      login(data);
      router.replace(getDefaultRouteForRole(data.role));
    } catch {
      setError("Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const normalizedPhone = normalizePhone(phoneNumber);
      if (!isValidGhanaPhone(normalizedPhone)) {
        setError("Enter a valid Ghana phone number.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      const referralCode = searchParams.get("ref") ?? undefined;
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          phoneNumber: normalizedPhone,
          password,
          confirmPassword,
          referralCode
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.id) {
        setError(data?.error ?? "Unable to create account.");
        return;
      }
      login(data);
      router.replace(getDefaultRouteForRole(data.role));
    } catch {
      setError("Unable to create account.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const normalizedPhone = normalizePhone(phoneNumber);
      if (!isValidGhanaPhone(normalizedPhone)) {
        setError("Enter a valid Ghana phone number.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          phoneNumber: normalizedPhone,
          password,
          confirmPassword
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Unable to reset password.");
        return;
      }
      setNotice("Password updated. Sign in with your new password.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Unable to reset password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f3ef] px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-bold">Keldatagh</h1>
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            Back home
          </Link>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-lg px-2 py-2 font-semibold ${mode === "login" ? "bg-white text-slate-900" : "text-slate-500"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-lg px-2 py-2 font-semibold ${mode === "signup" ? "bg-white text-slate-900" : "text-slate-500"}`}
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setMode("reset")}
            className={`rounded-lg px-2 py-2 font-semibold ${mode === "reset" ? "bg-white text-slate-900" : "text-slate-500"}`}
          >
            Reset
          </button>
        </div>

        <form
          onSubmit={mode === "login" ? handleLogin : mode === "signup" ? handleSignup : handleResetPassword}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-semibold">Username</label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter username"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              autoComplete="username"
              required
            />
          </div>

          {(mode === "signup" || mode === "reset") && (
            <div>
              <label className="mb-1 block text-sm font-semibold">Phone Number</label>
              <input
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="0241234567 or +233241234567"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                autoComplete="tel"
                required
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold">
              {mode === "reset" ? "New Password" : "Password"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </div>

          {(mode === "signup" || mode === "reset") && (
            <div>
              <label className="mb-1 block text-sm font-semibold">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                autoComplete="new-password"
                required
              />
            </div>
          )}

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
          {notice ? <p className="text-sm font-medium text-emerald-600">{notice}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
