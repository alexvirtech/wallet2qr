"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { decodeQrFromImage, extractPayloadFromQrData } from "@/lib/compat/qrDecoder";

interface QrScannerProps {
  onDecoded: (payload: string) => void;
  onError: (error: string) => void;
}

export default function QrScanner({ onDecoded, onError }: QrScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<{ destroy: () => void } | null>(null);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const img = new Image();
      img.onload = () => {
        const qrData = decodeQrFromImage(img);
        if (qrData) {
          const payload = extractPayloadFromQrData(qrData);
          onDecoded(payload);
        } else {
          onError("No QR code found in the image.");
        }
      };
      img.onerror = () => onError("Failed to load the image.");
      img.src = URL.createObjectURL(file);
    },
    [onDecoded, onError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;

      const img = new Image();
      img.onload = () => {
        const qrData = decodeQrFromImage(img);
        if (qrData) {
          onDecoded(extractPayloadFromQrData(qrData));
        } else {
          onError("No QR code found in the image.");
        }
      };
      img.onerror = () => onError("Failed to load the image.");
      img.src = URL.createObjectURL(file);
    },
    [onDecoded, onError]
  );

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setScanning(true);

    try {
      const QrScanner = (await import("qr-scanner")).default;
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const payload = extractPayloadFromQrData(result.data);
          onDecoded(payload);
          scanner.destroy();
          setScanning(false);
        },
        { highlightScanRegion: true }
      );
      scannerRef.current = scanner;
      await scanner.start();
    } catch {
      onError("Camera access denied or unavailable.");
      setScanning(false);
    }
  }, [onDecoded, onError]);

  const stopCamera = useCallback(() => {
    scannerRef.current?.destroy();
    scannerRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      scannerRef.current?.destroy();
    };
  }, []);

  return (
    <div className="space-y-4">
      {!scanning && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="border-dashed border-2 border-gray-400 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
        >
          <p className="text-gray-500 dark:text-gray-400">
            Drag and drop a QR code image here, or click to select a file
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      )}

      <div className="flex justify-center gap-2">
        {!scanning ? (
          <button
            type="button"
            onClick={startCamera}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-md text-sm"
          >
            Scan with Camera
          </button>
        ) : (
          <button
            type="button"
            onClick={stopCamera}
            className="bg-m-red hover:bg-red-700 text-white font-bold py-1.5 px-4 rounded-md text-sm"
          >
            Stop Camera
          </button>
        )}
      </div>

      <video
        ref={videoRef}
        className={`w-full max-w-md mx-auto rounded-lg ${scanning ? "" : "hidden"}`}
      />
    </div>
  );
}
