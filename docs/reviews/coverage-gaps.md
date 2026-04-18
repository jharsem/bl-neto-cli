# Coverage Gaps — CLI vs. Neto API

**Generated:** 2026-04-18 (Tier 2 in progress: warehouses, suppliers, categories done)
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
| `AddOrder` | orders-invoices | `orders create` | ✅ | — |
| `UpdateOrder` | orders-invoices | `orders update` | ✅ | — |
| `GetCustomer` | customers | `customers list / get` | ✅ | — |
| `AddCustomer` | customers | `customers create` | ✅ | — |
| `UpdateCustomer` | customers | `customers update` | ✅ | — |
| `GetCategory` | categories | `categories list / get` | ✅ | — |
| `AddCategory` | categories | `categories create` | ✅ | — |
| `UpdateCategory` | categories | `categories update` | ✅ | — |
| `GetVoucher` | voucher | `vouchers list / get` | ✅ | — |
| `AddVoucher` | voucher | `vouchers create` | ✅ | — |
| `UpdateVoucher` | voucher | `vouchers update` | ✅ | — |
| `RedeemVoucher` | voucher | `vouchers redeem` | ✅ | — |
| `GetSupplier` | suppliers | `suppliers list / get` | ✅ | — |
| `AddSupplier` | suppliers | `suppliers create` | ✅ | — |
| `UpdateSupplier` | suppliers | `suppliers update` | ✅ | — |
| `GetWarehouse` | warehouses | `warehouses list / get` | ✅ | — |
| `AddWarehouse` | warehouses | `warehouses create` | ✅ | — |
| `UpdateWarehouse` | warehouses | `warehouses update` | ✅ | — |
| `GetContent` | content | `content list / get` | ✅ | — |
| `AddContent` | content | `content create` | ✅ | — |
| `UpdateContent` | content | `content update` | ✅ | — |
| `GetRma` | rma | `rma list / get` | ✅ | — |
| `AddRma` | rma | `rma create` | ✅ | — |
| `GetPayment` | payments | `payments list / get` | ✅ | — |
| `AddPayment` | payments | `payments create` | ✅ | — |
| `GetPaymentMethods` | payments | `payments methods` | ✅ 🔎 | — |
| `GetShippingMethods` | shipping | `shipping methods` | ✅ 🔎 | — |
| `GetShippingQuote` | shipping | `shipping quote` | ✅ 🔎 | — |
| `GetCurrencySettings` | currency | `currency get` | ✅ 🔎 | — |
| `UpdateCurrencySettings` | currency | `currency update` | ✅ | — |
| `GetCart` | abandoned-cart | `cart list / get` | ✅ 🔎 | — |
| `AddCustomerLog` | customers | `customers log add` | ✅ | — |
| `UpdateCustomerLog` | customers | `customers log update` | ✅ | — |
| `GetAccountingSystemRelatedAccounts` | accounting-system | `accounting accounts list / get` | ✅ 🔎 | — |
| `AddAccountingSystemRelatedAccount` | accounting-system | `accounting accounts create` | ✅ | — |
| `UpdateAccountingSystemRelatedAccount` | accounting-system | `accounting accounts update` | ✅ | — |
| `DeleteAccountingSystemRelatedAccount` | accounting-system | `accounting accounts delete` | ✅ | — |

**Totals:** 45 ✅ dedicated · 0 ⚠️ escape-hatch-only · 0 ❌ missing from `KNOWN_ACTIONS` · 6 🔎 read-only resources

---

## Missing-command shortlist

### Tier 1 — complete existing CRUD (quick wins) — **DONE**

Parity with `products`, using the same patterns:

- ✅ **`neto customers create`** (`AddCustomer`) — done 2026-04-18
- ✅ **`neto customers update <username>`** (`UpdateCustomer`) — done 2026-04-18
- ✅ **`neto orders create`** (`AddOrder`) — done 2026-04-18. Ergonomic flags for core fields + addresses, `--line SKU:QTY[:PRICE]` repeatable shorthand, `--from-json` for complex OrderLine payloads.
- ✅ **`neto orders update <id>`** (`UpdateOrder`) — done 2026-04-18. Status/tracking/notes flags; tracking attaches to OrderLine via `--sku` + `--tracking-number` + `--tracking-shipping-method`.

**Shared helper:** `buildPayload(flagMap, opts)` in [src/lib/payload-helpers.ts](../../src/lib/payload-helpers.ts) — reused by customers, orders, and ready for every Tier 2 resource.

### Tier 2 — commonly-used resources (real user demand)

- **`neto categories list / get / create / update`** — taxonomy work
- ✅ **`neto vouchers list / get / create / update / redeem`** — done 2026-04-18. `redeem` is unique — maps to `RedeemVoucher`, requires `--order-id` + `--date-redeemed`. `update` requires all 4 API fields (VoucherID, Email, IsRedeemed, Owner).
- **`neto suppliers list / get / create / update`** — supplier maintenance
- **`neto warehouses list / get / create / update`** — multi-warehouse stores

### Tier 3 — niche / low-traffic — **DONE**

- ✅ **`neto content list / get / create / update`** — done 2026-04-18
- ✅ **`neto rma list / get / create`** — done 2026-04-18. No Update per docs. AddRma returns empty response body (no RmaID).
- ✅ **`neto payments list / get / create`** + **`neto payments methods`** — done 2026-04-18
- ✅ **`neto shipping methods`** + **`neto shipping quote`** — done 2026-04-18. Quote takes `--line SKU:QTY[:PRICE]` repeatable flags.
- ✅ **`neto currency get / update`** — done 2026-04-18. Singleton resource, no list.
- ✅ **`neto cart list / get`** — done 2026-04-18. `list` defaults to Abandoned; `--all` returns all statuses.
- ✅ **`neto customers log add / update`** — done 2026-04-18. Body shape `{ CustomerLogs: { CustomerLog: [...] } }` — distinct from other resources.
- ✅ **`neto accounting accounts list / get / create / update / delete`** — done 2026-04-18. First resource with `delete`; uses `--yes` confirmation flag. All fields are snake_case per the API.

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
