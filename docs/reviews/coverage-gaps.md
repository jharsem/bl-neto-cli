# Coverage Gaps — CLI vs. Neto API

**Generated:** 2026-04-18 (Tier 1: customers done)
**Method:** Cross-reference of `src/commands/*.ts` and `src/commands/api.ts` (`KNOWN_ACTIONS`) against `../neto-docs-engineer/docs/` (48 scraped action docs).
**Re-run:** `/review-cli`

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Dedicated `neto <command>` — first-class flags, table output, sensible defaults |
| ⚠️ | Reachable only via `neto api <Action>` escape hatch (JSON-in, JSON-out) |
| ❌ | Not wired at all — not even in `KNOWN_ACTIONS` |
| 🔎 | Read-only resource (no Add/Update in the API) |

---

## Summary table (all known Neto API actions)

| Action | Category | CLI surface | Status | Priority |
|---|---|---|---|---|
| `GetItem` | products | `products list / get / export / edit` | ✅ | — |
| `AddItem` | products | `products create` | ✅ | — |
| `UpdateItem` | products | `products update / edit` | ✅ | — |
| `GetOrder` | orders-invoices | `orders list / get / export` | ✅ | — |
| `AddOrder` | orders-invoices | escape-hatch | ⚠️ | **Tier 1** |
| `UpdateOrder` | orders-invoices | escape-hatch | ⚠️ | **Tier 1** |
| `GetCustomer` | customers | `customers list / get` | ✅ | — |
| `AddCustomer` | customers | `customers create` | ✅ | — |
| `UpdateCustomer` | customers | `customers update` | ✅ | — |
| `GetCategory` | categories | escape-hatch | ⚠️ | **Tier 2** |
| `AddCategory` | categories | escape-hatch | ⚠️ | **Tier 2** |
| `UpdateCategory` | categories | escape-hatch | ⚠️ | **Tier 2** |
| `GetVoucher` | voucher | escape-hatch | ⚠️ | **Tier 2** |
| `AddVoucher` | voucher | escape-hatch | ⚠️ | **Tier 2** |
| `UpdateVoucher` | voucher | escape-hatch | ⚠️ | **Tier 2** |
| `RedeemVoucher` | voucher | escape-hatch | ⚠️ | **Tier 2** |
| `GetSupplier` | suppliers | escape-hatch | ⚠️ | **Tier 2** |
| `AddSupplier` | suppliers | escape-hatch | ⚠️ | **Tier 2** |
| `UpdateSupplier` | suppliers | escape-hatch | ⚠️ | **Tier 2** |
| `GetWarehouse` | warehouses | escape-hatch | ⚠️ | **Tier 2** |
| `AddWarehouse` | warehouses | escape-hatch | ⚠️ | **Tier 2** |
| `UpdateWarehouse` | warehouses | escape-hatch | ⚠️ | **Tier 2** |
| `GetContent` | content | escape-hatch | ⚠️ | Tier 3 |
| `AddContent` | content | escape-hatch | ⚠️ | Tier 3 |
| `UpdateContent` | content | escape-hatch | ⚠️ | Tier 3 |
| `GetRma` | rma | escape-hatch | ⚠️ | Tier 3 |
| `AddRma` | rma | escape-hatch | ⚠️ | Tier 3 |
| `GetPayment` | payments | escape-hatch | ⚠️ | Tier 3 |
| `AddPayment` | payments | escape-hatch | ⚠️ | Tier 3 |
| `GetPaymentMethods` | payments | escape-hatch | ⚠️ 🔎 | Tier 3 |
| `GetShippingMethods` | shipping | escape-hatch | ⚠️ 🔎 | Tier 3 |
| `GetShippingQuote` | shipping | escape-hatch | ⚠️ 🔎 | Tier 3 |
| `GetCurrencySettings` | currency | escape-hatch | ⚠️ 🔎 | Tier 3 |
| `UpdateCurrencySettings` | currency | escape-hatch | ⚠️ | Tier 3 |
| `GetCart` | abandoned-cart | escape-hatch | ⚠️ 🔎 | Tier 3 |
| `AddCustomerLog` | customers | escape-hatch | ⚠️ | Tier 3 |
| `UpdateCustomerLog` | customers | escape-hatch | ⚠️ | Tier 3 |
| `GetAccountingSystemRelatedAccounts` | accounting-system | escape-hatch | ⚠️ 🔎 | Tier 3 |
| `AddAccountingSystemRelatedAccount` | accounting-system | escape-hatch | ⚠️ | Tier 3 |
| `UpdateAccountingSystemRelatedAccount` | accounting-system | escape-hatch | ⚠️ | Tier 3 |
| `DeleteAccountingSystemRelatedAccount` | accounting-system | escape-hatch | ⚠️ | Tier 3 |

**Totals:** 11 ✅ dedicated · 30 ⚠️ escape-hatch-only · 0 ❌ missing from `KNOWN_ACTIONS` · 6 🔎 read-only resources

---

## Missing-command shortlist

### Tier 1 — complete existing CRUD (quick wins)

Parity with `products`, using the same patterns:

- ✅ **`neto customers create`** (`AddCustomer`) — done 2026-04-18
- ✅ **`neto customers update <username>`** (`UpdateCustomer`) — done 2026-04-18
- **`neto orders create`** (`AddOrder`) — minimal flags + `--from-json` (order payloads are complex; JSON-first is fine)
- **`neto orders update <id>`** (`UpdateOrder`) — `--status`, `--tracking`, `--from-json`, `--dry-run`

**Shared helper landed:** `buildPayload(flagMap, opts)` now lives in [src/lib/payload-helpers.ts](../../src/lib/payload-helpers.ts) — orders and all Tier 2 resources can build on it.

### Tier 2 — commonly-used resources (real user demand)

- **`neto categories list / get / create / update`** — taxonomy work
- **`neto vouchers list / get / create / update / redeem`** — voucher management (`RedeemVoucher` is the interesting one; no equivalent in other resources)
- **`neto suppliers list / get / create / update`** — supplier maintenance
- **`neto warehouses list / get / create / update`** — multi-warehouse stores

### Tier 3 — niche / low-traffic

- **`neto content list / get / create / update`** — CMS pages
- **`neto rma list / get / create`** — returns (no Update per docs)
- **`neto payments list / get / create`** + **`neto payments methods`** (read-only)
- **`neto shipping methods`** + **`neto shipping quote`** (both read-only, quote takes a cart payload)
- **`neto currency get / update`** (singleton — no list)
- **`neto cart get <sessionid>`** (read-only abandoned-cart lookup)
- **`neto customers log add / update`** — interaction notes on a customer
- **`neto accounting accounts list / create / update / delete`** — ERP integration

---

## Read-only vs. write-capable

| Resource | Reads only | Full CRUD | Notes |
|---|---|---|---|
| `GetPaymentMethods` | 🔎 | — | Enumeration — no create/update |
| `GetShippingMethods` | 🔎 | — | Enumeration — no create/update |
| `GetShippingQuote` | 🔎 | — | Calculation — no persisted state |
| `GetCurrencySettings` | 🔎 | UpdateCurrencySettings exists | Singleton — no `list`, no `add` |
| `GetCart` | 🔎 | — | Abandoned-cart inspection — no cart mutation via API |
| `GetAccountingSystemRelatedAccounts` | 🔎 | Add/Update/Delete exist | Only resource with a documented `Delete*` action |

Everything else follows the standard `Get*` / `Add*` / `Update*` triad (with the exception of `RedeemVoucher`, which is an action verb rather than a mutation).

---

## Notes for future expansion

- **`Delete*` actions** — the CLI doesn't handle any deletion pattern yet. When adding `neto accounting accounts delete`, establish a deletion confirmation pattern (`--yes` to bypass) that future resources (if Neto adds any) can reuse.
- **Nested input objects** — `AddOrder` and `AddCustomer` use nested address/line-item blocks. `--from-json` is the pragmatic first pass; bespoke flags can follow if usage data shows demand.
- **`Add*` batch support** — `products create` already accepts `{Item: [...]}` batches via `--from-json`. Keep that shape for every new write command.
- **Missing from `KNOWN_ACTIONS`** — none. The list already covers every action documented in `neto-docs-engineer/docs/`.
