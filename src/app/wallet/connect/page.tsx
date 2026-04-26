"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { useWalletConnect } from "@/components/WalletConnectProvider";
import { formatChainId, describeRequest } from "@/lib/walletconnect";

export default function ConnectPage() {
  const { isUnlocked } = useSession();
  const router = useRouter();
  const {
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
  } = useWalletConnect();

  const [uri, setUri] = useState("");
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
  }, [isUnlocked, router]);

  if (!isUnlocked) return null;

  if (!projectId) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 text-center">
        <h1 className="text-2xl font-bold mb-4">WalletConnect</h1>
        <p className="text-gray-500 text-sm">
          WalletConnect is not configured. Set{" "}
          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">
            NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
          </code>{" "}
          in your environment variables.
        </p>
        <p className="text-gray-400 text-xs mt-2">
          Get a project ID at cloud.reown.com
        </p>
      </div>
    );
  }

  const handlePair = async () => {
    const trimmed = uri.trim();
    if (!trimmed) return;
    setError("");
    setPairing(true);
    try {
      await pair(trimmed);
      setUri("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to pair");
    } finally {
      setPairing(false);
    }
  };

  const handleApproveProposal = async () => {
    setProcessing(true);
    try {
      await approveProposal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectProposal = async () => {
    setProcessing(true);
    try {
      await rejectProposal();
    } catch {
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveRequest = async () => {
    setProcessing(true);
    try {
      await approveRequest();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectRequest = async () => {
    setProcessing(true);
    try {
      await rejectRequest();
    } catch {
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-6">WalletConnect</h1>

      {/* Pairing input */}
      <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg p-4 mb-6">
        <p className="text-sm font-bold mb-2">Connect to dApp</p>
        <p className="text-xs text-gray-400 mb-3">
          Paste the WalletConnect URI from the dApp you want to connect to
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="wc:..."
            className="flex-1 bg-white dark:bg-m-blue-dark-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handlePair}
            disabled={pairing || !uri.trim() || !ready}
            className="bg-blue-500 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
          >
            {pairing ? "..." : "Connect"}
          </button>
        </div>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
        {!ready && (
          <p className="text-gray-400 text-xs mt-2">Initializing WalletConnect...</p>
        )}
      </div>

      {/* Session proposal */}
      {pendingProposal && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm font-bold mb-2">Connection Request</p>
          <div className="mb-3 space-y-1">
            <p className="text-sm">
              <span className="text-gray-500">dApp:</span>{" "}
              <span className="font-bold">
                {pendingProposal.params.proposer.metadata.name}
              </span>
            </p>
            <p className="text-xs text-gray-400">
              {pendingProposal.params.proposer.metadata.url}
            </p>
            {pendingProposal.params.proposer.metadata.description && (
              <p className="text-xs text-gray-500">
                {pendingProposal.params.proposer.metadata.description}
              </p>
            )}
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Requested chains:</p>
              <div className="flex flex-wrap gap-1">
                {[
                  ...(pendingProposal.params.requiredNamespaces?.eip155?.chains ?? []),
                  ...(pendingProposal.params.optionalNamespaces?.eip155?.chains ?? []),
                ].map((c) => (
                  <span
                    key={c}
                    className="text-[10px] bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded"
                  >
                    {formatChainId(c)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApproveProposal}
              disabled={processing}
              className="flex-1 bg-green-500 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg text-sm"
            >
              {processing ? "..." : "Approve"}
            </button>
            <button
              onClick={handleRejectProposal}
              disabled={processing}
              className="flex-1 bg-red-500 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg text-sm"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Session request */}
      {pendingRequest && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <p className="text-sm font-bold mb-2">
            {describeRequest(pendingRequest.params.request.method)}
          </p>
          <div className="mb-3 space-y-1">
            <p className="text-xs text-gray-500">
              Chain: {formatChainId(pendingRequest.params.chainId)}
            </p>
            <p className="text-xs text-gray-500">
              Method: <code className="text-xs">{pendingRequest.params.request.method}</code>
            </p>
            <div className="mt-2 bg-white dark:bg-m-blue-dark-2 rounded p-2 max-h-32 overflow-y-auto">
              <pre className="text-[10px] font-mono whitespace-pre-wrap break-all text-gray-600 dark:text-gray-300">
                {JSON.stringify(pendingRequest.params.request.params, null, 2)}
              </pre>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApproveRequest}
              disabled={processing}
              className="flex-1 bg-green-500 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg text-sm"
            >
              {processing ? "Signing..." : "Approve"}
            </button>
            <button
              onClick={handleRejectRequest}
              disabled={processing}
              className="flex-1 bg-red-500 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 px-3 rounded-lg text-sm"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Active sessions */}
      <div>
        <h2 className="text-sm font-bold text-gray-600 dark:text-gray-300 mb-3">
          Active Sessions ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <p className="text-xs text-gray-400">No active connections.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.topic}
                className="flex items-center gap-3 p-3 bg-white dark:bg-m-blue-dark-3 rounded-lg shadow-sm"
              >
                {s.peer.metadata.icons?.[0] && (
                  <img
                    src={s.peer.metadata.icons[0]}
                    alt=""
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">
                    {s.peer.metadata.name}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {s.peer.metadata.url}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.values(s.namespaces)
                      .flatMap((ns) => ns.chains ?? [])
                      .map((c) => (
                        <span
                          key={c}
                          className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded"
                        >
                          {formatChainId(c)}
                        </span>
                      ))}
                  </div>
                </div>
                <button
                  onClick={() => disconnect(s.topic)}
                  className="text-xs text-red-500 hover:text-red-700 font-bold flex-shrink-0"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
