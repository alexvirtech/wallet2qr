import QRCode from "qrcode";

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
  return canvas.toDataURL("image/png");
}
