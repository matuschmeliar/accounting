import { FileText, Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, Status } from "@/components/page-header";
import { fmtDate, fmtEur, queries, sumAmount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function InvoicesReceivedPage() {
  const invoices = await queries.invoicesReceived();
  const sorted = [...invoices].sort((a, b) =>
    (b.data.date as string) > (a.data.date as string) ? 1 : -1
  );

  const totalAll = sumAmount(invoices);
  const unpaid = invoices.filter(
    (i) => (i.data.payment_status as string) !== "completed"
  );
  const totalUnpaid = sumAmount(unpaid);

  return (
    <div>
      <PageHeader
        eyebrow="Doklady"
        title="Faktúry prijaté"
        description="Doklady od dodávateľov za nákupy, služby, energie atď. Filter podľa _doc_type=invoice_received (alebo fallback kind=nákup + functional_type=faktúra)."
        crumbs={[{ label: "Doklady" }, { label: "Faktúry prijaté" }]}
        actions={
          <button
            type="button"
            disabled
            title="Coming soon — zatiaľ nahraj cez chat (⌘K) PDF alebo opíš obsah"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background opacity-50 cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            Nahrať FP
          </button>
        }
      />

      <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryStat label="Spolu faktúr" value={`${invoices.length}`} />
          <SummaryStat label="Celkové náklady" value={fmtEur(totalAll)} />
          <SummaryStat
            label="Neuhradené"
            value={`${unpaid.length} · ${fmtEur(totalUnpaid)}`}
            warn={unpaid.length > 0}
          />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sorted.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <div className="font-serif text-[17px] font-medium">
                Zatiaľ žiadne prijaté faktúry
              </div>
              <div className="mt-1.5 text-[12px] text-muted-foreground">
                Pridaj cez chat: „Zaeviduj faktúru od XY za 1000 €&ldquo; (⌘K)
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Číslo FA
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Dátum
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Splatnosť
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Dodávateľ
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground text-right">
                    Bez DPH
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground text-right">
                    DPH
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground text-right">
                    Spolu
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Stav
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((inv) => {
                  const d = inv.data as Record<string, unknown>;
                  const status = String(d.payment_status ?? "pending");
                  const supplierName =
                    (d._supplier_name as string) ||
                    extractSupplierFromName(String(d.name ?? "")) ||
                    "—";
                  const number = String(
                    d._invoice_number ?? d.reference_number ?? d.alias ?? d.name ?? "—"
                  );
                  return (
                    <TableRow
                      key={inv.instance_id}
                      className="text-[13px] hover:bg-muted/40"
                    >
                      <TableCell className="font-medium">{number}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(String(d.date ?? ""))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(String(d.due_date ?? ""))}
                      </TableCell>
                      <TableCell className="text-foreground/80 truncate max-w-[220px]">
                        {supplierName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtEur(
                          Number(
                            d._total_excl_vat ??
                              Number(d.amount ?? 0) - Number(d.tax_amount ?? 0)
                          )
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {fmtEur(Number(d.tax_amount ?? 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {fmtEur(Number(d.amount ?? 0))}
                      </TableCell>
                      <TableCell>
                        <PaymentStatus status={status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground/80 italic">
          Zdroj:{" "}
          <code className="font-mono text-muted-foreground not-italic">
            schemas/event/real/transaction.json
          </code>{" "}
          · filter{" "}
          <code className="font-mono text-muted-foreground not-italic">
            _doc_type=invoice_received
          </code>{" "}
          (fallback: kind=nákup + functional_type=faktúra).
        </p>
      </div>
    </div>
  );
}

/** Try to extract supplier name from common naming patterns like "FA-2026011 - METINAS s. r. o. -> dpMarketingGroup". */
function extractSupplierFromName(name: string): string | null {
  const arrow = name.indexOf("->");
  if (arrow > 0) {
    // Pattern: "Číslo - Dodávateľ -> Odberateľ"
    const before = name.slice(0, arrow).trim();
    const dash = before.indexOf(" - ");
    if (dash > 0) return before.slice(dash + 3).trim();
  }
  return null;
}

function SummaryStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-serif text-[22px] font-medium tabular-nums ${
          warn ? "text-amber-700" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function PaymentStatus({ status }: { status: string }) {
  const map: Record<
    string,
    { kind: Parameters<typeof Status>[0]["kind"]; label: string }
  > = {
    completed: { kind: "ok", label: "Uhradená" },
    pending: { kind: "neutral", label: "Čaká" },
    cancelled: { kind: "neutral", label: "Storno" },
    refunded: { kind: "neutral", label: "Refund" },
  };
  const cfg = map[status] ?? { kind: "neutral" as const, label: status };
  return <Status kind={cfg.kind} label={cfg.label} />;
}
