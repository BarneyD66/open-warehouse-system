"use client";

export const skuImageInputMaxBytes = 10 * 1024 * 1024;

const skuImageStoredMaxBytes = 900 * 1024;
const skuImageMaxDimension = 1600;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("IMAGE_READ_FAILED")));
    reader.onerror = () => reject(new Error("IMAGE_READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("IMAGE_COMPRESS_FAILED"))), "image/webp", quality);
  });
}

export async function compressSkuImage(file: File) {
  const source = await createImageBitmap(file);
  try {
    const initialScale = Math.min(1, skuImageMaxDimension / Math.max(source.width, source.height));
    let width = Math.max(1, Math.round(source.width * initialScale));
    let height = Math.max(1, Math.round(source.height * initialScale));
    const canvas = document.createElement("canvas");

    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("IMAGE_COMPRESS_FAILED");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(source, 0, 0, width, height);

      const blob = await canvasToBlob(canvas, Math.max(0.48, 0.88 - attempt * 0.06));
      if (blob.size <= skuImageStoredMaxBytes) {
        return { dataUrl: await blobToDataUrl(blob), size: blob.size };
      }

      const reduction = Math.min(0.88, Math.max(0.65, Math.sqrt(skuImageStoredMaxBytes / blob.size) * 0.95));
      width = Math.max(1, Math.round(width * reduction));
      height = Math.max(1, Math.round(height * reduction));
    }
  } finally {
    source.close();
  }

  throw new Error("IMAGE_COMPRESS_FAILED");
}
