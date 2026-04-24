"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  decodeQrFromImage,
  decodeQrFromImageData,
  extractPayloadFromQrData,
} from "@/lib/compat/qrDecoder";

interface QrScannerProps {
  onDecoded: (payload: string) => void;
  onError: (error: string) => void;
}

export default function QrScanner({ onDecoded, onError }: QrScannerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [scanning, setScanning] = useState(false);

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
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

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
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
          if (qrData) {
            const payload = extractPayloadFromQrData(qrData);
            stopCamera();
            onDecoded(payload);
            return;
          }
        }
        rafRef.current = requestAnimationFrame(scan);
      };
      rafRef.current = requestAnimationFrame(scan);
    } catch {
      onError("Camera access denied or unavailable.");
      setScanning(false);
    }
  }, [onDecoded, onError, stopCamera]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
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
        autoPlay
        playsInline
        muted
        style={{ width: "100%", maxWidth: 480 }}
        className={`mx-auto rounded-lg ${scanning ? "block" : "hidden"}`}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
