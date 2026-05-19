// Light cheque image preprocessing via sharp. Replaces preprocessing.py for
// the "vision" preset only. The OpenCV-based crop-to-cheque + Hough deskew
// from the original are skipped — Mistral OCR handles imperfect framing well
// enough that the accuracy hit is small, and adding OpenCV breaks the Render
// build (native deps).

import sharp from "sharp";

const MAX_DIM = 3500;
const MIN_DIM = 1800;

async function autoOrient(input: Buffer): Promise<{ buf: Buffer; width: number; height: number }> {
  // .rotate() with no args applies EXIF auto-orientation.
  const out = await sharp(input).rotate().toBuffer({ resolveWithObject: true });
  return { buf: out.data, width: out.info.width, height: out.info.height };
}

async function forceLandscape(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  if ((meta.height ?? 0) > (meta.width ?? 0)) {
    return sharp(input).rotate(-90).toBuffer();
  }
  return input;
}

async function resizeForOcr(input: Buffer): Promise<Buffer> {
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const longSide = Math.max(w, h);
  if (longSide === 0) return input;
  let scale = 1;
  if (longSide > MAX_DIM) scale = MAX_DIM / longSide;
  else if (longSide < MIN_DIM) scale = MIN_DIM / longSide;
  if (scale === 1) return input;
  return sharp(input)
    .resize({
      width: Math.round(w * scale),
      height: Math.round(h * scale),
      fit: "fill",
      kernel: "lanczos3",
    })
    .toBuffer();
}

export interface PreparedImage {
  buf: Buffer;        // JPEG bytes
  mime: "image/jpeg";
  width: number;
  height: number;
}

async function toJpeg(input: Buffer): Promise<PreparedImage> {
  // Quality 95 + no chroma subsampling — same setting as the Python code.
  // The MICR strip is the most fragile region; chroma subsampling smears digits.
  const out = await sharp(input)
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer({ resolveWithObject: true });
  return { buf: out.data, mime: "image/jpeg", width: out.info.width, height: out.info.height };
}

/** Apply EXIF orient + landscape + resize. rotateDeg is applied on top. */
export async function prepareFull(input: Buffer, rotateDeg = 0): Promise<PreparedImage> {
  const oriented = await autoOrient(input);
  let buf = await forceLandscape(oriented.buf);
  if (rotateDeg) {
    buf = await sharp(buf).rotate(rotateDeg).toBuffer();
  }
  buf = await resizeForOcr(buf);
  return toJpeg(buf);
}

/** Bottom ~18% — where the MICR line sits. The targeted MICR-strip OCR pass
 * is the biggest accuracy win for cheque numbers. */
export async function extractMicrStrip(input: Buffer, frac = 0.18): Promise<PreparedImage> {
  const prepared = await prepareFull(input);
  const top = Math.round(prepared.height * (1 - frac));
  const out = await sharp(prepared.buf)
    .extract({ left: 0, top, width: prepared.width, height: prepared.height - top })
    .toBuffer({ resolveWithObject: true });
  return toJpeg(out.data);
}

/** Middle band — Rupees-in-words + figure box. */
export async function extractAmountBand(input: Buffer): Promise<PreparedImage> {
  const prepared = await prepareFull(input);
  const top = Math.round(prepared.height * 0.35);
  const height = Math.round(prepared.height * (0.65 - 0.35));
  const out = await sharp(prepared.buf)
    .extract({ left: 0, top, width: prepared.width, height })
    .toBuffer({ resolveWithObject: true });
  return toJpeg(out.data);
}

/** Upper band — "Pay" line / payee. */
export async function extractPayeeBand(input: Buffer): Promise<PreparedImage> {
  const prepared = await prepareFull(input);
  const top = Math.round(prepared.height * 0.20);
  const height = Math.round(prepared.height * (0.45 - 0.20));
  const out = await sharp(prepared.buf)
    .extract({ left: 0, top, width: prepared.width, height })
    .toBuffer({ resolveWithObject: true });
  return toJpeg(out.data);
}

export function toDataUrl(img: PreparedImage): string {
  return `data:${img.mime};base64,${img.buf.toString("base64")}`;
}
