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
    products.ts         # neto products list|get|export
    orders.ts           # neto orders list|get|export
    customers.ts        # neto customers list|get
    api.ts              # neto api <action> (raw escape hatch) + neto actions
    theme.ts            # neto theme list|pull|push|watch (SFTP)
  lib/
    client.ts           # NetoApiClient - HTTP wrapper for Neto API
    config.ts           # Config read/write (~/.neto-cli/config.json)
    output.ts           # Table, JSON, detail output formatters
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
