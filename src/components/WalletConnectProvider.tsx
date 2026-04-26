"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  getWalletKit,
  buildApprovalNamespaces,
  getEvmAddress,
  handleSessionRequest,
  type SessionProposal,
  type SessionRequest,
} from "@/lib/walletconnect";
import { useSession } from "@/lib/state/session";
import type { SessionTypes } from "@walletconnect/types";

interface WcState {
  ready: boolean;
  sessions: SessionTypes.Struct[];
  pendingProposal: SessionProposal | null;
  pendingRequest: SessionRequest | null;
  pair: (uri: string) => Promise<void>;
  approveProposal: () => Promise<void>;
  rejectProposal: () => Promise<void>;
  approveRequest: () => Promise<void>;
  rejectRequest: () => Promise<void>;
  disconnect: (topic: string) => Promise<void>;
  refreshSessions: () => void;
}

const WcContext = createContext<WcState>({
  ready: false,
  sessions: [],
  pendingProposal: null,
  pendingRequest: null,
  pair: async () => {},
  approveProposal: async () => {},
  rejectProposal: async () => {},
  approveRequest: async () => {},
  rejectRequest: async () => {},
  disconnect: async () => {},
  refreshSessions: () => {},
});

export function useWalletConnect() {
  return useContext(WcContext);
}

export function WalletConnectProvider({ children }: { children: ReactNode }) {
  const { mnemonic, isUnlocked } = useSession();
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<SessionTypes.Struct[]>([]);
  const [pendingProposal, setPendingProposal] = useState<SessionProposal | null>(null);
  const [pendingRequest, setPendingRequest] = useState<SessionRequest | null>(null);

  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

  const refreshSessions = useCallback(async () => {
    if (!projectId) return;
    try {
      const wk = await getWalletKit();
      const active = wk.getActiveSessions();
      setSessions(Object.values(active));
    } catch {}
  }, [projectId]);

  useEffect(() => {
    if (!isUnlocked || !projectId) return;

    let mounted = true;

    (async () => {
      try {
        const wk = await getWalletKit();
        if (!mounted) return;

        wk.on("session_proposal", (proposal: SessionProposal) => {
          if (mounted) setPendingProposal(proposal);
        });

        wk.on("session_request", (request: SessionRequest) => {
          if (mounted) setPendingRequest(request);
        });

        wk.on("session_delete", () => {
          if (mounted) refreshSessions();
        });

        setSessions(Object.values(wk.getActiveSessions()));
        setReady(true);
      } catch (e) {
        console.error("WalletConnect init failed:", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isUnlocked, projectId, refreshSessions]);

  const pair = useCallback(async (uri: string) => {
    const wk = await getWalletKit();
    await wk.pair({ uri });
  }, []);

  const approveProposal = useCallback(async () => {
    if (!pendingProposal || !mnemonic) return;
    const wk = await getWalletKit();
    const evmAddress = getEvmAddress(mnemonic);
    const namespaces = buildApprovalNamespaces(pendingProposal, evmAddress);
    if (!namespaces) {
      await wk.rejectSession({
        id: pendingProposal.id,
        reason: { code: 5100, message: "Requested chains not supported" },
      });
      setPendingProposal(null);
      return;
    }
    await wk.approveSession({ id: pendingProposal.id, namespaces });
    setPendingProposal(null);
    refreshSessions();
  }, [pendingProposal, mnemonic, refreshSessions]);

  const rejectProposal = useCallback(async () => {
    if (!pendingProposal) return;
    const wk = await getWalletKit();
    await wk.rejectSession({
      id: pendingProposal.id,
      reason: { code: 5000, message: "User rejected" },
    });
    setPendingProposal(null);
  }, [pendingProposal]);

  const approveRequest = useCallback(async () => {
    if (!pendingRequest || !mnemonic) return;
    const wk = await getWalletKit();
    try {
      const result = await handleSessionRequest(pendingRequest, mnemonic);
      await wk.respondSessionRequest({
        topic: pendingRequest.topic,
        response: {
          id: pendingRequest.id,
          jsonrpc: "2.0",
          result,
        },
      });
    } catch (e) {
      await wk.respondSessionRequest({
        topic: pendingRequest.topic,
        response: {
          id: pendingRequest.id,
          jsonrpc: "2.0",
          error: {
            code: 5000,
            message: e instanceof Error ? e.message : "Request failed",
          },
        },
      });
    }
    setPendingRequest(null);
  }, [pendingRequest, mnemonic]);

  const rejectRequest = useCallback(async () => {
    if (!pendingRequest) return;
    const wk = await getWalletKit();
    await wk.respondSessionRequest({
      topic: pendingRequest.topic,
      response: {
        id: pendingRequest.id,
        jsonrpc: "2.0",
        error: { code: 5000, message: "User rejected" },
      },
    });
    setPendingRequest(null);
  }, [pendingRequest]);

  const disconnect = useCallback(async (topic: string) => {
    const wk = await getWalletKit();
    await wk.disconnectSession({
      topic,
      reason: { code: 6000, message: "User disconnected" },
    });
    refreshSessions();
  }, [refreshSessions]);

  return (
    <WcContext.Provider
      value={{
        ready,
        sessions,
        pendingProposal,
        pendingRequest,
        pair,
        approveProposal,
        rejectProposal,
        approveRequest,
        rejectRequest,
        disconnect,
        refreshSessions,
      }}
    >
      {children}
    </WcContext.Provider>
  );
}
