import type { Row } from "./helpers";

/** A simple column-ordered table — our stand-in for a pandas DataFrame. */
export interface Frame {
  columns: string[];
  rows: Row[];
}

export const EMPTY: Frame = { columns: [], rows: [] };

export function isEmpty(f: Frame | null | undefined): boolean {
  return !f || f.rows.length === 0;
}
