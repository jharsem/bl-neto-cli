# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Neto CLI (`neto`) is a command-line tool for the Neto/Maropost ecommerce platform. It wraps the Neto REST API and provides SFTP-based theme management, inspired by Shopify CLI.

## Tech Stack

- **Runtime**: Node.js 18+ (uses built-in `fetch`, no axios)
- **Language**: TypeScript (strict mode, ESM modules)
- **CLI Framework**: Commander.js
- **Output**: chalk (colors), ora (spinners), cli-table3 (tables)
- **Prompts**: inquirer (interactive auth setup)
- **SFTP**: ssh2-sftp-client (theme push/pull/watch)

## Commands

### Build & Run

```bash
npm install          # install dependencies
npm run build        # compile TypeScript → dist/
npm run dev          # run via tsx (no build needed)
npm link             # make `neto` available globally
```

### Development

```bash
npx tsc              # typecheck
node dist/index.js   # run compiled CLI directly
npx tsx src/index.ts  # run from source
```

## Architecture

### File Structure

```
src/
  index.ts              # Entry point, registers all commands
  commands/
    auth.ts             # neto auth setup|status|clear|sftp
    info.ts             # neto info (connectivity test)
    products.ts         # neto products list|get|export|create|update|edit
    orders.ts           # neto orders list|get|export
    customers.ts        # neto customers list|get
    api.ts              # neto api <action> (raw escape hatch) + neto actions
    theme.ts            # neto theme list|pull|push|watch (SFTP)
  lib/
    client.ts           # NetoApiClient - HTTP wrapper for Neto API
    config.ts           # Config read/write (~/.neto-cli/config.json)
    output.ts           # Table, JSON, detail output formatters
    product-helpers.ts  # Payload building, JSON input, $EDITOR launch, diff
```

### Key Patterns

- **Single API endpoint**: All Neto API calls POST to `{store_url}/do/WS/NetoAPI` with `NETOAPI_ACTION` header
- **Filter + OutputSelector**: Every API request uses `{"Filter": {"OutputSelector": [...], ...filters}}`
- **Response key mapping**: `GetItem` → `Item`, `GetOrder` → `Order`, etc. (see `RESPONSE_KEYS` in `client.ts`)
- **Auth guard**: Commands call `requireAuth()` which checks for config and exits with guidance if missing
- **Default filters**: List commands default to active records (IsActive/Active: True) because the Neto API requires at least one filter beyond pagination
- **Pagination**: Export commands loop incrementing `Page` until empty array returned

### Config Location

Credentials stored at `~/.neto-cli/config.json` (outside repo). Contains:
- `store_url`, `api_key`, `username` (API auth)
- `sftp` object: `host`, `port`, `username`, `password`, `remote_path` (theme SFTP)

### SFTP Defaults

- Host: `sftp.neto.com.au`
- Port: `1022`
- Remote path: `/httpdocs/assets/themes`

### API Rate Limits

- 500 requests/minute per account
- Client auto-retries on 429 with exponential backoff (max 3 attempts)

## Important Notes

- Never commit credentials or API keys. Config lives in `~/.neto-cli/`, not the repo
- The Neto API requires at least one filter field (beyond Page/Limit/OutputSelector) to return results
- Theme management uses SFTP, not the API — Neto doesn't expose theme files through its REST API
- All commands support `--json` for machine-readable output
- The `neto api <action>` command is an escape hatch for any API action not wrapped by a dedicated command

## Reference Documentation

The scraped Maropost/Neto developer docs live locally at `../neto-docs-engineer/docs/` (sibling repo). **Prefer reading these files over guessing field names, inventing filters, or fetching live docs** — they're the authoritative source for:

- Filter keys and types for every `Get*` action
- Full OutputSelector lists (often 50–150 fields per action)
- Write payload schemas for every `Add*` / `Update*` action
- Enum values (e.g. OrderStatus, Customer Type)
- Nested element structures (addresses, order lines, images, categories)

### API action → doc path

All 48 action docs follow `docs/<category>/<action>.md` (lowercase filename, no hyphens). Quick lookup:

| Category folder | Actions (files) |
|---|---|
| `products/` | `getitem.md`, `additem.md`, `updateitem.md` |
| `orders-invoices/` | `getorder.md`, `addorder.md`, `updateorder.md` |
| `customers/` | `getcustomer.md`, `addcustomer.md`, `updatecustomer.md`, `addcustomerlog.md`, `updatecustomerlog.md` |
| `categories/` | `getcategory.md`, `addcategory.md`, `updatecategory.md` |
| `content/` | `getcontent.md`, `addcontent.md`, `updatecontent.md` |
| `payments/` | `getpayment.md`, `addpayment.md`, `getpaymentmethods.md` |
| `warehouses/` | `getwarehouse.md`, `addwarehouse.md`, `updatewarehouse.md` |
| `suppliers/` | `getsupplier.md`, `addsupplier.md`, `updatesupplier.md` |
| `voucher/` | `getvoucher.md`, `addvoucher.md`, `updatevoucher.md`, `redeemvoucher.md` |
| `rma/` | `getrma.md`, `addrma.md` |
| `shipping/` | `getshippingmethods.md`, `getshippingquote.md` |
| `currency/` | `getcurrencysettings.md`, `updatecurrencysettings.md` |
| `abandoned-cart/` | `getcart.md` |
| `accounting-system/` | `getaccountingsystemrelatedaccounts.md`, `add…`, `update…`, `delete…` |
| `notification-events-webhooks/` | `Order-Notifications.md` (canonical OrderStatus enum lives here) |

### Cross-cutting docs

- `docs/introductions-and-getting-started/Authentication.md` — exact header names (`NETOAPI_ACTION`, `NETOAPI_USERNAME`, `NETOAPI_KEY`) and OAuth flow
- `docs/introductions-and-getting-started/Api-Best-Practices.md` — rate limit (500 req/min), batch patterns, UTC date guidance
- `docs/introductions-and-getting-started/Api-Field-Types.md` — primitive types and length constraints
- `docs/introductions-and-getting-started/Getting-Started-with-the-API.md` — endpoint and payload basics

### Theme references (secondary)

For any future theme-related features:
- `../neto-docs-engineer/docs-base-tags/` — B@SE tag library (91 files, Liquid-like templating)
- `../neto-docs-engineer/docs-tweak-documents/` — ready-made theme tweak snippets (101 files)

### Self-audits

Regenerable coverage and accuracy audits live under `docs/reviews/`:
- `docs/reviews/coverage-gaps.md` — which of the 41+ Neto actions have dedicated commands vs. escape-hatch-only
- `docs/reviews/accuracy-audit.md` — field-name / filter / enum / OutputSelector correctness of the commands that exist

Re-run with `/review-cli` (slash command in `.claude/commands/review-cli.md`) when commands, defaults, or `KNOWN_ACTIONS` change.
