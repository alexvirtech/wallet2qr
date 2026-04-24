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

interface SessionState {
  mnemonic: string | null;
  password: string | null;
  setSession: (mnemonic: string, password: string) => void;
  lock: () => void;
  isUnlocked: boolean;
  verifyPassword: (input: string) => boolean;
}

const SessionContext = createContext<SessionState>({
  mnemonic: null,
  password: null,
  setSession: () => {},
  lock: () => {},
  isUnlocked: false,
  verifyPassword: () => false,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [mnemonic, setMnemonicRaw] = useState<string | null>(null);
  const [password, setPasswordRaw] = useState<string | null>(null);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    setMnemonicRaw(null);
    setPasswordRaw(null);
    router.push("/qr-to-wallet");
  }, [router]);

  const resetIdleTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (mnemonic) {
      timerRef.current = setTimeout(lock, IDLE_TIMEOUT_MS);
    }
  }, [mnemonic, lock]);

  const setSession = useCallback(
    (m: string, p: string) => {
      setMnemonicRaw(m);
      setPasswordRaw(p);
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

  return (
    <SessionContext.Provider
      value={{ mnemonic, password, setSession, lock, isUnlocked: !!mnemonic, verifyPassword }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
