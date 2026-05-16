import { datamap, Instance, SCHEMA } from "./datamap";

/**
 * Výpočet DPH výkazov za zvolené obdobie.
 *
 * Implementácia ladí so:
 * - Zákonom č. 222/2004 Z. z. o DPH (sadzby, miesto dodania, RC, IC, oslobodenia)
 * - Štruktúrou DP DPH (DPHv25) — Oddiely I-VI
 * - Štruktúrou KV DPH (časti A.1, A.2, B.1, B.2, B.3, C.1, C.2, D.1, D.2)
 * - Súhrnný výkaz § 80 (IC dodanie tovaru, B2B služby, trojstranný obchod, call-off)
 * - Sadzby DPH 2026: 23 % základná, 19 % znížená, 5 % super-znížená, 0 % oslobodené
 *
 * MVP obmedzenia (pre full produkčný compliance treba doplniť):
 * - Pri B.2 chýba pomerný odpočet (§ 50, koeficient) a kód položky 21–29 — vždy = 1.0, kód = 21
 * - eKasa časti B.3/D.1/D.2 sú nuly (eKasa integrácia coming soon)
 * - Pri opravných FV/FP (C.1/C.2) sa rozlišuje len cez _is_correction + _corrects_invoice_number
 * - Trojstranný obchod a call-off stock zatiaľ nemajú samostatný flag — patria do _vat_regime
 * - DVDP = transaction.date (nepoužíva sa dátum prijatia platby pre cash accounting)
 * - Sadzby viazané iba na dátum vystavenia faktúry, NIE na DVDP (pri zmene sadzieb cez rok môže byť off)
 * - Zaokrúhľovanie 2 desatinné miesta (matematicky, nie banker's rounding)
 */

function num(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return parseFloat(x) || 0;
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const SK_MONTH_FULL = [
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

export type VatRegime =
  | "standard"
  | "reverse_charge_domestic"
  | "ic_supply"
  | "ic_acquisition"
  | "export"
  | "import"
  | "exempt"
  | "oss";

export type Period = {
  start: string; // ISO date
  end: string; // ISO date
  label: string; // e.g. "máj 2026"
  type: "monthly" | "quarterly";
  monthOrQuarter: number; // 1-12 for monthly, 1-4 for quarterly
  year: number;
};

export function monthlyPeriod(year: number, month: number): Period {
  const start = new Date(Date.UTC(year, month - 1, 1))
    .toISOString()
    .slice(0, 10);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return {
    start,
    end,
    label: `${SK_MONTH_FULL[month - 1]} ${year}`,
    type: "monthly",
    monthOrQuarter: month,
    year,
  };
}

/* ============ DP DPH (priznanie) ============ */

export type DpDphSections = {
  /** Oddiel I — Zdaniteľné plnenia v tuzemsku */
  section_I: {
    /** Riadok 1 — Daň pri dodaní tovaru a služieb v tuzemsku */
    rate23: { base: number; vat: number; count: number };
    rate19: { base: number; vat: number; count: number };
    rate5: { base: number; vat: number; count: number };
    /** Riadok 9-10 — Tuzemský RC ako dodávateľ (vystaviteľ, plnenie bez DPH) */
    domestic_rc_supplier: { base: number; count: number };
  };
  /** Oddiel II — IC nadobudnutie tovaru (§ 11) */
  section_II: {
    ic_acquisitions: { base: number; vat: number; count: number };
  };
  /** Oddiel III — Dovoz / iné samozdanenie */
  section_III: {
    domestic_rc_recipient: { base: number; vat: number; count: number };
    import: { base: number; vat: number; count: number };
  };
  /** Oddiel IV — Oslobodené plnenia */
  section_IV: {
    ic_supply: { base: number; count: number };
    export: { base: number; count: number };
    exempt: { base: number; count: number };
  };
  /** Oddiel V — Odpočet dane */
  section_V: {
    input_rate23: { base: number; vat: number; count: number };
    input_rate19: { base: number; vat: number; count: number };
    input_rate5: { base: number; vat: number; count: number };
    input_rc: { base: number; vat: number; count: number };
    input_ic: { base: number; vat: number; count: number };
  };
  /** Oddiel VI — Vysporiadanie */
  section_VI: {
    output_vat_total: number;
    input_vat_total: number;
    /** > 0 = daňová povinnosť (zaplatiť), < 0 = nadmerný odpočet (vrátenie) */
    balance: number;
  };
};

/* ============ KV DPH (kontrolný výkaz) ============ */

export type KvLine = {
  partner_vat_number: string;
  partner_name?: string;
  invoice_number: string;
  dvdp: string;
  rate?: number;
  base: number;
  vat: number;
  /** Iba pre B.2: koeficient pomerného odpočtu */
  ratio_coef?: number;
  /** Iba pre B.2: kód položky 21–29 */
  item_code?: string;
  /** Iba pre C.1/C.2: odkaz na pôvodnú faktúru */
  corrects_invoice_number?: string;
};

export type KvDphReport = {
  A1: KvLine[]; // Vyhotovené FV tuzemským platcom s výstupnou DPH
  A2: KvLine[]; // Vyhotovené FV s tuzemským RC (§ 69 ods. 12)
  B1: KvLine[]; // Prijaté FP — samozdanenie (IC nad., dovoz, RC ako príjemca)
  B2: KvLine[]; // Prijaté tuzemské FP s odpočtom
  B3: { count: number; base_total: number; vat_total: number }; // eKasa sumár — TODO
  C1: KvLine[]; // Opravné FV k A.1/A.2
  C2: KvLine[]; // Opravné FP k B.1/B.2
  D1: { count: number; total: number }; // eKasa celkový obrat — TODO
  D2: { count: number; total: number }; // Iné tržby bez ERP — TODO
};

/* ============ Súhrnný výkaz ============ */

export type SuhrnnyLine = {
  partner_vat_number: string;
  partner_country: string;
  partner_name?: string;
  /** 0 = bežné IC dodanie tovaru, 1 = trojstranný obchod, 2 = služba B2B, 3 = call-off stock */
  kind_code: number;
  kind_label: string;
  total: number;
  count: number;
};

export type SuhrnnyReport = {
  lines: SuhrnnyLine[];
  totals: {
    ic_supply_goods: number;
    ic_supply_services: number;
    triangular: number;
    call_off: number;
  };
  required: boolean;
  required_reason: string;
  frequency: "monthly" | "quarterly" | "none";
};

/* ============ Top-level result ============ */

export type VatReports = {
  period: Period;
  ownCompany: {
    instance_id?: string;
    name?: string;
    vat_number?: string;
    vat_period?: "monthly" | "quarterly";
  };
  dpDph: DpDphSections;
  kvDph: KvDphReport;
  suhrnny: SuhrnnyReport;
  warnings: string[];
  counts: {
    issued: number;
    received: number;
    customers_resolved: number;
    suppliers_resolved: number;
  };
};

/* ============ Computation ============ */

function inPeriod(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function classifyRegime(d: Record<string, unknown>): VatRegime {
  const raw = String(d._vat_regime ?? "").toLowerCase();
  if (raw && raw !== "standard") return raw as VatRegime;
  // fallback inferencia
  const rate = num(d.tax_rate);
  if (rate === 0) {
    // môže byť IC, export, exempt — bez explicit flagu nevieme, default exempt
    return "exempt";
  }
  return "standard";
}

export async function computeVatReports(period: Period): Promise<VatReports> {
  const { start, end } = period;

  // Robustné matchery — fallback z kind+functional_type ak _doc_type chýba
  const ISSUED_MATCH = `(._doc_type == "invoice_issued" or (._doc_type == null and .kind == "predaj" and .functional_type == "faktúra"))`;
  const RECEIVED_MATCH = `(._doc_type == "invoice_received" or (._doc_type == null and .kind == "nákup" and .functional_type == "faktúra"))`;

  // Pull all needed data in parallel
  const [issuedRes, receivedRes, customersRes, suppliersRes, ownRes] =
    await Promise.all([
      datamap.listInstances({
        json_schema_id: SCHEMA.transaction,
        jq_filter: `.[] | select(${ISSUED_MATCH} and .date >= "${start}" and .date <= "${end}")`,
      }),
      datamap.listInstances({
        json_schema_id: SCHEMA.transaction,
        jq_filter: `.[] | select(${RECEIVED_MATCH} and .date >= "${start}" and .date <= "${end}")`,
      }),
      datamap.listInstances({
        json_schema_id: SCHEMA.organization,
        jq_filter: `.[] | select(._doc_type == "customer")`,
      }),
      datamap.listInstances({
        json_schema_id: SCHEMA.organization,
        jq_filter: `.[] | select(._doc_type == "supplier")`,
      }),
      datamap.listInstances({
        json_schema_id: SCHEMA.organization,
        jq_filter: `.[] | select(._doc_type == "own_company")`,
      }),
    ]);

  const customers = customersRes.instances;
  const suppliers = suppliersRes.instances;
  const customerById = new Map<string, Instance>(
    customers.map((c) => [c.instance_id, c])
  );
  const supplierById = new Map<string, Instance>(
    suppliers.map((s) => [s.instance_id, s])
  );
  const own = ownRes.instances[0];

  const warnings: string[] = [];

  // Initialize accumulators
  const dp: DpDphSections = {
    section_I: {
      rate23: { base: 0, vat: 0, count: 0 },
      rate19: { base: 0, vat: 0, count: 0 },
      rate5: { base: 0, vat: 0, count: 0 },
      domestic_rc_supplier: { base: 0, count: 0 },
    },
    section_II: {
      ic_acquisitions: { base: 0, vat: 0, count: 0 },
    },
    section_III: {
      domestic_rc_recipient: { base: 0, vat: 0, count: 0 },
      import: { base: 0, vat: 0, count: 0 },
    },
    section_IV: {
      ic_supply: { base: 0, count: 0 },
      export: { base: 0, count: 0 },
      exempt: { base: 0, count: 0 },
    },
    section_V: {
      input_rate23: { base: 0, vat: 0, count: 0 },
      input_rate19: { base: 0, vat: 0, count: 0 },
      input_rate5: { base: 0, vat: 0, count: 0 },
      input_rc: { base: 0, vat: 0, count: 0 },
      input_ic: { base: 0, vat: 0, count: 0 },
    },
    section_VI: {
      output_vat_total: 0,
      input_vat_total: 0,
      balance: 0,
    },
  };

  const kv: KvDphReport = {
    A1: [],
    A2: [],
    B1: [],
    B2: [],
    B3: { count: 0, base_total: 0, vat_total: 0 },
    C1: [],
    C2: [],
    D1: { count: 0, total: 0 },
    D2: { count: 0, total: 0 },
  };

  const suhrnnyByPartner = new Map<string, SuhrnnyLine>();
  let icSupplyTotal = 0;
  let icServicesTotal = 0;
  let triangularTotal = 0;
  let callOffTotal = 0;

  // ===== ISSUED INVOICES =====
  for (const inv of issuedRes.instances) {
    const d = inv.data as Record<string, unknown>;
    if (!inPeriod(String(d.date ?? ""), start, end)) continue;

    const regime = classifyRegime(d);
    const rate = num(d.tax_rate);
    const base = num(
      d._total_excl_vat ?? num(d.amount) - num(d.tax_amount)
    );
    const vatAmt = num(d.tax_amount);
    const invoiceNumber = String(
      d._invoice_number ?? d.name ?? inv.instance_id.slice(0, 8)
    );
    const dvdp = String(d.date ?? "");
    const isCorrection = Boolean(d._is_correction);
    const correctsRef = d._corrects_invoice_number
      ? String(d._corrects_invoice_number)
      : undefined;

    // Resolve customer for IČ DPH
    const customerId = String(d._customer_id ?? "");
    const customer = customerId ? customerById.get(customerId) : undefined;
    const partnerVatNumber = customer
      ? String((customer.data as Record<string, unknown>).vat_number ?? "")
      : "";
    const partnerName = customer
      ? String((customer.data as Record<string, unknown>).name ?? "")
      : undefined;
    const partnerCountry = customer
      ? String(
          (customer.data as Record<string, unknown>).jurisdiction_country ??
            "SK"
        )
      : "SK";

    if (!customer) {
      warnings.push(
        `FV ${invoiceNumber}: chýba _customer_id alebo customer nenájdený`
      );
    } else if (!partnerVatNumber && regime !== "exempt") {
      warnings.push(
        `FV ${invoiceNumber}: klient '${partnerName}' nemá IČ DPH — KV DPH ho vyžaduje`
      );
    }

    const kvLineBase: KvLine = {
      partner_vat_number: partnerVatNumber,
      partner_name: partnerName,
      invoice_number: invoiceNumber,
      dvdp,
      rate,
      base,
      vat: vatAmt,
      corrects_invoice_number: correctsRef,
    };

    if (regime === "standard") {
      // Oddiel I + KV A.1 (alebo C.1 ak je oprava)
      if (rate === 23) {
        dp.section_I.rate23.base += base;
        dp.section_I.rate23.vat += vatAmt;
        dp.section_I.rate23.count += 1;
      } else if (rate === 19) {
        dp.section_I.rate19.base += base;
        dp.section_I.rate19.vat += vatAmt;
        dp.section_I.rate19.count += 1;
      } else if (rate === 5) {
        dp.section_I.rate5.base += base;
        dp.section_I.rate5.vat += vatAmt;
        dp.section_I.rate5.count += 1;
      } else if (rate !== 0) {
        warnings.push(
          `FV ${invoiceNumber}: neštandardná sadzba ${rate}% (povolené: 23/19/5/0)`
        );
      }
      if (isCorrection) kv.C1.push(kvLineBase);
      else kv.A1.push(kvLineBase);
    } else if (regime === "reverse_charge_domestic") {
      // Tuzemský RC dodávateľ (§ 69 ods. 12) — vystavená FV bez DPH
      dp.section_I.domestic_rc_supplier.base += base;
      dp.section_I.domestic_rc_supplier.count += 1;
      if (isCorrection) kv.C1.push({ ...kvLineBase, vat: 0 });
      else kv.A2.push({ ...kvLineBase, vat: 0 });
    } else if (regime === "ic_supply") {
      // IC dodanie tovaru — oslobodené (§ 43)
      dp.section_IV.ic_supply.base += base;
      dp.section_IV.ic_supply.count += 1;
      icSupplyTotal += base;

      // Súhrnný výkaz — zoskupiť podľa IČ DPH partnera
      if (partnerVatNumber) {
        const key = `${partnerVatNumber}|0`;
        const cur = suhrnnyByPartner.get(key) ?? {
          partner_vat_number: partnerVatNumber,
          partner_country: partnerCountry,
          partner_name: partnerName,
          kind_code: 0,
          kind_label: "IC dodanie tovaru",
          total: 0,
          count: 0,
        };
        cur.total = round2(cur.total + base);
        cur.count += 1;
        suhrnnyByPartner.set(key, cur);
      } else {
        warnings.push(
          `FV ${invoiceNumber}: IC dodanie bez IČ DPH partnera — Súhrnný výkaz nemôže byť zložený`
        );
      }
    } else if (regime === "export") {
      dp.section_IV.export.base += base;
      dp.section_IV.export.count += 1;
    } else if (regime === "exempt") {
      dp.section_IV.exempt.base += base;
      dp.section_IV.exempt.count += 1;
    }
  }

  // ===== RECEIVED INVOICES =====
  for (const inv of receivedRes.instances) {
    const d = inv.data as Record<string, unknown>;
    if (!inPeriod(String(d.date ?? ""), start, end)) continue;

    const regime = classifyRegime(d);
    const rate = num(d.tax_rate);
    const base = num(
      d._total_excl_vat ?? num(d.amount) - num(d.tax_amount)
    );
    const vatAmt = num(d.tax_amount);
    const invoiceNumber = String(
      d._invoice_number ?? d.name ?? inv.instance_id.slice(0, 8)
    );
    const dvdp = String(d.date ?? "");
    const isCorrection = Boolean(d._is_correction);
    const correctsRef = d._corrects_invoice_number
      ? String(d._corrects_invoice_number)
      : undefined;

    const supplierId = String(d._supplier_id ?? "");
    const supplier = supplierId ? supplierById.get(supplierId) : undefined;
    const partnerVatNumber = supplier
      ? String((supplier.data as Record<string, unknown>).vat_number ?? "")
      : "";
    const partnerName = supplier
      ? String((supplier.data as Record<string, unknown>).name ?? "")
      : undefined;

    if (!supplier) {
      warnings.push(
        `FP ${invoiceNumber}: chýba _supplier_id alebo supplier nenájdený`
      );
    } else if (!partnerVatNumber && regime !== "exempt") {
      warnings.push(
        `FP ${invoiceNumber}: dodávateľ '${partnerName}' nemá IČ DPH — KV DPH ho vyžaduje`
      );
    }

    const kvLineBase: KvLine = {
      partner_vat_number: partnerVatNumber,
      partner_name: partnerName,
      invoice_number: invoiceNumber,
      dvdp,
      rate,
      base,
      vat: vatAmt,
      ratio_coef: 1.0, // MVP: žiadny pomerný odpočet
      item_code: "21", // MVP: default kód položky (tovar)
      corrects_invoice_number: correctsRef,
    };

    if (regime === "standard") {
      // Oddiel V odpočet + KV B.2
      if (rate === 23) {
        dp.section_V.input_rate23.base += base;
        dp.section_V.input_rate23.vat += vatAmt;
        dp.section_V.input_rate23.count += 1;
      } else if (rate === 19) {
        dp.section_V.input_rate19.base += base;
        dp.section_V.input_rate19.vat += vatAmt;
        dp.section_V.input_rate19.count += 1;
      } else if (rate === 5) {
        dp.section_V.input_rate5.base += base;
        dp.section_V.input_rate5.vat += vatAmt;
        dp.section_V.input_rate5.count += 1;
      }
      if (isCorrection) kv.C2.push(kvLineBase);
      else kv.B2.push(kvLineBase);
    } else if (regime === "reverse_charge_domestic") {
      // Tuzemský RC ako príjemca — samozdanenie (oddiel III + V) + KV B.1
      dp.section_III.domestic_rc_recipient.base += base;
      dp.section_III.domestic_rc_recipient.vat += vatAmt;
      dp.section_III.domestic_rc_recipient.count += 1;
      dp.section_V.input_rc.base += base;
      dp.section_V.input_rc.vat += vatAmt;
      dp.section_V.input_rc.count += 1;
      if (isCorrection) kv.C2.push(kvLineBase);
      else kv.B1.push(kvLineBase);
    } else if (regime === "ic_acquisition") {
      // IC nadobudnutie (§ 11) — vstup + výstup
      dp.section_II.ic_acquisitions.base += base;
      dp.section_II.ic_acquisitions.vat += vatAmt;
      dp.section_II.ic_acquisitions.count += 1;
      dp.section_V.input_ic.base += base;
      dp.section_V.input_ic.vat += vatAmt;
      dp.section_V.input_ic.count += 1;
      if (isCorrection) kv.C2.push(kvLineBase);
      else kv.B1.push(kvLineBase);
    } else if (regime === "import") {
      dp.section_III.import.base += base;
      dp.section_III.import.vat += vatAmt;
      dp.section_III.import.count += 1;
      kv.B1.push(kvLineBase);
    }
  }

  // Round all numbers
  for (const sec of Object.values(dp.section_I) as Array<{
    base: number;
    vat?: number;
  }>) {
    sec.base = round2(sec.base);
    if ("vat" in sec && sec.vat != null) sec.vat = round2(sec.vat);
  }
  for (const k of Object.keys(dp.section_II) as Array<
    keyof typeof dp.section_II
  >) {
    dp.section_II[k].base = round2(dp.section_II[k].base);
    dp.section_II[k].vat = round2(dp.section_II[k].vat);
  }
  for (const k of Object.keys(dp.section_III) as Array<
    keyof typeof dp.section_III
  >) {
    dp.section_III[k].base = round2(dp.section_III[k].base);
    dp.section_III[k].vat = round2(dp.section_III[k].vat);
  }
  for (const k of Object.keys(dp.section_IV) as Array<
    keyof typeof dp.section_IV
  >) {
    dp.section_IV[k].base = round2(dp.section_IV[k].base);
  }
  for (const k of Object.keys(dp.section_V) as Array<
    keyof typeof dp.section_V
  >) {
    dp.section_V[k].base = round2(dp.section_V[k].base);
    dp.section_V[k].vat = round2(dp.section_V[k].vat);
  }

  // Oddiel VI — totals
  const outputVat = round2(
    dp.section_I.rate23.vat +
      dp.section_I.rate19.vat +
      dp.section_I.rate5.vat +
      dp.section_II.ic_acquisitions.vat +
      dp.section_III.domestic_rc_recipient.vat +
      dp.section_III.import.vat
  );
  const inputVat = round2(
    dp.section_V.input_rate23.vat +
      dp.section_V.input_rate19.vat +
      dp.section_V.input_rate5.vat +
      dp.section_V.input_rc.vat +
      dp.section_V.input_ic.vat
  );
  dp.section_VI.output_vat_total = outputVat;
  dp.section_VI.input_vat_total = inputVat;
  dp.section_VI.balance = round2(outputVat - inputVat);

  // Súhrnný výkaz — určenie frekvencie
  const ownData = (own?.data as Record<string, unknown>) ?? {};
  const ownVatPeriod = (ownData._vat_period as "monthly" | "quarterly") ??
    "monthly";

  // § 80 ods. 2: mesačné podávanie ak IC dodanie tovaru > 50 000 € v aktuálnom alebo predchádzajúcom kvartáli
  // MVP: zjednodušene, ak v tomto mesiaci > 50k → monthly, inak quarterly
  // (Pre presnosť by sa malo pozerať na 4 kvartály)
  const totalIcSupplyAndServices = icSupplyTotal + icServicesTotal;
  const suhrnnyRequired =
    icSupplyTotal > 0 || icServicesTotal > 0 || triangularTotal > 0;
  const suhrnnyFrequency: "monthly" | "quarterly" | "none" = !suhrnnyRequired
    ? "none"
    : icSupplyTotal > 50000
    ? "monthly"
    : "quarterly";

  const suhrnny: SuhrnnyReport = {
    lines: Array.from(suhrnnyByPartner.values()),
    totals: {
      ic_supply_goods: round2(icSupplyTotal),
      ic_supply_services: round2(icServicesTotal),
      triangular: round2(triangularTotal),
      call_off: round2(callOffTotal),
    },
    required: suhrnnyRequired,
    required_reason: suhrnnyRequired
      ? "IC dodanie tovaru, IC služby B2B, trojstranný obchod alebo call-off"
      : "Žiadne IC plnenia v období",
    frequency: suhrnnyFrequency,
  };

  // De-duplicate warnings
  const dedupWarnings = Array.from(new Set(warnings));

  return {
    period,
    ownCompany: {
      instance_id: own?.instance_id,
      name: own
        ? String((own.data as Record<string, unknown>).name ?? "")
        : undefined,
      vat_number: own
        ? String(
            (own.data as Record<string, unknown>).vat_number ?? ""
          )
        : undefined,
      vat_period: ownVatPeriod,
    },
    dpDph: dp,
    kvDph: kv,
    suhrnny,
    warnings: dedupWarnings,
    counts: {
      issued: issuedRes.instances.length,
      received: receivedRes.instances.length,
      customers_resolved: customers.length,
      suppliers_resolved: suppliers.length,
    },
  };
}
