"use client";

import { Download } from "lucide-react";
import type { VatReports } from "@/lib/vat";

type Props = {
  report: VatReports;
  part: "dp-dph" | "kv-dph" | "suhrnny";
  label: string;
};

export function DownloadButton({ report, part, label }: Props) {
  function onClick() {
    let payload: unknown;
    let fileName: string;
    const periodSlug = `${report.period.year}-${String(
      report.period.monthOrQuarter
    ).padStart(2, "0")}`;

    if (part === "dp-dph") {
      payload = {
        type: "DP_DPH_DPHv25",
        period: report.period,
        own_company: report.ownCompany,
        sections: report.dpDph,
      };
      fileName = `dp-dph-${periodSlug}.json`;
    } else if (part === "kv-dph") {
      payload = {
        type: "KV_DPH",
        period: report.period,
        own_company: report.ownCompany,
        parts: report.kvDph,
      };
      fileName = `kv-dph-${periodSlug}.json`;
    } else {
      payload = {
        type: "SUHRNNY_VYKAZ",
        period: report.period,
        own_company: report.ownCompany,
        suhrnny: report.suhrnny,
      };
      fileName = `suhrnny-${periodSlug}.json`;
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/60 transition-colors"
      title={label}
    >
      <Download className="h-3 w-3" />
      {label}
    </button>
  );
}
