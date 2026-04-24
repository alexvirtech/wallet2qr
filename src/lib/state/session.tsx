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

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface SessionState {
  mnemonic: string | null;
  setMnemonic: (m: string | null) => void;
  lock: () => void;
  isUnlocked: boolean;
}

const SessionContext = createContext<SessionState>({
  mnemonic: null,
  setMnemonic: () => {},
  lock: () => {},
  isUnlocked: false,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [mnemonic, setMnemonicRaw] = useState<string | null>(null);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    setMnemonicRaw(null);
    router.push("/qr-to-wallet");
  }, [router]);

  const resetIdleTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (mnemonic) {
      timerRef.current = setTimeout(lock, IDLE_TIMEOUT_MS);
    }
  }, [mnemonic, lock]);

  const setMnemonic = useCallback(
    (m: string | null) => {
      setMnemonicRaw(m);
      if (m) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(lock, IDLE_TIMEOUT_MS);
      } else {
        if (timerRef.current) clearTimeout(timerRef.current);
      }
    },
    [lock]
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
      value={{ mnemonic, setMnemonic, lock, isUnlocked: !!mnemonic }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
