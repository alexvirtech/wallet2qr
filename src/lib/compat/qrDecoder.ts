import jsQR from "jsqr";

// Extract the encrypted payload (ds param only) from a QR code URL string
export function extractPayloadFromQrData(data: string): string {
  try {
    const u = new URL(data);
    return u.searchParams.get("ds") ?? data.replace(/^https?:\/\/[^/]+\/\?ds=/, "");
  } catch {
    return data.replace(/^https?:\/\/[^/]+\/\?ds=/, "");
  }
}

// Decode a QR code from an image element, return the raw QR string
export function decodeQrFromImage(image: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  canvas.width = image.width;
  canvas.height = image.height;
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const qrCode = jsQR(imageData.data, canvas.width, canvas.height);
  return qrCode?.data ?? null;
}

// Decode from raw ImageData
export function decodeQrFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number
): string | null {
  const qrCode = jsQR(data, width, height);
  return qrCode?.data ?? null;
}
