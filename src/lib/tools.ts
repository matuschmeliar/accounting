import { tool } from "ai";
import { z } from "zod";
import { datamap, SCHEMA } from "./datamap";
import { computeVatReports, monthlyPeriod } from "./vat";

export const tools = {
  list_instances: tool({
    description:
      "Načíta inštancie z Datamap. Použij na vyhľadávanie faktúr, klientov, dodávateľov, bankových transakcií. " +
      "Mapovanie schém: customer/supplier → organization, faktúra/banka → transaction, dokument → file, účet → account. " +
      "Pre filter cez vlastné polia (_doc_type, _customer_id) použij jq_filter so syntaxou '.[] | select(._doc_type == \"invoice_issued\")'.",
    inputSchema: z.object({
      schema: z.enum([
        "organization",
        "transaction",
        "file",
        "account",
        "person",
      ]),
      jq_filter: z
        .string()
        .optional()
        .describe(
          'jq filter, syntax: ".[] | select(...)". Povolené identifikátory: true, false, null, and, or, not, select, any, strings, contains, ascii_downcase.'
        ),
      search_term: z
        .string()
        .optional()
        .describe("Fulltextové hľadanie (SKALPEL)"),
      instance_ids: z.array(z.string()).optional(),
    }),
    execute: async ({ schema, jq_filter, search_term, instance_ids }) => {
      const res = await datamap.listInstances({
        json_schema_id: SCHEMA[schema],
        jq_filter,
        search_term,
        instance_ids,
      });
      return {
        count: res.count,
        instances: res.instances.map((i) => ({
          id: i.instance_id,
          schema: i.json_schema_id,
          data: i.data,
          created_at: i.created_at,
          updated_at: i.updated_at,
        })),
      };
    },
  }),

  create_instance: tool({
    description:
      "Vytvorí novú inštanciu. Príklady:\n" +
      "- Customer s.r.o.: schema=organization, data={name, kind:'s.r.o.', vat_number:'SK...', _doc_type:'customer'}\n" +
      "- Faktúra vystavená: schema=transaction, data={name:'FV-2026-0001', kind:'predaj', functional_type:'faktúra', date, due_date, amount, tax_amount, tax_rate, currency:'EUR', variable_symbol, _doc_type:'invoice_issued', _customer_id, _invoice_lines:[...], _invoice_number}\n" +
      "- Bank line: schema=transaction, data={name, kind:'platba'/'prevod'/'inkaso', date, amount, variable_symbol, IBAN, _doc_type:'bank_line', _matched_invoice_id (ak je)}",
    inputSchema: z.object({
      schema: z.enum([
        "organization",
        "transaction",
        "file",
        "account",
        "person",
      ]),
      data: z.record(z.string(), z.unknown()),
    }),
    execute: async ({ schema, data }) => {
      const res = await datamap.createInstance({
        json_schema_id: SCHEMA[schema],
        data,
      });
      return { instance_id: res.instance_id };
    },
  }),

  update_instance: tool({
    description:
      "Aktualizuje existujúcu inštanciu. Pošli kompletné data (replace, nie merge).",
    inputSchema: z.object({
      instance_id: z.string(),
      schema: z.enum([
        "organization",
        "transaction",
        "file",
        "account",
        "person",
      ]),
      data: z.record(z.string(), z.unknown()),
    }),
    execute: async ({ instance_id, schema, data }) => {
      const res = await datamap.updateInstance({
        instance_id,
        json_schema_id: SCHEMA[schema],
        data,
      });
      return { instance_id: res.instance_id };
    },
  }),

  delete_instance: tool({
    description: "Zmaže inštanciu. Pre účtovné záznamy radšej zmeň _doc_type na 'cancelled' a doplň _cancelled_reason — nezmaž natvrdo, audit trail je dôležitý.",
    inputSchema: z.object({
      instance_id: z.string(),
    }),
    execute: async ({ instance_id }) => {
      await datamap.deleteInstance(instance_id);
      return { deleted: true, instance_id };
    },
  }),

  agentic_search: tool({
    description:
      "Sémantické vyhľadávanie cez LLM nad Datamap. Použij pre fuzzy otázky typu 'nájdi všetko súvisiace s ACME za apríl'. Pre presné filtre použij list_instances + jq_filter.",
    inputSchema: z.object({
      query: z.string().describe("Hľadaný text v slovenčine"),
      schema: z
        .enum(["organization", "transaction", "file", "account", "person"])
        .optional(),
    }),
    execute: async ({ query, schema }) => {
      const res = await datamap.agenticSearch({
        search_term: query,
        json_schema_id: schema ? SCHEMA[schema] : undefined,
        max_results_per_method: 10,
      });
      return {
        text: res.text,
        count: res.instances.length,
        instances: res.instances.map((i) => ({
          id: i.instance_id,
          schema: i.json_schema_id,
          data: i.data,
        })),
      };
    },
  }),

  compute_vat: tool({
    description:
      "Deterministický výpočet DPH zo zoznamu súm a sadzieb. Použij vždy pre DPH aritmetiku, nikdy nepočítaj sám.",
    inputSchema: z.object({
      items: z.array(
        z.object({
          base: z.number().describe("Základ dane (bez DPH)"),
          rate: z
            .number()
            .describe("Sadzba DPH v percentách: 0, 5, 19 alebo 23"),
        })
      ),
    }),
    execute: async ({ items }) => {
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const byRate = new Map<number, { base: number; vat: number }>();
      for (const it of items) {
        const cur = byRate.get(it.rate) ?? { base: 0, vat: 0 };
        cur.base = round2(cur.base + it.base);
        cur.vat = round2(cur.vat + (it.base * it.rate) / 100);
        byRate.set(it.rate, cur);
      }
      const summary = [...byRate.entries()].map(([rate, v]) => ({
        rate,
        base: v.base,
        vat: v.vat,
        total: round2(v.base + v.vat),
      }));
      const total_base = round2(
        summary.reduce((s, r) => s + r.base, 0)
      );
      const total_vat = round2(summary.reduce((s, r) => s + r.vat, 0));
      const total_incl = round2(total_base + total_vat);
      return { summary, total_base, total_vat, total_incl };
    },
  }),

  compute_vat_return: tool({
    description:
      "Deterministický výpočet všetkých 3 DPH výkazov za zvolené obdobie: " +
      "Priznanie DPH (DPHv25 oddiely I-VI), Kontrolný výkaz (A.1/A.2/B.1/B.2/C.1/C.2) a " +
      "Súhrnný výkaz (IC dodania, B2B služby). " +
      "Číta všetky faktúry z Datamap pre dané obdobie, agreguje podľa _vat_regime a sadzby. " +
      "Použij keď sa užívateľ pýta 'Priprav DPH za...' alebo 'Aký je nadmerný odpočet za...'.",
    inputSchema: z.object({
      year: z.number().describe("Rok obdobia, napr. 2026"),
      month: z
        .number()
        .min(1)
        .max(12)
        .describe("Mesiac obdobia 1-12 (mesačný platca DPH)"),
    }),
    execute: async ({ year, month }) => {
      const period = monthlyPeriod(year, month);
      const report = await computeVatReports(period);
      return {
        period: report.period,
        verdict: {
          output_vat: report.dpDph.section_VI.output_vat_total,
          input_vat: report.dpDph.section_VI.input_vat_total,
          balance: report.dpDph.section_VI.balance,
          interpretation:
            report.dpDph.section_VI.balance > 0
              ? "Vlastná daňová povinnosť — zaplatiť FS SR"
              : report.dpDph.section_VI.balance < 0
              ? "Nadmerný odpočet — nárok na vrátenie"
              : "Nulové vysporiadanie",
        },
        dp_dph: report.dpDph,
        kv_dph_summary: {
          A1_count: report.kvDph.A1.length,
          A2_count: report.kvDph.A2.length,
          B1_count: report.kvDph.B1.length,
          B2_count: report.kvDph.B2.length,
          C1_count: report.kvDph.C1.length,
          C2_count: report.kvDph.C2.length,
        },
        suhrnny: {
          required: report.suhrnny.required,
          frequency: report.suhrnny.frequency,
          totals: report.suhrnny.totals,
        },
        counts: report.counts,
        warnings: report.warnings,
      };
    },
  }),
};
