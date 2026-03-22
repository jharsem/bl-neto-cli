import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';

const DEFAULT_LIST_FIELDS = [
  'OrderID', 'Username', 'Email', 'GrandTotal',
  'OrderStatus', 'DatePlaced', 'ShippingOption',
];
const DEFAULT_GET_FIELDS = [
  'OrderID', 'Username', 'Email', 'GrandTotal', 'TaxTotal', 'ShippingTotal',
  'OrderStatus', 'OrderType', 'DatePlaced', 'DatePaid', 'DateInvoiced',
  'ShippingOption', 'DeliveryInstruction',
  'BillAddress', 'ShipAddress',
  'OrderLine', 'OrderLine.ProductName', 'OrderLine.SKU',
  'OrderLine.Quantity', 'OrderLine.UnitPrice',
  'OrderPayment', 'OrderPayment.PaymentType', 'OrderPayment.DatePaid',
  'SalesChannel', 'CustomerRef1',
];

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'Order ID', key: 'OrderID', width: 12 },
  { header: 'Customer', key: 'Username', width: 20 },
  { header: 'Total', key: 'GrandTotal', width: 10 },
  { header: 'Status', key: 'OrderStatus', width: 14 },
  { header: 'Date', key: 'DatePlaced', width: 20 },
  { header: 'Shipping', key: 'ShippingOption', width: 18 },
];

function requireAuth(): NetoApiClient {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  return new NetoApiClient(loadConfig());
}

export function registerOrdersCommand(program: Command): void {
  const orders = program
    .command('orders')
    .description('Manage orders');

  orders
    .command('list')
    .description('List orders')
    .option('--limit <n>', 'Number of results', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--status <status>', 'Filter by order status (New, Pick, Pack, Dispatched, etc.)')
    .option('--date-from <date>', 'Filter orders placed from date (YYYY-MM-DD)')
    .option('--date-to <date>', 'Filter orders placed to date (YYYY-MM-DD)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Fetching orders...').start();

      try {
        const filter: Record<string, unknown> = {
          Limit: opts.limit,
          Page: opts.page,
          OutputSelector: fields,
        };
        if (opts.status) {
          filter.OrderStatus = [opts.status];
        } else {
          // Default: show all recent active statuses
          filter.OrderStatus = ['New', 'Pick', 'Pack', 'Pending Pickup', 'Pending Dispatch', 'Dispatched', 'On Hold'];
        }
        if (opts.dateFrom) filter.DatePlacedFrom = opts.dateFrom;
        if (opts.dateTo) filter.DatePlacedTo = opts.dateTo;

        const res = await client.callWithFilter('GetOrder', filter);
        printWarnings(res);
        const items = res.Order || [];
        spinner.stop();

        if (items.length === 0) {
          console.log(chalk.dim('No orders found.'));
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

  orders
    .command('get <id>')
    .description('Get order details by Order ID')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_GET_FIELDS);
      const spinner = ora(`Fetching order ${id}...`).start();

      try {
        const res = await client.callWithFilter('GetOrder', {
          OrderID: [id],
          OutputSelector: fields,
        });
        printWarnings(res);
        const items = res.Order || [];
        spinner.stop();

        if (items.length === 0) {
          console.log(chalk.yellow(`Order "${id}" not found.`));
          return;
        }

        const order = items[0];
        if (opts.json) {
          outputJson(order);
        } else {
          console.log(chalk.bold(`Order: ${order.OrderID}`));
          console.log();
          outputDetail(order);
        }
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    });

  orders
    .command('export')
    .description('Export all orders as JSON (paginated)')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--status <status>', 'Filter by order status')
    .option('--date-from <date>', 'Orders placed from date (YYYY-MM-DD)')
    .option('--date-to <date>', 'Orders placed to date (YYYY-MM-DD)')
    .option('--batch-size <n>', 'Orders per page', '100')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Exporting orders...').start();

      try {
        const allItems: unknown[] = [];
        let page = 0;

        while (true) {
          const filter: Record<string, unknown> = {
            Limit: opts.batchSize,
            Page: String(page),
            OutputSelector: fields,
          };
          if (opts.status) {
            filter.OrderStatus = [opts.status];
          } else {
            filter.OrderStatus = ['New', 'Pick', 'Pack', 'Pending Pickup', 'Pending Dispatch', 'Dispatched', 'On Hold'];
          }
          if (opts.dateFrom) filter.DatePlacedFrom = opts.dateFrom;
          if (opts.dateTo) filter.DatePlacedTo = opts.dateTo;

          const res = await client.callWithFilter('GetOrder', filter);
          const items = res.Order || [];
          if (items.length === 0) break;

          allItems.push(...items);
          spinner.text = `Exported ${allItems.length} orders...`;
          page++;
        }

        spinner.succeed(`Exported ${allItems.length} orders`);
        outputJson(allItems);
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    });

  orders.action(() => orders.outputHelp());
}
