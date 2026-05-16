"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCompanySettings, SaveState } from "./actions";
import { cn } from "@/lib/utils";

type Props = {
  instanceId?: string;
  initialData: Record<string, unknown>;
};

export function CompanySettingsForm({ instanceId, initialData }: Props) {
  const initial: SaveState | null = null;
  const [state, action, pending] = useActionState(
    saveCompanySettings,
    initial
  );

  // For UI feedback after async save
  const [touched, setTouched] = useState(false);

  const office = (initialData.registered_office ?? {}) as Record<
    string,
    unknown
  >;

  return (
    <form
      action={action}
      onChange={() => setTouched(true)}
      className="space-y-6"
    >
      <Section
        title="Základné údaje"
        description="Identifikácia firmy v obchodnom a daňovom registri."
      >
        <Field
          label="Názov firmy"
          name="name"
          required
          defaultValue={asStr(initialData.name)}
          placeholder="Acme s.r.o."
        />
        <SelectField
          label="Právna forma"
          name="kind"
          defaultValue={asStr(initialData.kind) || "s.r.o."}
          options={[
            { value: "s.r.o.", label: "s.r.o." },
            { value: "a.s.", label: "a.s." },
            { value: "živnosť", label: "živnosť" },
            { value: "družstvo", label: "družstvo" },
            { value: "other", label: "Iné" },
          ]}
        />
        <Field
          label="Obchodné meno (oficiálne)"
          name="legal_name"
          defaultValue={asStr(initialData.legal_name)}
          placeholder="Acme Slovakia s.r.o."
          hint="Ak je iné než pracovný názov. Použije sa na faktúrach."
        />
        <Field
          label="IČO"
          name="registration_number"
          defaultValue={asStr(initialData.registration_number)}
          placeholder="12345678"
          monoFont
        />
        <Field
          label="IČ DPH"
          name="vat_number"
          defaultValue={asStr(initialData.vat_number)}
          placeholder="SK2020123456"
          monoFont
        />
        <Field
          label="DIČ"
          name="tax_id"
          defaultValue={asStr(initialData._tax_id)}
          placeholder="2020123456"
          monoFont
        />
      </Section>

      <Section
        title="Sídlo firmy"
        description="Adresa zapísaná v Obchodnom registri."
      >
        <Field
          label="Ulica a číslo"
          name="street"
          defaultValue={asStr(office.street)}
          placeholder="Hlavná 12"
          span2
        />
        <Field
          label="Mesto"
          name="city"
          defaultValue={asStr(office.city)}
          placeholder="Bratislava"
        />
        <Field
          label="PSČ"
          name="postal_code"
          defaultValue={asStr(office.postal_code)}
          placeholder="811 01"
          monoFont
        />
        <Field
          label="Krajina"
          name="country"
          defaultValue={asStr(office.country) || "SK"}
          placeholder="SK"
          monoFont
        />
      </Section>

      <Section
        title="Bankový účet"
        description="Účet zobrazený na vystavených faktúrach pre úhrady."
      >
        <Field
          label="IBAN"
          name="iban"
          defaultValue={asStr(initialData._iban)}
          placeholder="SK12 3456 7890 1234 5678 9012"
          monoFont
          span2
        />
        <Field
          label="SWIFT / BIC"
          name="swift_bic"
          defaultValue={asStr(initialData._swift_bic)}
          placeholder="TATRSKBX"
          monoFont
        />
        <Field
          label="Názov banky"
          name="bank_name"
          defaultValue={asStr(initialData._bank_name)}
          placeholder="Tatra banka, a.s."
        />
      </Section>

      <Section
        title="Účtovné nastavenia"
        description="Pravidlá ktoré Claude a výkazy DPH použijú automaticky."
      >
        <SelectField
          label="Účtovné obdobie"
          name="accounting_period"
          defaultValue={asStr(initialData._accounting_period) || "calendar"}
          options={[
            { value: "calendar", label: "Kalendárny rok" },
            { value: "fiscal", label: "Hospodársky rok" },
          ]}
        />
        <SelectField
          label="Zdaňovacie obdobie DPH"
          name="vat_period"
          defaultValue={asStr(initialData._vat_period) || "monthly"}
          options={[
            { value: "monthly", label: "Mesačné" },
            { value: "quarterly", label: "Štvrťročné" },
          ]}
        />
        <SelectField
          label="Veľkostná trieda UJ"
          name="size_category"
          defaultValue={asStr(initialData._size_category) || "micro"}
          options={[
            { value: "micro", label: "Mikro" },
            { value: "small", label: "Malá" },
            { value: "large", label: "Veľká" },
          ]}
        />
        <SelectField
          label="Default sadzba DPH"
          name="default_vat_rate"
          defaultValue={asStr(initialData._default_vat_rate) || "23"}
          options={[
            { value: "23", label: "23 % (základná)" },
            { value: "19", label: "19 % (znížená)" },
            { value: "5", label: "5 % (super-znížená)" },
            { value: "0", label: "0 % (oslobodené)" },
          ]}
        />
        <Field
          label="Default mena"
          name="default_currency"
          defaultValue={asStr(initialData._default_currency) || "EUR"}
          placeholder="EUR"
          monoFont
        />
      </Section>

      <Section
        title="Faktúry — séria"
        description="Automatické číslovanie pri vystavovaní faktúr."
      >
        <Field
          label="Prefix čísla faktúry"
          name="invoice_prefix"
          defaultValue={
            asStr(initialData._invoice_prefix) ||
            `FV-${new Date().getFullYear()}-`
          }
          placeholder="FV-2026-"
          monoFont
        />
        <Field
          label="Nasledujúce číslo"
          name="invoice_next_number"
          type="number"
          defaultValue={asStr(initialData._invoice_next_number) || "1"}
          placeholder="1"
          monoFont
        />
        <Field
          label="Default splatnosť (dní)"
          name="default_payment_days"
          type="number"
          defaultValue={asStr(initialData._default_payment_days) || "14"}
          placeholder="14"
          monoFont
        />
      </Section>

      <Section
        title="Kontakt"
        description="Zobrazí sa na faktúrach a v komunikácii s klientmi."
      >
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={asStr(initialData._email)}
          placeholder="firma@example.sk"
          span2
        />
        <Field
          label="Telefón"
          name="phone"
          defaultValue={asStr(initialData._phone)}
          placeholder="+421 900 000 000"
        />
        <Field
          label="Web"
          name="website"
          defaultValue={asStr(initialData._website)}
          placeholder="https://example.sk"
        />
      </Section>

      {/* Footer with save button + feedback */}
      <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-background/95 backdrop-blur border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px]">
          {state?.error && (
            <span className="inline-flex items-center gap-1.5 text-red-700">
              <AlertCircle className="h-3.5 w-3.5" />
              {state.error}
            </span>
          )}
          {state?.ok && !touched && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <Check className="h-3.5 w-3.5" />
              Uložené.{" "}
              {instanceId ? (
                <span className="text-muted-foreground">
                  Aktualizované v Datamap.
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Vytvorená nová inštancia.
                </span>
              )}
            </span>
          )}
          {!state && (
            <span className="text-muted-foreground">
              {instanceId
                ? "Editácia existujúcich firemných údajov."
                : "Vyplň prosím aspoň názov a IČO/IČ DPH."}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={pending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background",
            "disabled:opacity-50 hover:bg-foreground/90 transition-colors"
          )}
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Ukladám…
            </>
          ) : (
            "Uložiť zmeny"
          )}
        </button>
      </div>
    </form>
  );
}

function asStr(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-5 py-4 border-b border-border/60">
        <h2 className="font-serif text-[17px] font-medium leading-tight">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 p-5">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required,
  hint,
  monoFont,
  span2,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
  monoFont?: boolean;
  span2?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", span2 && "sm:col-span-2")}>
      <Label htmlFor={name} className="text-[12px] text-foreground/80">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className={cn(monoFont && "font-mono text-[13px]")}
      />
      {hint && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-[12px] text-foreground/80">
        {label}
      </Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-[13px] shadow-xs transition-colors",
          "focus:border-foreground/30 focus:outline-none",
          "disabled:opacity-50"
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
