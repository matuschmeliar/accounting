"use client";

import { Download, FileCode2 } from "lucide-react";
import type { VatReports } from "@/lib/vat";
import {
  filenameFor,
  generateDpDphXml,
  generateKvDphXml,
  generateSuhrnnyXml,
} from "@/lib/vat-xml";

type Props = {
  report: VatReports;
  part: "dp-dph" | "kv-dph" | "suhrnny";
  format: "json" | "xml";
  label: string;
};

export function DownloadButton({ report, part, format, label }: Props) {
  function onClick() {
    let content: string;
    let mimeType: string;

    if (format === "xml") {
      if (part === "dp-dph") content = generateDpDphXml(report);
      else if (part === "kv-dph") content = generateKvDphXml(report);
      else content = generateSuhrnnyXml(report);
      mimeType = "application/xml";
    } else {
      let payload: unknown;
      if (part === "dp-dph") {
        payload = {
          type: "DP_DPH_DPHv25",
          period: report.period,
          own_company: report.ownCompany,
          sections: report.dpDph,
        };
      } else if (part === "kv-dph") {
        payload = {
          type: "KV_DPH",
          period: report.period,
          own_company: report.ownCompany,
          parts: report.kvDph,
        };
      } else {
        payload = {
          type: "SUHRNNY_VYKAZ",
          period: report.period,
          own_company: report.ownCompany,
          suhrnny: report.suhrnny,
        };
      }
      content = JSON.stringify(payload, null, 2);
      mimeType = "application/json";
    }

    const fileName = filenameFor(part, report, format);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const Icon = format === "xml" ? FileCode2 : Download;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted/60 transition-colors"
      title={label}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}
