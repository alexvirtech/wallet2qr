"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { allNetworks } from "./networks";

interface TokenSetting {
  added: boolean;
  visible: boolean;
}

interface NetworkSetting {
  added: boolean;
  visible: boolean;
  tokens: Record<string, TokenSetting>;
}

export interface WalletSettings {
  networks: Record<string, NetworkSetting>;
}

const STORAGE_KEY = "wallet2qr_settings";

function buildDefaultSettings(): WalletSettings {
  const networks: Record<string, NetworkSetting> = {};
  for (const [key, net] of Object.entries(allNetworks)) {
    const tokens: Record<string, TokenSetting> = {};
    tokens[net.nativeCurrency.symbol] = { added: true, visible: true };
    for (const t of net.tokens) {
      tokens[t.symbol] = { added: true, visible: true };
    }
    networks[key] = { added: net.isDefault, visible: true, tokens };
  }
  return { networks };
}

function loadSettings(): WalletSettings {
  if (typeof window === "undefined") return buildDefaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultSettings();
    const stored = JSON.parse(raw) as WalletSettings;
    const defaults = buildDefaultSettings();
    for (const key of Object.keys(defaults.networks)) {
      if (!stored.networks[key]) {
        stored.networks[key] = defaults.networks[key];
      } else {
        for (const tkn of Object.keys(defaults.networks[key].tokens)) {
          if (!stored.networks[key].tokens[tkn]) {
            stored.networks[key].tokens[tkn] = defaults.networks[key].tokens[tkn];
          }
        }
      }
    }
    return stored;
  } catch {
    return buildDefaultSettings();
  }
}

function saveSettings(s: WalletSettings) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }
}

interface SettingsContextValue {
  settings: WalletSettings;
  addNetwork: (key: string) => void;
  removeNetwork: (key: string) => void;
  toggleNetworkVisible: (key: string) => void;
  addToken: (networkKey: string, symbol: string) => void;
  removeToken: (networkKey: string, symbol: string) => void;
  toggleTokenVisible: (networkKey: string, symbol: string) => void;
  getActiveNetworkKeys: () => string[];
  getVisibleTokens: (networkKey: string) => string[];
}

const SettingsContext = createContext<SettingsContextValue>(null!);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<WalletSettings>(buildDefaultSettings);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const persist = useCallback((next: WalletSettings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const addNetwork = useCallback(
    (key: string) => {
      const next = structuredClone(settings);
      if (next.networks[key]) {
        next.networks[key].added = true;
        next.networks[key].visible = true;
        for (const tkn of Object.keys(next.networks[key].tokens)) {
          next.networks[key].tokens[tkn].added = true;
          next.networks[key].tokens[tkn].visible = true;
        }
      }
      persist(next);
    },
    [settings, persist]
  );

  const removeNetwork = useCallback(
    (key: string) => {
      const next = structuredClone(settings);
      if (next.networks[key]) next.networks[key].added = false;
      persist(next);
    },
    [settings, persist]
  );

  const toggleNetworkVisible = useCallback(
    (key: string) => {
      const next = structuredClone(settings);
      if (next.networks[key]) {
        next.networks[key].visible = !next.networks[key].visible;
      }
      persist(next);
    },
    [settings, persist]
  );

  const addToken = useCallback(
    (networkKey: string, symbol: string) => {
      const next = structuredClone(settings);
      if (next.networks[networkKey]?.tokens[symbol]) {
        next.networks[networkKey].tokens[symbol].added = true;
        next.networks[networkKey].tokens[symbol].visible = true;
      }
      persist(next);
    },
    [settings, persist]
  );

  const removeToken = useCallback(
    (networkKey: string, symbol: string) => {
      const next = structuredClone(settings);
      if (next.networks[networkKey]?.tokens[symbol]) {
        next.networks[networkKey].tokens[symbol].added = false;
      }
      persist(next);
    },
    [settings, persist]
  );

  const toggleTokenVisible = useCallback(
    (networkKey: string, symbol: string) => {
      const next = structuredClone(settings);
      if (next.networks[networkKey]?.tokens[symbol]) {
        next.networks[networkKey].tokens[symbol].visible =
          !next.networks[networkKey].tokens[symbol].visible;
      }
      persist(next);
    },
    [settings, persist]
  );

  const getActiveNetworkKeys = useCallback(() => {
    return Object.keys(settings.networks).filter(
      (k) => settings.networks[k].added && settings.networks[k].visible
    );
  }, [settings]);

  const getVisibleTokens = useCallback(
    (networkKey: string) => {
      const ns = settings.networks[networkKey];
      if (!ns || !ns.added) return [];
      return Object.keys(ns.tokens).filter(
        (s) => ns.tokens[s].added && ns.tokens[s].visible
      );
    },
    [settings]
  );

  return (
    <SettingsContext.Provider
      value={{
        settings,
        addNetwork,
        removeNetwork,
        toggleNetworkVisible,
        addToken,
        removeToken,
        toggleTokenVisible,
        getActiveNetworkKeys,
        getVisibleTokens,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
