import { Plus, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtEur, queries, sumAmount } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, invoicesIssued] = await Promise.all([
    queries.customers(),
    queries.invoicesIssued(),
  ]);

  // Agreguj per klient
  type Stat = { count: number; total: number; openCount: number; openTotal: number };
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
    <div className="px-8 py-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Partneri
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">Klienti</h1>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white opacity-50 cursor-not-allowed"
          title="Coming soon — zatiaľ pridaj cez chat"
        >
          <Plus className="h-4 w-4" />
          Nový klient
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500">Spolu klientov</div>
            <div className="text-lg font-semibold tabular-nums">
              {customers.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500">
              Celkový obrat (z FV)
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {fmtEur(totalRevenue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-zinc-500">Otvorené pohľadávky</div>
            <div
              className={`text-lg font-semibold tabular-nums ${
                totalOpenAmount > 0 ? "text-amber-600" : ""
              }`}
            >
              {fmtEur(totalOpenAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Users className="h-10 w-10 text-zinc-300 mx-auto mb-3" />
              <div className="text-sm font-medium text-zinc-700">
                Zatiaľ žiadni klienti
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Pridaj prvého cez chat: „Vytvor klienta X s IČ DPH ...&ldquo;
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Názov</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>IČ DPH</TableHead>
                  <TableHead>IČO</TableHead>
                  <TableHead className="text-right">Faktúr</TableHead>
                  <TableHead className="text-right">Obrat</TableHead>
                  <TableHead className="text-right">Otvorené</TableHead>
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
                    <TableRow key={c.instance_id} className="text-sm">
                      <TableCell className="font-medium">
                        {String(d.name ?? "—")}
                      </TableCell>
                      <TableCell className="text-zinc-600 text-xs">
                        {String(d.kind ?? "—")}
                      </TableCell>
                      <TableCell className="text-zinc-600 font-mono text-xs">
                        {String(d.vat_number ?? "—")}
                      </TableCell>
                      <TableCell className="text-zinc-600 font-mono text-xs">
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
                          stat.openTotal > 0 ? "text-amber-600 font-medium" : ""
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
        </CardContent>
      </Card>

      <p className="mt-4 text-xs text-zinc-500">
        Dáta zo schémy{" "}
        <code className="text-zinc-600">
          schemas/item/abstract/organization.json
        </code>
        , filter <code className="text-zinc-600">_doc_type=customer</code>.
      </p>
    </div>
  );
}
