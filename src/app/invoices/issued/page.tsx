import { FileDown, Plus } from "lucide-react";
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

export default async function InvoicesIssuedPage() {
  const invoices = await queries.invoicesIssued();
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
        title="Faktúry vystavené"
        description="Tabuľka vystavených faktúr (FV) z JARVIS Datamap. Filter podľa _doc_type=invoice_issued nad schémou transaction.json."
        crumbs={[{ label: "Doklady" }, { label: "Faktúry vystavené" }]}
        actions={
          <button
            type="button"
            disabled
            title="Coming soon — zatiaľ vystav cez chat (⌘K)"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background opacity-50 cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            Nová FV
          </button>
        }
      />

      <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryStat label="Spolu faktúr" value={`${invoices.length}`} />
          <SummaryStat label="Celkový obrat" value={fmtEur(totalAll)} />
          <SummaryStat
            label="Neuhradené"
            value={`${unpaid.length} · ${fmtEur(totalUnpaid)}`}
            warn={unpaid.length > 0}
          />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sorted.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <FileDown className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <div className="font-serif text-[17px] font-medium">
                Zatiaľ žiadne vystavené faktúry
              </div>
              <div className="mt-1.5 text-[12px] text-muted-foreground">
                Vytvor prvú cez chat: „Vystav FV za X € klientovi Y&ldquo; (⌘K)
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Číslo
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Dátum
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Splatnosť
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Klient
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
                  return (
                    <TableRow
                      key={inv.instance_id}
                      className="text-[13px] hover:bg-muted/40"
                    >
                      <TableCell className="font-medium">
                        {String(d._invoice_number ?? d.name ?? "—")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(String(d.date ?? ""))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmtDate(String(d.due_date ?? ""))}
                      </TableCell>
                      <TableCell className="text-foreground/80 truncate max-w-[200px]">
                        {String(d._customer_name ?? "—")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtEur(Number(d._total_excl_vat ?? 0))}
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
            _doc_type=invoice_issued
          </code>
          . Detail faktúry a editácia coming soon.
        </p>
      </div>
    </div>
  );
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
  const map: Record<string, { kind: Parameters<typeof Status>[0]["kind"]; label: string }> = {
    completed: { kind: "ok", label: "Uhradená" },
    pending: { kind: "neutral", label: "Čaká" },
    cancelled: { kind: "neutral", label: "Storno" },
    refunded: { kind: "neutral", label: "Refund" },
  };
  const cfg = map[status] ?? { kind: "neutral" as const, label: status };
  return <Status kind={cfg.kind} label={cfg.label} />;
}
