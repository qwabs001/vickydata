"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "@/frontend/providers/ThemeProvider";
import {
  DEFAULT_ACCENT,
  DEFAULT_PRIMARY,
  loadThemeSettings,
  saveThemeSettings
} from "@/frontend/lib/themeSettingsStorage";
import { useAuth } from "@/frontend/hooks/useAuth";

type FooterSettings = {
  copyright: string;
  showLogo: boolean;
  privacyUrl: string;
  termsUrl: string;
  contactUrl: string;
};

type ContactSettings = {
  whatsapp: string;
  telegram: string;
  messenger: string;
  email: string;
  phone: string;
  customLabel: string;
  customUrl: string;
  showWidget: boolean;
};

const defaultFooter: FooterSettings = {
  copyright: `© ${new Date().getFullYear()} BundleArena. All rights reserved.`,
  showLogo: true,
  privacyUrl: "",
  termsUrl: "",
  contactUrl: ""
};

const defaultContact: ContactSettings = {
  whatsapp: "",
  telegram: "",
  messenger: "",
  email: "",
  phone: "",
  customLabel: "",
  customUrl: "",
  showWidget: true
};

export default function Page() {
  const { accent, primary, setAccent, setPrimary, resetTheme, setLogoUrl, logoUrl } = useTheme();
  const { user } = useAuth();
  const [primaryColor, setPrimaryColor] = useState(primary);
  const [activeColor, setActiveColor] = useState(accent);
  const [logoName, setLogoName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [logoNotice, setLogoNotice] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [logoUrlSaving, setLogoUrlSaving] = useState(false);
  const [footer, setFooter] = useState<FooterSettings>(defaultFooter);
  const [contact, setContact] = useState<ContactSettings>(defaultContact);
  const [footerSaving, setFooterSaving] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [footerNotice, setFooterNotice] = useState<string | null>(null);
  const [contactNotice, setContactNotice] = useState<string | null>(null);
  const presetColors = [
    "#f6c500",
    "#2563eb",
    "#22c55e",
    "#a855f7",
    "#f97316",
    "#14b8a6"
  ];

  useEffect(() => {
    setActiveColor(accent);
  }, [accent]);

  useEffect(() => {
    setPrimaryColor(primary);
  }, [primary]);

  useEffect(() => {
    if (logoUrl && !logoFile) setLogoPreview(logoUrl);
  }, [logoUrl, logoFile]);

  useEffect(() => {
    const stored = loadThemeSettings();
    setLogoName(stored.logoName ?? "");
    setLogoPreview(stored.logoUrl ?? logoUrl ?? null);
    const loadTheme = async () => {
      try {
        const response = await fetch("/api/brand/theme", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        if (!data) return;
        if (data.accent) {
          setActiveColor(data.accent);
          setAccent(data.accent);
        }
        if (data.primary) {
          setPrimaryColor(data.primary);
          setPrimary(data.primary);
        }
        if (data.logoUrl) {
          setLogoPreview(data.logoUrl);
          setLogoUrl(data.logoUrl);
          setLogoUrlInput(data.logoUrl);
          saveThemeSettings({ logoUrl: data.logoUrl });
        }
        if (data.footer) setFooter((prev) => ({ ...prev, ...data.footer }));
        if (data.contact) {
          // Deep merge to preserve all fields including customLabel and customUrl
          setContact((prev) => ({
            ...prev,
            ...data.contact,
            // Explicitly preserve custom fields if they exist in the loaded data
            customLabel: data.contact.customLabel ?? prev.customLabel ?? "",
            customUrl: data.contact.customUrl ?? prev.customUrl ?? ""
          }));
        }
      } catch {
        // ignore
      }
    };
    loadTheme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleActiveChange = (value: string) => {
    setActiveColor(value);
    setAccent(value);
  };

  const handlePrimaryChange = (value: string) => {
    setPrimaryColor(value);
    setPrimary(value);
  };

  const handleSave = async () => {
    setAccent(activeColor);
    setPrimary(primaryColor);
    saveThemeSettings({ accent: activeColor, primary: primaryColor, logoName });
    try {
      if (user?.id) {
        await fetch("/api/admin/brand/theme", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id
          },
          body: JSON.stringify({ accent: activeColor, primary: primaryColor })
        });
      }
    } catch {
      // persist locally even if API fails
    }
    setSaveNotice("Theme saved. All visitors will see these colors.");
    window.setTimeout(() => setSaveNotice(null), 2500);
  };

  const handleReset = async () => {
    resetTheme();
    setActiveColor(DEFAULT_ACCENT);
    setPrimaryColor(DEFAULT_PRIMARY);
    setLogoName("");
    setLogoFile(null);
    setLogoPreview(null);
    setLogoUrl("");
    saveThemeSettings({
      accent: DEFAULT_ACCENT,
      primary: DEFAULT_PRIMARY,
      logoName: "",
      logoUrl: ""
    });
    try {
      if (user?.id) {
        await fetch("/api/admin/brand/theme", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": user.id
          },
          body: JSON.stringify({ accent: DEFAULT_ACCENT, primary: DEFAULT_PRIMARY })
        });
      }
    } catch {
      // persist locally even if API fails
    }
    setSaveNotice("Theme reset.");
    window.setTimeout(() => setSaveNotice(null), 2500);
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      setLogoNotice("Choose a logo file first.");
      window.setTimeout(() => setLogoNotice(null), 2500);
      return;
    }
    if (!user?.id) {
      setLogoNotice("Please login again to upload a logo.");
      window.setTimeout(() => setLogoNotice(null), 2500);
      return;
    }
    setLogoUploading(true);
    setLogoNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", logoFile);
      const uploadResponse = await fetch("/api/uploads/brand-logo", {
        method: "POST",
        headers: { "x-user-id": user.id },
        body: formData
      });
      const uploadData = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok) {
        throw new Error(uploadData?.error ?? "Unable to upload logo.");
      }
      if (!uploadData?.url) {
        throw new Error("Upload succeeded but no URL was returned.");
      }
      const logoUrlToSave = uploadData.url;
      const saveResponse = await fetch("/api/admin/brand/logo", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ logoUrl: logoUrlToSave })
      });
      const saveData = await saveResponse.json().catch(() => null);
      if (!saveResponse.ok) {
        throw new Error(saveData?.error ?? "Logo uploaded but failed to save. Please try again.");
      }
      setLogoPreview(logoUrlToSave);
      setLogoUrl(logoUrlToSave);
      setLogoFile(null);
      saveThemeSettings({ logoName: logoFile.name, logoUrl: logoUrlToSave });
      setLogoNotice("Logo saved and will appear across the site.");
      window.setTimeout(() => setLogoNotice(null), 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload logo.";
      setLogoNotice(message);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSaveLogoUrl = async () => {
    const url = logoUrlInput.trim();
    if (!url) {
      setLogoNotice("Enter a logo image URL.");
      window.setTimeout(() => setLogoNotice(null), 2500);
      return;
    }
    try {
      new URL(url);
    } catch {
      setLogoNotice("Enter a valid URL (e.g. https://example.com/logo.png).");
      window.setTimeout(() => setLogoNotice(null), 2500);
      return;
    }
    if (!user?.id) {
      setLogoNotice("Please log in again to save the logo.");
      window.setTimeout(() => setLogoNotice(null), 2500);
      return;
    }
    setLogoUrlSaving(true);
    setLogoNotice(null);
    try {
      const res = await fetch("/api/admin/brand/logo", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ logoUrl: url })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to save logo URL.");
      }
      const savedUrl = (data.logoUrl ?? url).trim();
      setLogoPreview(savedUrl);
      setLogoUrl(savedUrl);
      setLogoUrlInput(savedUrl);
      setLogoFile(null);
      setLogoName("");
      saveThemeSettings({ logoUrl: savedUrl });
      setLogoNotice("Logo URL saved. It will appear across the site.");
      localStorage.setItem("theme:refresh", Date.now().toString());
      window.dispatchEvent(new Event("theme:refresh"));
      window.setTimeout(() => setLogoNotice(null), 2500);
    } catch (error) {
      setLogoNotice(error instanceof Error ? error.message : "Unable to save logo URL.");
    } finally {
      setLogoUrlSaving(false);
    }
  };

  const handleFooterSave = async () => {
    if (!user?.id) return;
    setFooterSaving(true);
    setFooterNotice(null);
    try {
      const res = await fetch("/api/admin/brand/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ footer })
      });
      if (!res.ok) throw new Error("Failed to save footer settings.");
      setFooterNotice("Footer settings saved.");
      window.setTimeout(() => setFooterNotice(null), 2500);
    } catch {
      setFooterNotice("Unable to save footer settings.");
    } finally {
      setFooterSaving(false);
    }
  };

  const handleContactSave = async () => {
    if (!user?.id) return;
    setContactSaving(true);
    setContactNotice(null);
    try {
      // Send all contact fields, trimming whitespace but preserving empty strings
      // This ensures customLabel and customUrl are saved even if they're empty (to clear them)
      const contactToSave: ContactSettings = {
        whatsapp: contact.whatsapp.trim(),
        telegram: contact.telegram.trim(),
        messenger: contact.messenger?.trim() || "",
        email: contact.email.trim(),
        phone: contact.phone.trim(),
        customLabel: contact.customLabel.trim(),
        customUrl: contact.customUrl.trim(),
        showWidget: contact.showWidget
      };

      const res = await fetch("/api/admin/brand/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ contact: contactToSave })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error || "Failed to save contact settings.");
      }
      const savedData = await res.json().catch(() => null);
      // Update local state with saved data to ensure consistency
      if (savedData?.contact) {
        setContact((prev) => ({ ...prev, ...savedData.contact }));
      }
      setContactNotice("Contact settings saved.");
      // Trigger theme refresh in all tabs/windows
      localStorage.setItem("theme:refresh", Date.now().toString());
      window.dispatchEvent(new Event("theme:refresh"));
      window.setTimeout(() => setContactNotice(null), 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save contact settings.";
      setContactNotice(message);
    } finally {
      setContactSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <header>
        <h1 className="text-2xl font-black text-[#0f172a]">Theme Customization</h1>
        <p className="text-sm text-slate-500">Update brand colors, logo, footer, and contact links.</p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        {saveNotice ? (
          <div className="mb-4 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-600">
            {saveNotice}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
          {/* Left: Brand Colors */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#0f172a]">Brand Colors</h2>
                <p className="text-sm text-slate-500">
                  Active color highlights buttons and accents. Primary color styles links, borders, and selections.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-[#f8fafc] px-4 py-2 text-xs font-semibold text-slate-600">
                Live Preview
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: activeColor }}
                  title="Active"
                />
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                  title="Primary"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Primary Color
            </label>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(event) => handlePrimaryChange(event.target.value)}
                className="h-10 w-10 cursor-pointer rounded-xl border border-slate-200"
              />
              <input
                value={primaryColor}
                onChange={(event) => handlePrimaryChange(event.target.value)}
                className="flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {presetColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handlePrimaryChange(color)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    primaryColor.toLowerCase() === color
                      ? "border-slate-900"
                      : "border-white shadow-[0_4px_10px_rgba(15,23,42,0.12)]"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select primary ${color}`}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Active Color
            </label>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input
                type="color"
                value={activeColor}
                onChange={(event) => handleActiveChange(event.target.value)}
                className="h-10 w-10 cursor-pointer rounded-xl border border-slate-200"
              />
              <input
                value={activeColor}
                onChange={(event) => handleActiveChange(event.target.value)}
                className="flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {presetColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleActiveChange(color)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    activeColor.toLowerCase() === color
                      ? "border-slate-900"
                      : "border-white shadow-[0_4px_10px_rgba(15,23,42,0.12)]"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select ${color}`}
                />
              ))}
            </div>
          </div>
        </div>
          </div>

          {/* Right: Contact & Integration */}
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">Contact &amp; Integration</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add your WhatsApp, social links, or any contact link. A floating button will appear on the site.
            </p>
            {contactNotice ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-600">
                {contactNotice}
              </div>
            ) : null}
            <div className="mt-6 space-y-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setContact((prev) => ({ ...prev, showWidget: !prev.showWidget }))}
                  className={`relative h-6 w-11 rounded-full transition ${contact.showWidget ? "bg-[#22c55e]" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${contact.showWidget ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <span className="text-sm text-slate-700">Show floating contact button on site</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#25D366]" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </label>
                  <input
                    value={contact.whatsapp}
                    onChange={(e) => setContact((prev) => ({ ...prev, whatsapp: e.target.value }))}
                    placeholder="https://wa.me/233XXXXXXXXX"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0088cc]" fill="currentColor" aria-hidden="true">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                    Telegram
                  </label>
                  <input
                    value={contact.telegram}
                    onChange={(e) => setContact((prev) => ({ ...prev, telegram: e.target.value }))}
                    placeholder="https://t.me/yourusername"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Email
                  </label>
                  <input
                    value={contact.email}
                    onChange={(e) => setContact((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="support@bundlearena.com"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    Phone
                  </label>
                  <input
                    value={contact.phone}
                    onChange={(e) => setContact((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+233 XX XXX XXXX"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                  />
                </div>
              </div>
            </div>
            <div className="mt-6">
              <button
                className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white disabled:opacity-70"
                onClick={handleContactSave}
                disabled={contactSaving}
                type="button"
              >
                {contactSaving ? "Saving..." : "Save Contact"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Logo Upload
            </label>
            <p className="mt-1 text-xs text-slate-400">
              Upload a file (requires Cloudinary) or use a logo URL below (no Cloudinary needed).
            </p>
            <div className="mt-3 flex items-center gap-4">
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setLogoFile(file ?? null);
                  setLogoName(file ? file.name : "");
                  setLogoPreview(file ? URL.createObjectURL(file) : logoUrl ?? null);
                }}
              />
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                onClick={handleLogoUpload}
                type="button"
                disabled={logoUploading}
              >
                {logoUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Or use a logo URL (no Cloudinary needed)
              </label>
              <p className="mt-1 text-xs text-slate-400">
                Paste a direct image link (e.g. https://yoursite.com/logo.png). Imgbb page links (ibb.co/…) are auto-converted to the image.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="url"
                  value={logoUrlInput}
                  onChange={(e) => setLogoUrlInput(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
                />
                <button
                  type="button"
                  onClick={handleSaveLogoUrl}
                  disabled={logoUrlSaving}
                  className="rounded-full bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white disabled:opacity-70"
                >
                  {logoUrlSaving ? "Saving..." : "Save logo URL"}
                </button>
              </div>
            </div>
            {logoPreview ? (
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
                  <Image src={logoPreview} alt="Brand logo preview" width={40} height={40} className="h-full w-full object-contain" />
                </div>
                <p className="text-xs text-slate-500">Logo preview</p>
              </div>
            ) : null}
            {logoName ? (
              <p className="mt-3 text-xs font-semibold text-slate-500">
                Selected: {logoName}
              </p>
            ) : null}
            {logoNotice ? (
              <p className="mt-2 text-xs font-semibold text-slate-600">{logoNotice}</p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-5">
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Custom Link
            </label>
            <p className="mt-1 text-xs text-slate-400">Add any other link (e.g. Facebook, Instagram).</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:gap-2">
              <input
                value={contact.customLabel}
                onChange={(e) => setContact((prev) => ({ ...prev, customLabel: e.target.value }))}
                placeholder="Label (e.g. Instagram)"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
              />
              <input
                value={contact.customUrl}
                onChange={(e) => setContact((prev) => ({ ...prev, customUrl: e.target.value }))}
                placeholder="https://instagram.com/youraccount"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
            onClick={handleReset}
            type="button"
          >
            Reset
          </button>
          <button
            className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white"
            onClick={handleSave}
            type="button"
          >
            Save Theme
          </button>
        </div>
      </section>

      {/* ── Footer Settings ── */}
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#0f172a]">Footer Settings</h2>
            <p className="text-sm text-slate-500">
              Customize the footer copyright text and page links.
            </p>
          </div>
        </div>

        {footerNotice ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-600">
            {footerNotice}
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Copyright Text
            </label>
            <input
              value={footer.copyright}
              onChange={(e) => setFooter((prev) => ({ ...prev, copyright: e.target.value }))}
              placeholder={`© ${new Date().getFullYear()} BundleArena. All rights reserved.`}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFooter((prev) => ({ ...prev, showLogo: !prev.showLogo }))}
              className={`relative h-6 w-11 rounded-full transition ${footer.showLogo ? "bg-[#22c55e]" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${footer.showLogo ? "left-[22px]" : "left-0.5"}`} />
            </button>
            <span className="text-sm text-slate-700">Show logo in footer</span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Privacy Policy URL
              </label>
              <input
                value={footer.privacyUrl}
                onChange={(e) => setFooter((prev) => ({ ...prev, privacyUrl: e.target.value }))}
                placeholder="https://example.com/privacy"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Terms of Service URL
              </label>
              <input
                value={footer.termsUrl}
                onChange={(e) => setFooter((prev) => ({ ...prev, termsUrl: e.target.value }))}
                placeholder="https://example.com/terms"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Contact Page URL
              </label>
              <input
                value={footer.contactUrl}
                onChange={(e) => setFooter((prev) => ({ ...prev, contactUrl: e.target.value }))}
                placeholder="https://example.com/contact"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            className="rounded-full bg-[#2563eb] px-5 py-2 text-sm font-semibold text-white disabled:opacity-70"
            onClick={handleFooterSave}
            disabled={footerSaving}
            type="button"
          >
            {footerSaving ? "Saving..." : "Save Footer"}
          </button>
        </div>
      </section>
    </div>
  );
}
