"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const STORAGE_KEY = "w2q_session";

interface StoredSession {
  mnemonic: string;
  password: string;
  readOnly?: boolean;
}

function saveToStorage(mnemonic: string, password: string, readOnly: boolean) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mnemonic, password, readOnly } satisfies StoredSession)
    );
  } catch {}
}

function loadFromStorage(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.mnemonic && typeof parsed.password === "string") return parsed;
  } catch {}
  return null;
}

function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

interface SessionState {
  mnemonic: string | null;
  password: string | null;
  readOnly: boolean;
  setSession: (mnemonic: string, password: string, readOnly?: boolean) => void;
  lock: () => void;
  isUnlocked: boolean;
  verifyPassword: (input: string) => boolean;
}

const SessionContext = createContext<SessionState>({
  mnemonic: null,
  password: null,
  readOnly: false,
  setSession: () => {},
  lock: () => {},
  isUnlocked: false,
  verifyPassword: () => false,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [mnemonic, setMnemonicRaw] = useState<string | null>(null);
  const [password, setPasswordRaw] = useState<string | null>(null);
  const [readOnly, setReadOnlyRaw] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setMnemonicRaw(stored.mnemonic);
      setPasswordRaw(stored.password);
      setReadOnlyRaw(stored.readOnly ?? false);
    }
    setHydrated(true);
  }, []);

  const lock = useCallback(() => {
    setMnemonicRaw(null);
    setPasswordRaw(null);
    setReadOnlyRaw(false);
    clearStorage();
    router.push("/qr-to-wallet");
  }, [router]);

  const resetIdleTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (mnemonic) {
      timerRef.current = setTimeout(lock, IDLE_TIMEOUT_MS);
    }
  }, [mnemonic, lock]);

  const setSession = useCallback(
    (m: string, p: string, ro = false) => {
      setMnemonicRaw(m);
      setPasswordRaw(p);
      setReadOnlyRaw(ro);
      saveToStorage(m, p, ro);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(lock, IDLE_TIMEOUT_MS);
    },
    [lock]
  );

  const verifyPassword = useCallback(
    (input: string) => {
      return password !== null && input === password;
    },
    [password]
  );

  useEffect(() => {
    if (!mnemonic) return;
    const events = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    const handler = () => resetIdleTimer();
    events.forEach((e) => window.addEventListener(e, handler));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mnemonic, resetIdleTimer]);

  if (!hydrated) return null;

  return (
    <SessionContext.Provider
      value={{
        mnemonic,
        password,
        readOnly,
        setSession,
        lock,
        isUnlocked: !!mnemonic,
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
