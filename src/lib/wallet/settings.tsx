"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { allNetworks, type TokenConfig } from "./networks";
import { getAssetsForNetwork } from "./assets";
import {
  getDefaultSchemeId,
  getScheme,
  resolveTemplate,
  getNextIndex,
} from "./derivationSchemes";

export type UiMode = "simple" | "advanced";
export type PaymentAssetPref = "USDT" | "USDC" | "auto";
export type PaymentNetworkPref = "auto" | string;
export type RoutingMode = "lowest_fee" | "fastest" | "best_liquidity" | "manual";
export type DataSource = "extrawallet" | "direct";

interface TokenSetting {
  added: boolean;
  visible: boolean;
}

export interface DerivedAccount {
  path: string;
  label: string;
}

interface NetworkSetting {
  added: boolean;
  visible: boolean;
  tokens: Record<string, TokenSetting>;
  derivationPath?: string;
  accounts: DerivedAccount[];
  activeAccountIndex: number;
  schemeId?: string;
}

export interface CustomToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  coingeckoId: string;
  networkKey: string;
}

export interface WalletSettings {
  networks: Record<string, NetworkSetting>;
  mode: UiMode;
  preferredPaymentAsset: PaymentAssetPref;
  preferredPaymentNetwork: PaymentNetworkPref;
  routingMode: RoutingMode;
  customTokens: CustomToken[];
  dataSource: DataSource;
}

const STORAGE_KEY = "wallet2qr_settings";

function buildDefaultSettings(): WalletSettings {
  const networks: Record<string, NetworkSetting> = {};
  for (const [key, net] of Object.entries(allNetworks)) {
    const tokens: Record<string, TokenSetting> = {};
    tokens[net.nativeCurrency.symbol] = { added: true, visible: true };

    const assetDefs = getAssetsForNetwork(key);
    for (const t of net.tokens) {
      const def = assetDefs.find((a) => a.symbol === t.symbol);
      const isVisible = def ? def.isDefaultVisible : true;
      tokens[t.symbol] = { added: isVisible, visible: isVisible };
    }

    const schemeId = getDefaultSchemeId(net.chainType);
    const scheme = getScheme(schemeId)!;
    const defaultPath = resolveTemplate(scheme.template, 0);

    networks[key] = {
      added: net.isDefault,
      visible: true,
      tokens,
      accounts: [{ path: defaultPath, label: "Account 1" }],
      activeAccountIndex: 0,
      schemeId,
    };
  }
  return {
    networks,
    mode: "simple",
    preferredPaymentAsset: "auto",
    preferredPaymentNetwork: "auto",
    routingMode: "lowest_fee",
    customTokens: [],
    dataSource: "extrawallet",
  };
}

function loadSettings(): WalletSettings {
  if (typeof window === "undefined") return buildDefaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultSettings();
    const stored = JSON.parse(raw) as WalletSettings;
    const defaults = buildDefaultSettings();

    if (!stored.mode) stored.mode = defaults.mode;
    if (!stored.preferredPaymentAsset) stored.preferredPaymentAsset = defaults.preferredPaymentAsset;
    if (!stored.preferredPaymentNetwork) stored.preferredPaymentNetwork = defaults.preferredPaymentNetwork;
    if (!stored.routingMode) stored.routingMode = defaults.routingMode;
    if (!stored.customTokens) stored.customTokens = [];
    if (!stored.dataSource) stored.dataSource = defaults.dataSource;

    for (const key of Object.keys(defaults.networks)) {
      if (!stored.networks[key]) {
        stored.networks[key] = defaults.networks[key];
      } else {
        const ns = stored.networks[key];
        const net = allNetworks[key];
        if (net?.isDefault && !ns.added) {
          ns.added = true;
        }
        for (const tkn of Object.keys(defaults.networks[key].tokens)) {
          if (!ns.tokens[tkn]) {
            ns.tokens[tkn] = defaults.networks[key].tokens[tkn];
          }
        }
        // Migrate: add accounts array if missing
        if (!ns.accounts || ns.accounts.length === 0) {
          const schemeId = ns.schemeId || getDefaultSchemeId(net.chainType);
          const path = ns.derivationPath || resolveTemplate(getScheme(schemeId)!.template, 0);
          ns.accounts = [{ path, label: "Account 1" }];
          ns.activeAccountIndex = 0;
          ns.schemeId = schemeId;
        }
        if (ns.activeAccountIndex == null) ns.activeAccountIndex = 0;
        if (ns.activeAccountIndex >= ns.accounts.length) ns.activeAccountIndex = 0;
      }
    }

    for (const ct of stored.customTokens) {
      if (stored.networks[ct.networkKey] && !stored.networks[ct.networkKey].tokens[ct.symbol]) {
        stored.networks[ct.networkKey].tokens[ct.symbol] = { added: true, visible: true };
      }
    }

    saveSettings(stored);
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
  setMode: (mode: UiMode) => void;
  setDataSource: (ds: DataSource) => void;
  setPaymentAssetPref: (pref: PaymentAssetPref) => void;
  setPaymentNetworkPref: (pref: PaymentNetworkPref) => void;
  setRoutingMode: (mode: RoutingMode) => void;
  addNetwork: (key: string) => void;
  removeNetwork: (key: string) => void;
  toggleNetworkVisible: (key: string) => void;
  addToken: (networkKey: string, symbol: string) => void;
  removeToken: (networkKey: string, symbol: string) => void;
  toggleTokenVisible: (networkKey: string, symbol: string) => void;
  addCustomToken: (token: CustomToken) => void;
  removeCustomToken: (networkKey: string, symbol: string) => void;
  setDerivationPath: (networkKey: string, path: string) => void;
  addAccount: (networkKey: string, customPath?: string) => void;
  removeAccount: (networkKey: string, index: number) => void;
  setActiveAccount: (networkKey: string, index: number) => void;
  setScheme: (networkKey: string, schemeId: string) => void;
  getActiveNetworkKeys: () => string[];
  getVisibleTokens: (networkKey: string) => string[];
  getDerivationPath: (networkKey: string) => string;
  getCustomTokensForNetwork: (networkKey: string) => CustomToken[];
  getAllTokensForNetwork: (networkKey: string) => TokenConfig[];
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

  const setMode = useCallback(
    (mode: UiMode) => {
      const next = structuredClone(settings);
      next.mode = mode;
      persist(next);
    },
    [settings, persist]
  );

  const setDataSource = useCallback(
    (ds: DataSource) => {
      const next = structuredClone(settings);
      next.dataSource = ds;
      persist(next);
    },
    [settings, persist]
  );

  const setPaymentAssetPref = useCallback(
    (pref: PaymentAssetPref) => {
      const next = structuredClone(settings);
      next.preferredPaymentAsset = pref;
      persist(next);
    },
    [settings, persist]
  );

  const setPaymentNetworkPref = useCallback(
    (pref: PaymentNetworkPref) => {
      const next = structuredClone(settings);
      next.preferredPaymentNetwork = pref;
      persist(next);
    },
    [settings, persist]
  );

  const setRoutingMode = useCallback(
    (mode: RoutingMode) => {
      const next = structuredClone(settings);
      next.routingMode = mode;
      persist(next);
    },
    [settings, persist]
  );

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
      if (next.networks[key]) {
        if (allNetworks[key]?.isDefault) {
          next.networks[key].visible = false;
        } else {
          next.networks[key].added = false;
        }
      }
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

  const addCustomToken = useCallback(
    (token: CustomToken) => {
      const next = structuredClone(settings);
      const exists = next.customTokens.some(
        (t) => t.networkKey === token.networkKey && t.symbol === token.symbol
      );
      if (exists) return;
      next.customTokens.push(token);
      if (next.networks[token.networkKey]) {
        next.networks[token.networkKey].tokens[token.symbol] = { added: true, visible: true };
      }
      persist(next);
    },
    [settings, persist]
  );

  const removeCustomToken = useCallback(
    (networkKey: string, symbol: string) => {
      const next = structuredClone(settings);
      next.customTokens = next.customTokens.filter(
        (t) => !(t.networkKey === networkKey && t.symbol === symbol)
      );
      if (next.networks[networkKey]?.tokens[symbol]) {
        delete next.networks[networkKey].tokens[symbol];
      }
      persist(next);
    },
    [settings, persist]
  );

  const setDerivationPath = useCallback(
    (networkKey: string, path: string) => {
      const next = structuredClone(settings);
      const ns = next.networks[networkKey];
      if (ns) {
        ns.derivationPath = path;
        if (ns.accounts.length > 0) {
          ns.accounts[ns.activeAccountIndex].path = path;
        }
      }
      persist(next);
    },
    [settings, persist]
  );

  const addAccount = useCallback(
    (networkKey: string, customPath?: string) => {
      const next = structuredClone(settings);
      const ns = next.networks[networkKey];
      if (!ns) return;
      let path: string;
      if (customPath) {
        path = customPath;
      } else {
        const scheme = getScheme(ns.schemeId || "bip44-standard");
        if (!scheme) return;
        const existingPaths = ns.accounts.map((a) => a.path);
        const nextIdx = getNextIndex(scheme.template, existingPaths);
        path = resolveTemplate(scheme.template, nextIdx);
      }
      const label = `Account ${ns.accounts.length + 1}`;
      ns.accounts.push({ path, label });
      ns.activeAccountIndex = ns.accounts.length - 1;
      ns.derivationPath = path;
      persist(next);
    },
    [settings, persist]
  );

  const removeAccount = useCallback(
    (networkKey: string, index: number) => {
      const next = structuredClone(settings);
      const ns = next.networks[networkKey];
      if (!ns || ns.accounts.length <= 1 || index === 0) return;
      ns.accounts.splice(index, 1);
      if (ns.activeAccountIndex >= ns.accounts.length) {
        ns.activeAccountIndex = ns.accounts.length - 1;
      }
      ns.derivationPath = ns.accounts[ns.activeAccountIndex].path;
      persist(next);
    },
    [settings, persist]
  );

  const setActiveAccount = useCallback(
    (networkKey: string, index: number) => {
      const next = structuredClone(settings);
      const ns = next.networks[networkKey];
      if (!ns || index >= ns.accounts.length) return;
      ns.activeAccountIndex = index;
      ns.derivationPath = ns.accounts[index].path;
      persist(next);
    },
    [settings, persist]
  );

  const setScheme = useCallback(
    (networkKey: string, schemeId: string) => {
      const next = structuredClone(settings);
      const ns = next.networks[networkKey];
      if (!ns) return;
      const scheme = getScheme(schemeId);
      if (!scheme) return;
      ns.schemeId = schemeId;
      const defaultPath = resolveTemplate(scheme.template, 0);
      ns.accounts = [{ path: defaultPath, label: "Account 1" }];
      ns.activeAccountIndex = 0;
      ns.derivationPath = defaultPath;
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

  const getDerivationPath = useCallback(
    (networkKey: string) => {
      const ns = settings.networks[networkKey];
      if (!ns) return allNetworks[networkKey]?.derivationPath ?? "m/44'/60'/0'/0/0";
      const idx = ns.activeAccountIndex ?? 0;
      if (ns.accounts && ns.accounts[idx]) return ns.accounts[idx].path;
      if (ns.derivationPath) return ns.derivationPath;
      return allNetworks[networkKey]?.derivationPath ?? "m/44'/60'/0'/0/0";
    },
    [settings]
  );

  const getCustomTokensForNetwork = useCallback(
    (networkKey: string) => {
      return settings.customTokens.filter((t) => t.networkKey === networkKey);
    },
    [settings]
  );

  const getAllTokensForNetwork = useCallback(
    (networkKey: string): TokenConfig[] => {
      const net = allNetworks[networkKey];
      if (!net) return [];
      const builtIn = [...net.tokens];
      const custom = settings.customTokens
        .filter((t) => t.networkKey === networkKey)
        .map((t) => ({
          symbol: t.symbol,
          name: t.name,
          address: t.address,
          decimals: t.decimals,
          coingeckoId: t.coingeckoId,
        }));
      return [...builtIn, ...custom];
    },
    [settings]
  );

  return (
    <SettingsContext.Provider
      value={{
        settings,
        setMode,
        setDataSource,
        setPaymentAssetPref,
        setPaymentNetworkPref,
        setRoutingMode,
        addNetwork,
        removeNetwork,
        toggleNetworkVisible,
        addToken,
        removeToken,
        toggleTokenVisible,
        addCustomToken,
        removeCustomToken,
        setDerivationPath,
        addAccount,
        removeAccount,
        setActiveAccount,
        setScheme,
        getActiveNetworkKeys,
        getVisibleTokens,
        getDerivationPath,
        getCustomTokensForNetwork,
        getAllTokensForNetwork,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}

export function getDataSourceSetting(): DataSource {
  if (typeof window === "undefined") return "extrawallet";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "extrawallet";
    const parsed = JSON.parse(raw);
    return parsed?.dataSource || "extrawallet";
  } catch {
    return "extrawallet";
  }
}
