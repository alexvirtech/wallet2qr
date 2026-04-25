import QRCode from "qrcode";

const LOGO_PATH = "/logo.png";
const LOGO_RATIO = 0.2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  canvasSize: number
) {
  const logoSize = Math.round(canvasSize * LOGO_RATIO);
  const x = Math.round((canvasSize - logoSize) / 2);
  const y = x;
  const pad = 4;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, 6);
  ctx.fill();
  ctx.drawImage(logo, x, y, logoSize, logoSize);
}

export async function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  data: string
): Promise<void> {
  const width = canvas.offsetWidth || 400;
  await QRCode.toCanvas(canvas, data, {
    width,
    margin: 0,
    errorCorrectionLevel: "H",
  });
  try {
    const logo = await loadImage(LOGO_PATH);
    const ctx = canvas.getContext("2d");
    if (ctx) drawLogo(ctx, logo, canvas.width);
  } catch {}
}

export async function qrToDataUrl(
  data: string,
  width = 400
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width;
  await QRCode.toCanvas(canvas, data, {
    width,
    margin: 0,
    errorCorrectionLevel: "H",
  });
  try {
    const logo = await loadImage(LOGO_PATH);
    const ctx = canvas.getContext("2d");
    if (ctx) drawLogo(ctx, logo, width);
  } catch {}
  return canvas.toDataURL("image/png");
}
