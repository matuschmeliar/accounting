import Link from "next/link";
import { FileDown, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
    <div className="px-8 py-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Doklady
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Faktúry vystavené
          </h1>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white opacity-50 cursor-not-allowed"
          title="Coming soon — zatiaľ vystavuj cez chat"
        >
          <Plus className="h-4 w-4" />
          Nová FV
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <SummaryStat label="Spolu faktúr" value={`${invoices.length}`} />
        <SummaryStat label="Celkový obrat" value={fmtEur(totalAll)} />
        <SummaryStat
          label="Neuhradené"
          value={`${unpaid.length} · ${fmtEur(totalUnpaid)}`}
          warn={unpaid.length > 0}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <FileDown className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
              <div className="text-sm font-medium text-zinc-700">
                Zatiaľ žiadne vystavené faktúry
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Vytvor prvú cez chat: „Vystav FV za X € klientovi Y&ldquo;
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Číslo</TableHead>
                  <TableHead>Dátum</TableHead>
                  <TableHead>Splatnosť</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead className="text-right">Bez DPH</TableHead>
                  <TableHead className="text-right">DPH</TableHead>
                  <TableHead className="text-right">Spolu</TableHead>
                  <TableHead>Stav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((inv) => {
                  const d = inv.data as Record<string, unknown>;
                  const status = String(d.payment_status ?? "pending");
                  return (
                    <TableRow
                      key={inv.instance_id}
                      className="text-sm"
                    >
                      <TableCell className="font-medium">
                        {String(d._invoice_number ?? d.name ?? "—")}
                      </TableCell>
                      <TableCell className="text-zinc-600">
                        {fmtDate(String(d.date ?? ""))}
                      </TableCell>
                      <TableCell className="text-zinc-600">
                        {fmtDate(String(d.due_date ?? ""))}
                      </TableCell>
                      <TableCell className="text-zinc-600 truncate max-w-[200px]">
                        {String(d._customer_name ?? "—")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtEur(Number(d._total_excl_vat ?? 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-zinc-500">
                        {fmtEur(Number(d.tax_amount ?? 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {fmtEur(Number(d.amount ?? 0))}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-zinc-500">
        Dáta zo schémy{" "}
        <code className="text-zinc-600">
          schemas/event/real/transaction.json
        </code>
        , filter <code className="text-zinc-600">_doc_type=invoice_issued</code>
        . Detaily a editácia coming soon — zatiaľ použij{" "}
        <Link href="#" className="underline">
          chat (⌘K)
        </Link>
        .
      </p>
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
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-zinc-500">{label}</div>
        <div
          className={`text-lg font-semibold tabular-nums ${
            warn ? "text-amber-600" : "text-zinc-900"
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const cfg = {
    completed: { label: "Uhradená", variant: "default" as const },
    pending: { label: "Čaká", variant: "secondary" as const },
    cancelled: { label: "Storno", variant: "outline" as const },
    refunded: { label: "Refund", variant: "outline" as const },
  }[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
