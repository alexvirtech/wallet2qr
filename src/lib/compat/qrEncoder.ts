import QRCode from "qrcode";

// Render QR to a canvas element — matches text2qrApp settings
export async function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  data: string
): Promise<void> {
  await QRCode.toCanvas(canvas, data, {
    width: canvas.offsetWidth || 400,
    margin: 0,
  });
}

// Generate QR as data URL (for download)
export async function qrToDataUrl(
  data: string,
  width = 400
): Promise<string> {
  return QRCode.toDataURL(data, { width, margin: 0 });
}
