import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';
import { collectField, readJsonInput } from '../lib/payload-helpers.js';

// Verified against ../neto-docs-engineer/docs/voucher/{addvoucher,updatevoucher,redeemvoucher}.md
const CREATE_FLAG_MAP: Record<string, string> = {
  orderId: 'OrderID',
  sku: 'SKU',
  senderEmail: 'SenderEmail',
  senderName: 'SenderName',
  recipientName: 'RecipientName',
  recipientEmail: 'RecipientEmail',
  giftMessage: 'GiftMessage',
  dateSendVoucher: 'DateSendVoucher',
};

const DEFAULT_LIST_FIELDS = [
  'VoucherID', 'VoucherCode', 'ProgramType', 'Balance',
  'IsRedeemed', 'Owner', 'SenderEmail', 'RecipientEmail', 'OrderID',
];

const DEFAULT_GET_FIELDS = [
  'VoucherID', 'VoucherCode', 'ProgramType', 'Balance',
  'IsRedeemed', 'Owner', 'SenderEmail', 'SenderName',
  'RecipientEmail', 'RecipientName', 'GiftMessage',
  'OrderID', 'SKU', 'DateSendVoucher', 'DatePosted', 'DateUpdated',
];

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'ID', key: 'VoucherID', width: 8 },
  { header: 'Code', key: 'VoucherCode', width: 18 },
  { header: 'Type', key: 'ProgramType', width: 12 },
  { header: 'Balance', key: 'Balance', width: 10 },
  { header: 'Redeemed', key: 'IsRedeemed', width: 10 },
  { header: 'Owner', key: 'Owner', width: 16 },
  { header: 'Recipient', key: 'RecipientEmail', width: 24 },
];

function requireAuth(): NetoApiClient {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  return new NetoApiClient(loadConfig());
}

function buildCreate(opts: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [flag, field] of Object.entries(CREATE_FLAG_MAP)) {
    if (opts[flag] !== undefined) out[field] = opts[flag];
  }
  for (const entry of (opts.field ?? []) as string[]) {
    const eq = entry.indexOf('=');
    if (eq === -1) continue;
    out[entry.slice(0, eq)] = entry.slice(eq + 1);
  }
  return out;
}

export function registerVouchersCommand(program: Command): void {
  const vouchers = program
    .command('vouchers')
    .description('Manage gift/reward vouchers');

  vouchers
    .command('list')
    .description('List vouchers')
    .option('--limit <n>', 'Number of results', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--type <t>', 'Filter by program type (Reward/Gift/Third Party)')
    .option('--redeemed <bool>', 'Filter by IsRedeemed (True/False)')
    .option('--owner <email>', 'Filter by owner email')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Fetching vouchers...').start();
      try {
        const filter: Record<string, unknown> = {
          Limit: opts.limit,
          Page: opts.page,
          OutputSelector: fields,
        };
        if (opts.type) filter.ProgramType = [opts.type];
        if (opts.redeemed !== undefined) filter.IsRedeemed = opts.redeemed;
        if (opts.owner) filter.Owner = [opts.owner];
        const res = await client.callWithFilter('GetVoucher', filter);
        printWarnings(res);
        const items = res.Voucher || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.dim('No vouchers found.')); return; }
        opts.json ? outputJson(items) : outputTable(LIST_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  vouchers
    .command('get <id>')
    .description('Get voucher by ID or code')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_GET_FIELDS);
      const spinner = ora(`Fetching voucher ${id}...`).start();
      try {
        const filter = /^\d+$/.test(id)
          ? { VoucherID: [id], OutputSelector: fields }
          : { VoucherCode: [id], OutputSelector: fields };
        const res = await client.callWithFilter('GetVoucher', filter);
        printWarnings(res);
        const items = res.Voucher || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.yellow(`Voucher "${id}" not found.`)); return; }
        const v = items[0];
        opts.json ? outputJson(v) : (console.log(chalk.bold(`Voucher: ${v.VoucherCode || v.VoucherID}`)), console.log(), outputDetail(v));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  vouchers
    .command('create')
    .description('Create a voucher (attached to an existing order + SKU)')
    .option('--order-id <id>', 'Order ID (required)')
    .option('--sku <s>', 'Voucher product SKU (required)')
    .option('--sender-email <addr>', 'Sender email')
    .option('--sender-name <n>', 'Sender name')
    .option('--recipient-name <n>', 'Recipient name')
    .option('--recipient-email <addr>', 'Recipient email')
    .option('--gift-message <t>', 'Gift message')
    .option('--date-send-voucher <dt>', 'Date to send voucher (YYYY-MM-DD HH:MM:SS)')
    .option('--field <key=value>', 'Set any API field (repeatable)', collectField, [])
    .option('--from-json [path]', 'Read from JSON file or stdin')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      let items: Record<string, unknown>[];
      if (opts.fromJson !== undefined) {
        try { items = await readJsonInput(opts.fromJson); }
        catch (err: any) { console.error(chalk.red(`Error reading JSON: ${err.message}`)); process.exit(1); }
      } else {
        if (!opts.orderId) { console.error(chalk.red('Error: --order-id is required.')); process.exit(1); }
        if (!opts.sku) { console.error(chalk.red('Error: --sku is required.')); process.exit(1); }
        items = [buildCreate(opts)];
      }
      const body = { Voucher: items };
      if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
      const spinner = ora(`Creating ${items.length} voucher${items.length !== 1 ? 's' : ''}...`).start();
      try {
        const res = await client.call('AddVoucher', body);
        printWarnings(res);
        spinner.stop();
        if (opts.json) {
          outputJson(res);
        } else {
          const created = res.Voucher;
          const list = Array.isArray(created) ? created : created ? [created] : [];
          if (list.length === 0) {
            console.log(chalk.yellow('No voucher returned in response — check warnings above.'));
          } else {
            for (const v of list as any[]) {
              console.log(chalk.green(`Created voucher ${v.VoucherID} (code: ${v.VoucherCode || 'N/A'})`));
            }
          }
        }
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  vouchers
    .command('update <id>')
    .description('Update a voucher (all four fields required by API)')
    .option('--email <addr>', 'Current owner email (required)')
    .option('--is-redeemed <bool>', 'Mark as redeemed (True/False) (required)')
    .option('--owner <email>', 'New owner email (required)')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      if (!opts.email) { console.error(chalk.red('Error: --email is required.')); process.exit(1); }
      if (opts.isRedeemed === undefined) { console.error(chalk.red('Error: --is-redeemed is required.')); process.exit(1); }
      if (!opts.owner) { console.error(chalk.red('Error: --owner is required.')); process.exit(1); }
      const item: Record<string, unknown> = {
        VoucherID: id,
        Email: opts.email,
        IsRedeemed: opts.isRedeemed,
        Owner: opts.owner,
      };
      const body = { Voucher: [item] };
      if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
      const spinner = ora(`Updating voucher ${id}...`).start();
      try {
        const res = await client.call('UpdateVoucher', body);
        printWarnings(res);
        spinner.stop();
        opts.json ? outputJson(res) : console.log(chalk.green(`Updated voucher ${id}`));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  vouchers
    .command('redeem <id>')
    .description('Redeem a voucher')
    .option('--order-id <id>', 'Order ID (required)')
    .option('--date-redeemed <dt>', 'Date redeemed (YYYY-MM-DD HH:MM:SS) (required)')
    .option('--redeem-amount <n>', 'Amount to redeem')
    .option('--card-authorisation <c>', 'Card authorisation code')
    .option('--payment-method-id <id>', 'Payment method ID')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      if (!opts.orderId) { console.error(chalk.red('Error: --order-id is required.')); process.exit(1); }
      if (!opts.dateRedeemed) { console.error(chalk.red('Error: --date-redeemed is required.')); process.exit(1); }
      const item: Record<string, unknown> = {
        VoucherID: id,
        OrderID: opts.orderId,
        DateRedeemed: opts.dateRedeemed,
      };
      if (opts.redeemAmount !== undefined) item.RedeemAmount = opts.redeemAmount;
      if (opts.cardAuthorisation !== undefined) item.CardAuthorisation = opts.cardAuthorisation;
      if (opts.paymentMethodId !== undefined) item.PaymentMethodID = opts.paymentMethodId;
      const body = { Voucher: [item] };
      if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
      const spinner = ora(`Redeeming voucher ${id}...`).start();
      try {
        const res = await client.call('RedeemVoucher', body);
        printWarnings(res);
        spinner.stop();
        opts.json ? outputJson(res) : console.log(chalk.green(`Redeemed voucher ${id}`));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  vouchers.action(() => vouchers.outputHelp());
}
