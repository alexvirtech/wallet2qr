import jsQR from "jsqr";
import QrScanner from "qr-scanner";

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

// Enhanced decode from raw ImageData — tries center whiteout and binarization
// for old QR codes with embedded logos. More expensive than single-pass.
export function decodeQrFromImageDataEnhanced(
  data: Uint8ClampedArray,
  width: number,
  height: number
): string | null {
  // Attempt 1: direct
  let qr = jsQR(data, width, height);
  if (qr?.data) return qr.data;

  // Attempt 2: white out center logo area (28% of smallest dimension)
  const copy = new Uint8ClampedArray(data);
  const logoSize = Math.min(width, height) * 0.28;
  const lx = Math.floor((width - logoSize) / 2);
  const ly = Math.floor((height - logoSize) / 2);
  const lw = Math.ceil(logoSize);
  const lh = Math.ceil(logoSize);
  for (let y = ly; y < ly + lh && y < height; y++) {
    for (let x = lx; x < lx + lw && x < width; x++) {
      const i = (y * width + x) * 4;
      copy[i] = copy[i + 1] = copy[i + 2] = 255;
    }
  }
  qr = jsQR(copy, width, height);
  if (qr?.data) return qr.data;

  // Attempt 3: binarize to reduce noise
  const bin = new Uint8ClampedArray(data);
  for (let i = 0; i < bin.length; i += 4) {
    const lum = bin[i] * 0.299 + bin[i + 1] * 0.587 + bin[i + 2] * 0.114;
    const v = lum < 128 ? 0 : 255;
    bin[i] = bin[i + 1] = bin[i + 2] = v;
  }
  qr = jsQR(bin, width, height);
  if (qr?.data) return qr.data;

  return null;
}

// Fallback decoder using qr-scanner (handles perspective, rotation, real-world photos).
// Used when jsQR-based decoding fails — e.g. photos of physical QR cards.
export async function decodeQrFromImageAsync(
  source: HTMLImageElement | HTMLCanvasElement | File
): Promise<string | null> {
  try {
    const result = await QrScanner.scanImage(source, {
      returnDetailedScanResult: true,
      alsoTryWithoutScanRegion: true,
    });
    return result?.data || null;
  } catch {
    return null;
  }
}
