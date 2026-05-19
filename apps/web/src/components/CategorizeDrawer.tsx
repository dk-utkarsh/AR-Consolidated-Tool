import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  categorizeUncategorized,
  fetchCustomerInvoices,
  fetchCustomersList,
  fetchLocationsList,
  type CustomerSummary,
  type LocationSummary,
  type OpenInvoice,
  type BankTransaction,
} from "@/lib/api";
import { formatINR } from "@/lib/utils";

interface Props {
  open: boolean;
  bankTxn: BankTransaction | null;
  onClose: () => void;
  onMatched: () => void;
}

export function CategorizeDrawer({ open, bankTxn, onClose, onMatched }: Props) {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);

  const [invoices, setInvoices] = useState<OpenInvoice[] | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [applied, setApplied] = useState<Record<string, string>>({});

  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [locationId, setLocationId] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"payment" | "advance">("payment");

  useEffect(() => {
    if (!open) return;
    setCustomers([]);
    setCustomerSearch("");
    setSelectedCustomer(null);
    setInvoices(null);
    setApplied({});
    setLocationId("");
    setError(null);
    setMode("payment");
    fetchLocationsList().then(setLocations).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      fetchCustomersList(customerSearch).then(setCustomers).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch, open]);

  useEffect(() => {
    if (!selectedCustomer) {
      setInvoices(null);
      return;
    }
    setLoadingInvoices(true);
    setApplied({});
    fetchCustomerInvoices(selectedCustomer.contact_id)
      .then((rows) => setInvoices(rows))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoadingInvoices(false));
  }, [selectedCustomer]);

  const depositAmount = Number(bankTxn?.amount ?? 0) || 0;
  const totalApplied = useMemo(
    () =>
      Object.values(applied).reduce(
        (s, v) => s + (Number(v) || 0),
        0,
      ),
    [applied],
  );
  const remaining = depositAmount - totalApplied;
  const isExact = Math.abs(remaining) < 0.01;

  const onAutoFill = (inv: OpenInvoice) => {
    const remainingNow = depositAmount - totalApplied + (Number(applied[inv.invoice_id]) || 0);
    const target = Math.min(remainingNow, inv.balance);
    setApplied((prev) => ({ ...prev, [inv.invoice_id]: target > 0 ? String(target) : "" }));
  };

  const onSubmit = async () => {
    if (!bankTxn || !selectedCustomer) return;
    setError(null);
    setSubmitting(true);
    try {
      let invoicesPayload: Array<{ invoice_id: string; amount_applied: number }> = [];
      if (mode === "payment") {
        invoicesPayload = Object.entries(applied)
          .map(([invoice_id, v]) => ({ invoice_id, amount_applied: Number(v) || 0 }))
          .filter((x) => x.amount_applied > 0);
        if (invoicesPayload.length === 0) throw new Error("Apply an amount to at least one invoice");
        if (!isExact) throw new Error("Applied amounts must equal the deposit amount");
      }
      await categorizeUncategorized(String(bankTxn.transaction_id), {
        customer_id: selectedCustomer.contact_id,
        amount: depositAmount,
        date: String(bankTxn.date ?? ""),
        reference_number: bankTxn.reference_number ?? undefined,
        description: bankTxn.description ?? undefined,
        location_id: locationId || undefined,
        invoices: invoicesPayload,
        mode,
      });
      onMatched();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !bankTxn) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-slate-900/40"
        onClick={onClose}
        aria-label="Close drawer overlay"
      />
      <div className="flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-semibold">
              Categorize as {mode === "payment" ? "Customer Payment" : "Customer Advance"}
            </h2>
            <div className="mt-1 text-xs text-slate-500">
              Deposit ₹{formatINR(depositAmount)} on {bankTxn.date} · Ref{" "}
              {bankTxn.reference_number ?? "—"}
            </div>
            <div className="mt-1 text-xs text-slate-400">{bankTxn.description ?? ""}</div>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Category</label>
            <select
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as "payment" | "advance")}
            >
              <option value="payment">Customer Payment (apply to invoices)</option>
              <option value="advance">Customer Advance (sits as credit, no invoice)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Customer</label>
            <Input
              placeholder="Search by name…"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            {!selectedCustomer && customers.length > 0 && (
              <div className="mt-1 max-h-60 overflow-auto rounded-md border border-slate-200">
                {customers.map((c) => (
                  <button
                    type="button"
                    key={c.contact_id}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() => setSelectedCustomer(c)}
                  >
                    <div className="font-medium">{c.contact_name}</div>
                    {typeof c.outstanding_receivable_amount === "number" && (
                      <div className="text-xs text-slate-500">
                        Outstanding: {formatINR(c.outstanding_receivable_amount)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div className="mt-2 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">{selectedCustomer.contact_name}</div>
                  {typeof selectedCustomer.outstanding_receivable_amount === "number" && (
                    <div className="text-xs text-slate-500">
                      Outstanding: {formatINR(selectedCustomer.outstanding_receivable_amount)}
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setSelectedCustomer(null)}>
                  Change
                </Button>
              </div>
            )}
          </div>

          {selectedCustomer && mode === "payment" && (
            <div>
              <label className="text-xs font-medium text-slate-600">Open Invoices</label>
              {loadingInvoices && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              )}
              {invoices && invoices.length === 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  No open invoices for this customer.
                </div>
              )}
              {invoices && invoices.length > 0 && (
                <div className="overflow-auto rounded-md border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Invoice#</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                        <th className="px-3 py-2 text-right">Apply (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.invoice_id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium">{inv.invoice_number}</td>
                          <td className="px-3 py-2">{inv.date}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatINR(inv.balance)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                className="w-28 text-right"
                                value={applied[inv.invoice_id] ?? ""}
                                onChange={(e) =>
                                  setApplied((prev) => ({
                                    ...prev,
                                    [inv.invoice_id]: e.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="text-xs text-blue-600 hover:underline"
                                onClick={() => onAutoFill(inv)}
                              >
                                fill
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {locations.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-600">Location (optional)</label>
              <select
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">— Select —</option>
                {locations.map((l) => (
                  <option key={l.location_id} value={l.location_id}>
                    {l.location_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex justify-between">
              <span>Deposit amount</span>
              <span className="tabular-nums">{formatINR(depositAmount)}</span>
            </div>
            {mode === "payment" ? (
              <>
                <div className="flex justify-between">
                  <span>Applied</span>
                  <span className="tabular-nums">{formatINR(totalApplied)}</span>
                </div>
                <div
                  className={`flex justify-between font-semibold ${
                    isExact ? "text-green-700" : "text-amber-700"
                  }`}
                >
                  <span>Remaining</span>
                  <span className="tabular-nums">{formatINR(remaining)}</span>
                </div>
              </>
            ) : (
              <div className="mt-1 text-xs text-slate-600">
                Will be saved as an <strong>unapplied customer advance</strong> — the full deposit
                amount becomes available as credit on the customer's account.
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submitting || !selectedCustomer || (mode === "payment" && !isExact)}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "payment" ? "Confirm Match" : "Save as Advance"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
