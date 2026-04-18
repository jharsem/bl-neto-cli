import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';

// Verified against ../neto-docs-engineer/docs/abandoned-cart/getcart.md

const DEFAULT_LIST_FIELDS = [
  'CartID', 'CheckoutStatus', 'CustomerEmail', 'CustomerUsername',
  'CartTotal', 'DateCreated', 'DateUpdated', 'OrderID',
];

const DEFAULT_GET_FIELDS = [
  'CartID', 'CheckoutStatus', 'CloseReason', 'CustomerEmail', 'CustomerUsername',
  'CartTotal', 'OrderID', 'NotifiedCustomer', 'IsProcessed',
  'DateCreated', 'DateUpdated', 'RestoreCartUrl', 'BillingAddress', 'OrderLines',
];

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'Cart ID', key: 'CartID', width: 10 },
  { header: 'Status', key: 'CheckoutStatus', width: 12 },
  { header: 'Customer', key: 'CustomerEmail', width: 26 },
  { header: 'Total', key: 'CartTotal', width: 10 },
  { header: 'Order ID', key: 'OrderID', width: 12 },
  { header: 'Updated', key: 'DateUpdated', width: 22 },
];

function requireAuth(): NetoApiClient {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  return new NetoApiClient(loadConfig());
}

export function registerCartCommand(program: Command): void {
  const cart = program
    .command('cart')
    .description('View customer shopping carts (read-only, saved up to 90 days)');

  cart
    .command('list')
    .description('List carts')
    .option('--limit <n>', 'Number of results', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--status <s>', 'Filter by status: Open, Closed, or Abandoned', 'Abandoned')
    .option('--all', 'Return all statuses (Open, Closed, Abandoned)')
    .option('--from <dt>', 'Filter by DateCreatedFrom (YYYY-MM-DD HH:MM:SS)')
    .option('--to <dt>', 'Filter by DateCreatedTo (YYYY-MM-DD HH:MM:SS)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Fetching carts...').start();
      try {
        const filter: Record<string, unknown> = {
          Limit: opts.limit,
          Page: opts.page,
          OutputSelector: fields,
        };
        if (!opts.all) filter.CheckoutStatus = [opts.status];
        if (opts.from) filter.DateCreatedFrom = opts.from;
        if (opts.to) filter.DateCreatedTo = opts.to;
        const res = await client.callWithFilter('GetCart', filter);
        printWarnings(res);
        const items = res.Cart || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.dim('No carts found.')); return; }
        opts.json ? outputJson(items) : outputTable(LIST_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  cart
    .command('get <id>')
    .description('Get cart by ID')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_GET_FIELDS);
      const spinner = ora(`Fetching cart ${id}...`).start();
      try {
        const res = await client.callWithFilter('GetCart', {
          CartID: [id],
          OutputSelector: fields,
        });
        printWarnings(res);
        const items = res.Cart || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.yellow(`Cart "${id}" not found.`)); return; }
        const c = items[0];
        opts.json ? outputJson(c) : (console.log(chalk.bold(`Cart: ${c.CartID} (${c.CheckoutStatus})`)), console.log(), outputDetail(c));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  cart.action(() => cart.outputHelp());
}
