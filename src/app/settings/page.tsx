import { PageHeader } from "@/components/page-header";
import { CompanySettingsForm } from "./form";
import { getCompanySettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const company = await getCompanySettings();

  return (
    <div>
      <PageHeader
        eyebrow="Nastavenia"
        title="Firemné nastavenia"
        description="Údaje tvojej firmy. Používajú sa pri vystavovaní faktúr, generovaní výkazov DPH, a Claude ich pozná pri chat interakciách. Uložené v JARVIS Datamap."
        crumbs={[{ label: "Nastavenia" }]}
      />

      <div className="px-6 py-6 max-w-3xl mx-auto">
        <CompanySettingsForm
          instanceId={company?.instance_id}
          initialData={(company?.data as Record<string, unknown>) ?? {}}
        />
      </div>
    </div>
  );
}
