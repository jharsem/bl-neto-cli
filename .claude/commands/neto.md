---
description: Use the neto CLI to read and write data against a Neto/Maropost ecommerce store. Covers all 45 API actions across products, orders, customers, categories, warehouses, suppliers, vouchers, content, RMA, payments, shipping, currency, cart, customer logs, and accounting.
---

# /neto — Neto CLI Agent Reference

Use this skill when you need to interact with a Neto/Maropost store via the CLI. All commands run against the store configured in `~/.neto-cli/config.json`.

## Auth check first

Before any other command, verify the CLI is authenticated:

```bash
neto info
```

If it prints store details, you're good. If not:

```bash
neto auth setup   # interactive — prompts for store URL, username, API key
neto auth status  # show current config
```

---

## Command reference

### Products

```bash
neto products list [--limit 50] [--page 0] [--active True|False] [--all]
neto products get <SKU>
neto products export [--output file.csv]

# Create — required: --name, --sku
neto products create --sku PROD-001 --name "My Product" --price 29.95 --active True
neto products create --from-json products.json          # batch via JSON

# Update
neto products update <SKU> --price 39.95 --active False
neto products update <SKU> --from-json payload.json

# Interactive edit (opens $EDITOR)
neto products edit <SKU>
```

Key create/update flags: `--name`, `--sku`, `--price`, `--rrp`, `--active`, `--brand`, `--category <ID>`, `--quantity <n> --warehouse-id <id>`, `--weight`, `--width`, `--height`, `--depth`, `--field Key=Value`

---

### Orders

```bash
neto orders list [--limit 50] [--status <status>] [--from <dt>] [--to <dt>]
neto orders get <OrderID>              # e.g. N100001
neto orders export [--output file.csv]

# Create — required: --username, --line
neto orders create --username jdoe --line "SKU-001:2:29.95" --line "SKU-002:1"
neto orders create --from-json order.json

# Update
neto orders update <OrderID> --status Dispatched
neto orders update <OrderID> --sku SKU-001 --tracking-number TRACK123 --tracking-shipping-method "Express"
```

Order status values: `New`, `Pick`, `Pack`, `Dispatched`, `Cancelled`, `Quotes`, `On Hold`, `Awaiting Payment`, `Payment Pending`, `Declined`

Key flags: `--username`, `--status`, `--notes`, `--shipping-method`, `--line <SKU:QTY[:PRICE]>`, `--bill-*`, `--ship-*`, `--from-json`

---

### Customers

```bash
neto customers list [--limit 50] [--type Customer|Prospect] [--all]
neto customers get <username|ID>

# Create — required: --username
neto customers create --username jdoe --email j@example.com --first-name Jane --last-name Doe
neto customers create --from-json customers.json

# Update
neto customers update <username> --email newemail@example.com --active False

# Customer log entries
neto customers log add --username <u> --notes "Called re: order" --status "Require Recontact" [--follow-up-type Call] [--follow-up-date "2026-05-01 09:00:00"]
neto customers log update <log-id> --status Completed --notes "Resolved"
```

Status values for log: `Require Recontact`, `Recontacting`, `Completed`

Key address flags: `--street`, `--city`, `--state`, `--postcode`, `--country`, `--bill-*`, `--ship-*`, `--ship-same-as-bill`

---

### Categories

```bash
neto categories list [--active True|False] [--all] [--parent-id <id>]
neto categories get <CategoryID>

# Create — required: --name
neto categories create --name "New Category" [--parent-id <id>] [--active True]

# Update
neto categories update <CategoryID> --name "Renamed" --sort-order 5
```

---

### Warehouses

```bash
neto warehouses list
neto warehouses get <ID|reference>

# Create — required: --reference, --is-primary
neto warehouses create --reference "WH-SYD" --name "Sydney" --is-primary True --is-active True

# Update — --is-primary required by the API even on updates
neto warehouses update <ID> --is-primary True --city "Melbourne"
```

---

### Suppliers

```bash
neto suppliers list [--country AU]
neto suppliers get <SupplierID>

# Create / Update — all fields optional
neto suppliers create --company "ACME Ltd" --email orders@acme.com --country AU
neto suppliers update <SupplierID> --email new@acme.com --lead-time1 7
```

---

### Vouchers

```bash
neto vouchers list [--type Reward|Gift|"Third Party"] [--redeemed True|False] [--owner <email>]
neto vouchers get <VoucherID|code>

# Create — required: --order-id, --sku (voucher product)
neto vouchers create --order-id N100001 --sku GIFT-CARD --recipient-email bob@example.com

# Update — all 4 flags required by the API
neto vouchers update <VoucherID> --email owner@example.com --is-redeemed False --owner owner@example.com

# Redeem — required: --order-id, --date-redeemed
neto vouchers redeem <VoucherID> --order-id N100002 --date-redeemed "2026-04-18 10:00:00" [--redeem-amount 50]
```

---

### Content (CMS pages)

```bash
neto content list [--type <type>] [--active True|False] [--all] [--parent-id <id>]
neto content get <ContentID>

# Create — required: --name, --type
neto content create --name "About Us" --type "2" --active True

# Update
neto content update <ContentID> --name "About Us (Updated)" --seo-title "About Buttery Labs"
```

---

### RMA (Returns)

```bash
neto rma list [--order-id <id>] [--username <u>] [--status Open|Closed]
neto rma get <RmaID>

# Create — 7 required flags + shipping refund tax code
neto rma create \
  --order-id N100001 \
  --invoice-number INV-001 \
  --customer-username jdoe \
  --staff-username admin \
  --po-number PO-001 \
  --notes "Customer returned faulty item" \
  --shipping-refund-tax-code GST \
  [--status Open] [--shipping-refund 0]

# Complex payloads (RmaLines, Refunds) via JSON
neto rma create --from-json rma.json
```

Note: `AddRma` returns an empty response body — no RmaID is returned by the API.

---

### Payments

```bash
neto payments list [--order-id <id>] [--from <dt>] [--to <dt>]
neto payments get <PaymentID>
neto payments methods            # read-only list of payment methods

# Add payment to an order — required: --order-id, --amount, --authorisation
neto payments create --order-id N100001 --amount 99.95 --authorisation "AUTH-12345" --method-name "Bank Deposit"
```

---

### Shipping

```bash
neto shipping methods            # list all active/inactive shipping methods

# Quote — required: --postcode, --country, --city, --state, --po-box + at least one --line
neto shipping quote \
  --postcode 2000 --country AU --city Sydney --state NSW --po-box False \
  --line "SKU-001:1:79.95" [--line "SKU-002:2"]
```

---

### Currency

```bash
neto currency get                # singleton — returns DEFAULTCOUNTRY, DEFAULTCURRENCY, GST_AMT
neto currency update --currency AUD --country AU [--gst-amt 1.1]
```

---

### Cart (abandoned carts — read-only)

```bash
neto cart list [--status Abandoned|Open|Closed] [--all] [--from <dt>] [--to <dt>]
neto cart get <CartID>
```

Default status filter is `Abandoned`. Requires "Abandoned Cart Saver" addon to be enabled on the store.

---

### Accounting

```bash
neto accounting accounts list
neto accounting accounts get <acc_account_id>

# Create
neto accounting accounts create --ref "4-1000" --name "Sales Revenue" --type "Revenue" --class "Income" --active True

# Update
neto accounting accounts update <id> --name "Renamed Account" --active False

# Delete — requires --yes confirmation
neto accounting accounts delete <id> --yes
```

Note: all field names are snake_case (`acc_account_ref`, `acc_account_name`, etc.) matching the Neto API.

---

### Theme (SFTP)

```bash
neto theme list [--all]         # list remote theme files
neto theme pull [theme]         # download theme files locally
neto theme push [theme]         # upload local files to store
neto theme watch [theme]        # watch + auto-push on change
```

---

### Raw API escape hatch

For any action not covered by a dedicated command:

```bash
neto api <Action> [--filter '{"Key":"value"}'] [--filter-file filter.json] [--body '{"Key":"value"}']
neto actions                    # list all known actions grouped by resource
```

---

## Common patterns

### Dry-run before writing
All write commands support `--dry-run` to print the payload without sending:
```bash
neto products create --sku TEST --name "Check me" --dry-run
neto orders update N100001 --status Dispatched --dry-run
```

### JSON output for scripting
All commands support `--json` to return raw API response:
```bash
neto customers list --json | jq '.[].Username'
neto orders get N100001 --json
```

### Batch writes via JSON
All create commands accept `--from-json [path]` for batch payloads:
```bash
# File: products.json → [{"SKU":"A","Name":"..."}, ...]
neto products create --from-json products.json
neto customers create --from-json customers.json
```

### Field override escape hatch
Use `--field Key=Value` (repeatable) to set any API field not exposed as a named flag:
```bash
neto products update SKU-001 --field Classification1=VIP --field UserCustom01=hello
neto customers create --username jdoe --field UserGroup=wholesale
```

### Pagination
```bash
neto products list --limit 100 --page 0
neto products list --limit 100 --page 1
# or use export for full dataset
neto products export --output all-products.csv
```

---

## API behaviour notes

- **Neto signals errors in the response body**, not HTTP status. The CLI checks `Ack: Error` and `Messages.Error` automatically and surfaces them as errors.
- **Rate limit**: 500 requests/minute. The CLI auto-retries on 429 with exponential backoff.
- **At least one filter required**: Neto list endpoints require at least one non-pagination filter field to return results. The CLI sets sensible defaults (e.g. `Active: True`).
- **UpdateWarehouse quirk**: `IsPrimary` is required by the API even on updates — always pass `--is-primary`.
- **UpdateVoucher quirk**: All four fields (`--email`, `--is-redeemed`, `--owner`, positional `<id>`) are required by the API.
- **CustomerLog body shape**: Uses `{CustomerLogs: {CustomerLog: [...]}}` — different from every other resource's `{Resource: [...]}` shape. The CLI handles this internally.
