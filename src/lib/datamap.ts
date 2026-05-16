const API_URL = process.env.DATAMAP_API_URL!;
const API_KEY = process.env.DATAMAP_API_KEY!;

type Headers = Record<string, string>;

const baseHeaders: Headers = {
  Authorization: `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

async function dmFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...baseHeaders, ...(init.headers as Headers) },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Datamap ${res.status} ${path}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export type Instance = {
  instance_id: string;
  user_id: string;
  user_name: string;
  json_schema_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  global_slug?: string | null;
};

export type ListResponse = {
  instances: Instance[];
  count: number;
};

export type CreateResponse = {
  instance_id: string;
};

export const datamap = {
  health: () => dmFetch<Record<string, unknown>>("/health", { method: "GET" }),

  listInstances: (params: {
    json_schema_id?: string;
    instance_ids?: string[];
    jq_filter?: string;
    search_term?: string;
    owner_scope?: { type: "own" | "all" };
  }) =>
    dmFetch<ListResponse>("/instance/list", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getInstance: async (instance_id: string) => {
    const res = await datamap.listInstances({ instance_ids: [instance_id] });
    return res.instances[0] ?? null;
  },

  createInstance: (params: {
    json_schema_id: string;
    data: Record<string, unknown>;
    global_slug?: string;
  }) =>
    dmFetch<CreateResponse>("/instance/create", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  updateInstance: (params: {
    instance_id: string;
    json_schema_id: string;
    data: Record<string, unknown>;
  }) =>
    dmFetch<CreateResponse>("/instance/update", {
      method: "PUT",
      body: JSON.stringify(params),
    }),

  deleteInstance: (instance_id: string) =>
    dmFetch<void>(`/instance/${instance_id}`, { method: "DELETE" }),

  agenticSearch: (params: {
    search_term: string;
    json_schema_id?: string;
    similarity_threshold?: number;
    max_results_per_method?: number;
  }) =>
    dmFetch<{ text: string; instances: Instance[] }>(
      "/instance/search-agentic-list",
      { method: "POST", body: JSON.stringify(params) }
    ),
};

export const SCHEMA = {
  organization: "schemas/item/abstract/organization.json",
  transaction: "schemas/event/real/transaction.json",
  file: "schemas/item/digital/file.json",
  account: "schemas/object/finance/account.json",
  person: "schemas/person/person.json",
} as const;

export type DocType =
  | "customer"
  | "supplier"
  | "invoice_issued"
  | "invoice_received"
  | "bank_line"
  | "payment"
  | "bank_account"
  | "document";
