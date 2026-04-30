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

// Decode a QR code from an image element, return the raw QR string.
// Tries multiple strategies to handle old QR codes that have a logo overlay.
export function decodeQrFromImage(image: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  if (w === 0 || h === 0) return null;

  // Attempt 1: original size
  canvas.width = w;
  canvas.height = h;
  context.drawImage(image, 0, 0, w, h);
  let imageData = context.getImageData(0, 0, w, h);
  let qr = jsQR(imageData.data, w, h);
  if (qr?.data) return qr.data;

  // Attempt 2: upscale 2x (helps with small or low-res images)
  const sw = w * 2;
  const sh = h * 2;
  canvas.width = sw;
  canvas.height = sh;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, sw, sh);
  imageData = context.getImageData(0, 0, sw, sh);
  qr = jsQR(imageData.data, sw, sh);
  if (qr?.data) return qr.data;

  // Attempt 3: white out center logo area then decode at original size
  canvas.width = w;
  canvas.height = h;
  context.imageSmoothingEnabled = true;
  context.drawImage(image, 0, 0, w, h);
  const logoSize = Math.min(w, h) * 0.28;
  context.fillStyle = "#ffffff";
  context.fillRect((w - logoSize) / 2, (h - logoSize) / 2, logoSize, logoSize);
  imageData = context.getImageData(0, 0, w, h);
  qr = jsQR(imageData.data, w, h);
  if (qr?.data) return qr.data;

  // Attempt 4: binarize (convert to pure black/white) to reduce noise
  canvas.width = w;
  canvas.height = h;
  context.drawImage(image, 0, 0, w, h);
  imageData = context.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = lum < 128 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  context.putImageData(imageData, 0, 0);
  qr = jsQR(d, w, h);
  if (qr?.data) return qr.data;

  return null;
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
