"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { LandingConfig } from "@/shared/types";
import { defaultLandingConfig } from "@/shared/constants/landingConfig";
import { mergeLandingConfig } from "@/shared/utils/landingConfig";

interface LandingConfigContextValue {
  config: LandingConfig;
  updateConfig: (next: LandingConfig) => void;
  resetConfig: () => void;
}

const LandingConfigContext = createContext<LandingConfigContextValue | undefined>(undefined);
const STORAGE_KEY = "vickydata.landing.config";

export function LandingConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<LandingConfig>(defaultLandingConfig);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let active = true;
    const readLocalStorage = () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as LandingConfig;
        if (!active) return;
        const merged = mergeLandingConfig(parsed);
        setConfig(merged);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    };

    const loadFromApi = async () => {
      try {
        const response = await fetch("/api/landing");
        if (!response.ok) {
          readLocalStorage();
          return;
        }
        const data = (await response.json()) as LandingConfig;
        if (!active) return;
        const merged = mergeLandingConfig(data);
        setConfig(merged);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        readLocalStorage();
      }
    };

    loadFromApi();
    return () => {
      active = false;
    };
  }, []);

  const updateConfig = useCallback((next: LandingConfig) => {
    setConfig(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const resetConfig = useCallback(() => {
    updateConfig(defaultLandingConfig);
  }, [updateConfig]);

  const value = useMemo(
    () => ({
      config,
      updateConfig,
      resetConfig
    }),
    [config, updateConfig, resetConfig]
  );

  return (
    <LandingConfigContext.Provider value={value}>
      {children}
    </LandingConfigContext.Provider>
  );
}

export function useLandingConfig() {
  const context = useContext(LandingConfigContext);
  if (!context) {
    throw new Error("useLandingConfig must be used within LandingConfigProvider");
  }
  return context;
}
