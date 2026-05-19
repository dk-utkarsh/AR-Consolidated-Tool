// OCR-only orchestrator: image bytes → Mistral OCR → field extraction +
// validation warnings. The Zoho payment lookup is now a separate explicit
// step the user triggers via the "Lookup in Zoho Books" button.

import { ocrCheque, extractFields, type ExtractedFields } from "./mistral";
import { isPlausibleChequeNumber, isPlausibleDate } from "./validators";
import type { LookupResult } from "./zoho-payments";

export interface ChequeLookupResult {
  image: string;
  fields: ExtractedFields;
  warnings: string[];
  matches: LookupResult["matches"];        // always [] from this endpoint now
  rejected: LookupResult["rejected"];       // always []
  total_candidates: number;                 // always 0
  error?: string;
}

export async function lookupCheque(originalBuf: Buffer, filename: string): Promise<ChequeLookupResult> {
  const base: ChequeLookupResult = {
    image: filename,
    fields: { cheque_number: null, vendor_name: null, amount: null, amount_in_words: null, date: null },
    warnings: [],
    matches: [],
    rejected: [],
    total_candidates: 0,
  };

  let ocrText: string;
  try {
    ocrText = await ocrCheque(originalBuf);
  } catch (e) {
    return { ...base, error: `OCR failed: ${(e as Error).message}` };
  }

  let fields: ExtractedFields;
  try {
    fields = await extractFields(ocrText);
  } catch (e) {
    return { ...base, error: `field extraction failed: ${(e as Error).message}` };
  }
  base.fields = fields;

  // Post-extraction warnings — only surface ones the user can act on.
  if (fields.cheque_number && !isPlausibleChequeNumber(fields.cheque_number)) {
    base.warnings.push(`cheque_number "${fields.cheque_number}" is not 6 digits`);
  }
  if (fields.date && !isPlausibleDate(fields.date)) {
    base.warnings.push(`cheque_date "${fields.date}" is implausible (outside ±5y)`);
  }

  return base;
}
