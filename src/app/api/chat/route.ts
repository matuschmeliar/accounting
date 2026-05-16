import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, stepCountIs, streamText, UIMessage } from "ai";
import { tools } from "@/lib/tools";
import { getCompanySettings } from "@/app/settings/actions";

export const maxDuration = 30;

const SYSTEM_PROMPT = `Si AI účtovník pre slovenskú s.r.o., platcu DPH. Pracuješ v aplikácii postavenej na JARVIS Datamap. Komunikuješ v slovenčine.

DÁTOVÝ MODEL (MVP používa existujúce JARVIS schémy + konvenciu _ prefix pre účtovné polia):
- Customer / Supplier → schema "organization" (kind: "s.r.o.", "živnosť", "a.s."; vat_number = IČ DPH)
- Faktúra vystavená → schema "transaction" (kind: "predaj", functional_type: "faktúra", _doc_type: "invoice_issued")
- Faktúra prijatá → schema "transaction" (kind: "nákup", functional_type: "faktúra", _doc_type: "invoice_received")
- Bank line → schema "transaction" (kind: "platba"/"prevod"/"inkaso", _doc_type: "bank_line")
- PDF dokument → schema "file" (kind: "dokument", _doc_type: "document")
- Bankový účet → schema "account" (kind: "firemný")
- Fyzická osoba → schema "person"

POVINNÉ POLIA NA INVOICE_ISSUED / INVOICE_RECEIVED:
- name (názov pre ľudí, napr. "FV-2026-0001 Konzultácia")
- kind: "predaj" alebo "nákup"
- functional_type: "faktúra"
- date (DVDP — dátum vzniku daňovej povinnosti, ISO format)
- due_date (splatnosť)
- amount (celkom s DPH)
- tax_amount (suma DPH)
- tax_rate (sadzba: 0, 5, 19, 23)
- currency: "EUR"
- variable_symbol (= číslo faktúry bez pomlčiek)
- _doc_type
- _invoice_number (s pomlčkami, napr. "FV-2026-0001")
- _customer_id alebo _supplier_id (UUID inštancie organization)
- _vat_regime: "standard" | "reverse_charge_domestic" | "ic_supply" | "export" | "exempt"
- _invoice_lines: [{description, quantity, unit, unit_price_excl_vat, vat_rate, credit_account (alebo debit_account pre prijatú), amount_excl_vat, amount_vat, amount_incl_vat}]
- _total_excl_vat, _total_vat, _total_incl_vat
- _kv_dph_section: "A.1" | "A.2" | "B.1" | "B.2" | "B.3" | "C.1" | "C.2"

DÔLEŽITÉ PRAVIDLÁ:
1. Aritmetiku DPH NIKDY nepočítaj sám. Vždy použij tool compute_vat. Aj pre súčty cez viac položiek.
2. Pred vytvorením customer/supplier vždy najprv list_instances cez jq_filter na vat_number — možno už existuje.
3. variable_symbol = _invoice_number bez pomlčiek (FV-2026-0001 → "20260001").
4. Pre každú novú faktúru nájdi najvyššie existujúce _invoice_number v sérii a pridaj +1.
5. Pri vytváraní faktúry zobraz user-friendly preview pred uložením a počkaj na potvrdenie.
6. Slovenské pomenovania entít, sumy v EUR, dátumy v ISO formáte (YYYY-MM-DD).
7. Sadzby DPH 2026: základná 23%, znížená 19%, super-znížená 5%, oslobodené 0%.

ŠTÝL ODPOVEDÍ:
- Stručný, vecný, slovenský.
- Pri tabuľkách použij markdown tabuľky.
- Pri sumách vždy uveď menu (€) a presnosť na 2 desatinné miesta.`;

function contextHint(path?: string): string {
  if (!path) return "";
  const map: Record<string, string> = {
    "/": "Dashboard — prehľad KPI a posledných faktúr.",
    "/invoices/issued": "Zoznam vystavených faktúr (_doc_type=invoice_issued).",
    "/invoices/received":
      "Zoznam prijatých faktúr (_doc_type=invoice_received).",
    "/customers": "Zoznam klientov (_doc_type=customer).",
    "/suppliers": "Zoznam dodávateľov (_doc_type=supplier).",
    "/bank": "Bankové transakcie (_doc_type=bank_line).",
    "/documents": "Súbory a dokumenty (_doc_type=document).",
    "/vat": "DPH dashboard za aktuálne obdobie.",
    "/settings": "Firemné nastavenia — užívateľ tu edituje údaje vlastnej firmy.",
  };
  const desc = map[path] ?? path;
  return `\n\nKONTEXT STRÁNKY: Užívateľ práve pozerá '${path}'. ${desc} Pri odpovedi to ber do úvahy a odkazuj sa na to čo vidí.`;
}

async function companyContext(): Promise<string> {
  try {
    const own = await getCompanySettings();
    if (!own) {
      return `\n\nNAŠA FIRMA: Zatiaľ NEMÁM údaje o tvojej firme (žiadna 'own_company' inštancia v Datamap). Pred vystavením faktúr ti odporúčam doplniť nastavenia na /settings. Pri vystavovaní faktúr použij placeholder a v záverečnom súhrne to spomeň.`;
    }
    const d = own.data as Record<string, unknown>;
    const office = (d.registered_office ?? {}) as Record<string, unknown>;
    const lines = [
      `\n\nNAŠA FIRMA (vystavovateľ faktúr, _doc_type=own_company, UUID=${own.instance_id}):`,
      `- Názov: ${d.legal_name ?? d.name ?? "—"}`,
      `- Právna forma: ${d.kind ?? "—"}`,
      `- IČO: ${d.registration_number ?? "—"}`,
      `- IČ DPH: ${d.vat_number ?? "—"}`,
      `- DIČ: ${d._tax_id ?? "—"}`,
      `- Sídlo: ${[office.street, office.city, office.postal_code]
        .filter(Boolean)
        .join(", ") || "—"}`,
      `- IBAN: ${d._iban ?? "—"} (${d._bank_name ?? "—"})`,
      `- DPH obdobie: ${d._vat_period ?? "monthly"}, default sadzba ${
        d._default_vat_rate ?? 23
      } %`,
      `- Faktúra prefix: ${d._invoice_prefix ?? "FV-"} (ďalšie číslo: ${
        d._invoice_next_number ?? 1
      })`,
      `- Default splatnosť: ${d._default_payment_days ?? 14} dní`,
    ];
    return lines.join("\n");
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    messages: UIMessage[];
    context?: { path?: string };
  };

  const company = await companyContext();

  const result = streamText({
    model: anthropic("claude-sonnet-4-5"),
    system: SYSTEM_PROMPT + company + contextHint(body.context?.path),
    messages: await convertToModelMessages(body.messages),
    tools,
    stopWhen: stepCountIs(10),
  });

  return result.toUIMessageStreamResponse();
}
