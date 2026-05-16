import { datamap, Instance, SCHEMA } from "./datamap";

export type AccountingDocType =
  | "customer"
  | "supplier"
  | "invoice_issued"
  | "invoice_received"
  | "bank_line"
  | "payment"
  | "bank_account"
  | "document";

function startOfMonth(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth(), 1);
  return m.toISOString().slice(0, 10);
}
function endOfMonth(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return m.toISOString().slice(0, 10);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export const filters = {
  byDocType: (docType: AccountingDocType) =>
    `.[] | select(._doc_type == "${docType}")`,
  invoiceIssuedMTD: () =>
    `.[] | select(._doc_type == "invoice_issued" and .date >= "${startOfMonth()}" and .date <= "${endOfMonth()}")`,
  invoiceReceivedMTD: () =>
    `.[] | select(._doc_type == "invoice_received" and .date >= "${startOfMonth()}" and .date <= "${endOfMonth()}")`,
  unpaidIssued: () =>
    `.[] | select(._doc_type == "invoice_issued" and .payment_status != "completed")`,
  overdueIssued: () =>
    `.[] | select(._doc_type == "invoice_issued" and .payment_status != "completed" and .due_date < "${todayISO()}")`,
};

async function listAccounting(
  schema: keyof typeof SCHEMA,
  docType: AccountingDocType
) {
  const res = await datamap.listInstances({
    json_schema_id: SCHEMA[schema],
    jq_filter: filters.byDocType(docType),
    owner_scope: { type: "own" },
  });
  return res.instances;
}

export const queries = {
  customers: () => listAccounting("organization", "customer"),
  suppliers: () => listAccounting("organization", "supplier"),
  invoicesIssued: () => listAccounting("transaction", "invoice_issued"),
  invoicesReceived: () => listAccounting("transaction", "invoice_received"),
  bankLines: () => listAccounting("transaction", "bank_line"),
  documents: () => listAccounting("file", "document"),

  invoicesIssuedMTD: async () => {
    const res = await datamap.listInstances({
      json_schema_id: SCHEMA.transaction,
      jq_filter: filters.invoiceIssuedMTD(),
    });
    return res.instances;
  },
  invoicesReceivedMTD: async () => {
    const res = await datamap.listInstances({
      json_schema_id: SCHEMA.transaction,
      jq_filter: filters.invoiceReceivedMTD(),
    });
    return res.instances;
  },
  unpaidIssued: async () => {
    const res = await datamap.listInstances({
      json_schema_id: SCHEMA.transaction,
      jq_filter: filters.unpaidIssued(),
    });
    return res.instances;
  },
  overdueIssued: async () => {
    const res = await datamap.listInstances({
      json_schema_id: SCHEMA.transaction,
      jq_filter: filters.overdueIssued(),
    });
    return res.instances;
  },
};

export type Money = { amount: number; currency: string };

function num(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return parseFloat(x) || 0;
  return 0;
}

export function sumAmount(instances: Instance[], field = "amount") {
  return instances.reduce((s, i) => s + num(i.data[field]), 0);
}

export type Kpi = {
  revenueMTD: number;
  expensesMTD: number;
  profitMTD: number;
  invoicesIssuedCountMTD: number;
  invoicesReceivedCountMTD: number;
  unpaidCount: number;
  unpaidAmount: number;
  overdueCount: number;
  overdueAmount: number;
  customersCount: number;
  suppliersCount: number;
};

export async function getDashboardKpis(): Promise<Kpi> {
  const [issuedMTD, receivedMTD, unpaid, overdue, customers, suppliers] =
    await Promise.all([
      queries.invoicesIssuedMTD(),
      queries.invoicesReceivedMTD(),
      queries.unpaidIssued(),
      queries.overdueIssued(),
      queries.customers(),
      queries.suppliers(),
    ]);

  const revenueMTD = sumAmount(issuedMTD);
  const expensesMTD = sumAmount(receivedMTD);

  return {
    revenueMTD,
    expensesMTD,
    profitMTD: revenueMTD - expensesMTD,
    invoicesIssuedCountMTD: issuedMTD.length,
    invoicesReceivedCountMTD: receivedMTD.length,
    unpaidCount: unpaid.length,
    unpaidAmount: sumAmount(unpaid),
    overdueCount: overdue.length,
    overdueAmount: sumAmount(overdue),
    customersCount: customers.length,
    suppliersCount: suppliers.length,
  };
}

export function fmtEur(n: number) {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(d);
}

export function fmtRelative(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "pred chvíľou";
  if (diff < 3600) return `pred ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `pred ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `pred ${Math.floor(diff / 86400)} d`;
  return fmtDate(iso);
}
