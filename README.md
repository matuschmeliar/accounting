# Účtovný AI MVP

AI-first účtovný softvér pre slovenské s.r.o., postavený na JARVIS Datamap. Single-firm demo.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind 4
- **Vercel AI SDK v6** s Anthropic provider (`claude-opus-4-7`)
- **JARVIS Datamap** ako single source of truth (faktúry, klienti, transakcie, dokumenty)
- Deploy: **Vercel**

## Architektúra

```
Next.js UI ──▶ /api/chat (streamText + tools) ──▶ Claude Opus 4.7
                       │
                       └─▶ Datamap API (instances/relationships)
```

Datamap mapping (trojan horse cez existujúce schémy + `_` prefix custom polia):

| Účtovná entita | Datamap schéma | Discriminator |
|---|---|---|
| Customer / Supplier | `schemas/item/abstract/organization.json` | `_doc_type: "customer"` / `"supplier"` |
| Faktúra vystavená | `schemas/event/real/transaction.json` | `kind: "predaj"`, `_doc_type: "invoice_issued"` |
| Faktúra prijatá | `schemas/event/real/transaction.json` | `kind: "nákup"`, `_doc_type: "invoice_received"` |
| Bank line | `schemas/event/real/transaction.json` | `kind: "platba"/"prevod"`, `_doc_type: "bank_line"` |
| PDF dokument | `schemas/item/digital/file.json` | `_doc_type: "document"` |
| Bankový účet | `schemas/object/finance/account.json` | — |

Vzťahy ako FK polia (`_customer_id`, `_matched_invoice_id`), join cez `jq_filter`.

## Lokálne spustenie

```bash
cp .env.example .env.local
# Doplň DATAMAP_API_KEY, ANTHROPIC_API_KEY, APP_PASSWORD
npm install
npm run dev
```

Otvor `http://localhost:3000`, login: user `demo` + heslo z `APP_PASSWORD`.

## Deploy na Vercel

1. Push do GitHub
2. Vercel → New Project → import repo
3. Pridaj env vars (DATAMAP_API_URL, DATAMAP_API_KEY, ANTHROPIC_API_KEY, APP_PASSWORD)
4. Deploy

## Tools dostupné Claude

- `list_instances` — list/filter cez jq
- `create_instance` — nová inštancia
- `update_instance` — replace existujúcej
- `delete_instance` — hard delete (radšej `_doc_type: "cancelled"`)
- `agentic_search` — semantic search nad Datamap
- `compute_vat` — deterministický výpočet DPH

## Známe obmedzenia MVP

- Bez native Neo4j relationships pre účtovné entity (workaround: FK polia)
- Bez audit history (cez `created_at`/`updated_at` + tool-call log later)
- Bez aggregations server-side (klient stiahne celý zoznam, sumarizuje v BFF)
- Hard-coded sadzby DPH 2026 (5/19/23/0)
