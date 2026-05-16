import { Plus, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { fmtEur, queries, sumAmount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, invoicesIssued] = await Promise.all([
    queries.customers(),
    queries.invoicesIssued(),
  ]);

  type Stat = {
    count: number;
    total: number;
    openCount: number;
    openTotal: number;
  };
  const byCustomer = new Map<string, Stat>();
  for (const inv of invoicesIssued) {
    const cid = String(inv.data._customer_id ?? "");
    if (!cid) continue;
    const cur = byCustomer.get(cid) ?? {
      count: 0,
      total: 0,
      openCount: 0,
      openTotal: 0,
    };
    cur.count += 1;
    cur.total += Number(inv.data.amount ?? 0);
    if ((inv.data.payment_status as string) !== "completed") {
      cur.openCount += 1;
      cur.openTotal += Number(inv.data.amount ?? 0);
    }
    byCustomer.set(cid, cur);
  }

  const totalRevenue = sumAmount(invoicesIssued);
  const totalOpenAmount = sumAmount(
    invoicesIssued.filter(
      (i) => (i.data.payment_status as string) !== "completed"
    )
  );

  const sorted = [...customers].sort((a, b) => {
    const an = String(a.data.name ?? "").toLocaleLowerCase("sk");
    const bn = String(b.data.name ?? "").toLocaleLowerCase("sk");
    return an.localeCompare(bn, "sk");
  });

  return (
    <div>
      <PageHeader
        eyebrow="Partneri"
        title="Klienti"
        description="Odberatelia firmy s históriou faktúr a otvorenými saldami. Schéma organization.json, filter _doc_type=customer."
        crumbs={[{ label: "Partneri" }, { label: "Klienti" }]}
        actions={
          <button
            type="button"
            disabled
            title="Coming soon — pridaj cez chat"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background opacity-50 cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            Nový klient
          </button>
        }
      />

      <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SummaryStat label="Spolu klientov" value={`${customers.length}`} />
          <SummaryStat label="Celkový obrat" value={fmtEur(totalRevenue)} />
          <SummaryStat
            label="Otvorené pohľadávky"
            value={fmtEur(totalOpenAmount)}
            warn={totalOpenAmount > 0}
          />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {sorted.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <div className="font-serif text-[17px] font-medium">
                Zatiaľ žiadni klienti
              </div>
              <div className="mt-1.5 text-[12px] text-muted-foreground">
                Pridaj prvého cez chat: „Vytvor klienta X s IČ DPH ...&ldquo;
                (⌘K)
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Názov
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    Typ
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    IČ DPH
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    IČO
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground text-right">
                    Faktúr
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground text-right">
                    Obrat
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground text-right">
                    Otvorené
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => {
                  const d = c.data as Record<string, unknown>;
                  const stat = byCustomer.get(c.instance_id) ?? {
                    count: 0,
                    total: 0,
                    openCount: 0,
                    openTotal: 0,
                  };
                  return (
                    <TableRow
                      key={c.instance_id}
                      className="text-[13px] hover:bg-muted/40"
                    >
                      <TableCell className="font-medium">
                        {String(d.name ?? "—")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[12px]">
                        {String(d.kind ?? "—")}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-[12px]">
                        {String(d.vat_number ?? "—")}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-[12px]">
                        {String(d.registration_number ?? "—")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stat.count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtEur(stat.total)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          stat.openTotal > 0 ? "text-amber-700 font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {stat.openTotal > 0 ? fmtEur(stat.openTotal) : "—"}
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
            schemas/item/abstract/organization.json
          </code>{" "}
          · filter{" "}
          <code className="font-mono text-muted-foreground not-italic">
            _doc_type=customer
          </code>
          .
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
