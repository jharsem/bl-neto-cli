import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, printWarnings, type ColumnDef } from '../lib/output.js';

// Verified against ../neto-docs-engineer/docs/shipping/{getshippingmethods,getshippingquote}.md

const METHODS_COLUMNS: ColumnDef[] = [
  { header: 'ID', key: 'id', width: 6 },
  { header: 'Name', key: 'name', width: 28 },
  { header: 'Status', key: 'status', width: 10 },
  { header: 'Description', key: 'description', width: 32 },
];

const QUOTE_COLUMNS: ColumnDef[] = [
  { header: 'Method', key: '_method', width: 28 },
  { header: 'Cost', key: 'ShippingCost', width: 10 },
  { header: 'Delivery Days', key: 'DeliveryTime', width: 14 },
  { header: 'PO Box', key: 'ShipPOBox', width: 8 },
  { header: 'Tax Incl.', key: 'TaxInclusive', width: 10 },
];

function requireAuth(): NetoApiClient {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  return new NetoApiClient(loadConfig());
}

export function registerShippingCommand(program: Command): void {
  const shipping = program
    .command('shipping')
    .description('Shipping methods and quote calculations');

  shipping
    .command('methods')
    .description('List all shipping methods')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const spinner = ora('Fetching shipping methods...').start();
      try {
        const res = await client.call('GetShippingMethods', {});
        printWarnings(res);
        // Response: { ShippingMethods: { ShippingMethod: [...] } }
        const items: any[] = res.ShippingMethods?.ShippingMethod ?? [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.dim('No shipping methods found.')); return; }
        opts.json ? outputJson(items) : outputTable(METHODS_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  shipping
    .command('quote')
    .description('Calculate a shipping quote')
    .option('--postcode <p>', 'Destination postcode (required)')
    .option('--country <c>', 'Destination country code 2-letter (required)')
    .option('--city <c>', 'Destination city (required)')
    .option('--state <s>', 'Destination state (required)')
    .option('--po-box <bool>', 'Is PO Box delivery (True/False) (required)')
    .option('--tax-inclusive <bool>', 'Tax inclusive (True/False)')
    .option('--user-group <id>', 'User group ID for pricing')
    .option('--method-id <id>', 'Limit to a specific shipping method ID')
    .option('--line <SKU:QTY[:PRICE]>', 'Order line (repeatable)', (v, a: string[]) => { a.push(v); return a; }, [] as string[])
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      if (!opts.postcode) { console.error(chalk.red('Error: --postcode is required.')); process.exit(1); }
      if (!opts.country) { console.error(chalk.red('Error: --country is required.')); process.exit(1); }
      if (!opts.city) { console.error(chalk.red('Error: --city is required.')); process.exit(1); }
      if (!opts.state) { console.error(chalk.red('Error: --state is required.')); process.exit(1); }
      if (opts.poBox === undefined) { console.error(chalk.red('Error: --po-box is required (True/False).')); process.exit(1); }

      const quote: Record<string, unknown> = {
        ShipPostCode: opts.postcode,
        ShipCountry: opts.country,
        ShipCity: opts.city,
        ShipState: opts.state,
        ShipPOBox: opts.poBox,
      };
      if (opts.taxInclusive !== undefined) quote.TaxInclusive = opts.taxInclusive;
      if (opts.userGroup) quote.UserGroupId = opts.userGroup;
      if (opts.methodId) quote.ShippingMethod = { ID: opts.methodId };

      if ((opts.line as string[]).length > 0) {
        const lines = (opts.line as string[]).map((l) => {
          const parts = l.split(':');
          const line: Record<string, unknown> = { SKU: parts[0], Quantity: Number(parts[1] ?? 1) };
          if (parts[2]) line.UnitPrice = Number(parts[2]);
          return line;
        });
        quote.OrderLines = { OrderLine: lines };
      }

      if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson({ ShippingQuote: quote }); return; }
      const spinner = ora('Getting shipping quote...').start();
      try {
        const res = await client.call('GetShippingQuote', { ShippingQuote: quote });
        printWarnings(res);
        // Response: { ShippingQuotes: [{ ShippingQuote: [...] }] } or similar
        const sq = res.ShippingQuotes;
        let rawItems: any[] = Array.isArray(sq)
          ? (sq[0]?.ShippingQuote ?? sq)
          : (sq?.ShippingQuote ?? []);
        spinner.stop();
        if (rawItems.length === 0) { console.log(chalk.dim('No shipping quotes returned.')); return; }
        // Flatten ShippingMethod name into display row
        const items = rawItems.map((q: any) => ({
          ...q,
          _method: q.ShippingMethod?.Name ?? '',
        }));
        opts.json ? outputJson(rawItems) : outputTable(QUOTE_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  shipping.action(() => shipping.outputHelp());
}
