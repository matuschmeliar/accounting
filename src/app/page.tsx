import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  TrendingDown,
  TrendingUp,
  Wallet,
  Users,
  AlertTriangle,
  FileDown,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  fmtDate,
  fmtEur,
  fmtRelative,
  getDashboardKpis,
  queries,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const SK_MONTH = [
  "január",
  "február",
  "marec",
  "apríl",
  "máj",
  "jún",
  "júl",
  "august",
  "september",
  "október",
  "november",
  "december",
];

export default async function DashboardPage() {
  const now = new Date();
  const periodLabel = `${SK_MONTH[now.getMonth()]} ${now.getFullYear()}`;

  const [kpis, issued] = await Promise.all([
    getDashboardKpis(),
    queries.invoicesIssued(),
  ]);

  const recent = [...issued]
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, 6);

  return (
    <div className="px-8 py-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Obdobie
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {periodLabel}
          </h1>
        </div>
        <div className="text-xs text-zinc-500 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Dáta z JARVIS Datamap · live
        </div>
      </header>

      {/* Top row KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <KpiCard
          label="Príjmy MTD"
          value={fmtEur(kpis.revenueMTD)}
          icon={TrendingUp}
          sublabel={`${kpis.invoicesIssuedCountMTD} vystavených FV`}
          tone="positive"
        />
        <KpiCard
          label="Náklady MTD"
          value={fmtEur(kpis.expensesMTD)}
          icon={TrendingDown}
          sublabel={`${kpis.invoicesReceivedCountMTD} prijatých FP`}
          tone="neutral"
        />
        <KpiCard
          label="Zisk MTD"
          value={fmtEur(kpis.profitMTD)}
          icon={CircleDollarSign}
          sublabel="Príjmy − náklady"
          tone={kpis.profitMTD >= 0 ? "positive" : "negative"}
        />
      </div>

      {/* Bottom row KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <KpiCard
          label="Otvorené pohľadávky"
          value={fmtEur(kpis.unpaidAmount)}
          icon={Wallet}
          sublabel={`${kpis.unpaidCount} neuhradené FV`}
          tone="neutral"
        />
        <KpiCard
          label="Po splatnosti"
          value={fmtEur(kpis.overdueAmount)}
          icon={AlertTriangle}
          sublabel={`${kpis.overdueCount} faktúr meškajú`}
          tone={kpis.overdueCount > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          label="Partneri"
          value={`${kpis.customersCount + kpis.suppliersCount}`}
          icon={Users}
          sublabel={`${kpis.customersCount} klientov · ${kpis.suppliersCount} dodávateľov`}
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Nedávna aktivita
              </h2>
              <Link
                href="/invoices/issued"
                className="text-xs text-zinc-500 hover:text-zinc-900"
              >
                Všetky faktúry →
              </Link>
            </div>
            {recent.length === 0 ? (
              <EmptyState
                title="Žiadne faktúry zatiaľ"
                body="Vytvor prvú faktúru cez chat alebo cez tlačidlo nižšie."
              />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {recent.map((i) => {
                  const d = i.data as Record<string, unknown>;
                  const number = String(d._invoice_number ?? d.name ?? "—");
                  const amount = Number(d.amount ?? 0);
                  const status = String(d.payment_status ?? "pending");
                  return (
                    <li
                      key={i.instance_id}
                      className="flex items-center gap-3 py-2.5 text-sm"
                    >
                      <FileDown className="h-4 w-4 text-zinc-400" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-zinc-900 truncate">
                          {number}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {fmtDate(String(d.date ?? ""))} ·{" "}
                          {fmtRelative(i.created_at)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-zinc-900">
                          {fmtEur(amount)}
                        </div>
                        <StatusBadge status={status} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Alerts / quick actions */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-zinc-900 mb-3">
              Treba vyriešiť
            </h2>
            <ul className="space-y-2 text-sm">
              {kpis.overdueCount > 0 && (
                <li className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-amber-900">
                      {kpis.overdueCount} faktúr po splatnosti
                    </div>
                    <div className="text-xs text-amber-700">
                      Spolu {fmtEur(kpis.overdueAmount)}
                    </div>
                  </div>
                </li>
              )}
              {kpis.unpaidCount === 0 && kpis.overdueCount === 0 && (
                <li className="text-zinc-500 text-xs">
                  Žiadne otvorené veci. ✨
                </li>
              )}
            </ul>

            <Separator className="my-4" />

            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
              Rýchle akcie
            </h3>
            <div className="space-y-1.5 text-sm">
              <QuickAction href="/invoices/issued" label="Faktúry vystavené" />
              <QuickAction href="/customers" label="Klienti" />
              <QuickAction
                href="#"
                label="Vystaviť novú faktúru (cez chat)"
                hint="⌘K"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: typeof TrendingUp;
  tone?: "positive" | "negative" | "warning" | "neutral";
}) {
  const toneClass = {
    positive: "text-emerald-600",
    negative: "text-red-600",
    warning: "text-amber-600",
    neutral: "text-zinc-500",
  }[tone];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
          <span>{label}</span>
          <Icon className={`h-4 w-4 ${toneClass}`} />
        </div>
        <div className="text-2xl font-semibold text-zinc-900 tabular-nums">
          {value}
        </div>
        <div className="mt-1 text-xs text-zinc-500">{sublabel}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    completed: { label: "Uhradená", cls: "text-emerald-600" },
    pending: { label: "Čaká", cls: "text-zinc-500" },
    cancelled: { label: "Storno", cls: "text-zinc-400" },
    refunded: { label: "Refund", cls: "text-zinc-500" },
  }[status] ?? { label: status, cls: "text-zinc-500" };
  return <div className={`text-[10px] ${cfg.cls}`}>{cfg.label}</div>;
}

function QuickAction({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint?: string;
}) {
  const isLink = href !== "#";
  const inner = (
    <>
      <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400" />
      <span className="flex-1">{label}</span>
      {hint && (
        <kbd className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded font-mono">
          {hint}
        </kbd>
      )}
    </>
  );
  const cls =
    "flex items-center gap-2 rounded-md px-2 py-1.5 text-zinc-700 hover:bg-zinc-50";
  return isLink ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls + " cursor-default"}>{inner}</div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 px-3 py-6 text-center">
      <div className="text-sm font-medium text-zinc-700">{title}</div>
      <div className="mt-1 text-xs text-zinc-500">{body}</div>
    </div>
  );
}
