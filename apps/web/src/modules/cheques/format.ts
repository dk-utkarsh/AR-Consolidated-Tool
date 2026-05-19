export function money(x: number | null | undefined): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "₹0";
  const fmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  return `₹${fmt.format(x)}`;
}

export function moneyCompact(x: number | null | undefined): string {
  if (x === null || x === undefined || x === 0 || Number.isNaN(x)) return "₹0";
  const abs = Math.abs(x);
  if (abs >= 1e7) return `₹${(x / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(x / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(x / 1e3).toFixed(1)}K`;
  return money(x);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
