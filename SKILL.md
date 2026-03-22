---
name: neto-cli
description: Use the Neto CLI to interact with Neto/Maropost ecommerce stores. Trigger this skill whenever the user mentions Neto, Maropost, or wants to work with a Neto store's products, orders, customers, themes, or API. Also trigger when the user wants to pull/push themes via SFTP to a Neto store, export store data, or query the Neto API. Even if the user doesn't say "neto-cli" explicitly, use this skill if they're working with Neto ecommerce data or theme files.
---

# Neto CLI

A CLI tool for the Neto/Maropost ecommerce platform. It wraps the Neto REST API for products, orders, and customers, and provides SFTP-based theme management (pull, push, watch).

## Setup

The CLI must be configured before use. Credentials are stored in `~/.neto-cli/config.json`, never in the repo.

```bash
# Build and install
cd neto-cli
npm install && npm run build && npm link

# Configure API credentials
neto auth setup --store-url <url> --api-key <key> --username <user>

# Configure SFTP for themes (optional)
neto auth sftp --sftp-user <user> --sftp-pass <pass>

# Verify connection
neto info
```

### SFTP Defaults

If not overridden, SFTP uses:
- Host: `sftp.neto.com.au`
- Port: `1022`
- Remote path: `/httpdocs/assets/themes`

These can be changed via `neto auth sftp --host <host> --port <port> --remote-path <path>`.

## Commands Reference

### Authentication

| Command | Description |
|---|---|
| `neto auth setup` | Configure API credentials (interactive or via flags `--store-url`, `--api-key`, `--username`) |
| `neto auth status` | Show current config (keys masked) |
| `neto auth clear` | Remove stored credentials |
| `neto auth sftp` | Configure SFTP credentials (flags: `--host`, `--port`, `--sftp-user`, `--sftp-pass`, `--remote-path`) |

### Store Info

| Command | Description |
|---|---|
| `neto info` | Show config and test API connectivity |

### Products

| Command | Key Options |
|---|---|
| `neto products list` | `--limit <n>` (default 50), `--page <n>` (default 0), `--brand <brand>`, `--active <True/False>` (default True), `--all`, `--fields <csv>`, `--json` |
| `neto products get <sku>` | `--fields <csv>`, `--json` |
| `neto products export` | `--active <True/False>` (default True), `--all`, `--batch-size <n>` (default 100), `--fields <csv>` |

Default list fields: `SKU, Name, Brand, DefaultPrice, IsActive, DateUpdated`

### Orders

| Command | Key Options |
|---|---|
| `neto orders list` | `--limit <n>`, `--page <n>`, `--status <status>`, `--date-from <YYYY-MM-DD>`, `--date-to <YYYY-MM-DD>`, `--fields <csv>`, `--json` |
| `neto orders get <id>` | `--fields <csv>`, `--json` |
| `neto orders export` | `--status <status>`, `--date-from`, `--date-to`, `--batch-size <n>`, `--fields <csv>` |

Default list fields: `OrderID, Username, Email, GrandTotal, OrderStatus, DatePlaced, ShippingOption`

Valid statuses: `Quote`, `New`, `On Hold`, `New Backorder`, `Backorder Approved`, `Pick`, `Pack`, `Pending Pickup`, `Pending Dispatch`, `Dispatched`, `Cancelled`, `Uncommitted`

Without `--status`, defaults to showing: New, Pick, Pack, Pending Pickup, Pending Dispatch, Dispatched, On Hold.

### Customers

| Command | Key Options |
|---|---|
| `neto customers list` | `--limit <n>`, `--page <n>`, `--type <Customer/Prospect>`, `--active <True/False>` (default True), `--all`, `--fields <csv>`, `--json` |
| `neto customers get <identifier>` | Looks up by username first, then by numeric ID. `--fields <csv>`, `--json` |

Default list fields: `Username, ID, EmailAddress, FirstName, LastName, Type, Active, DateAdded`

### Themes (SFTP)

Requires SFTP credentials via `neto auth sftp`.

| Command | Key Options |
|---|---|
| `neto theme list` | Lists theme directories on the remote server |
| `neto theme pull [theme]` | `--dest <dir>` (default `./theme`). Without theme name, lists available themes |
| `neto theme push [theme]` | `--src <dir>` (default `./theme`), `--dry-run`. Without theme name, uses directory name |
| `neto theme watch [theme]` | `--src <dir>` (default `./theme`). Auto-uploads on file changes, 300ms debounce. Ctrl+C to stop |

### Raw API

| Command | Key Options |
|---|---|
| `neto api <action>` | `--filter <json>`, `--filter-file <path>`, `--body <json>`. Always outputs JSON |
| `neto actions` | Lists all known API actions grouped by resource |

## Neto API Essentials

When constructing raw API calls or helping users understand the system:

- **Single endpoint**: All calls POST to `{store_url}/do/WS/NetoAPI`
- **Headers**: `NETOAPI_ACTION` specifies the action, `NETOAPI_KEY` + `NETOAPI_USERNAME` for auth
- **Request body**: `{"Filter": {"OutputSelector": ["Field1", "Field2"], "SKU": ["value"], "Limit": "50", "Page": "0"}}`
- **At least one filter required** beyond Page/Limit/OutputSelector, or the API returns empty results
- **Rate limit**: 500 requests/minute (CLI auto-retries on 429)
- **Response keys**: `GetItem` returns `Item`, `GetOrder` returns `Order`, `GetCustomer` returns `Customer`, etc.

## Common Workflows

### Export all products to a file
```bash
neto products export > products.json
neto products export --all --fields SKU,Name,DefaultPrice,AvailableSellQuantity > inventory.json
```

### Check recent orders
```bash
neto orders list --status New --limit 20
neto orders list --date-from 2025-01-01 --date-to 2025-03-31
```

### Theme development cycle
```bash
neto theme pull storefront --dest ./my-theme
# Edit files locally...
neto theme push storefront --src ./my-theme --dry-run   # preview
neto theme push storefront --src ./my-theme              # upload
neto theme watch storefront --src ./my-theme             # live sync
```

### Ad-hoc API query
```bash
neto api GetItem --filter '{"SKU":["PROD-001"],"OutputSelector":["Name","DefaultPrice","AvailableSellQuantity"]}'
neto api GetOrder --filter '{"OrderStatus":["New"],"OutputSelector":["OrderID","GrandTotal"]}'
```

## Project Structure

```
neto-cli/
  src/
    index.ts              # Entry point
    commands/
      auth.ts             # neto auth setup|status|clear|sftp
      info.ts             # neto info
      products.ts         # neto products list|get|export
      orders.ts           # neto orders list|get|export
      customers.ts        # neto customers list|get
      api.ts              # neto api <action> + neto actions
      theme.ts            # neto theme list|pull|push|watch
    lib/
      client.ts           # NetoApiClient (HTTP wrapper, retry, response key mapping)
      config.ts           # Config types, read/write ~/.neto-cli/config.json
      output.ts           # Table, JSON, detail view formatters
```

Built with TypeScript, Commander.js, chalk, ora, cli-table3, inquirer, ssh2-sftp-client. Requires Node.js 18+.
