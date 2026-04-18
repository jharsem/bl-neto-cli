import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';
import { readJsonInput } from '../lib/payload-helpers.js';

// Verified against ../neto-docs-engineer/docs/rma/{getrma,addrma}.md
const DEFAULT_LIST_FIELDS = [
  'RmaID', 'OrderID', 'InvoiceNumber', 'CustomerUsername',
  'RmaStatus', 'RefundTotal', 'DateIssued', 'DateUpdated',
];

const DEFAULT_GET_FIELDS = [
  'RmaID', 'OrderID', 'InvoiceNumber', 'CustomerUsername', 'StaffUsername',
  'PurchaseOrderNumber', 'InternalNotes', 'CurrencyCode', 'RmaStatus',
  'ShippingRefundAmount', 'RefundSubtotal', 'RefundTotal', 'RefundTaxTotal',
  'TaxInclusive', 'DateIssued', 'DateUpdated', 'DateApproved', 'RmaLine',
];

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'RMA ID', key: 'RmaID', width: 8 },
  { header: 'Order ID', key: 'OrderID', width: 12 },
  { header: 'Invoice', key: 'InvoiceNumber', width: 14 },
  { header: 'Customer', key: 'CustomerUsername', width: 18 },
  { header: 'Status', key: 'RmaStatus', width: 10 },
  { header: 'Refund Total', key: 'RefundTotal', width: 13 },
];

function requireAuth(): NetoApiClient {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  return new NetoApiClient(loadConfig());
}

export function registerRmaCommand(program: Command): void {
  const rma = program
    .command('rma')
    .description('Manage return merchandise authorisations (RMAs)');

  rma
    .command('list')
    .description('List RMAs')
    .option('--limit <n>', 'Number of results', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--order-id <id>', 'Filter by order ID')
    .option('--username <u>', 'Filter by customer username')
    .option('--status <s>', 'Filter by RMA status (Open/Closed)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Fetching RMAs...').start();
      try {
        const filter: Record<string, unknown> = {
          Limit: opts.limit,
          Page: opts.page,
          OutputSelector: fields,
        };
        if (opts.orderId) filter.OrderID = [opts.orderId];
        if (opts.username) filter.Username = [opts.username];
        if (opts.status) filter.RmaStatus = [opts.status];
        const res = await client.callWithFilter('GetRma', filter);
        printWarnings(res);
        const items = res.Rma || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.dim('No RMAs found.')); return; }
        opts.json ? outputJson(items) : outputTable(LIST_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  rma
    .command('get <id>')
    .description('Get RMA by ID')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_GET_FIELDS);
      const spinner = ora(`Fetching RMA ${id}...`).start();
      try {
        const res = await client.callWithFilter('GetRma', {
          RmaID: [id],
          OutputSelector: fields,
        });
        printWarnings(res);
        const items = res.Rma || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.yellow(`RMA "${id}" not found.`)); return; }
        const r = items[0];
        opts.json ? outputJson(r) : (console.log(chalk.bold(`RMA: ${r.RmaID} (Order: ${r.OrderID})`)), console.log(), outputDetail(r));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  rma
    .command('create')
    .description('Create a new RMA (Return Merchandise Authorisation)')
    .option('--order-id <id>', 'Order ID (required)')
    .option('--invoice-number <n>', 'Invoice number (required)')
    .option('--customer-username <u>', 'Customer username (required)')
    .option('--staff-username <u>', 'Staff username (required)')
    .option('--po-number <n>', 'Purchase order number (required)')
    .option('--notes <t>', 'Internal notes (required)')
    .option('--status <s>', 'RMA status: Open or Closed (required)', 'Open')
    .option('--shipping-refund <amt>', 'Shipping refund amount (required)', '0')
    .option('--shipping-refund-tax-code <c>', 'Shipping refund tax code (required)')
    .option('--tax-inclusive <bool>', 'Tax inclusive (True/False)')
    .option('--from-json [path]', 'Read full RMA payload from JSON file or stdin')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      let items: Record<string, unknown>[];
      if (opts.fromJson !== undefined) {
        try { items = await readJsonInput(opts.fromJson); }
        catch (err: any) { console.error(chalk.red(`Error reading JSON: ${err.message}`)); process.exit(1); }
      } else {
        const required: [string, string][] = [
          ['orderId', '--order-id'],
          ['invoiceNumber', '--invoice-number'],
          ['customerUsername', '--customer-username'],
          ['staffUsername', '--staff-username'],
          ['poNumber', '--po-number'],
          ['notes', '--notes'],
          ['shippingRefundTaxCode', '--shipping-refund-tax-code'],
        ];
        for (const [key, flag] of required) {
          if (!opts[key]) { console.error(chalk.red(`Error: ${flag} is required.`)); process.exit(1); }
        }
        const item: Record<string, unknown> = {
          OrderID: opts.orderId,
          InvoiceNumber: opts.invoiceNumber,
          CustomerUsername: opts.customerUsername,
          StaffUsername: opts.staffUsername,
          PurchaseOrderNumber: opts.poNumber,
          InternalNotes: opts.notes,
          RmaStatus: opts.status,
          ShippingRefundAmount: opts.shippingRefund,
          ShippingRefundTaxCode: opts.shippingRefundTaxCode,
        };
        if (opts.taxInclusive !== undefined) item.TaxInclusive = opts.taxInclusive;
        items = [item];
      }
      const body = { Rma: items };
      if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
      const spinner = ora('Creating RMA...').start();
      try {
        const res = await client.call('AddRma', body);
        printWarnings(res);
        spinner.stop();
        opts.json ? outputJson(res) : console.log(chalk.green('Created RMA successfully.'));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  rma.action(() => rma.outputHelp());
}
