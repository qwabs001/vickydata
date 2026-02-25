"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/frontend/components/ui/input";
import { Button } from "@/frontend/components/ui/button";
import { useAuth } from "@/frontend/hooks/useAuth";
import { isValidGhanaPhone } from "@/shared/utils/validators";
import Link from "next/link";

type Preferences = {
  orderAlerts: boolean;
  rewardsUpdates: boolean;
  promotions: boolean;
  productNews: boolean;
};

export default function AgentProfilePage() {
  const { user, logout, login } = useAuth();
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [mail, setMail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [preferences, setPreferences] = useState<Preferences>({
    orderAlerts: true,
    rewardsUpdates: true,
    promotions: false,
    productNews: false
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const avatarInitial = (username || user?.username || user?.phoneNumber || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    setUsername(user?.username ?? "");
    setPhoneNumber(user?.phoneNumber ?? "");
  }, [user]);

  const joinedLabel = useMemo(() => {
    const date = new Date();
    return `Joined ${date.toLocaleString("en-US", { month: "short", year: "numeric" })}`;
  }, []);

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      setStatusError("Username is required.");
      setStatusMessage(null);
      return;
    }
    if (username.trim().length < 3) {
      setStatusError("Username must be at least 3 characters.");
      setStatusMessage(null);
      return;
    }
    if (phoneNumber && !isValidGhanaPhone(phoneNumber)) {
      setStatusError("Enter a valid Ghana phone number.");
      setStatusMessage(null);
      return;
    }
    if (!user?.id) {
      setStatusError("Please login to continue.");
      setStatusMessage(null);
      return;
    }
    setStatusError(null);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          username: username.trim(),
          phoneNumber: phoneNumber.trim()
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setStatusError(data?.error ?? "Unable to update profile.");
        return;
      }
      login(data);
      setStatusMessage("Personal details saved.");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      setStatusError("Unable to update profile.");
    }
  };

  const handlePasswordUpdate = () => {
    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      setPasswordMessage(null);
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      setPasswordMessage(null);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      setPasswordMessage(null);
      return;
    }
    setPasswordError(null);
    setPasswordMessage("Password updated.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTimeout(() => setPasswordMessage(null), 3000);
  };

  const togglePreference = (key: keyof Preferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    logout();
    window.location.href = "/";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="md:hidden">
        <header className="flex items-center justify-between">
          <Link
            href="/agent"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-base font-semibold text-slate-900">Profile Settings</h1>
          <div className="h-10 w-10" aria-hidden="true" />
        </header>

        <section className="mt-6 flex flex-col items-center text-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#0F172B]/10 text-2xl font-bold text-[#0F172B]">
              {avatarInitial}
            </div>
            <button
              type="button"
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#0F172B] text-white shadow-sm"
              aria-label="Upload avatar"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </button>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-900">{username || "Username"}</h2>
          <p className="text-sm text-slate-500">{phoneNumber}</p>
          <span className="mt-2 rounded-full bg-[rgb(var(--accent-rgb)/0.25)] px-3 py-1 text-xs font-semibold text-[#0f172a]">
            Agent since {new Date().getFullYear()}
          </span>
        </section>

        <section className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Personal Information
          </p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {[
              {
                label: "Full Name",
                value: username,
                onChange: setUsername,
                placeholder: "John Doe",
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c1.8-3.5 6-5 8-5s6.2 1.5 8 5" />
                  </svg>
                )
              },
              {
                label: "Phone Number",
                value: phoneNumber,
                onChange: setPhoneNumber,
                placeholder: "024 123 4567",
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.9 19.9 0 0 1-8.7-3.1 19.7 19.7 0 0 1-6-6A19.9 19.9 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z" />
                  </svg>
                )
              },
              {
                label: "Mail",
                value: mail,
                onChange: setMail,
                placeholder: "john.doe@example.com",
                icon: (
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16v16H4z" />
                    <path d="M22 6l-10 7L2 6" />
                  </svg>
                )
              }
            ].map((item, index) => (
              <div
                key={item.label}
                className={`flex items-center gap-3 px-4 py-3 ${index !== 2 ? "border-b border-slate-100" : ""}`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#2563eb]">
                  {item.icon}
                </span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                  <Input
                    value={item.value}
                    onChange={(event) => item.onChange(event.target.value)}
                    className="mt-1 h-auto border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 focus-visible:ring-0"
                    placeholder={item.placeholder}
                  />
                </div>
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            ))}
          </div>
          {statusError ? <p className="mt-3 text-sm text-red-500">{statusError}</p> : null}
          {statusMessage ? <p className="mt-3 text-sm text-emerald-600">{statusMessage}</p> : null}
          <Button
            className="mt-4 w-full rounded-2xl bg-[#0F172B] text-sm font-semibold text-white"
            onClick={handleSaveProfile}
          >
            Save Changes
          </Button>
        </section>

        <section className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Security</p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between"
              onClick={() => setShowPasswordForm((prev) => !prev)}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#2563eb]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-800">Change Password</p>
                  <p className="text-xs text-slate-500">Update your login details</p>
                </div>
              </div>
              <svg viewBox="0 0 24 24" className={`h-4 w-4 text-slate-300 transition ${showPasswordForm ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            {showPasswordForm ? (
              <div className="mt-4 space-y-3">
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Current password"
                />
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New password"
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                />
                {passwordError ? <p className="text-sm text-red-500">{passwordError}</p> : null}
                {passwordMessage ? <p className="text-sm text-emerald-600">{passwordMessage}</p> : null}
                <Button
                  className="w-full rounded-2xl bg-[#0F172B] text-sm font-semibold text-white"
                  onClick={handlePasswordUpdate}
                >
                  Update Password
                </Button>
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#2563eb]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2a7 7 0 0 0-7 7v4" />
                  <path d="M5 9a7 7 0 1 0 14 0" />
                  <path d="M8 22h8" />
                  <path d="M12 16v6" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">Biometric Login</p>
                <p className="text-xs text-slate-500">Use Face ID or Touch ID</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBiometricEnabled((prev) => !prev)}
              className={`h-6 w-11 rounded-full border transition ${
                biometricEnabled ? "border-transparent bg-[#0F172B]" : "border-slate-200 bg-slate-100"
              }`}
            >
              <span
                className={`block h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${
                  biometricEnabled ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </section>

        <section className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Preferences</p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <button
              type="button"
              className="flex w-full items-center justify-between"
              onClick={() => setShowPreferences((prev) => !prev)}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef2ff] text-[#2563eb]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </span>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-800">Notification Settings</p>
                  <p className="text-xs text-slate-500">Manage alerts and updates</p>
                </div>
              </div>
              <svg viewBox="0 0 24 24" className={`h-4 w-4 text-slate-300 transition ${showPreferences ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            {showPreferences ? (
              <div className="mt-4 space-y-3">
                {[
                  {
                    key: "orderAlerts",
                    title: "Order alerts",
                    description: "Updates about purchases and delivery status."
                  },
                  {
                    key: "rewardsUpdates",
                    title: "Rewards updates",
                    description: "News about rewards and cashback activity."
                  },
                  {
                    key: "promotions",
                    title: "Promotions",
                    description: "Exclusive bundles and limited offers."
                  },
                  {
                    key: "productNews",
                    title: "Product news",
                    description: "Feature updates and new services."
                  }
                ].map((item) => {
                  const key = item.key as keyof Preferences;
                  return (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => togglePreference(key)}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                        <p className="text-xs text-slate-500">{item.description}</p>
                      </div>
                      <div
                        className={`h-6 w-11 rounded-full border transition ${
                          preferences[key]
                            ? "border-transparent bg-[#0F172B]"
                            : "border-slate-200 bg-slate-100"
                        }`}
                      >
                        <div
                          className={`h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${
                            preferences[key] ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        <button
          type="button"
          className="mt-6 w-full rounded-2xl bg-[#0F172B] px-4 py-3 text-sm font-semibold text-white"
          onClick={handleLogout}
        >
          Logout
        </button>
        <p className="mt-4 text-center text-xs text-slate-400">Keldatagh App v2.4.0</p>
      </div>

      <div className="hidden md:flex md:flex-col gap-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0F172B]/10 text-xl font-bold text-[#0F172B]">
                  {avatarInitial}
                </div>
                <button
                  type="button"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#0F172B] text-white shadow-sm"
                  aria-label="Upload avatar"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </button>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{username || "Username"}</h2>
                <p className="text-sm text-slate-500">Agent · {joinedLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button className="h-10 rounded-full bg-[#0F172B] px-5 text-sm font-semibold text-white">
                Change Photo
              </Button>
              <Button className="h-10 rounded-full bg-[#0F172B] px-5 text-sm font-semibold text-white">
                Remove
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-base font-semibold text-slate-900">Personal Information</h3>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">Username</label>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-2"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Phone Number</label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="text-sm font-semibold text-slate-600">+233</span>
                <Input
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  className="h-auto border-0 px-0 py-0 text-sm focus:ring-0"
                  placeholder="024 123 4567"
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Verified mobile number for bundle purchases
              </p>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Mail</label>
              <Input
                value={mail}
                onChange={(event) => setMail(event.target.value)}
                className="mt-2"
                placeholder="john.doe@example.com"
              />
            </div>
          </div>
          {statusError ? <p className="mt-4 text-sm text-red-500">{statusError}</p> : null}
          {statusMessage ? <p className="mt-4 text-sm text-emerald-600">{statusMessage}</p> : null}
          <div className="mt-6 flex justify-end">
            <Button
              className="rounded-full bg-[#0F172B] px-6 text-sm font-semibold text-white"
              onClick={handleSaveProfile}
            >
              Save Personal Details
            </Button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-base font-semibold text-slate-900">Security</h3>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-slate-700">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="mt-2"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-2"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Confirm New Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2"
                placeholder="••••••••"
              />
            </div>
            <div className="md:col-span-2 rounded-xl bg-[#f1f5ff] px-4 py-3 text-xs text-slate-500">
              Password must be at least 8 characters long and include a mix of uppercase,
              lowercase, and symbols.
            </div>
          </div>
          {passwordError ? <p className="mt-4 text-sm text-red-500">{passwordError}</p> : null}
          {passwordMessage ? <p className="mt-4 text-sm text-emerald-600">{passwordMessage}</p> : null}
          <div className="mt-6 flex justify-end">
            <Button
              className="rounded-full bg-[#0F172B] px-6 text-sm font-semibold text-white"
              onClick={handlePasswordUpdate}
            >
              Update Password
            </Button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="text-base font-semibold text-slate-900">Communication Preferences</h3>
          </div>
          <div className="mt-6 grid gap-4">
            {[
              {
                key: "orderAlerts",
                title: "Order alerts",
                description: "Updates about purchases and delivery status."
              },
              {
                key: "rewardsUpdates",
                title: "Rewards updates",
                description: "News about rewards and cashback activity."
              },
              {
                key: "promotions",
                title: "Promotions",
                description: "Exclusive bundles and limited offers."
              },
              {
                key: "productNews",
                title: "Product news",
                description: "Feature updates and new services."
              }
            ].map((item) => {
              const key = item.key as keyof Preferences;
              return (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => togglePreference(key)}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.description}</p>
                  </div>
                  <div
                      className={`h-6 w-11 rounded-full border transition ${
                        preferences[key]
                        ? "border-transparent bg-[#0F172B]"
                        : "border-slate-200 bg-slate-100"
                    }`}
                  >
                    <div
                      className={`h-5 w-5 translate-y-0.5 rounded-full bg-white transition ${
                        preferences[key] ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
