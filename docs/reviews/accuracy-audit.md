# Accuracy Audit — CLI vs. Neto API Docs

**Generated:** 2026-04-18
**Method:** Walked every filter key, default OutputSelector, flag-to-field mapping, and enum value used by the nine wired actions in `src/commands/` and `src/lib/`, then cross-checked against `../neto-docs-engineer/docs/`.
**Re-run:** `/review-cli`

---

## Legend

| Symbol | Meaning |
|---|---|
| ✅ | Matches the docs exactly |
| ⚠️ | Drift — not strictly wrong, but inconsistent with docs or CLI internals |
| ❌ | Mismatch — field name / enum value doesn't exist in the API spec |

---

## 1. Products — `GetItem` / `AddItem` / `UpdateItem`

**Files touched:** `src/commands/products.ts`, `src/lib/product-helpers.ts`
**Docs:** `docs/products/{getitem,additem,updateitem}.md`

### Filter keys (`products list / get / export`)

| Used | In docs? | Result |
|---|---|---|
| `SKU` | yes | ✅ |
| `Brand` | yes | ✅ |
| `IsActive` | yes | ✅ |
| `Limit`, `Page` | yes | ✅ |
| `OutputSelector` | yes | ✅ |

### Default OutputSelectors

`DEFAULT_LIST_FIELDS` (`SKU, Name, Brand, DefaultPrice, IsActive, DateUpdated`) and `DEFAULT_GET_FIELDS` (21 entries including `PromotionPrice`, `RRP`, `CostPrice`, `AvailableSellQuantity`, `CommittedQuantity`, `PrimarySupplier`, `Categories`) — **all documented in `docs/products/getitem.md`**. ✅

### `FLAG_MAP` (`src/lib/product-helpers.ts`)

| Flag | API field | In `additem.md`? | Result |
|---|---|---|---|
| `--sku` → `SKU` | yes | ✅ |
| `--name` → `Name` | yes | ✅ |
| `--brand` → `Brand` | yes | ✅ |
| `--model` → `Model` | yes | ✅ |
| `--price` → `DefaultPrice` | yes | ✅ |
| `--cost-price` → `CostPrice` | yes | ✅ |
| `--rrp` → `RRP` | yes | ✅ |
| `--description` → `Description` | yes | ✅ |
| `--short-description` → `ShortDescription` | yes | ✅ |
| `--active` → `IsActive` | yes | ✅ |
| `--visible` → `Visible` | yes | ✅ |
| `--supplier` → `PrimarySupplier` | yes | ✅ |
| `--image-url` → `ImageURL` | yes (String(2083)) | ✅ |

### Special-handling flags

| Flag | Code behaviour | Docs | Result |
|---|---|---|---|
| `--category <id>` | Builds `Categories: [{CategoryID: id}, ...]` | `Categories` is a nested type in `getitem.md` / `additem.md` with `CategoryID` element | ✅ |
| `--quantity <n>` + `--warehouse-id <id>` | Builds nested `WarehouseQuantity: [{WarehouseID, Quantity}]` | Matches `additem.md` `WarehouseQuantity` type (WarehouseID + Quantity required) | ✅ (fixed 2026-04-18) |

> **Fixed:** previously set non-existent `DefaultQuantity`. Now requires `--warehouse-id` alongside `--quantity` and builds the correct nested element per `docs/products/additem.md`.

### `READONLY_FIELDS` (stripped before editor launch)

All 12 entries (`ID`, `InventoryID`, `DateAdded/AddedLocal/AddedUTC`, `DateCreatedLocal/UTC`, `DateUpdated/UpdatedLocal/UpdatedUTC`, `CommittedQuantity`, `AvailableSellQuantity`) appear as OutputSelectors in `getitem.md`. Appropriate to strip — they're server-maintained. ✅

### `EDIT_FIELDS` (47 entries)

Spot-checked against `additem.md`: `SEOPageTitle/Heading/MetaKeywords/MetaDescription`, `ShippingHeight/Length/Width/Weight`, `ItemHeight/Length/Width`, `UPC`, `AccountingCode`, `TaxCategory`, `TaxFreeItem`, `TaxInclusive`, `Group`, `ShippingCategory`, `Misc01`–`Misc05` — all present. ✅

---

## 2. Orders — `GetOrder`

**Files touched:** `src/commands/orders.ts`
**Docs:** `docs/orders-invoices/getorder.md`, `docs/notification-events-webhooks/Order-Notifications.md`

### Filter keys

| Used | In `getorder.md`? | Result |
|---|---|---|
| `OrderID` | yes | ✅ |
| `OrderStatus` | yes | ✅ |
| `DatePlacedFrom` / `DatePlacedTo` | yes | ✅ |
| `Limit`, `Page`, `OutputSelector` | yes | ✅ |

### Default active-status list (lines 70, 160 of `orders.ts`)

CLI default when `--status` is omitted:
```
['New', 'Pick', 'Pack', 'Pending Pickup', 'Pending Dispatch', 'Dispatched', 'On Hold']
```

Canonical enum from `docs/notification-events-webhooks/Order-Notifications.md`:
```
Quote · New · On Hold · New Backorder · Backorder Approved · Pick · Pack ·
Pending Pickup · Pending Dispatch · Dispatched · Cancelled · Uncommitted
```

- All 9 CLI defaults are valid statuses. ✅
- **Fixed 2026-04-18:** `New Backorder` and `Backorder Approved` added to the default list so backorder stores aren't silently filtered out. Only `Quote`, `Cancelled`, and `Uncommitted` remain excluded from the default (terminal / inactive states).

### Default OutputSelectors

`DEFAULT_GET_FIELDS` uses nested selectors `OrderLine.ProductName`, `OrderLine.SKU`, `OrderLine.Quantity`, `OrderLine.UnitPrice`, `OrderPayment.PaymentType`, `OrderPayment.DatePaid`. `getorder.md` shows `OrderLine` and `OrderPayment` as nested types and supports the dot-notation selector syntax. ✅

Also included: `CustomerRef1` — exists in `getorder.md`. ✅

---

## 3. Customers — `GetCustomer`

**Files touched:** `src/commands/customers.ts`
**Docs:** `docs/customers/getcustomer.md`

### Filter keys

| Used | In `getcustomer.md`? | Result |
|---|---|---|
| `Username` | yes | ✅ |
| `ID` | yes | ✅ |
| `Type` | yes | ✅ |
| `Active` | yes | ✅ |
| `Limit`, `Page`, `OutputSelector` | yes | ✅ |

> **Note:** product filter is `IsActive`, customer filter is `Active`. Both are correct per their respective specs — easy to conflate when editing, but the CLI currently keeps them distinct. ✅

### `Type` enum values

CLI help text: "Customer or Prospect". `getcustomer.md` documents exactly these two values. ✅

### Lookup strategy

`customers get <identifier>` tries `Username` first, then falls back to numeric `ID`. Both filters are documented and accept the respective types. ✅

### Default OutputSelectors

All 18 entries in `DEFAULT_GET_FIELDS` (including `Username`, `EmailAddress`, `Company`, `BillingAddress`, `ShippingAddress`, `AccountBalance`, `CreditLimit`, `NewsletterSubscriber`, `DateOfBirth`, `Fax`, `Phone`) appear as OutputSelectors in `getcustomer.md`. ✅

---

## 4. Raw API — `KNOWN_ACTIONS` and `RESPONSE_KEYS`

**Files touched:** `src/commands/api.ts` (`KNOWN_ACTIONS`), `src/lib/client.ts` (`RESPONSE_KEYS`)

### `KNOWN_ACTIONS` completeness

41 entries. Every action in `../neto-docs-engineer/docs/` has a matching entry. ✅

### `RESPONSE_KEYS` completeness

43 entries — every `KNOWN_ACTIONS` entry now has a matching response key. ✅

**Fixed 2026-04-18** — added 6 previously-missing entries:

| Action | Response key | Source |
|---|---|---|
| `AddCustomerLog` | `CustomerLog` | `docs/customers/addcustomerlog.md` — response wraps `<CustomerLog><LogID>` |
| `UpdateCustomerLog` | `CustomerLog` | same |
| `GetAccountingSystemRelatedAccounts` | `RelatedAccount` | `docs/accounting-system/getaccountingsystemrelatedaccounts.md` — response wraps `<RelatedAccounts><RelatedAccount>` |
| `AddAccountingSystemRelatedAccount` | `RelatedAccount` | same convention |
| `UpdateAccountingSystemRelatedAccount` | `RelatedAccount` | same |
| `DeleteAccountingSystemRelatedAccount` | `RelatedAccount` | same |

`neto actions` now groups all six under their correct resource heading.

---

## 5. Rate-limit & auth

**Files touched:** `src/lib/client.ts`
**Docs:** `docs/introductions-and-getting-started/{Authentication.md, Api-Best-Practices.md}`

| Item | CLI | Docs | Result |
|---|---|---|---|
| Endpoint | `POST {store_url}/do/WS/NetoAPI` | same | ✅ |
| Header: `NETOAPI_ACTION` | yes | yes | ✅ |
| Header: `NETOAPI_USERNAME` | yes | yes | ✅ |
| Header: `NETOAPI_KEY` | yes | yes | ✅ |
| Content-Type / Accept | `application/json` | JSON supported when `Accept: application/json` | ✅ |
| Rate limit | 429 → exponential backoff, max 3 attempts (1s/2s/4s) | 500 req/min | ✅ |
| OAuth | not implemented | supported as alternative | — (out of scope for API-key CLI) |

---

## Applied patches (2026-04-18)

All four recommended patches landed in this pass:

1. ✅ **`--quantity` → nested `WarehouseQuantity`** — requires `--warehouse-id`, produces `{WarehouseQuantity: [{WarehouseID, Quantity}]}` matching `additem.md`. See `src/lib/product-helpers.ts` and `src/commands/products.ts` (create + update).
2. ✅ **Backorder defaults** — `New Backorder` and `Backorder Approved` added to the default OrderStatus list in `src/commands/orders.ts`. `--status` help text now enumerates the full canonical set.
3. ✅ **`RESPONSE_KEYS` completeness** — all six missing entries added to `src/lib/client.ts`.
4. ✅ **Comment hygiene** — the stale `DefaultQuantity` comment is gone; the new block points at `docs/products/additem.md` as the source of truth.

No other mismatches found between wired CLI behaviour and the scraped docs as of this pass.
