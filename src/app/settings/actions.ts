"use server";

import { revalidatePath } from "next/cache";
import { datamap, SCHEMA } from "@/lib/datamap";

const SELF_DOC_TYPE = "own_company";

export async function getCompanySettings() {
  const res = await datamap.listInstances({
    json_schema_id: SCHEMA.organization,
    jq_filter: `.[] | select(._doc_type == "${SELF_DOC_TYPE}")`,
  });
  return res.instances[0] ?? null;
}

function s(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function n(v: FormDataEntryValue | null): number | undefined {
  const str = s(v);
  if (!str) return undefined;
  const num = Number(str);
  return Number.isFinite(num) ? num : undefined;
}

export type SaveState = {
  ok: boolean;
  error?: string;
  instance_id?: string;
};

export async function saveCompanySettings(
  _prev: SaveState | null,
  formData: FormData
): Promise<SaveState> {
  try {
    const name = s(formData.get("name"));
    const kind = s(formData.get("kind")) || "s.r.o.";

    if (!name) {
      return { ok: false, error: "Názov firmy je povinný" };
    }

    // Build the data payload. Native organization fields + our _ extensions.
    const data: Record<string, unknown> = {
      _doc_type: SELF_DOC_TYPE,

      // organization schema native fields
      name,
      kind,
      legal_name: s(formData.get("legal_name")) || name,
      registration_number: s(formData.get("registration_number")),
      vat_number: s(formData.get("vat_number")),
      status: "aktívna",
      relation: "vlastním",
      jurisdiction_country: s(formData.get("country")) || "SK",

      // Address — native field is "registered_office", we put structured object there
      registered_office: {
        street: s(formData.get("street")),
        city: s(formData.get("city")),
        postal_code: s(formData.get("postal_code")),
        country: s(formData.get("country")) || "SK",
      },

      // Custom accounting extensions
      _tax_id: s(formData.get("tax_id")),
      _iban: s(formData.get("iban")),
      _swift_bic: s(formData.get("swift_bic")),
      _bank_name: s(formData.get("bank_name")),
      _accounting_period: s(formData.get("accounting_period")) || "calendar",
      _vat_period: s(formData.get("vat_period")) || "monthly",
      _size_category: s(formData.get("size_category")) || "micro",
      _default_vat_rate: n(formData.get("default_vat_rate")) ?? 23,
      _default_currency: s(formData.get("default_currency")) || "EUR",
      _invoice_prefix:
        s(formData.get("invoice_prefix")) || `FV-${new Date().getFullYear()}-`,
      _invoice_next_number: n(formData.get("invoice_next_number")) ?? 1,
      _default_payment_days: n(formData.get("default_payment_days")) ?? 14,
      _email: s(formData.get("email")),
      _phone: s(formData.get("phone")),
      _website: s(formData.get("website")),
    };

    const existing = await getCompanySettings();

    let instance_id: string;
    if (existing) {
      const res = await datamap.updateInstance({
        instance_id: existing.instance_id,
        json_schema_id: SCHEMA.organization,
        data,
      });
      instance_id = res.instance_id;
    } else {
      const res = await datamap.createInstance({
        json_schema_id: SCHEMA.organization,
        data,
      });
      instance_id = res.instance_id;
    }

    revalidatePath("/settings");
    revalidatePath("/");
    return { ok: true, instance_id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Neznáma chyba pri ukladaní",
    };
  }
}
