import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';
import {
  collectField, collectCategory, buildItemPayload, readJsonInput,
  launchEditor, diffObjects, stripReadonlyFields,
  EDIT_FIELDS,
} from '../lib/product-helpers.js';

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

  products
    .command('create')
    .description('Create a new product')
    .option('--sku <sku>', 'Product SKU (required unless --from-json)')
    .option('--name <name>', 'Product name')
    .option('--brand <brand>', 'Brand')
    .option('--model <model>', 'Model')
    .option('--price <price>', 'Default price')
    .option('--cost-price <price>', 'Cost price')
    .option('--rrp <price>', 'Recommended retail price')
    .option('--description <desc>', 'Full description')
    .option('--short-description <desc>', 'Short description')
    .option('--active <bool>', 'Is active (True/False)', 'True')
    .option('--visible <bool>', 'Is visible (True/False)', 'True')
    .option('--category <id>', 'Category ID (repeatable)', collectCategory, [])
    .option('--supplier <name>', 'Primary supplier')
    .option('--quantity <n>', 'Stock quantity (requires --warehouse-id)')
    .option('--warehouse-id <id>', 'Warehouse ID for --quantity')
    .option('--image-url <url>', 'Primary image URL')
    .option('--field <key=value>', 'Set any API field (repeatable)', collectField, [])
    .option('--from-json [path]', 'Read from JSON file or stdin')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON')
    .action(async (opts) => {
      const client = requireAuth();

      let items: Record<string, unknown>[];

      if (opts.fromJson !== undefined) {
        try {
          items = await readJsonInput(opts.fromJson);
        } catch (err: any) {
          console.error(chalk.red(`Error reading JSON: ${err.message}`));
          process.exit(1);
        }
      } else {
        if (!opts.sku) {
          console.error(chalk.red('Error: --sku is required. Use --from-json for bulk creation.'));
          process.exit(1);
        }
        items = [buildItemPayload(opts)];
      }

      const body = { Item: items };

      if (opts.dryRun) {
        console.log(chalk.bold('Dry run — would send:'));
        outputJson(body);
        return;
      }

      const spinner = ora(`Creating ${items.length} product${items.length !== 1 ? 's' : ''}...`).start();

      try {
        const res = await client.call('AddItem', body);
        printWarnings(res);
        spinner.stop();

        if (opts.json) {
          outputJson(res);
        } else {
          const created = res.Item || items;
          for (const item of created) {
            console.log(chalk.green(`Created product "${item.Name || ''}" (SKU: ${item.SKU})`));
          }
        }
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    });

  products
    .command('update <sku>')
    .description('Update an existing product')
    .option('--name <name>', 'Product name')
    .option('--brand <brand>', 'Brand')
    .option('--model <model>', 'Model')
    .option('--price <price>', 'Default price')
    .option('--cost-price <price>', 'Cost price')
    .option('--rrp <price>', 'Recommended retail price')
    .option('--description <desc>', 'Full description')
    .option('--short-description <desc>', 'Short description')
    .option('--active <bool>', 'Is active (True/False)')
    .option('--visible <bool>', 'Is visible (True/False)')
    .option('--category <id>', 'Category ID (repeatable)', collectCategory, [])
    .option('--supplier <name>', 'Primary supplier')
    .option('--quantity <n>', 'Stock quantity (requires --warehouse-id)')
    .option('--warehouse-id <id>', 'Warehouse ID for --quantity')
    .option('--image-url <url>', 'Primary image URL')
    .option('--field <key=value>', 'Set any API field (repeatable)', collectField, [])
    .option('--from-json [path]', 'Read from JSON file or stdin')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON')
    .action(async (sku, opts) => {
      const client = requireAuth();

      let items: Record<string, unknown>[];

      if (opts.fromJson !== undefined) {
        try {
          items = await readJsonInput(opts.fromJson);
          // Inject SKU if single item without one
          if (items.length === 1 && !items[0].SKU) {
            items[0].SKU = sku;
          }
        } catch (err: any) {
          console.error(chalk.red(`Error reading JSON: ${err.message}`));
          process.exit(1);
        }
      } else {
        const item = buildItemPayload(opts, sku);
        // Check that at least one field beyond SKU is being updated
        const fieldCount = Object.keys(item).filter(k => k !== 'SKU').length;
        if (fieldCount === 0) {
          console.error(chalk.red('Error: No fields to update. Provide flags, --field, or --from-json.'));
          process.exit(1);
        }
        items = [item];
      }

      const body = { Item: items };

      if (opts.dryRun) {
        console.log(chalk.bold('Dry run — would send:'));
        outputJson(body);
        return;
      }

      const spinner = ora(`Updating product ${sku}...`).start();

      try {
        const res = await client.call('UpdateItem', body);
        printWarnings(res);
        spinner.stop();

        if (opts.json) {
          outputJson(res);
        } else {
          const fieldCount = Object.keys(items[0]).filter(k => k !== 'SKU').length;
          console.log(chalk.green(`Updated product ${sku} (${fieldCount} field${fieldCount !== 1 ? 's' : ''} changed)`));
        }
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    });

  products
    .command('edit <sku>')
    .description('Edit a product interactively in $EDITOR')
    .option('--fields <fields>', 'Comma-separated fields to fetch for editing')
    .option('--json', 'Output the update payload as JSON instead of sending')
    .action(async (sku, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, EDIT_FIELDS);
      const spinner = ora(`Fetching product ${sku}...`).start();

      try {
        const res = await client.callWithFilter('GetItem', {
          SKU: [sku],
          OutputSelector: fields,
        });
        const items = res.Item || [];
        spinner.stop();

        if (items.length === 0) {
          console.log(chalk.yellow(`Product "${sku}" not found.`));
          return;
        }

        const original = stripReadonlyFields(items[0]);
        const edited = launchEditor(original);
        const changes = diffObjects(original, edited);

        if (!changes) {
          console.log(chalk.dim('No changes made.'));
          return;
        }

        const changedKeys = Object.keys(changes);
        console.log(chalk.bold(`${changedKeys.length} field${changedKeys.length !== 1 ? 's' : ''} changed:`));
        for (const key of changedKeys) {
          const before = original[key];
          const after = changes[key];
          const beforeStr = typeof before === 'object' ? JSON.stringify(before) : String(before ?? '');
          const afterStr = typeof after === 'object' ? JSON.stringify(after) : String(after ?? '');
          console.log(`  ${chalk.cyan(key)}  ${chalk.dim(beforeStr)} → ${afterStr}`);
        }
        console.log();

        const updateBody = { Item: [{ SKU: sku, ...changes }] };

        if (opts.json) {
          outputJson(updateBody);
          return;
        }

        const updateSpinner = ora('Saving changes...').start();
        const updateRes = await client.call('UpdateItem', updateBody);
        printWarnings(updateRes);
        updateSpinner.succeed(`Updated product ${sku}`);
      } catch (err: any) {
        spinner.stop();
        console.error(chalk.red(err.message));
        process.exit(1);
      }
    });

  products.action(() => products.outputHelp());
}
