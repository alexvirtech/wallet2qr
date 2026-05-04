"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { idbGet, idbSet, idbDelete } from "./idb";

const SESSION_KEY = "session";
const VAULT_KEY = "vault";

interface StoredSession {
  mnemonic: string;
  password: string;
  readOnly?: boolean;
  isDeterministic?: boolean;
}

export interface VaultData {
  rawQrUrl: string;
  envelope: unknown;
  version: number;
}

async function saveSession(mnemonic: string, password: string, readOnly: boolean, isDeterministic: boolean) {
  await idbSet(SESSION_KEY, { mnemonic, password, readOnly, isDeterministic } satisfies StoredSession);
  // Remove legacy localStorage entry if present
  try { localStorage.removeItem("w2q_session"); } catch {}
}

async function loadSession(): Promise<StoredSession | null> {
  const stored = await idbGet<StoredSession>(SESSION_KEY);
  if (stored?.mnemonic && typeof stored.password === "string") return stored;
  // Migrate from localStorage if present
  try {
    const raw = localStorage.getItem("w2q_session");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.mnemonic && typeof parsed.password === "string") {
        await idbSet(SESSION_KEY, parsed);
        localStorage.removeItem("w2q_session");
        return parsed;
      }
    }
  } catch {}
  return null;
}

export async function clearSession() {
  await idbDelete(SESSION_KEY);
  try { localStorage.removeItem("w2q_session"); } catch {}
}

export async function saveVault(data: VaultData): Promise<void> {
  await idbSet(VAULT_KEY, data);
}

export async function loadVault(): Promise<VaultData | null> {
  return idbGet<VaultData>(VAULT_KEY);
}

export async function clearVault(): Promise<void> {
  await idbDelete(VAULT_KEY);
}

interface SessionState {
  mnemonic: string | null;
  password: string | null;
  readOnly: boolean;
  isDeterministic: boolean;
  setSession: (mnemonic: string, password: string, readOnly?: boolean, isDeterministic?: boolean) => void;
  lock: () => void;
  isUnlocked: boolean;
  hasVault: boolean;
  verifyPassword: (input: string) => boolean;
}

const SessionContext = createContext<SessionState>({
  mnemonic: null,
  password: null,
  readOnly: false,
  isDeterministic: false,
  setSession: () => {},
  lock: () => {},
  isUnlocked: false,
  hasVault: false,
  verifyPassword: () => false,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [mnemonic, setMnemonicRaw] = useState<string | null>(null);
  const [password, setPasswordRaw] = useState<string | null>(null);
  const [readOnly, setReadOnlyRaw] = useState(false);
  const [isDeterministic, setIsDeterministicRaw] = useState(false);
  const [hasVault, setHasVault] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const stored = await loadSession();
      if (stored) {
        setMnemonicRaw(stored.mnemonic);
        setPasswordRaw(stored.password);
        setReadOnlyRaw(stored.readOnly ?? false);
        setIsDeterministicRaw(stored.isDeterministic ?? false);
      }
      const vault = await loadVault();
      setHasVault(!!vault);
      setHydrated(true);
    })();
  }, []);

  const lock = useCallback(() => {
    setMnemonicRaw(null);
    setPasswordRaw(null);
    setReadOnlyRaw(false);
    setIsDeterministicRaw(false);
    clearSession();
    router.push("/qr-to-wallet");
  }, [router]);

  const setSession = useCallback(
    (m: string, p: string, ro = false, det = false) => {
      setMnemonicRaw(m);
      setPasswordRaw(p);
      setReadOnlyRaw(ro);
      setIsDeterministicRaw(det);
      saveSession(m, p, ro, det);
    },
    []
  );

  const verifyPassword = useCallback(
    (input: string) => {
      return password !== null && input === password;
    },
    [password]
  );

  if (!hydrated) return null;

  return (
    <SessionContext.Provider
      value={{
        mnemonic,
        password,
        readOnly,
        isDeterministic,
        setSession,
        lock,
        isUnlocked: !!mnemonic,
        hasVault,
        verifyPassword,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
