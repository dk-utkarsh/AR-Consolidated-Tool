// Port of validators.py — Indian-English amount-in-words parser + sanity checks.

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
// Order matters: larger scales first so "two crore three lakh" works.
const SCALES: Array<[string, number]> = [
  ["crore", 10_000_000],
  ["crores", 10_000_000],
  ["lakh", 100_000],
  ["lakhs", 100_000],
  ["lac", 100_000],
  ["lacs", 100_000],
  ["thousand", 1_000],
  ["hundred", 100],
];
const NOISE = new Set([
  "and", "rupees", "rupee", "rs", "only", "paise", "paisa", "the", "a",
]);

function tokenizeAmount(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t));
}

export function wordsToInt(text: string | null | undefined): number | null {
  if (!text) return null;
  const tokens = tokenizeAmount(text);
  if (tokens.length === 0) return null;
  let total = 0;
  let current = 0;
  let sawNumber = false;
  for (const tok of tokens) {
    if (tok in UNITS) { current += UNITS[tok]; sawNumber = true; continue; }
    if (tok in TENS) { current += TENS[tok]; sawNumber = true; continue; }
    if (tok === "hundred" || tok === "hundreds") {
      current = (current || 1) * 100;
      sawNumber = true;
      continue;
    }
    const scale = SCALES.find(([k]) => k === tok)?.[1];
    if (scale !== undefined) {
      total += (current || 1) * scale;
      current = 0;
      sawNumber = true;
      continue;
    }
    // unknown token = OCR noise, ignore
  }
  return sawNumber ? total + current : null;
}

// ----- regex sanity ---------------------------------------------------------

// Indian MICR: 6-digit cheque no, 9-digit MICR/IFSC, 6-digit acct, 2-digit txn code.
const MICR_RE = /(?<!\d)(\d{6})\D{0,4}(\d{9})\D{0,4}(\d{6})\D{1,4}(\d{2})(?!\d)/;
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isPlausibleChequeNumber(s: unknown): s is string {
  return typeof s === "string" && /^\d{6}$/.test(s);
}

export function isPlausibleDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_ISO_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const today = Date.now();
  const diff = Math.abs(d.getTime() - today) / 86_400_000;
  return diff <= 5 * 365;
}

export function findMicr(text: string): [string, string, string, string] | null {
  const m = MICR_RE.exec(text);
  if (!m) return null;
  return [m[1], m[2], m[3], m[4]];
}

// ----- cross-check ---------------------------------------------------------

export interface CrossCheckResult {
  ok: boolean;
  words_value: number | null;
  figures_value: number | null;
  reason: string;
}

export function crossCheckAmount(
  figures: number | null,
  wordsText: string | null,
  tolerance = 0,
): CrossCheckResult {
  const wordsValue = wordsText ? wordsToInt(wordsText) : null;
  if (figures === null && wordsValue === null) {
    return { ok: false, words_value: null, figures_value: null, reason: "neither figures nor words could be parsed" };
  }
  if (figures === null) {
    return { ok: true, words_value: wordsValue, figures_value: null, reason: "figures unreadable; trusting words" };
  }
  if (wordsValue === null) {
    return { ok: true, words_value: null, figures_value: figures, reason: "words unreadable; trusting figures" };
  }
  if (Math.abs(figures - wordsValue) <= tolerance) {
    return { ok: true, words_value: wordsValue, figures_value: figures, reason: "match" };
  }
  return {
    ok: false,
    words_value: wordsValue,
    figures_value: figures,
    reason: `mismatch: words=${wordsValue} figures=${figures}`,
  };
}
