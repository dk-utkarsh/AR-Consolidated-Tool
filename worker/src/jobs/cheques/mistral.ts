// Mistral OCR + chat-extract calls. Mirrors cheque_lookup.py:_ocr_b64 +
// _extract_fields, including the multi-pass strategy (rotation retries +
// targeted MICR-strip pass).

import { config } from "../../lib/config";
import {
  extractMicrStrip,
  prepareFull,
  toDataUrl,
  type PreparedImage,
} from "./preprocessing";
import { findMicr } from "./validators";

const OCR_URL = "https://api.mistral.ai/v1/ocr";
const CHAT_URL = "https://api.mistral.ai/v1/chat/completions";
const OCR_MODEL = process.env.MISTRAL_OCR_MODEL ?? "mistral-ocr-latest";
const EXTRACT_MODEL = process.env.MISTRAL_EXTRACT_MODEL ?? "mistral-large-latest";

const EXTRACT_PROMPT = `You are extracting structured fields from the OCR transcription of an Indian bank cheque. The OCR text may include multiple passes — a full image read, plus rotated retries and a focused MICR-strip pass marked [MICR-strip]. Use whichever pass gives the clearest signal for each field; the MICR-strip pass is usually the most reliable source for cheque_number.

Return STRICT JSON with EXACTLY these five keys, and nothing else:
- cheque_number: the 6-digit cheque number from the MICR line at the bottom of the cheque (the FIRST group of 6 digits in the MICR strip, before the 9-digit MICR/IFSC code). Preserve any leading zeros — output as a string. If unreadable, null.
- vendor_name: the DRAWER / ACCOUNT-HOLDER name — the customer who issued and signed the cheque. On Indian cheques this is pre-printed in the BOTTOM-RIGHT area, directly above (or beside) the signature line, and is the name on the bank account being debited. It is NOT the payee from the 'Pay' line at the top — the payee is whoever is receiving the money (us), while the vendor/drawer is the customer paying us. Often in ALL CAPS and prefixed 'For ' or suffixed with company suffixes like 'PVT LTD', 'LIMITED', 'LLP', 'PROPRIETOR', etc. Trim whitespace and drop any leading 'For ' prefix. If unreadable, null.
- amount: the cheque amount as an INTEGER number of rupees (no commas, no currency symbol, no decimals). The cheque has the amount written TWICE — in figures next to the rupee symbol AND in words on the 'Rupees' line. ALWAYS compute the integer from the amount-in-WORDS and use that as the source of truth, because OCR frequently misreads the figure box. Example: if the words say 'One Lakh Forty One Thousand Six Hundred Sixty Seven Rupees', return 141667 — even if the figure box reads '1416571' or similar. If the words are unreadable, fall back to the figures. If both are unreadable, null.
- amount_in_words: the raw amount-in-words string as written on the 'Rupees' line, normalised to lowercase ASCII (e.g. 'one lakh forty one thousand six hundred sixty seven only'). Used for downstream cross-validation against the figure box. If unreadable, null.
- date: the date written in the DD MM YYYY boxes at the top, in ISO format YYYY-MM-DD. Example: 15032026 becomes '2026-03-15'. If unreadable, null.

Reply with the JSON object only — no commentary, no markdown fences.`;

interface OcrResponse {
  pages?: Array<{ markdown?: string }>;
}

function apiKey(): string {
  const k = config.mistralApiKey;
  if (!k) throw new Error("MISTRAL_API_KEY is not set");
  return k;
}

async function ocrOne(img: PreparedImage): Promise<string> {
  const body = {
    model: OCR_MODEL,
    document: { type: "image_url", image_url: toDataUrl(img) },
    include_image_base64: false,
  };
  let delay = 2_000;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(OCR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 200) {
      const data = (await res.json()) as OcrResponse;
      return (data.pages ?? []).map((p) => p.markdown ?? "").join("\n\n");
    }
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 30_000);
      continue;
    }
    const text = await res.text();
    throw new Error(`Mistral OCR HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  throw new Error("Mistral OCR rate-limited after retries");
}

/**
 * Multi-pass OCR. Tries the upright preprocessed image, retries at other
 * rotations if MICR isn't detected, then always runs a targeted MICR-strip
 * pass. Concatenates all output so the LLM extractor can pick the best
 * reading for each field.
 */
export async function ocrCheque(originalBuf: Buffer): Promise<string> {
  let text = await ocrOne(await prepareFull(originalBuf, 0));
  if (!findMicr(text)) {
    // Decide rotation order from aspect ratio (portrait → try side-rotations first).
    const meta = await import("sharp").then((s) => s.default(originalBuf).metadata());
    const portrait = (meta.height ?? 0) > (meta.width ?? 0);
    const order = portrait ? [90, 270, 180] : [180, 90, 270];
    for (const rot of order) {
      const more = await ocrOne(await prepareFull(originalBuf, rot));
      text = `${text}\n\n${more}`;
      if (findMicr(more)) break;
    }
  }
  // Targeted MICR-strip pass, always. Biggest accuracy win for cheque numbers.
  try {
    const strip = await ocrOne(await extractMicrStrip(originalBuf));
    text = `${text}\n\n[MICR-strip]\n${strip}`;
  } catch {
    // Strip OCR failure shouldn't fail the whole call.
  }
  return text;
}

export interface ExtractedFields {
  cheque_number: string | null;
  vendor_name: string | null;
  amount: number | null;
  amount_in_words: string | null;
  date: string | null;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function extractFields(ocrText: string): Promise<ExtractedFields> {
  const body = {
    model: EXTRACT_MODEL,
    messages: [
      { role: "system", content: EXTRACT_PROMPT },
      { role: "user", content: ocrText },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  };
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mistral chat HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = (await res.json()) as ChatResponse;
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as {
    cheque_number?: string | number | null;
    vendor_name?: string | null;
    amount?: string | number | null;
    amount_in_words?: string | null;
    date?: string | null;
  };

  // Defensive coercion (same as the Python version).
  let chequeNo: string | null = null;
  if (typeof parsed.cheque_number === "string") chequeNo = parsed.cheque_number;
  else if (typeof parsed.cheque_number === "number") chequeNo = String(parsed.cheque_number).padStart(6, "0");

  let amount: number | null = null;
  if (typeof parsed.amount === "number" && Number.isFinite(parsed.amount)) amount = parsed.amount;
  else if (typeof parsed.amount === "string") {
    const cleaned = parsed.amount.replace(/[,₹\s]/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n) && n !== 0) amount = n;
  }

  return {
    cheque_number: chequeNo,
    vendor_name: typeof parsed.vendor_name === "string" ? parsed.vendor_name : null,
    amount,
    amount_in_words: typeof parsed.amount_in_words === "string" ? parsed.amount_in_words : null,
    date: typeof parsed.date === "string" ? parsed.date : null,
  };
}
