/**
 * XML generátory pre slovenské DPH výkazy.
 *
 * Generuje 3 typy XML súborov v štruktúre FS SR (DPHv25, KVDPHv25, SVDPHv25):
 *  - Priznanie k DPH (DP DPH)
 *  - Kontrolný výkaz DPH (KV DPH)
 *  - Súhrnný výkaz (SV)
 *
 * ⚠️ MVP OBMEDZENIE: presné XSD schémy FS SR sa občas menia a vyžadujú špecifické
 * namespace-y a názvy elementov. Tento generator robí "best-effort" XML so štruktúrou
 * a poliami zodpovedajúcimi DPHv25 / KVDPHv25 / SVDPHv25 — všetky dáta sú správne,
 * ale element-mapping voči current XSD treba overiť pred prvým podaním. Pre stabilné
 * produkčné podávanie odporúčam použiť tento výstup ako data source a final XML
 * formatovať cez XSLT/template zo súčasnej XSD.
 *
 * Encoding: UTF-8. FS SR akceptuje aj UTF-8 aj Windows-1250 — UTF-8 je default.
 */

import type {
  DpDphSections,
  KvDphReport,
  KvLine,
  SuhrnnyReport,
  VatReports,
} from "./vat";

function xe(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(n: number): string {
  return n.toFixed(2);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function periodAttrs(report: VatReports): {
  rok: number;
  mesiac?: number;
  obdobie: string;
} {
  return {
    rok: report.period.year,
    mesiac: report.period.monthOrQuarter,
    obdobie:
      report.period.type === "monthly"
        ? pad2(report.period.monthOrQuarter)
        : `Q${report.period.monthOrQuarter}`,
  };
}

function identifikacia(report: VatReports): string {
  return [
    `  <Identifikacia>`,
    `    <IcDph>${xe(report.ownCompany.vat_number ?? "")}</IcDph>`,
    `    <Nazov>${xe(report.ownCompany.name ?? "")}</Nazov>`,
    `  </Identifikacia>`,
  ].join("\n");
}

function disclaimer(report: VatReports): string {
  const ts = new Date().toISOString();
  return [
    `<!-- ============================================================ -->`,
    `<!-- Vygenerované Účtovný AI MVP (JARVIS Datamap) — ${ts}     -->`,
    `<!-- Obdobie: ${report.period.label}                                -->`,
    `<!-- Vystavovateľ: ${report.ownCompany.name ?? "?"} (${report.ownCompany.vat_number ?? "?"})  -->`,
    `<!-- DISCLAIMER: pred prvým podaním validuj XML voči aktuálnemu  -->`,
    `<!-- XSD FS SR. Pri zmene schémy zo strany MF SR generator        -->`,
    `<!-- aktualizuj. Túto verziu beriem ako data source.              -->`,
    `<!-- ============================================================ -->`,
  ].join("\n");
}

/* ============ DP DPH (Priznanie k DPH) ============ */

export function generateDpDphXml(report: VatReports): string {
  const p = periodAttrs(report);
  const s = report.dpDph;

  // Riadky DPHv25 — výber kľúčových; číslovanie podľa štruktúry DPHv25.
  const lines: string[] = [];

  // ----- Oddiel I — Tuzemské zdaniteľné plnenia -----
  lines.push(`  <OddielI>`);
  lines.push(rowXml("01", "Dodanie tovaru a služieb v tuzemsku - sadzba 23%", s.section_I.rate23.base, s.section_I.rate23.vat));
  lines.push(rowXml("03", "Dodanie tovaru a služieb v tuzemsku - sadzba 19%", s.section_I.rate19.base, s.section_I.rate19.vat));
  lines.push(rowXml("05", "Dodanie tovaru a služieb v tuzemsku - sadzba 5%", s.section_I.rate5.base, s.section_I.rate5.vat));
  lines.push(rowXml("09", "Tuzemský RC dodávateľ (bez DPH § 69 ods. 12)", s.section_I.domestic_rc_supplier.base, 0));
  lines.push(`  </OddielI>`);

  // ----- Oddiel II — IC nadobudnutie tovaru -----
  lines.push(`  <OddielII>`);
  lines.push(rowXml("11", "IC nadobudnutie tovaru § 11", s.section_II.ic_acquisitions.base, s.section_II.ic_acquisitions.vat));
  lines.push(`  </OddielII>`);

  // ----- Oddiel III — Dovoz a iné samozdanenie -----
  lines.push(`  <OddielIII>`);
  lines.push(rowXml("13a", "Tuzemský RC ako príjemca § 69 ods. 12", s.section_III.domestic_rc_recipient.base, s.section_III.domestic_rc_recipient.vat));
  lines.push(rowXml("13b", "Cezhraničné EÚ služby B2B § 15 - samozdanenie", s.section_III.ic_services.base, s.section_III.ic_services.vat));
  lines.push(rowXml("13c", "Služby z 3. krajiny § 69 ods. 2 - samozdanenie", s.section_III.third_country_services.base, s.section_III.third_country_services.vat));
  lines.push(rowXml("14", "Dovoz tovaru", s.section_III.import.base, s.section_III.import.vat));
  lines.push(`  </OddielIII>`);

  // ----- Oddiel IV — Oslobodené plnenia -----
  lines.push(`  <OddielIV>`);
  lines.push(rowXml("15", "IC dodanie tovaru § 43", s.section_IV.ic_supply.base, 0));
  lines.push(rowXml("16", "Vývoz tovaru § 47", s.section_IV.export.base, 0));
  lines.push(rowXml("17", "Ostatné oslobodené plnenia", s.section_IV.exempt.base, 0));
  lines.push(`  </OddielIV>`);

  // ----- Oddiel V — Odpočet dane -----
  lines.push(`  <OddielV>`);
  lines.push(rowXml("19", "Odpočet dane - sadzba 23%", s.section_V.input_rate23.base, s.section_V.input_rate23.vat));
  lines.push(rowXml("21", "Odpočet dane - sadzba 19%", s.section_V.input_rate19.base, s.section_V.input_rate19.vat));
  lines.push(rowXml("23", "Odpočet dane - sadzba 5%", s.section_V.input_rate5.base, s.section_V.input_rate5.vat));
  lines.push(rowXml("25", "Odpočet z tuzemského RC ako príjemca", s.section_V.input_rc.base, s.section_V.input_rc.vat));
  lines.push(rowXml("27", "Odpočet z IC nadobudnutia tovaru", s.section_V.input_ic.base, s.section_V.input_ic.vat));
  lines.push(rowXml("28a", "Odpočet z cezhraničných EÚ služieb", s.section_V.input_ic_services.base, s.section_V.input_ic_services.vat));
  lines.push(rowXml("28b", "Odpočet zo služieb z 3. krajiny", s.section_V.input_third_country.base, s.section_V.input_third_country.vat));
  lines.push(`  </OddielV>`);

  // ----- Oddiel VI — Vysporiadanie -----
  lines.push(`  <OddielVI>`);
  lines.push(`    <VystupnaDan>${money(s.section_VI.output_vat_total)}</VystupnaDan>`);
  lines.push(`    <VstupnaDan>${money(s.section_VI.input_vat_total)}</VstupnaDan>`);
  if (s.section_VI.balance > 0) {
    lines.push(`    <VlastnaDanovaPovinnost>${money(s.section_VI.balance)}</VlastnaDanovaPovinnost>`);
    lines.push(`    <NadmernyOdpocet>0.00</NadmernyOdpocet>`);
  } else if (s.section_VI.balance < 0) {
    lines.push(`    <VlastnaDanovaPovinnost>0.00</VlastnaDanovaPovinnost>`);
    lines.push(`    <NadmernyOdpocet>${money(-s.section_VI.balance)}</NadmernyOdpocet>`);
  } else {
    lines.push(`    <VlastnaDanovaPovinnost>0.00</VlastnaDanovaPovinnost>`);
    lines.push(`    <NadmernyOdpocet>0.00</NadmernyOdpocet>`);
  }
  lines.push(`  </OddielVI>`);

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    disclaimer(report),
    `<DphPriznanie verzia="DPHv25" rok="${p.rok}" mesiac="${p.mesiac}">`,
    identifikacia(report),
    `  <Hlavicka>`,
    `    <DruhPriznania>R</DruhPriznania>`,
    `    <ZdanovacieObdobie>${report.period.type === "monthly" ? "M" : "Q"}</ZdanovacieObdobie>`,
    `    <Rok>${p.rok}</Rok>`,
    `    <${report.period.type === "monthly" ? "Mesiac" : "Stvrtrok"}>${p.mesiac}</${report.period.type === "monthly" ? "Mesiac" : "Stvrtrok"}>`,
    `    <DatumVystavenia>${new Date().toISOString().slice(0, 10)}</DatumVystavenia>`,
    `  </Hlavicka>`,
    `  <Telo>`,
    lines.join("\n"),
    `  </Telo>`,
    `</DphPriznanie>`,
  ].join("\n");
}

function rowXml(cislo: string, popis: string, zaklad: number, dan: number): string {
  return `    <Riadok cislo="${cislo}"><Popis>${xe(popis)}</Popis><Zaklad>${money(zaklad)}</Zaklad><Dan>${money(dan)}</Dan></Riadok>`;
}

/* ============ KV DPH (Kontrolný výkaz) ============ */

function kvLineXml(l: KvLine): string {
  const isCorrection = !!l.corrects_invoice_number;
  return [
    `    <Faktura>`,
    `      <IcDphPartnera>${xe(l.partner_vat_number)}</IcDphPartnera>`,
    `      <CisloFaktury>${xe(l.invoice_number)}</CisloFaktury>`,
    `      <DVDP>${xe(l.dvdp)}</DVDP>`,
    l.rate != null ? `      <Sadzba>${l.rate}</Sadzba>` : "",
    `      <Zaklad>${money(l.base)}</Zaklad>`,
    `      <Dan>${money(l.vat)}</Dan>`,
    l.ratio_coef != null ? `      <KoefPomernyOdpocet>${l.ratio_coef.toFixed(2)}</KoefPomernyOdpocet>` : "",
    l.item_code ? `      <KodPolozky>${xe(l.item_code)}</KodPolozky>` : "",
    isCorrection ? `      <PovodneCisloFaktury>${xe(l.corrects_invoice_number)}</PovodneCisloFaktury>` : "",
    `    </Faktura>`,
  ].filter(Boolean).join("\n");
}

export function generateKvDphXml(report: VatReports): string {
  const p = periodAttrs(report);
  const kv: KvDphReport = report.kvDph;

  function castSection(code: string, label: string, lines: KvLine[]): string {
    const inner = lines.map(kvLineXml).join("\n");
    return [
      `  <Cast${code} pocet="${lines.length}">`,
      `    <Popis>${xe(label)}</Popis>`,
      inner || "    <!-- žiadne záznamy -->",
      `  </Cast${code}>`,
    ].join("\n");
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    disclaimer(report),
    `<KvDph verzia="KVDPHv25" rok="${p.rok}" mesiac="${p.mesiac}">`,
    identifikacia(report),
    `  <Hlavicka>`,
    `    <Rok>${p.rok}</Rok>`,
    `    <${report.period.type === "monthly" ? "Mesiac" : "Stvrtrok"}>${p.mesiac}</${report.period.type === "monthly" ? "Mesiac" : "Stvrtrok"}>`,
    `  </Hlavicka>`,
    castSection("A1", "Vystavené FV tuzemským platcom (s DPH 5/19/23%)", kv.A1),
    castSection("A2", "Vystavené FV s tuzemským RC § 69 ods. 12", kv.A2),
    castSection("B1", "Prijaté FP - samozdanenie (IC, dovoz, RC)", kv.B1),
    castSection("B2", "Prijaté tuzemské FP s odpočtom DPH", kv.B2),
    `  <CastB3 pocet="${kv.B3.count}">`,
    `    <Popis>${xe("eKasa sumár dokladov s odpočtom (PHM atď.)")}</Popis>`,
    `    <CelkovyZaklad>${money(kv.B3.base_total)}</CelkovyZaklad>`,
    `    <CelkovaDan>${money(kv.B3.vat_total)}</CelkovaDan>`,
    `  </CastB3>`,
    castSection("C1", "Opravné FV (k A.1/A.2)", kv.C1),
    castSection("C2", "Opravné FP (k B.1/B.2)", kv.C2),
    `  <CastD1 pocet="${kv.D1.count}">`,
    `    <Popis>${xe("eKasa - celkový obrat")}</Popis>`,
    `    <Suma>${money(kv.D1.total)}</Suma>`,
    `  </CastD1>`,
    `  <CastD2 pocet="${kv.D2.count}">`,
    `    <Popis>${xe("Iné tržby bez ERP")}</Popis>`,
    `    <Suma>${money(kv.D2.total)}</Suma>`,
    `  </CastD2>`,
    `</KvDph>`,
  ].join("\n");
}

/* ============ Súhrnný výkaz ============ */

export function generateSuhrnnyXml(report: VatReports): string {
  const p = periodAttrs(report);
  const sv: SuhrnnyReport = report.suhrnny;

  if (!sv.required) {
    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      disclaimer(report),
      `<!-- Súhrnný výkaz za toto obdobie sa nepodáva: ${xe(sv.required_reason)} -->`,
      `<SuhrnnyVykaz verzia="SVDPHv25" rok="${p.rok}" mesiac="${p.mesiac}" pocet="0" />`,
    ].join("\n");
  }

  const plnenia = sv.lines.map((l) => {
    return [
      `    <Plnenie>`,
      `      <KodStatu>${xe(l.partner_country)}</KodStatu>`,
      `      <IcDphPartnera>${xe(l.partner_vat_number)}</IcDphPartnera>`,
      l.partner_name ? `      <NazovPartnera>${xe(l.partner_name)}</NazovPartnera>` : "",
      `      <Suma>${money(l.total)}</Suma>`,
      `      <Kod>${l.kind_code}</Kod>`,
      `      <PopisKodu>${xe(l.kind_label)}</PopisKodu>`,
      `    </Plnenie>`,
    ].filter(Boolean).join("\n");
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    disclaimer(report),
    `<SuhrnnyVykaz verzia="SVDPHv25" rok="${p.rok}" mesiac="${p.mesiac}" frekvencia="${sv.frequency}" pocet="${sv.lines.length}">`,
    identifikacia(report),
    `  <Plnenia>`,
    plnenia.join("\n"),
    `  </Plnenia>`,
    `  <Sucty>`,
    `    <IcDodanieTovaru>${money(sv.totals.ic_supply_goods)}</IcDodanieTovaru>`,
    `    <IcDodanieSluzieb>${money(sv.totals.ic_supply_services)}</IcDodanieSluzieb>`,
    `    <TrojstrannyObchod>${money(sv.totals.triangular)}</TrojstrannyObchod>`,
    `    <CallOffStock>${money(sv.totals.call_off)}</CallOffStock>`,
    `  </Sucty>`,
    `</SuhrnnyVykaz>`,
  ].join("\n");
}

/* ============ Filename helpers ============ */

export function filenameFor(
  part: "dp-dph" | "kv-dph" | "suhrnny",
  report: VatReports,
  ext: "xml" | "json"
): string {
  const periodSlug = `${report.period.year}-${pad2(
    report.period.monthOrQuarter
  )}`;
  const vatId = report.ownCompany.vat_number ?? "noid";
  const prefixes = {
    "dp-dph": "DP-DPH",
    "kv-dph": "KV-DPH",
    suhrnny: "SUHRNNY",
  } as const;
  return `${prefixes[part]}_${periodSlug}_${vatId}.${ext}`;
}
