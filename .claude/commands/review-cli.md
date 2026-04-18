---
description: Regenerate coverage-gaps.md and accuracy-audit.md by cross-referencing the CLI source against the scraped Neto API docs.
---

# /review-cli

Regenerate the two review documents under `docs/reviews/` by comparing the CLI source in this repo against the scraped Neto/Maropost docs that live at `../neto-docs-engineer/docs/` (sibling repo).

## Inputs to read

**CLI source (this repo):**
- `src/index.ts`
- `src/commands/{products,orders,customers,api,auth,theme,info}.ts`
- `src/lib/{client.ts,config.ts,product-helpers.ts,output.ts}`

In particular, extract:
- Every `.command(...)` + `.option(...)` chain (the CLI surface)
- `KNOWN_ACTIONS` array in `src/commands/api.ts`
- `RESPONSE_KEYS` object in `src/lib/client.ts`
- `FLAG_MAP`, `READONLY_FIELDS`, `EDIT_FIELDS` in `src/lib/product-helpers.ts`
- Every `callWithFilter(...)` / `client.call(...)` invocation (action name, filter keys, OutputSelector defaults)
- Any hard-coded enum lists (e.g. the 7-status list in `orders.ts`)

**Docs (sibling repo):**
- Full file tree under `../neto-docs-engineer/docs/` (48 action files across 16 categories)
- `../neto-docs-engineer/docs/introductions-and-getting-started/{Authentication.md,Api-Best-Practices.md,Api-Field-Types.md}`
- `../neto-docs-engineer/docs/notification-events-webhooks/Order-Notifications.md` (canonical OrderStatus enum)

## Outputs to write

1. **`docs/reviews/coverage-gaps.md`** — which of the known Neto actions have a dedicated `neto <command>` vs. escape-hatch-only. One row per action. Follow the existing format:
   - Header with generated date + method + re-run command
   - Legend (✅ / ⚠️ / ❌ / 🔎)
   - Summary table, every known action
   - Tier 1/2/3 missing-command shortlist
   - Read-only vs. write-capable notes
   - Totals line

2. **`docs/reviews/accuracy-audit.md`** — correctness check for the commands that **are** wired. Follow the existing format:
   - Header with generated date + method + re-run command
   - Section per wired action group (products, orders, customers, raw-api, rate-limit/auth)
   - Tables showing each filter key / default selector / flag mapping + ✅/⚠️/❌
   - Closing "Recommended patches" section, ordered by blast radius

## Method

1. **Enumerate the docs tree** — `ls ../neto-docs-engineer/docs/` — treat one `.md` file = one API action (filename is the action name, lowercased, no hyphens).
2. **Enumerate the CLI** — walk `src/commands/*.ts` and extract command shapes, default filters, default OutputSelectors.
3. **Coverage report** — for each action, mark ✅ (dedicated command exists), ⚠️ (reachable only via `neto api`), or ❌ (not in `KNOWN_ACTIONS`).
4. **Accuracy report** — for every wired action (`GetItem / AddItem / UpdateItem / GetOrder / GetCustomer`), read the matching doc file and verify:
   - Filter keys used in `callWithFilter(...)` exist in the doc's filter schema
   - Default OutputSelectors all exist in the doc's OutputSelector list
   - Flag → field mappings (`FLAG_MAP`) use real field names
   - Enum values in the code (e.g. OrderStatus list, `Type: Customer|Prospect`) match the canonical enums in the docs
   - `RESPONSE_KEYS` covers every `KNOWN_ACTIONS` entry with the correct response element name
5. **Cite the docs** — when flagging a mismatch, name the specific doc file (e.g. `docs/products/additem.md`) so the fix is traceable.

## Conventions

- Replace both files wholesale — they're generated artefacts, not hand-maintained.
- Preserve the existing legend/section structure so a diff shows real movement, not formatting churn.
- Keep generated date at the top in `YYYY-MM-DD` format.
- Don't invent priorities — re-use the Tier 1/2/3 grouping already established.
- Do NOT modify any file under `src/` or `../neto-docs-engineer/`. This is a read-only audit.

## When to re-run

Run this after:
- Adding or removing a `neto <command>` / subcommand
- Changing `KNOWN_ACTIONS`, `RESPONSE_KEYS`, `FLAG_MAP`, `READONLY_FIELDS`, or `EDIT_FIELDS`
- Updating any hard-coded default (OutputSelector, OrderStatus list, Customer Type enum)
- Re-scraping `neto-docs-engineer` (new fields/actions may have been added upstream)
