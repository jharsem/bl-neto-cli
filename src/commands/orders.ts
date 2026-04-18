import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';
import { collectField, readJsonInput } from '../lib/payload-helpers.js';
import { buildAddOrderPayload, buildUpdateOrderPayload } from '../lib/order-helpers.js';

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
    .option('--status <status>', 'Filter by order status (New, New Backorder, Backorder Approved, Pick, Pack, Pending Pickup, Pending Dispatch, Dispatched, On Hold, Quote, Cancelled, Uncommitted)')
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
          filter.OrderStatus = ['New', 'New Backorder', 'Backorder Approved', 'Pick', 'Pack', 'Pending Pickup', 'Pending Dispatch', 'Dispatched', 'On Hold'];
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
            filter.OrderStatus = ['New', 'New Backorder', 'Backorder Approved', 'Pick', 'Pack', 'Pending Pickup', 'Pending Dispatch', 'Dispatched', 'On Hold'];
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

  const addAddressFlags = (cmd: Command) =>
    cmd
      .option('--email <addr>', 'Customer email (required)')
      .option('--username <u>', 'Existing customer username')
      .option('--bill-first-name <n>', 'Billing first name')
      .option('--bill-last-name <n>', 'Billing last name')
      .option('--bill-company <c>', 'Billing company')
      .option('--bill-street <s>', 'Billing street line 1')
      .option('--bill-street2 <s>', 'Billing street line 2')
      .option('--bill-city <c>', 'Billing city')
      .option('--bill-state <s>', 'Billing state')
      .option('--bill-postcode <p>', 'Billing postcode')
      .option('--bill-phone <p>', 'Billing contact phone')
      .option('--bill-country <c>', 'Billing country (2-letter code)')
      .option('--ship-same-as-bill', 'Copy billing to shipping')
      .option('--ship-first-name <n>', 'Shipping first name')
      .option('--ship-last-name <n>', 'Shipping last name')
      .option('--ship-company <c>', 'Shipping company')
      .option('--ship-street <s>', 'Shipping street line 1')
      .option('--ship-street2 <s>', 'Shipping street line 2')
      .option('--ship-city <c>', 'Shipping city')
      .option('--ship-state <s>', 'Shipping state')
      .option('--ship-postcode <p>', 'Shipping postcode')
      .option('--ship-phone <p>', 'Shipping contact phone')
      .option('--ship-country <c>', 'Shipping country (2-letter code)')
      .option('--enable-address-validation <bool>', 'Enable address validation')
      .option('--field <key=value>', 'Set any API field (repeatable)', collectField, [])
      .option('--from-json [path]', 'Read from JSON file or stdin')
      .option('--dry-run', 'Show payload without sending')
      .option('--json', 'Output response as JSON');

  const createCmd = orders
    .command('create')
    .description('Create a new order')
    .option('--order-id <id>', 'Order ID (usually auto-assigned — omit to let Neto generate)')
    .option('--order-type <t>', 'sales | dropshipping | quote')
    .option('--on-hold-type <t>', 'On Hold | Layby')
    .option('--user-group <g>', 'User group')
    .option('--order-status <s>', 'Initial order status (New, Pick, Pack, Dispatched, ...)')
    .option('--date-placed <dt>', 'DatePlaced (YYYY-MM-DD HH:MM:SS)')
    .option('--date-required <dt>', 'DateRequired (YYYY-MM-DD)')
    .option('--date-invoiced <dt>', 'DateInvoiced')
    .option('--date-due <dt>', 'DateDue')
    .option('--payment-method <m>', 'Payment method')
    .option('--payment-terms <t>', 'Payment terms')
    .option('--tax-inclusive <bool>', 'Tax-inclusive pricing (True/False)')
    .option('--shipping-method <m>', 'Shipping method')
    .option('--shipping-cost <amt>', 'Shipping cost (decimal)')
    .option('--shipping-discount <amt>', 'Shipping discount (decimal)')
    .option('--currency-code <c>', '3-letter currency code')
    .option('--sales-channel <c>', 'Sales channel')
    .option('--sales-person <p>', 'Sales person')
    .option('--purchase-order-number <n>', 'Purchase order number')
    .option('--ship-instructions <t>', 'Shipping instructions')
    .option('--internal-order-notes <t>', 'Internal order notes')
    .option('--line <SKU:QTY[:PRICE]>', 'Order line (repeatable). Use --from-json for complex lines.', collectField, []);
  addAddressFlags(createCmd).action(async (opts) => {
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
      if (!opts.email) {
        console.error(chalk.red('Error: --email is required. Use --from-json for bulk creation.'));
        process.exit(1);
      }
      if (!opts.billCompany) {
        console.error(chalk.red('Error: --bill-company is required by the Neto API.'));
        process.exit(1);
      }
      if ((!opts.line || opts.line.length === 0)) {
        console.error(chalk.red('Error: at least one --line SKU:QTY is required. Use --from-json for complex OrderLine payloads.'));
        process.exit(1);
      }
      try {
        items = [buildAddOrderPayload(opts)];
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }

    const body = { Order: items };

    if (opts.dryRun) {
      console.log(chalk.bold('Dry run — would send:'));
      outputJson(body);
      return;
    }

    const spinner = ora(`Creating ${items.length} order${items.length !== 1 ? 's' : ''}...`).start();

    try {
      const res = await client.call('AddOrder', body);
      printWarnings(res);
      spinner.stop();

      if (opts.json) {
        outputJson(res);
      } else {
        const order = res.Order;
        const createdId = Array.isArray(order) ? order[0]?.OrderID : order?.OrderID;
        console.log(chalk.green(`Created order ${createdId || ''}`.trim()));
      }
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

  const updateCmd = orders
    .command('update <id>')
    .description('Update an existing order')
    .option('--order-status <s>', 'New order status')
    .option('--send-order-email <t>', 'tracking | receipt — send an email after update')
    .option('--pick-status <s>', 'Complete | Incomplete')
    .option('--export-status <s>', 'Pending | Exported')
    .option('--deduce-warehouse <bool>', 'Auto-pick warehouse (True/False)')
    .option('--sku <sku>', 'Target OrderLine SKU for tracking details')
    .option('--tracking-number <n>', 'Tracking number (attached to OrderLine)')
    .option('--tracking-shipping-method <m>', 'Shipping method for tracking (must match a Neto service)')
    .option('--date-shipped <dt>', 'DateShipped (YYYY-MM-DD HH:MM:SS)')
    .option('--date-required <dt>', 'DateRequired')
    .option('--sales-person <p>', 'Sales person')
    .option('--sales-channel <c>', 'Sales channel')
    .option('--purchase-order-number <n>', 'Purchase order number')
    .option('--on-hold-type <t>', 'On Hold | Layby')
    .option('--ship-instructions <t>', 'Shipping instructions')
    .option('--internal-order-notes <t>', 'Internal order notes')
    .option('--sticky-note-title <t>', 'Sticky note title')
    .option('--sticky-note <t>', 'Sticky note body');
  addAddressFlags(updateCmd).action(async (id, opts) => {
    const client = requireAuth();

    let items: Record<string, unknown>[];

    if (opts.fromJson !== undefined) {
      try {
        items = await readJsonInput(opts.fromJson);
        if (items.length === 1 && !items[0].OrderID) {
          items[0].OrderID = id;
        }
      } catch (err: any) {
        console.error(chalk.red(`Error reading JSON: ${err.message}`));
        process.exit(1);
      }
    } else {
      let payload: Record<string, unknown>;
      try {
        payload = buildUpdateOrderPayload(opts, id);
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
      const fieldCount = Object.keys(payload).filter(k => k !== 'OrderID').length;
      if (fieldCount === 0) {
        console.error(chalk.red('Error: No fields to update. Provide flags, --field, or --from-json.'));
        process.exit(1);
      }
      items = [payload];
    }

    const body = { Order: items };

    if (opts.dryRun) {
      console.log(chalk.bold('Dry run — would send:'));
      outputJson(body);
      return;
    }

    const spinner = ora(`Updating order ${id}...`).start();

    try {
      const res = await client.call('UpdateOrder', body);
      printWarnings(res);
      spinner.stop();

      if (opts.json) {
        outputJson(res);
      } else {
        const fieldCount = Object.keys(items[0]).filter(k => k !== 'OrderID').length;
        console.log(chalk.green(`Updated order ${id} (${fieldCount} field${fieldCount !== 1 ? 's' : ''} changed)`));
      }
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

  orders.action(() => orders.outputHelp());
}
