"use client";

import { useRef, useEffect, useCallback } from "react";
import { renderQrToCanvas, qrToDataUrl } from "@/lib/compat/qrEncoder";

interface QrCanvasProps {
  data: string;
}

export default function QrCanvas({ data }: QrCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && data) {
      renderQrToCanvas(canvasRef.current, data);
    }
  }, [data]);

  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
    });
  }, []);

  const handleDownload = useCallback(async () => {
    const url = await qrToDataUrl(data, 600);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wallet2qr.png";
    a.click();
  }, [data]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="border border-blue-200 p-4 bg-white rounded-md cursor-pointer" onClick={handleCopy} title="Click to copy">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", maxWidth: 400, height: "auto" }}
        />
      </div>
      <p className="text-xs text-gray-400">Click QR code to copy to clipboard</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDownload}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-md text-sm"
        >
          Download PNG
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-md text-sm"
        >
          Copy Image
        </button>
      </div>
    </div>
  );
}
