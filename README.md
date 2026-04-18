# Neto CLI

A command-line tool for the [Neto/Maropost](https://www.netohq.com/) ecommerce platform. Manage products, orders, customers, and themes from your terminal.

## Installation

```bash
# Requires Node.js 18+
npm install
npm run build
npm link    # makes `neto` available globally
```

## Quick Start

```bash
# 1. Configure your store credentials
neto auth setup

# 2. Test the connection
neto info

# 3. Start using it
neto products list
neto orders list --status New
neto theme pull storefront
```

---

## Commands

### `neto auth`

Configure API and SFTP credentials. All credentials are stored in `~/.neto-cli/config.json`.

#### `neto auth setup`

Set up store API credentials. Runs interactively, or pass all flags for non-interactive use.

| Option | Description |
|---|---|
| `--store-url <url>` | Store URL (e.g. `https://mystore.neto.com.au`) |
| `--api-key <key>` | Neto API key |
| `--username <user>` | Neto API username |

```bash
# Interactive
neto auth setup

# Non-interactive
neto auth setup --store-url https://mystore.neto.com.au --api-key YOUR_KEY --username YOUR_USER
```

#### `neto auth status`

Display current configuration (API key is masked).

#### `neto auth clear`

Remove all stored credentials (with confirmation prompt).

#### `neto auth sftp`

Configure SFTP credentials for theme management. Runs interactively, or pass all flags.

| Option | Description | Default |
|---|---|---|
| `--host <host>` | SFTP hostname | `sftp.neto.com.au` |
| `--port <port>` | SFTP port | `1022` |
| `--sftp-user <user>` | SFTP username | *(required)* |
| `--sftp-pass <pass>` | SFTP password | *(required)* |
| `--remote-path <path>` | Remote themes directory | `/httpdocs/assets/themes` |

```bash
# Interactive
neto auth sftp

# Non-interactive
neto auth sftp --sftp-user myuser --sftp-pass mypass --host sftp.neto.net.au --port 2022
```

---

### `neto info`

Show store configuration and test API connectivity.

```bash
neto info
```

---

### `neto products`

#### `neto products list`

List products in a table.

| Option | Description | Default |
|---|---|---|
| `--limit <n>` | Number of results | `50` |
| `--page <n>` | Page number (0-indexed) | `0` |
| `--fields <fields>` | Comma-separated OutputSelector fields | `SKU,Name,Brand,DefaultPrice,IsActive,DateUpdated` |
| `--brand <brand>` | Filter by brand | |
| `--active <bool>` | Filter by active status | `True` |
| `--all` | Include inactive products (overrides `--active`) | |
| `--json` | Output as JSON | |

```bash
neto products list
neto products list --limit 10 --brand "Apple"
neto products list --all --json
neto products list --fields SKU,Name,DefaultPrice,AvailableSellQuantity
```

#### `neto products get <sku>`

Get detailed information for a single product.

| Option | Description | Default |
|---|---|---|
| `--fields <fields>` | Comma-separated OutputSelector fields | `SKU,ParentSKU,ID,Name,Brand,Model,DefaultPrice,PromotionPrice,RRP,CostPrice,IsActive,Approved,Visible,Description,ShortDescription,AvailableSellQuantity,CommittedQuantity,DateAdded,DateUpdated,PrimarySupplier,Categories` |
| `--json` | Output as JSON | |

```bash
neto products get 215083
neto products get 215083 --json
neto products get 215083 --fields SKU,Name,DefaultPrice,Description
```

#### `neto products export`

Export all products as JSON, automatically paginating through all results.

| Option | Description | Default |
|---|---|---|
| `--fields <fields>` | Comma-separated OutputSelector fields | *(same as list defaults)* |
| `--active <bool>` | Filter by active status | `True` |
| `--all` | Include inactive products | |
| `--batch-size <n>` | Products fetched per API call | `100` |

```bash
neto products export > products.json
neto products export --all --fields SKU,Name,DefaultPrice,AvailableSellQuantity > all-products.json
```

#### `neto products create`

Create a new product. Supports common flags for frequently-used fields, `--field Key=Value` for any of the 192 API fields, or `--from-json` for full JSON control.

| Option | Description | Default |
|---|---|---|
| `--sku <sku>` | Product SKU (required unless `--from-json`) | |
| `--name <name>` | Product name | |
| `--brand <brand>` | Brand | |
| `--model <model>` | Model | |
| `--price <price>` | Default price | |
| `--cost-price <price>` | Cost price | |
| `--rrp <price>` | Recommended retail price | |
| `--description <desc>` | Full description | |
| `--short-description <desc>` | Short description | |
| `--active <bool>` | Is active | `True` |
| `--visible <bool>` | Is visible | `True` |
| `--category <id>` | Category ID (repeatable) | |
| `--supplier <name>` | Primary supplier | |
| `--quantity <n>` | Stock quantity | |
| `--image-url <url>` | Primary image URL | |
| `--field <Key=Value>` | Set any API field (repeatable) | |
| `--from-json [path]` | Read from JSON file or stdin | |
| `--dry-run` | Show payload without sending | |
| `--json` | Output response as JSON | |

```bash
# Simple create
neto products create --sku WIDGET-001 --name "Widget" --price 29.95 --brand "Acme"

# With extra fields
neto products create --sku WIDGET-001 --name "Widget" --price 29.95 --field Misc01="Custom" --field TaxCategory="GST"

# From JSON file
neto products create --from-json product.json

# From stdin
echo '{"SKU":"WIDGET-001","Name":"Widget","DefaultPrice":"29.95"}' | neto products create --from-json

# Preview without sending
neto products create --sku WIDGET-001 --name "Widget" --price 29.95 --dry-run
```

#### `neto products update <sku>`

Update an existing product. Same flags as create (all optional), with SKU provided as argument.

| Option | Description |
|---|---|
| `--name <name>` | Product name |
| `--brand <brand>` | Brand |
| `--model <model>` | Model |
| `--price <price>` | Default price |
| `--cost-price <price>` | Cost price |
| `--rrp <price>` | Recommended retail price |
| `--description <desc>` | Full description |
| `--short-description <desc>` | Short description |
| `--active <bool>` | Is active |
| `--visible <bool>` | Is visible |
| `--category <id>` | Category ID (repeatable) |
| `--supplier <name>` | Primary supplier |
| `--quantity <n>` | Stock quantity |
| `--image-url <url>` | Primary image URL |
| `--field <Key=Value>` | Set any API field (repeatable) |
| `--from-json [path]` | Read from JSON file or stdin |
| `--dry-run` | Show payload without sending |
| `--json` | Output response as JSON |

```bash
# Update price
neto products update WIDGET-001 --price 34.95

# Update multiple fields
neto products update WIDGET-001 --price 34.95 --name "Widget Pro" --field ShortDescription="Now improved"

# Preview changes
neto products update WIDGET-001 --price 34.95 --dry-run
```

#### `neto products edit <sku>`

Open a product in your `$EDITOR` for interactive editing. Fetches the product, opens it as JSON, computes the diff, and sends only changed fields.

| Option | Description | Default |
|---|---|---|
| `--fields <fields>` | Comma-separated fields to fetch | *(broad default set)* |
| `--json` | Output the update payload instead of sending | |

```bash
neto products edit WIDGET-001
EDITOR=code neto products edit WIDGET-001   # open in VS Code
```

---

### `neto orders`

#### `neto orders list`

List orders in a table. Defaults to showing orders with active statuses (New, Pick, Pack, Pending Pickup, Pending Dispatch, Dispatched, On Hold).

| Option | Description | Default |
|---|---|---|
| `--limit <n>` | Number of results | `50` |
| `--page <n>` | Page number (0-indexed) | `0` |
| `--fields <fields>` | Comma-separated OutputSelector fields | `OrderID,Username,Email,GrandTotal,OrderStatus,DatePlaced,ShippingOption` |
| `--status <status>` | Filter by single order status | *(all active statuses)* |
| `--date-from <date>` | Orders placed from date (YYYY-MM-DD) | |
| `--date-to <date>` | Orders placed to date (YYYY-MM-DD) | |
| `--json` | Output as JSON | |

Valid statuses: `Quote`, `New`, `On Hold`, `New Backorder`, `Backorder Approved`, `Pick`, `Pack`, `Pending Pickup`, `Pending Dispatch`, `Dispatched`, `Cancelled`, `Uncommitted`

```bash
neto orders list
neto orders list --status New --limit 20
neto orders list --date-from 2025-01-01 --date-to 2025-12-31
neto orders list --json
```

#### `neto orders get <id>`

Get detailed information for a single order.

| Option | Description | Default |
|---|---|---|
| `--fields <fields>` | Comma-separated OutputSelector fields | `OrderID,Username,Email,GrandTotal,TaxTotal,ShippingTotal,OrderStatus,OrderType,DatePlaced,DatePaid,DateInvoiced,ShippingOption,DeliveryInstruction,BillAddress,ShipAddress,OrderLine,OrderLine.ProductName,OrderLine.SKU,OrderLine.Quantity,OrderLine.UnitPrice,OrderPayment,OrderPayment.PaymentType,OrderPayment.DatePaid,SalesChannel,CustomerRef1` |
| `--json` | Output as JSON | |

```bash
neto orders get N11003
neto orders get N11003 --json
```

#### `neto orders export`

Export all orders as JSON, automatically paginating.

| Option | Description | Default |
|---|---|---|
| `--fields <fields>` | Comma-separated OutputSelector fields | *(same as list defaults)* |
| `--status <status>` | Filter by order status | *(all active statuses)* |
| `--date-from <date>` | Orders placed from date (YYYY-MM-DD) | |
| `--date-to <date>` | Orders placed to date (YYYY-MM-DD) | |
| `--batch-size <n>` | Orders fetched per API call | `100` |

```bash
neto orders export > orders.json
neto orders export --status Dispatched --date-from 2025-01-01 > dispatched-2025.json
```

#### `neto orders create`

Create a new order. `--email`, `--bill-company`, and at least one `--line SKU:QTY` are required (the Neto API also requires `ShipCompany`; use `--ship-same-as-bill` or `--ship-company`). Use `--from-json` for complex OrderLine payloads (ExtraOptions, KitComponents, warehouse targeting).

Key options:

| Option | Description |
|---|---|
| `--email <addr>` | Customer email (required) |
| `--username <u>` | Existing customer username |
| `--bill-company <c>`, `--bill-first-name`, `--bill-last-name`, `--bill-street`, `--bill-street2`, `--bill-city`, `--bill-state`, `--bill-postcode`, `--bill-country`, `--bill-phone` | Billing address |
| `--ship-same-as-bill` | Copy every `Bill*` field to its `Ship*` equivalent |
| `--ship-company`, `--ship-street`, … | Shipping address overrides (same shape) |
| `--line <SKU:QTY[:PRICE]>` | Order line (repeatable) |
| `--order-type <t>` | `sales`, `dropshipping`, or `quote` |
| `--order-status <s>` | Initial status (e.g. `New`, `Pick`) |
| `--payment-method <m>`, `--shipping-method <m>`, `--shipping-cost <n>` | |
| `--currency-code <c>` | 3-letter currency code |
| `--date-placed <dt>`, `--date-required <dt>` | |
| `--field <Key=Value>` | Set any documented Order field (repeatable) |
| `--from-json [path]` | Read one or more orders from JSON file or stdin |
| `--dry-run` | Print the payload without calling the API |

```bash
neto orders create \
  --email jane@example.com --bill-company Acme \
  --bill-first-name Jane --bill-last-name Doe \
  --bill-street "1 Main St" --bill-city Sydney --bill-country AU \
  --ship-same-as-bill \
  --line SKU-1:2 --line SKU-2:1:9.99 \
  --order-type sales --dry-run

neto orders create --from-json order.json
```

#### `neto orders update <id>`

Update an existing order. Typical flows: change status, attach tracking, edit notes.

| Option | Description |
|---|---|
| `--order-status <s>` | New status (e.g. `Dispatched`, `Cancelled`) |
| `--send-order-email <t>` | `tracking` or `receipt` — send email after update |
| `--sku <sku>` | Target OrderLine SKU for tracking details |
| `--tracking-number <n>` | Tracking number (attached to the OrderLine) |
| `--tracking-shipping-method <m>` | Shipping method for tracking (must match a Neto shipping service) |
| `--date-shipped <dt>` | DateShipped for the tracking block |
| `--pick-status <s>`, `--export-status <s>`, `--deduce-warehouse <bool>` | Fulfilment flags |
| `--bill-*` / `--ship-*` / `--ship-same-as-bill` | Edit addresses |
| `--ship-instructions`, `--internal-order-notes`, `--sticky-note`, `--sticky-note-title` | |
| `--field <Key=Value>` | Any other Order field |
| `--from-json [path]` | Replace the whole payload from JSON |
| `--dry-run` | Print without sending |

```bash
# Mark dispatched with tracking and email the customer
neto orders update N1000 \
  --order-status Dispatched \
  --sku ABC-123 \
  --tracking-number C123345 \
  --tracking-shipping-method "Australia Post eParcel" \
  --date-shipped "2026-04-18 10:00:00" \
  --send-order-email tracking

# Quick status change
neto orders update N1000 --order-status "On Hold"
```

---

### `neto customers`

#### `neto customers list`

List customers in a table.

| Option | Description | Default |
|---|---|---|
| `--limit <n>` | Number of results | `50` |
| `--page <n>` | Page number (0-indexed) | `0` |
| `--fields <fields>` | Comma-separated OutputSelector fields | `Username,ID,EmailAddress,FirstName,LastName,Type,Active,DateAdded` |
| `--type <type>` | Filter by type (`Customer` or `Prospect`) | |
| `--active <bool>` | Filter by active status | `True` |
| `--all` | Include inactive customers | |
| `--json` | Output as JSON | |

```bash
neto customers list
neto customers list --type Customer --limit 20
neto customers list --all --json
```

#### `neto customers get <identifier>`

Get detailed information for a single customer. Looks up by username first, then falls back to numeric ID.

| Option | Description | Default |
|---|---|---|
| `--fields <fields>` | Comma-separated OutputSelector fields | `Username,ID,EmailAddress,FirstName,LastName,Type,Active,DateAdded,DateUpdated,Company,Phone,Fax,BillingAddress,ShippingAddress,AccountBalance,CreditLimit,NewsletterSubscriber,DateOfBirth` |
| `--json` | Output as JSON | |

```bash
neto customers get john_doe
neto customers get 12345
neto customers get john_doe --json
```

#### `neto customers create`

Create a new customer. Supports common flags, nested billing/shipping addresses, `--field Key=Value` for any API field, or `--from-json` for full control.

| Option | Description | Default |
|---|---|---|
| `--username <u>` | Customer username (required unless `--from-json`) | |
| `--type <type>` | `Customer` or `Prospect` | |
| `--password <p>` | Password | |
| `--email <addr>` | Email address | |
| `--secondary-email <addr>` | Secondary email | |
| `--first-name <n>` | First name | |
| `--last-name <n>` | Last name | |
| `--company <c>` | Company name | |
| `--phone <p>` | Phone | |
| `--fax <f>` | Fax | |
| `--date-of-birth <YYYY-MM-DD>` | Date of birth | |
| `--gender <g>` | Gender | |
| `--user-group <id>` | User group | |
| `--credit-limit <amount>` | Credit limit | |
| `--active <bool>` | Is active (True/False) | |
| `--newsletter <bool>` | Newsletter subscriber | |
| `--sms <bool>` | SMS subscriber | |
| `--abn <abn>` | ABN | |
| `--internal-notes <text>` | Internal notes | |
| `--street <s>` | Billing street line 1 | |
| `--street2 <s>` | Billing street line 2 | |
| `--city <c>` | Billing city | |
| `--state <s>` | Billing state | |
| `--postcode <p>` | Billing postcode | |
| `--country <c>` | Billing country | |
| `--ship-same-as-bill` | Copy billing address to shipping | |
| `--ship-street <s>` | Shipping street line 1 | |
| `--ship-street2 <s>` | Shipping street line 2 | |
| `--ship-city <c>` | Shipping city | |
| `--ship-state <s>` | Shipping state | |
| `--ship-postcode <p>` | Shipping postcode | |
| `--ship-country <c>` | Shipping country | |
| `--ship-first-name <n>` | Shipping first name (if different) | |
| `--ship-last-name <n>` | Shipping last name (if different) | |
| `--field <Key=Value>` | Set any API field (repeatable) | |
| `--from-json [path]` | Read from JSON file or stdin | |
| `--dry-run` | Show payload without sending | |
| `--json` | Output response as JSON | |

```bash
# Simple create
neto customers create --username jdoe --email jane@example.com --first-name Jane --last-name Doe --type Customer

# With address, shipping same as billing
neto customers create --username jdoe --email jane@example.com \
  --first-name Jane --last-name Doe \
  --street "1 Example St" --city Sydney --state NSW --postcode 2000 --country AU \
  --ship-same-as-bill

# Custom fields via --field
neto customers create --username jdoe --email jane@example.com \
  --field Classification1=VIP --field UserCustom01=referral

# From JSON file
neto customers create --from-json customer.json

# Preview without sending
neto customers create --username jdoe --email jane@example.com --dry-run
```

#### `neto customers update <username>`

Update an existing customer. Same flags as `create` (all optional), with username provided as argument.

> **⚠ Address replacement is wholesale, not merge.** If you pass *any* billing or shipping flag, the Neto API replaces the entire `BillingAddress` / `ShippingAddress` block with exactly what you send — unsent child fields (BillFirstName, BillCompany, etc.) are blanked. When editing an address, resend every field you want to keep, or fetch the record with `neto customers get <username> --json`, edit it, and push it back via `--from-json`.

```bash
# Update credit limit
neto customers update jdoe --credit-limit 5000

# Update email and a custom field
neto customers update jdoe --email jane.new@example.com --field Classification1=VIP

# Update shipping address only
neto customers update jdoe --ship-street "2 New Rd" --ship-city Melbourne

# Preview changes
neto customers update jdoe --credit-limit 5000 --dry-run
```

---

### `neto theme`

Manage themes via SFTP. Requires SFTP credentials (`neto auth sftp`).

#### `neto theme list`

List all theme directories on the remote server.

```bash
neto theme list
```

#### `neto theme pull [theme]`

Download a theme from the server to a local directory.

| Option | Description | Default |
|---|---|---|
| `--dest <dir>` | Local destination directory | `./theme` |

```bash
# List available themes
neto theme pull

# Download a specific theme
neto theme pull storefront
neto theme pull storefront --dest ./my-theme
```

#### `neto theme push [theme]`

Upload local theme files to the server. If no theme name is given, uses the source directory name.

| Option | Description | Default |
|---|---|---|
| `--src <dir>` | Local source directory | `./theme` |
| `--dry-run` | Show files that would be uploaded without uploading | |

```bash
# Preview what would be uploaded
neto theme push storefront --dry-run

# Upload theme
neto theme push storefront
neto theme push storefront --src ./my-theme
```

#### `neto theme watch [theme]`

Watch a local directory for changes and automatically upload modified files to the server. Uses 300ms debounce to avoid duplicate uploads.

| Option | Description | Default |
|---|---|---|
| `--src <dir>` | Local source directory | `./theme` |

```bash
neto theme watch storefront
neto theme watch storefront --src ./my-theme
# Press Ctrl+C to stop
```

---

### `neto api <action>`

Raw API escape hatch. Call any Neto API action directly. Always outputs JSON.

| Option | Description |
|---|---|
| `--filter <json>` | Filter as a JSON string |
| `--filter-file <path>` | Path to a JSON file containing the filter |
| `--body <json>` | Full request body JSON (overrides `--filter`) |

```bash
# Get products by SKU
neto api GetItem --filter '{"SKU":["PROD-001"],"OutputSelector":["Name","DefaultPrice"]}'

# Use a filter file
neto api GetOrder --filter-file ./my-filter.json

# Send full custom body
neto api UpdateItem --body '{"Item":[{"SKU":"PROD-001","Name":"New Name"}]}'
```

### `neto actions`

List all known API actions, grouped by resource type.

```bash
neto actions
```

Available actions:

| Resource | Actions |
|---|---|
| Item (Products) | `GetItem`, `AddItem`, `UpdateItem` |
| Order | `GetOrder`, `AddOrder`, `UpdateOrder` |
| Customer | `GetCustomer`, `AddCustomer`, `UpdateCustomer` |
| Category | `GetCategory`, `AddCategory`, `UpdateCategory` |
| Content | `GetContent`, `AddContent`, `UpdateContent` |
| Payment | `GetPayment`, `AddPayment`, `GetPaymentMethods` |
| Warehouse | `GetWarehouse`, `AddWarehouse`, `UpdateWarehouse` |
| Supplier | `GetSupplier`, `AddSupplier`, `UpdateSupplier` |
| Voucher | `GetVoucher`, `AddVoucher`, `UpdateVoucher`, `RedeemVoucher` |
| RMA | `GetRma`, `AddRma` |
| Shipping | `GetShippingMethods`, `GetShippingQuote` |
| Currency | `GetCurrencySettings`, `UpdateCurrencySettings` |
| Cart | `GetCart` |
| Customer Log | `AddCustomerLog`, `UpdateCustomerLog` |
| Accounting | `GetAccountingSystemRelatedAccounts`, `AddAccountingSystemRelatedAccount`, `UpdateAccountingSystemRelatedAccount`, `DeleteAccountingSystemRelatedAccount` |

---

## Configuration

All configuration is stored in `~/.neto-cli/config.json` (never in the repo).

```json
{
  "store_url": "https://mystore.neto.com.au",
  "api_key": "your-api-key",
  "username": "your-username",
  "sftp": {
    "host": "sftp.neto.com.au",
    "port": 1022,
    "username": "sftp-user",
    "password": "sftp-pass",
    "remote_path": "/httpdocs/assets/themes"
  }
}
```

### API Authentication

Neto supports two auth methods:
- **API Key** (used by this CLI): Generate in Control Panel > Settings & Tools > API
- **OAuth**: For public add-ons listed in the Neto add-on store

### SFTP Defaults

| Setting | Default |
|---|---|
| Host | `sftp.neto.com.au` |
| Port | `1022` |
| Remote path | `/httpdocs/assets/themes` |

---

## API Notes

- **Rate limit**: 500 requests/minute (auto-retried on 429)
- **Endpoint**: All API calls POST to `{store_url}/do/WS/NetoAPI`
- **Filters required**: The Neto API requires at least one filter field to return results. List commands default to active records.
- **OutputSelector**: Controls which fields are returned. Use `--fields` to customise.
- **Pagination**: 0-indexed pages. Export commands auto-paginate until no more results.
