import {
  ArrowUpRight,
  CircleDollarSign,
  TrendingDown,
  TrendingUp,
  Wallet,
  Users,
  AlertTriangle,
  FileDown,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, Status } from "@/components/page-header";
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
    <div>
      <PageHeader
        eyebrow={`Obdobie · ${periodLabel}`}
        title="Dashboard"
        description="Prehľad výnosov, nákladov, otvorených pohľadávok a aktivity tvojej firmy. Dáta sa naťahujú priamo z JARVIS Datamap."
        crumbs={[{ label: "Prehľad" }]}
        actions={
          <button
            type="button"
            disabled
            title="Coming soon"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-[12px] font-medium text-background opacity-50 cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            Nová faktúra
          </button>
        }
      />

      <div className="px-6 py-6 max-w-6xl mx-auto space-y-6">
        {/* Top row KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Príjmy MTD"
            value={fmtEur(kpis.revenueMTD)}
            icon={TrendingUp}
            sublabel={`${kpis.invoicesIssuedCountMTD} vystavených FV`}
          />
          <KpiCard
            label="Náklady MTD"
            value={fmtEur(kpis.expensesMTD)}
            icon={TrendingDown}
            sublabel={`${kpis.invoicesReceivedCountMTD} prijatých FP`}
          />
          <KpiCard
            label="Zisk MTD"
            value={fmtEur(kpis.profitMTD)}
            icon={CircleDollarSign}
            sublabel="Príjmy − náklady"
            highlight={kpis.profitMTD >= 0}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Otvorené pohľadávky"
            value={fmtEur(kpis.unpaidAmount)}
            icon={Wallet}
            sublabel={`${kpis.unpaidCount} neuhradené FV`}
          />
          <KpiCard
            label="Po splatnosti"
            value={fmtEur(kpis.overdueAmount)}
            icon={AlertTriangle}
            sublabel={`${kpis.overdueCount} faktúr meškajú`}
            warning={kpis.overdueCount > 0}
          />
          <KpiCard
            label="Partneri"
            value={`${kpis.customersCount + kpis.suppliersCount}`}
            icon={Users}
            sublabel={`${kpis.customersCount} klientov · ${kpis.suppliersCount} dodávateľov`}
          />
        </div>

        {/* Two-column section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <div>
                <h2 className="font-serif text-[17px] font-medium">
                  Nedávna aktivita
                </h2>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Posledných {recent.length} vystavených faktúr
                </p>
              </div>
              <Link
                href="/invoices/issued"
                className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Všetky →
              </Link>
            </div>
            {recent.length === 0 ? (
              <EmptyState
                title="Žiadne faktúry zatiaľ"
                body="Vytvor prvú cez chat: „Vystav FV za X klientovi Y&ldquo;."
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {recent.map((i) => {
                  const d = i.data as Record<string, unknown>;
                  const number = String(d._invoice_number ?? d.name ?? "—");
                  const amount = Number(d.amount ?? 0);
                  const status = String(d.payment_status ?? "pending");
                  return (
                    <li
                      key={i.instance_id}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="h-8 w-8 shrink-0 rounded-md bg-muted/60 flex items-center justify-center">
                        <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">
                          {number}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {fmtDate(String(d.date ?? ""))} ·{" "}
                          {fmtRelative(i.created_at)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-medium tabular-nums">
                          {fmtEur(amount)}
                        </div>
                        <PaymentStatus status={status} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="px-5 py-4 border-b border-border/60">
              <h2 className="font-serif text-[17px] font-medium">
                Treba vyriešiť
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Otvorené úlohy a alerty
              </p>
            </div>
            <div className="p-4 space-y-2">
              {kpis.overdueCount > 0 && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-amber-900">
                      {kpis.overdueCount}{" "}
                      {kpis.overdueCount === 1 ? "faktúra" : "faktúr"} po
                      splatnosti
                    </div>
                    <div className="text-[11px] text-amber-700 mt-0.5">
                      Spolu {fmtEur(kpis.overdueAmount)}
                    </div>
                    <Link
                      href="/invoices/issued"
                      className="mt-2 inline-flex text-[11px] font-medium text-amber-900 underline decoration-amber-300 underline-offset-2 hover:decoration-amber-500"
                    >
                      Pozrieť →
                    </Link>
                  </div>
                </div>
              )}
              {kpis.overdueCount === 0 && (
                <div className="text-[12px] text-muted-foreground py-2 text-center">
                  Nič nečaká na vyriešenie. ✨
                </div>
              )}

              <div className="mt-4 space-y-0.5">
                <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-1.5 px-1">
                  Rýchle akcie
                </div>
                <QuickAction href="/invoices/issued" label="Faktúry vystavené" />
                <QuickAction href="/customers" label="Klienti" />
                <QuickAction
                  label="Vystaviť faktúru (cez chat)"
                  hint="⌘K"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  warning,
  highlight,
}: {
  label: string;
  value: string;
  sublabel: string;
  icon: typeof TrendingUp;
  warning?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2 uppercase tracking-[0.06em]">
        <span>{label}</span>
        <Icon
          className={`h-3.5 w-3.5 ${
            warning
              ? "text-amber-600"
              : highlight
              ? "text-emerald-600"
              : "text-muted-foreground/60"
          }`}
        />
      </div>
      <div
        className={`font-serif text-[28px] font-medium tabular-nums leading-none ${
          warning ? "text-amber-700" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground">
        {sublabel}
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

function QuickAction({
  href,
  label,
  hint,
}: {
  href?: string;
  label: string;
  hint?: string;
}) {
  const cls =
    "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-foreground/80 hover:bg-muted/60 transition-colors";
  const inner = (
    <>
      <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      {hint && (
        <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
          {hint}
        </kbd>
      )}
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls + " cursor-default"}>{inner}</div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="font-serif text-[16px] font-medium">{title}</div>
      <div className="mt-1 text-[12px] text-muted-foreground">{body}</div>
    </div>
  );
}
