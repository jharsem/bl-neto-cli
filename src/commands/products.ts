import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';

const DEFAULT_LIST_FIELDS = ['SKU', 'Name', 'Brand', 'DefaultPrice', 'IsActive', 'DateUpdated'];
const DEFAULT_GET_FIELDS = [
  'SKU', 'ParentSKU', 'ID', 'Name', 'Brand', 'Model',
  'DefaultPrice', 'PromotionPrice', 'RRP', 'CostPrice',
  'IsActive', 'Approved', 'Visible',
  'Description', 'ShortDescription',
  'AvailableSellQuantity', 'CommittedQuantity',
  'DateAdded', 'DateUpdated',
  'PrimarySupplier', 'Categories',
];

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'SKU', key: 'SKU', width: 20 },
  { header: 'Name', key: 'Name', width: 30 },
  { header: 'Brand', key: 'Brand', width: 15 },
  { header: 'Price', key: 'DefaultPrice', width: 10 },
  { header: 'Active', key: 'IsActive', width: 8 },
  { header: 'Updated', key: 'DateUpdated', width: 20 },
];

function requireAuth(): NetoApiClient {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  return new NetoApiClient(loadConfig());
}

export function registerProductsCommand(program: Command): void {
  const products = program
    .command('products')
    .description('Manage products');

  products
    .command('list')
    .description('List products')
    .option('--limit <n>', 'Number of results', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--brand <brand>', 'Filter by brand')
    .option('--active <bool>', 'Filter by active status (True/False)', 'True')
    .option('--all', 'Include inactive products')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Fetching products...').start();

      try {
        const filter: Record<string, unknown> = {
          Limit: opts.limit,
          Page: opts.page,
          OutputSelector: fields,
        };
        if (opts.brand) filter.Brand = [opts.brand];
        if (!opts.all) filter.IsActive = [opts.active];

        const res = await client.callWithFilter('GetItem', filter);
        printWarnings(res);
        const items = res.Item || [];
        spinner.stop();

        if (items.length === 0) {
          console.log(chalk.dim('No products found.'));
          return;
        }

        if (opts.json) {
          outputJson(items);
        } else {
          outputTable(LIST_COLUMNS, items);
        }
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    });

  products
    .command('get <sku>')
    .description('Get product details by SKU')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (sku, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_GET_FIELDS);
      const spinner = ora(`Fetching product ${sku}...`).start();

      try {
        const res = await client.callWithFilter('GetItem', {
          SKU: [sku],
          OutputSelector: fields,
        });
        printWarnings(res);
        const items = res.Item || [];
        spinner.stop();

        if (items.length === 0) {
          console.log(chalk.yellow(`Product "${sku}" not found.`));
          return;
        }

        if (opts.json) {
          outputJson(items[0]);
        } else {
          console.log(chalk.bold(`Product: ${items[0].Name || sku}`));
          console.log();
          outputDetail(items[0]);
        }
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    });

  products
    .command('export')
    .description('Export all products as JSON (paginated)')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--active <bool>', 'Filter by active status (True/False)', 'True')
    .option('--all', 'Include inactive products')
    .option('--batch-size <n>', 'Products per page', '100')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Exporting products...').start();

      try {
        const allItems: unknown[] = [];
        let page = 0;

        while (true) {
          const filter: Record<string, unknown> = {
            Limit: opts.batchSize,
            Page: String(page),
            OutputSelector: fields,
          };
          if (!opts.all) filter.IsActive = [opts.active];

          const res = await client.callWithFilter('GetItem', filter);
          const items = res.Item || [];
          if (items.length === 0) break;

          allItems.push(...items);
          spinner.text = `Exported ${allItems.length} products...`;
          page++;
        }

        spinner.succeed(`Exported ${allItems.length} products`);
        outputJson(allItems);
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    });

  products.action(() => products.outputHelp());
}
