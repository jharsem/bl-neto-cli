import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';

// Verified against ../neto-docs-engineer/docs/payments/{getpayment,addpayment,getpaymentmethods}.md
const DEFAULT_LIST_FIELDS = [
  'ID', 'OrderID', 'AmountPaid', 'CurrencyCode', 'DatePaid',
  'PaymentMethodName', 'ProcessBy', 'CardAuthorisation',
];

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'Pay ID', key: 'PaymentID', width: 8 },
  { header: 'Order ID', key: 'OrderID', width: 12 },
  { header: 'Amount', key: 'AmountPaid', width: 10 },
  { header: 'Currency', key: 'CurrencyCode', width: 10 },
  { header: 'Method', key: 'PaymentMethodName', width: 20 },
  { header: 'Date Paid', key: 'DatePaid', width: 22 },
];

const METHODS_COLUMNS: ColumnDef[] = [
  { header: 'ID', key: 'id', width: 6 },
  { header: 'Name', key: 'name', width: 30 },
  { header: 'Active', key: 'active', width: 8 },
  { header: 'Visible', key: 'visible', width: 9 },
  { header: 'Acc Code', key: 'acc_code', width: 12 },
];

function requireAuth(): NetoApiClient {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  return new NetoApiClient(loadConfig());
}

export function registerPaymentsCommand(program: Command): void {
  const payments = program
    .command('payments')
    .description('Manage order payments');

  payments
    .command('list')
    .description('List payments')
    .option('--limit <n>', 'Number of results', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--order-id <id>', 'Filter by order ID')
    .option('--from <dt>', 'Filter by DatePaidFrom (YYYY-MM-DD HH:MM:SS)')
    .option('--to <dt>', 'Filter by DatePaidTo (YYYY-MM-DD HH:MM:SS)')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Fetching payments...').start();
      try {
        const filter: Record<string, unknown> = {
          Limit: opts.limit,
          Page: opts.page,
          OutputSelector: fields,
        };
        if (opts.orderId) filter.OrderID = [opts.orderId];
        if (opts.from) filter.DatePaidFrom = opts.from;
        if (opts.to) filter.DatePaidTo = opts.to;
        const res = await client.callWithFilter('GetPayment', filter);
        printWarnings(res);
        const items = res.Payment || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.dim('No payments found.')); return; }
        opts.json ? outputJson(items) : outputTable(LIST_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  payments
    .command('get <id>')
    .description('Get payment by ID')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora(`Fetching payment ${id}...`).start();
      try {
        const res = await client.callWithFilter('GetPayment', {
          PaymentID: [id],
          OutputSelector: fields,
        });
        printWarnings(res);
        const items = res.Payment || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.yellow(`Payment "${id}" not found.`)); return; }
        const p = items[0];
        opts.json ? outputJson(p) : (console.log(chalk.bold(`Payment: ${p.PaymentID} (Order: ${p.OrderID})`)), console.log(), outputDetail(p));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  payments
    .command('create')
    .description('Add a payment to an order')
    .option('--order-id <id>', 'Order ID (required)')
    .option('--amount <n>', 'Amount paid (required)')
    .option('--authorisation <c>', 'Card authorisation code (required)')
    .option('--method-id <id>', 'Payment method ID')
    .option('--method-name <n>', 'Payment method name')
    .option('--date-paid <dt>', 'Date paid (YYYY-MM-DD)')
    .option('--is-credit <bool>', 'Is credit payment (True/False)')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      if (!opts.orderId) { console.error(chalk.red('Error: --order-id is required.')); process.exit(1); }
      if (!opts.amount) { console.error(chalk.red('Error: --amount is required.')); process.exit(1); }
      if (!opts.authorisation) { console.error(chalk.red('Error: --authorisation is required.')); process.exit(1); }
      const item: Record<string, unknown> = {
        OrderID: opts.orderId,
        AmountPaid: opts.amount,
        CardAuthorisation: opts.authorisation,
      };
      if (opts.methodId) item.PaymentMethodID = opts.methodId;
      if (opts.methodName) item.PaymentMethodName = opts.methodName;
      if (opts.datePaid) item.DatePaid = opts.datePaid;
      if (opts.isCredit !== undefined) item.IsCreditPayment = opts.isCredit;
      const body = { Payment: [item] };
      if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
      const spinner = ora('Adding payment...').start();
      try {
        const res = await client.call('AddPayment', body);
        printWarnings(res);
        spinner.stop();
        if (opts.json) {
          outputJson(res);
        } else {
          const created = res.Payment;
          const list = Array.isArray(created) ? created : created ? [created] : [];
          for (const p of list as any[]) {
            console.log(chalk.green(`Added payment ${p.PaymentID}`));
          }
        }
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  payments
    .command('methods')
    .description('List available payment methods')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const spinner = ora('Fetching payment methods...').start();
      try {
        const res = await client.call('GetPaymentMethods', {});
        printWarnings(res);
        // Response: { PaymentMethods: [{ PaymentMethod: [...] }] } or { PaymentMethods: { PaymentMethod: [...] } }
        const pm = res.PaymentMethods;
        const items: any[] = Array.isArray(pm)
          ? (pm[0]?.PaymentMethod ?? [])
          : (pm?.PaymentMethod ?? []);
        spinner.stop();
        if (items.length === 0) { console.log(chalk.dim('No payment methods found.')); return; }
        opts.json ? outputJson(items) : outputTable(METHODS_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  payments.action(() => payments.outputHelp());
}
