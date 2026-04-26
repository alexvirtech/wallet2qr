"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/state/session";
import { useWalletConnect } from "@/components/WalletConnectProvider";
import { formatChainId, describeRequest } from "@/lib/walletconnect";
import { decodeQrFromImage, decodeQrFromImageData } from "@/lib/compat/qrDecoder";

type ConnectMode = "scan" | "paste";

export default function ConnectPage() {
  const { isUnlocked, readOnly } = useSession();
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

  const [mode, setMode] = useState<ConnectMode>("scan");
  const [uri, setUri] = useState("");
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

  useEffect(() => {
    if (!isUnlocked) router.push("/qr-to-wallet");
    else if (readOnly) router.push("/wallet");
  }, [isUnlocked, readOnly, router]);

  const doPair = useCallback(async (wcUri: string) => {
    const trimmed = wcUri.trim();
    if (!trimmed) return;
    setError("");
    setPairing(true);
    try {
      await pair(trimmed);
      setUri("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setPairing(false);
    }
  }, [pair]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      video.setAttribute("autoplay", "");
      video.setAttribute("playsinline", "");

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play().then(() => resolve()).catch(() => resolve());
        };
      });

      setScanning(true);

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;

      const scan = () => {
        if (!streamRef.current) return;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrData = decodeQrFromImageData(
            imageData.data,
            canvas.width,
            canvas.height
          );
          if (qrData && qrData.startsWith("wc:")) {
            stopCamera();
            doPair(qrData);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(scan);
      };
      rafRef.current = requestAnimationFrame(scan);
    } catch {
      setError("Camera access denied or unavailable. Try uploading an image or pasting the URI.");
      setScanning(false);
    }
  }, [doPair, stopCamera]);

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError("");
      const img = new Image();
      img.onload = () => {
        const qrData = decodeQrFromImage(img);
        if (qrData && qrData.startsWith("wc:")) {
          doPair(qrData);
        } else if (qrData) {
          setError("QR code found but it's not a WalletConnect code. Look for the WalletConnect QR in the dApp.");
        } else {
          setError("No QR code found in the image.");
        }
      };
      img.onerror = () => setError("Failed to load the image.");
      img.src = URL.createObjectURL(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [doPair]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;
      setError("");
      const img = new Image();
      img.onload = () => {
        const qrData = decodeQrFromImage(img);
        if (qrData && qrData.startsWith("wc:")) {
          doPair(qrData);
        } else if (qrData) {
          setError("QR code found but it's not a WalletConnect code.");
        } else {
          setError("No QR code found in the image.");
        }
      };
      img.onerror = () => setError("Failed to load the image.");
      img.src = URL.createObjectURL(file);
    },
    [doPair]
  );

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!isUnlocked || readOnly) return null;

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

      {/* Connect to dApp */}
      {!pendingProposal && !pendingRequest && (
        <div className="bg-gray-50 dark:bg-m-blue-dark-3 rounded-lg p-4 mb-6">
          <p className="text-sm font-bold mb-1">Connect to dApp</p>
          <p className="text-xs text-gray-400 mb-3">
            Open a dApp (e.g. Uniswap, OpenSea), click &quot;Connect Wallet&quot; and choose WalletConnect
          </p>

          {/* Mode tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-600 mb-4">
            <button
              onClick={() => { setMode("scan"); setError(""); }}
              className={`py-1.5 px-3 text-xs font-bold border-b-2 transition-colors ${
                mode === "scan"
                  ? "border-blue-500 text-blue-500"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Scan QR Code
            </button>
            <button
              onClick={() => { setMode("paste"); stopCamera(); setError(""); }}
              className={`py-1.5 px-3 text-xs font-bold border-b-2 transition-colors ${
                mode === "paste"
                  ? "border-blue-500 text-blue-500"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Paste URI
            </button>
          </div>

          {mode === "scan" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Scan or upload the QR code shown by the dApp
              </p>

              {/* Camera */}
              {!scanning ? (
                <>
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-dashed border-2 border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                  >
                    <div className="text-3xl mb-2 opacity-40">&#128247;</div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Drop a screenshot here or click to upload
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      Take a screenshot of the dApp&apos;s WalletConnect QR code
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFile}
                      className="hidden"
                    />
                  </div>
                  <div className="flex justify-center">
                    <button
                      onClick={startCamera}
                      disabled={!ready}
                      className="bg-blue-500 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                    >
                      Use Camera
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-center text-gray-500">
                    Point camera at the WalletConnect QR code
                  </p>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-w-sm mx-auto rounded-lg"
                  />
                  <div className="flex justify-center">
                    <button
                      onClick={stopCamera}
                      className="bg-m-red hover:bg-red-700 text-white font-bold py-1.5 px-4 rounded-lg text-sm"
                    >
                      Stop Camera
                    </button>
                  </div>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {mode === "paste" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Some dApps show a &quot;Copy to clipboard&quot; link under the QR code — paste it here
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={uri}
                  onChange={(e) => setUri(e.target.value)}
                  placeholder="wc:..."
                  className="flex-1 bg-white dark:bg-m-blue-dark-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && doPair(uri)}
                />
                <button
                  onClick={() => doPair(uri)}
                  disabled={pairing || !uri.trim() || !ready}
                  className="bg-blue-500 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  {pairing ? "..." : "Connect"}
                </button>
              </div>
            </div>
          )}

          {pairing && (
            <p className="text-blue-500 text-xs mt-3 text-center">Connecting...</p>
          )}
          {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
          {!ready && (
            <p className="text-gray-400 text-xs mt-3">Initializing WalletConnect...</p>
          )}
        </div>
      )}

      {/* Session proposal */}
      {pendingProposal && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm font-bold mb-2">Connection Request</p>
          <div className="mb-3 space-y-1">
            <div className="flex items-center gap-3">
              {pendingProposal.params.proposer.metadata.icons?.[0] && (
                <img
                  src={pendingProposal.params.proposer.metadata.icons[0]}
                  alt=""
                  className="w-10 h-10 rounded-full flex-shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div>
                <p className="text-sm font-bold">
                  {pendingProposal.params.proposer.metadata.name}
                </p>
                <p className="text-xs text-gray-400">
                  {pendingProposal.params.proposer.metadata.url}
                </p>
              </div>
            </div>
            {pendingProposal.params.proposer.metadata.description && (
              <p className="text-xs text-gray-500 mt-2">
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
