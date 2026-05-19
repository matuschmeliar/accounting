import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { PageHeader, Status } from "@/components/page-header";
import { fmtEur, fmtDate } from "@/lib/queries";
import {
  computeVatReports,
  monthlyPeriod,
  SK_MONTH_FULL,
  type DpDphSections,
  type KvLine,
  type SuhrnnyReport,
  type VatReports,
} from "@/lib/vat";
import { PeriodSelector } from "./period-selector";
import { DownloadButton } from "./download-button";

export const dynamic = "force-dynamic";

type SearchParams = { year?: string; month?: string };

export default async function VatPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const now = new Date();
  // Default = predchádzajúci mesiac (lebo DP DPH sa podáva za predchádzajúce obdobie)
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultYear =
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const year = parseInt(sp.year ?? `${defaultYear}`) || defaultYear;
  const month = parseInt(sp.month ?? `${defaultMonth}`) || defaultMonth;

  const period = monthlyPeriod(year, month);
  const report = await computeVatReports(period);

  const dueDate = computeDueDate(period.end);

  return (
    <div>
      <PageHeader
        eyebrow="Dane & reporty"
        title="DPH výkazy"
        description={`Priznanie DPH, Kontrolný výkaz a Súhrnný výkaz za zvolené zdaňovacie obdobie. Sadzby 2026: 23 / 19 / 5 / 0 %. Lehota podania: 25. ${fmtDate(
          dueDate
        )} cez portál FS SR.`}
        crumbs={[{ label: "Dane & reporty" }, { label: "DPH" }]}
        actions={<PeriodSelector year={year} month={month} />}
      />

      <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
        <PeriodSummary report={report} dueDate={dueDate} />

        {report.warnings.length > 0 && <WarningsPanel warnings={report.warnings} />}

        <DpDphCard sections={report.dpDph} report={report} />

        <KvDphCard report={report} />

        <SuhrnnyCard suhrnny={report.suhrnny} />
      </div>
    </div>
  );
}

/* ============ Period summary card (verdict + actions) ============ */

function PeriodSummary({
  report,
  dueDate,
}: {
  report: VatReports;
  dueDate: string;
}) {
  const balance = report.dpDph.section_VI.balance;
  const isLiability = balance > 0;
  const isRefund = balance < 0;
  const isZero = balance === 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="p-5">
          <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            Obdobie
          </div>
          <div className="mt-1 font-serif text-[20px] font-medium">
            {report.period.label}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {fmtDate(report.period.start)} – {fmtDate(report.period.end)} ·{" "}
            {report.counts.issued} FV · {report.counts.received} FP
          </div>
        </div>
        <div className="p-5">
          <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            Vysporiadanie
          </div>
          <div
            className={`mt-1 font-serif text-[22px] font-medium tabular-nums ${
              isLiability
                ? "text-amber-700"
                : isRefund
                ? "text-emerald-700"
                : "text-foreground"
            }`}
          >
            {fmtEur(Math.abs(balance))}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {isLiability && "Vlastná daňová povinnosť — zaplatiť"}
            {isRefund && "Nadmerný odpočet — žiadosť o vrátenie"}
            {isZero && "Nulové vysporiadanie"}
          </div>
        </div>
        <div className="p-5">
          <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            Lehota podania
          </div>
          <div className="mt-1 font-serif text-[20px] font-medium">
            {fmtDate(dueDate)}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            DPHv25 · cez portál FS SR (elektronicky)
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-muted/40">
        <div className="px-5 pt-3 pb-2 flex items-start justify-between gap-3">
          <div className="text-[11px] text-muted-foreground leading-relaxed flex-1 min-w-0">
            <strong className="text-foreground">XML pre FS SR podateľňu:</strong>{" "}
            štruktúrne zodpovedá DPHv25 / KVDPHv25 / SVDPHv25, ale pred prvým
            podaním overuj voči aktuálnemu XSD FS SR — schémy sa občas menia.
            JSON je raw data export.
          </div>
        </div>
        <div className="px-5 pb-3 flex flex-wrap items-center justify-end gap-2">
          <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground mr-2 self-center">
            DP DPH:
          </div>
          <DownloadButton
            report={report}
            part="dp-dph"
            format="xml"
            label="XML"
          />
          <DownloadButton
            report={report}
            part="dp-dph"
            format="json"
            label="JSON"
          />
          <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground mx-2 self-center">
            KV DPH:
          </div>
          <DownloadButton
            report={report}
            part="kv-dph"
            format="xml"
            label="XML"
          />
          <DownloadButton
            report={report}
            part="kv-dph"
            format="json"
            label="JSON"
          />
          <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground mx-2 self-center">
            Súhrnný:
          </div>
          <DownloadButton
            report={report}
            part="suhrnny"
            format="xml"
            label="XML"
          />
          <DownloadButton
            report={report}
            part="suhrnny"
            format="json"
            label="JSON"
          />
        </div>
      </div>
    </div>
  );
}

/* ============ Warnings ============ */

function WarningsPanel({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-medium text-amber-900">
            {warnings.length}{" "}
            {warnings.length === 1 ? "upozornenie" : "upozornení"} — výpočet
            môže byť neúplný
          </h3>
          <ul className="mt-2 space-y-0.5 text-[12px] text-amber-800">
            {warnings.slice(0, 10).map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
            {warnings.length > 10 && (
              <li className="italic">… a {warnings.length - 10} ďalších</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ============ DP DPH (Priznanie) card ============ */

function DpDphCard({
  sections,
  report,
}: {
  sections: DpDphSections;
  report: VatReports;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="px-5 py-4 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-[18px] font-medium">
              1 · Priznanie k DPH
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Tlačivo DPHv25 · § 78 zákona 222/2004 Z. z. ·{" "}
              {report.ownCompany.vat_number ?? "—"}
            </p>
          </div>
          <Status
            kind={
              sections.section_VI.balance > 0
                ? "warning"
                : sections.section_VI.balance < 0
                ? "ok"
                : "neutral"
            }
            label={
              sections.section_VI.balance > 0
                ? `Daň ${fmtEur(sections.section_VI.balance)}`
                : sections.section_VI.balance < 0
                ? `Vrátenie ${fmtEur(-sections.section_VI.balance)}`
                : "Nula"
            }
          />
        </div>
      </header>

      <div className="divide-y divide-border/60">
        <SectionBlock title="Oddiel I — Tuzemské zdaniteľné plnenia (vystavené)">
          <DpRow
            label="Riadok 01-02 · Sadzba 23 %"
            base={sections.section_I.rate23.base}
            vat={sections.section_I.rate23.vat}
            count={sections.section_I.rate23.count}
          />
          <DpRow
            label="Riadok 03-04 · Sadzba 19 %"
            base={sections.section_I.rate19.base}
            vat={sections.section_I.rate19.vat}
            count={sections.section_I.rate19.count}
          />
          <DpRow
            label="Riadok 05-06 · Sadzba 5 %"
            base={sections.section_I.rate5.base}
            vat={sections.section_I.rate5.vat}
            count={sections.section_I.rate5.count}
          />
          <DpRow
            label="Riadok 09 · Tuzemský RC (vystaviteľ, bez DPH § 69 ods. 12)"
            base={sections.section_I.domestic_rc_supplier.base}
            count={sections.section_I.domestic_rc_supplier.count}
          />
        </SectionBlock>

        <SectionBlock title="Oddiel II — IC nadobudnutie tovaru (§ 11)">
          <DpRow
            label="IC nadobudnutia (vstup + výstup)"
            base={sections.section_II.ic_acquisitions.base}
            vat={sections.section_II.ic_acquisitions.vat}
            count={sections.section_II.ic_acquisitions.count}
          />
        </SectionBlock>

        <SectionBlock title="Oddiel III — Dovoz a iné samozdanenie">
          <DpRow
            label="Tuzemský RC ako príjemca (§ 69 ods. 12)"
            base={sections.section_III.domestic_rc_recipient.base}
            vat={sections.section_III.domestic_rc_recipient.vat}
            count={sections.section_III.domestic_rc_recipient.count}
          />
          <DpRow
            label="Cezhraničné EÚ služby B2B (§ 15) — samozdanenie"
            base={sections.section_III.ic_services.base}
            vat={sections.section_III.ic_services.vat}
            count={sections.section_III.ic_services.count}
          />
          <DpRow
            label="Služby z 3. krajiny (§ 69 ods. 2) — samozdanenie"
            base={sections.section_III.third_country_services.base}
            vat={sections.section_III.third_country_services.vat}
            count={sections.section_III.third_country_services.count}
          />
          <DpRow
            label="Dovoz tovaru"
            base={sections.section_III.import.base}
            vat={sections.section_III.import.vat}
            count={sections.section_III.import.count}
          />
        </SectionBlock>

        <SectionBlock title="Oddiel IV — Oslobodené plnenia">
          <DpRow
            label="IC dodanie tovaru (§ 43)"
            base={sections.section_IV.ic_supply.base}
            count={sections.section_IV.ic_supply.count}
          />
          <DpRow
            label="Vývoz tovaru (§ 47)"
            base={sections.section_IV.export.base}
            count={sections.section_IV.export.count}
          />
          <DpRow
            label="Iné oslobodenia"
            base={sections.section_IV.exempt.base}
            count={sections.section_IV.exempt.count}
          />
        </SectionBlock>

        <SectionBlock title="Oddiel V — Odpočet dane">
          <DpRow
            label="Riadok 19-20 · Odpočet 23 %"
            base={sections.section_V.input_rate23.base}
            vat={sections.section_V.input_rate23.vat}
            count={sections.section_V.input_rate23.count}
          />
          <DpRow
            label="Riadok 21-22 · Odpočet 19 %"
            base={sections.section_V.input_rate19.base}
            vat={sections.section_V.input_rate19.vat}
            count={sections.section_V.input_rate19.count}
          />
          <DpRow
            label="Riadok 23-24 · Odpočet 5 %"
            base={sections.section_V.input_rate5.base}
            vat={sections.section_V.input_rate5.vat}
            count={sections.section_V.input_rate5.count}
          />
          <DpRow
            label="Odpočet z tuzemského RC ako príjemca"
            base={sections.section_V.input_rc.base}
            vat={sections.section_V.input_rc.vat}
            count={sections.section_V.input_rc.count}
          />
          <DpRow
            label="Odpočet z IC nadobudnutia tovaru"
            base={sections.section_V.input_ic.base}
            vat={sections.section_V.input_ic.vat}
            count={sections.section_V.input_ic.count}
          />
          <DpRow
            label="Odpočet z cezhraničných EÚ služieb"
            base={sections.section_V.input_ic_services.base}
            vat={sections.section_V.input_ic_services.vat}
            count={sections.section_V.input_ic_services.count}
          />
          <DpRow
            label="Odpočet zo služieb z 3. krajiny"
            base={sections.section_V.input_third_country.base}
            vat={sections.section_V.input_third_country.vat}
            count={sections.section_V.input_third_country.count}
          />
        </SectionBlock>

        <SectionBlock title="Oddiel VI — Vysporiadanie" emphasis>
          <DpTotalRow
            label="Výstupná DPH spolu"
            value={sections.section_VI.output_vat_total}
          />
          <DpTotalRow
            label="Vstupná DPH spolu (odpočet)"
            value={sections.section_VI.input_vat_total}
            negative
          />
          <DpTotalRow
            label={
              sections.section_VI.balance >= 0
                ? "Vlastná daňová povinnosť"
                : "Nadmerný odpočet"
            }
            value={Math.abs(sections.section_VI.balance)}
            isResult
            warning={sections.section_VI.balance > 0}
            success={sections.section_VI.balance < 0}
          />
        </SectionBlock>
      </div>
    </section>
  );
}

function SectionBlock({
  title,
  children,
  emphasis,
}: {
  title: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={emphasis ? "bg-muted/20" : ""}>
      <div className="px-5 pt-4 pb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </div>
      <div className="px-5 pb-3">{children}</div>
    </div>
  );
}

function DpRow({
  label,
  base,
  vat,
  count,
}: {
  label: string;
  base: number;
  vat?: number;
  count: number;
}) {
  const empty = base === 0 && (!vat || vat === 0);
  return (
    <div
      className={`flex items-center justify-between py-1.5 text-[13px] ${
        empty ? "text-muted-foreground/60" : "text-foreground/90"
      }`}
    >
      <div className="flex items-center gap-2 flex-1">
        <span>{label}</span>
        {count > 0 && (
          <span className="text-[10px] text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
      </div>
      <div className="flex items-center gap-6 tabular-nums">
        <div className="w-28 text-right">{fmtEur(base)}</div>
        <div className="w-28 text-right">
          {vat == null ? <span className="text-muted-foreground/40">—</span> : fmtEur(vat)}
        </div>
      </div>
    </div>
  );
}

function DpTotalRow({
  label,
  value,
  negative,
  isResult,
  warning,
  success,
}: {
  label: string;
  value: number;
  negative?: boolean;
  isResult?: boolean;
  warning?: boolean;
  success?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${
        isResult
          ? "border-t border-border/60 mt-1 pt-3 text-[14px] font-medium"
          : "text-[13px]"
      }`}
    >
      <span>{label}</span>
      <span
        className={`tabular-nums font-serif text-[16px] ${
          warning ? "text-amber-700" : success ? "text-emerald-700" : ""
        }`}
      >
        {negative ? "−" : ""}
        {fmtEur(value)}
      </span>
    </div>
  );
}

/* ============ KV DPH card ============ */

function KvDphCard({ report }: { report: VatReports }) {
  const kv = report.kvDph;

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="px-5 py-4 border-b border-border/60">
        <h2 className="font-serif text-[18px] font-medium">
          2 · Kontrolný výkaz DPH
        </h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          § 78a zákona 222/2004 Z. z. · XML formát pre FS SR
        </p>
      </header>

      <div className="divide-y divide-border/60">
        <KvSection
          code="A.1"
          title="Vystavené FV tuzemským platcom (s DPH 5 / 19 / 23 %)"
          lines={kv.A1}
        />
        <KvSection
          code="A.2"
          title="Vystavené FV pri tuzemskom RC (§ 69 ods. 12, bez DPH)"
          lines={kv.A2}
          hideVat
        />
        <KvSection
          code="B.1"
          title="Prijaté FP — samozdanenie (IC nadobudnutie, dovoz, RC ako príjemca)"
          lines={kv.B1}
        />
        <KvSection
          code="B.2"
          title="Prijaté tuzemské FP s odpočtom dane"
          lines={kv.B2}
          showB2Extras
        />
        <KvSection
          code="C.1"
          title="Opravné FV (dobropisy / ťarchopisy) k A.1 a A.2"
          lines={kv.C1}
        />
        <KvSection
          code="C.2"
          title="Opravné FP k B.1 a B.2"
          lines={kv.C2}
        />

        <div className="px-5 py-3 text-[12px] text-muted-foreground">
          <div className="flex items-start gap-2">
            <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              <strong className="text-foreground">B.3 (eKasa sumár):</strong>{" "}
              {kv.B3.count} · <strong>D.1 (eKasa obrat):</strong>{" "}
              {kv.D1.count} · <strong>D.2 (iné tržby bez ERP):</strong>{" "}
              {kv.D2.count}
              <div className="mt-0.5 italic">
                eKasa integrácia coming soon — zatiaľ sumáre = 0.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function KvSection({
  code,
  title,
  lines,
  hideVat,
  showB2Extras,
}: {
  code: string;
  title: string;
  lines: KvLine[];
  hideVat?: boolean;
  showB2Extras?: boolean;
}) {
  const totalBase = lines.reduce((s, l) => s + l.base, 0);
  const totalVat = lines.reduce((s, l) => s + l.vat, 0);

  return (
    <div className="px-5 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-medium bg-muted/60 px-1.5 py-0.5 rounded">
            {code}
          </span>
          <span className="text-[13px] font-medium">{title}</span>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums">
          {lines.length} {lines.length === 1 ? "záznam" : "záznamov"} ·{" "}
          {fmtEur(totalBase)} základ
          {!hideVat && ` · ${fmtEur(totalVat)} DPH`}
        </div>
      </div>
      {lines.length === 0 ? (
        <div className="text-[12px] text-muted-foreground/60 italic py-1">
          Žiadne záznamy.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground text-left border-b border-border/60">
                <th className="py-1.5 pr-3">IČ DPH partnera</th>
                <th className="py-1.5 pr-3">Číslo FA</th>
                <th className="py-1.5 pr-3">DVDP</th>
                {!hideVat && <th className="py-1.5 pr-3">Sadzba</th>}
                {showB2Extras && <th className="py-1.5 pr-3">Kód</th>}
                <th className="py-1.5 pr-3 text-right">Základ</th>
                {!hideVat && (
                  <th className="py-1.5 pr-3 text-right">DPH</th>
                )}
                {showB2Extras && (
                  <th className="py-1.5 pr-3 text-right">Koef.</th>
                )}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1.5 pr-3 font-mono text-[11px]">
                    {l.partner_vat_number || (
                      <span className="text-red-600">CHÝBA</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 font-medium">
                    {l.invoice_number}
                    {l.corrects_invoice_number && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">
                        ← {l.corrects_invoice_number}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {fmtDate(l.dvdp)}
                  </td>
                  {!hideVat && (
                    <td className="py-1.5 pr-3 text-muted-foreground">
                      {l.rate}%
                    </td>
                  )}
                  {showB2Extras && (
                    <td className="py-1.5 pr-3 text-muted-foreground font-mono text-[10px]">
                      {l.item_code ?? "21"}
                    </td>
                  )}
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {fmtEur(l.base)}
                  </td>
                  {!hideVat && (
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {fmtEur(l.vat)}
                    </td>
                  )}
                  {showB2Extras && (
                    <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                      {(l.ratio_coef ?? 1).toFixed(2)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============ Súhrnný výkaz card ============ */

function SuhrnnyCard({ suhrnny }: { suhrnny: SuhrnnyReport }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="px-5 py-4 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-[18px] font-medium">
              3 · Súhrnný výkaz
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              § 80 zákona 222/2004 Z. z. · IC dodania, B2B služby, trojstranný
              obchod
            </p>
          </div>
          {suhrnny.required ? (
            <Status
              kind="warning"
              label={`Podáva sa ${
                suhrnny.frequency === "monthly" ? "mesačne" : "štvrťročne"
              }`}
            />
          ) : (
            <Status kind="ok" label="Nepodáva sa" />
          )}
        </div>
      </header>

      <div className="p-5">
        {!suhrnny.required ? (
          <div className="flex items-start gap-2.5 text-[13px] text-foreground/80">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p>Súhrnný výkaz za toto obdobie sa nepodáva.</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {suhrnny.required_reason}.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <MiniStat
                label="IC dodanie tovaru"
                value={fmtEur(suhrnny.totals.ic_supply_goods)}
              />
              <MiniStat
                label="IC služby B2B"
                value={fmtEur(suhrnny.totals.ic_supply_services)}
              />
              <MiniStat
                label="Trojstranný obchod"
                value={fmtEur(suhrnny.totals.triangular)}
              />
              <MiniStat
                label="Call-off stock"
                value={fmtEur(suhrnny.totals.call_off)}
              />
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground text-left border-b border-border/60">
                  <th className="py-1.5 pr-3">IČ DPH partnera</th>
                  <th className="py-1.5 pr-3">Krajina</th>
                  <th className="py-1.5 pr-3">Typ</th>
                  <th className="py-1.5 pr-3 text-right">Počet</th>
                  <th className="py-1.5 pr-3 text-right">Suma</th>
                </tr>
              </thead>
              <tbody>
                {suhrnny.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="py-1.5 pr-3 font-mono text-[11px]">
                      {l.partner_vat_number}
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-[11px]">
                      {l.partner_country}
                    </td>
                    <td className="py-1.5 pr-3">{l.kind_label}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {l.count}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {fmtEur(l.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-serif text-[16px] tabular-nums">{value}</div>
    </div>
  );
}

/* ============ Helpers ============ */

function computeDueDate(periodEnd: string): string {
  // § 78 ods. 2: do 25 dní po skončení zdaňovacieho obdobia
  const end = new Date(periodEnd + "T00:00:00Z");
  // 25. deň nasledujúceho mesiaca
  const due = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 25)
  );
  return due.toISOString().slice(0, 10);
}
