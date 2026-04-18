import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, type ColumnDef } from '../lib/output.js';

// Verified against ../neto-docs-engineer/docs/accounting-system/{get,add,update,delete}accountingsystemrelatedaccount.md
// Note: all field names are snake_case (acc_account_id, etc.) — this is how the API documents them

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'ID', key: 'acc_account_id', width: 8 },
  { header: 'Ref', key: 'acc_account_ref', width: 14 },
  { header: 'Name', key: 'acc_account_name', width: 26 },
  { header: 'Type', key: 'acc_account_type', width: 16 },
  { header: 'Class', key: 'acc_account_class', width: 14 },
  { header: 'Active', key: 'acc_account_active', width: 8 },
];

function requireAuth(): NetoApiClient {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  return new NetoApiClient(loadConfig());
}

const addWriteFlags = (cmd: Command) =>
  cmd
    .option('--accapi-id <id>', 'External accounting API account ID')
    .option('--ref <r>', 'Account reference')
    .option('--parent-ref <r>', 'Parent account reference')
    .option('--name <n>', 'Account name')
    .option('--type <t>', 'Account type')
    .option('--class <c>', 'Account class')
    .option('--is-asset <bool>', 'Is asset account (True/False)')
    .option('--is-expense <bool>', 'Is expense account (True/False)')
    .option('--is-income <bool>', 'Is income account (True/False)')
    .option('--is-cos <bool>', 'Is cost-of-sales account (True/False)')
    .option('--is-bank <bool>', 'Is bank account (True/False)')
    .option('--note <t>', 'Account note')
    .option('--active <bool>', 'Active (True/False)')
    .option('--is-detail <bool>', 'Is detail account (True/False)')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON');

function buildAccountPayload(opts: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (opts.accapiId !== undefined) out.accapi_id = opts.accapiId;
  if (opts.ref !== undefined) out.acc_account_ref = opts.ref;
  if (opts.parentRef !== undefined) out.acc_account_parent_ref = opts.parentRef;
  if (opts.name !== undefined) out.acc_account_name = opts.name;
  if (opts.type !== undefined) out.acc_account_type = opts.type;
  if (opts.class !== undefined) out.acc_account_class = opts.class;
  if (opts.isAsset !== undefined) out.is_asset_acc = opts.isAsset;
  if (opts.isExpense !== undefined) out.is_expense_acc = opts.isExpense;
  if (opts.isIncome !== undefined) out.is_income_acc = opts.isIncome;
  if (opts.isCos !== undefined) out.is_costofsales_acc = opts.isCos;
  if (opts.isBank !== undefined) out.is_bank_acc = opts.isBank;
  if (opts.note !== undefined) out.acc_account_note = opts.note;
  if (opts.active !== undefined) out.acc_account_active = opts.active;
  if (opts.isDetail !== undefined) out.acc_account_is_detail = opts.isDetail;
  return out;
}

export function registerAccountingCommand(program: Command): void {
  const accounting = program
    .command('accounting')
    .description('Manage accounting system related accounts');

  const accounts = accounting
    .command('accounts')
    .description('Manage related accounts');

  accounts
    .command('list')
    .description('List all related accounts')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const spinner = ora('Fetching accounting accounts...').start();
      try {
        const res = await client.call('GetAccountingSystemRelatedAccounts', {});
        printWarnings(res);
        // Response: { RelatedAccounts: [{ RelatedAccount: [...] }] }
        const ra = res.RelatedAccounts;
        const items: any[] = Array.isArray(ra)
          ? (ra[0]?.RelatedAccount ?? [])
          : (ra?.RelatedAccount ?? []);
        spinner.stop();
        if (items.length === 0) { console.log(chalk.dim('No accounting accounts found.')); return; }
        opts.json ? outputJson(items) : outputTable(LIST_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  accounts
    .command('get <id>')
    .description('Show a single account by ID')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      const spinner = ora(`Fetching account ${id}...`).start();
      try {
        const res = await client.call('GetAccountingSystemRelatedAccounts', {});
        printWarnings(res);
        const ra = res.RelatedAccounts;
        const all: any[] = Array.isArray(ra)
          ? (ra[0]?.RelatedAccount ?? [])
          : (ra?.RelatedAccount ?? []);
        const item = all.find((a: any) => String(a.acc_account_id) === String(id));
        spinner.stop();
        if (!item) { console.log(chalk.yellow(`Account "${id}" not found.`)); return; }
        opts.json ? outputJson(item) : (console.log(chalk.bold(`Account: ${item.acc_account_name || item.acc_account_id}`)), console.log(), outputDetail(item));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  addWriteFlags(
    accounts.command('create').description('Create a new related account')
  ).action(async (opts) => {
    const client = requireAuth();
    const payload = buildAccountPayload(opts);
    if (Object.keys(payload).length === 0) { console.error(chalk.red('Error: No fields provided.')); process.exit(1); }
    const body = { RelatedAccount: payload };
    if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
    const spinner = ora('Creating accounting account...').start();
    try {
      const res = await client.call('AddAccountingSystemRelatedAccount', body);
      printWarnings(res);
      spinner.stop();
      if (opts.json) {
        outputJson(res);
      } else {
        const ra = res.RelatedAccounts;
        const list: any[] = Array.isArray(ra)
          ? (ra[0]?.RelatedAccount ?? [])
          : (ra?.RelatedAccount ?? []);
        if (list.length > 0) {
          console.log(chalk.green(`Created account ${list[0].acc_account_id}`));
        } else {
          console.log(chalk.green('Created accounting account.'));
        }
      }
    } catch (err: any) { spinner.fail(err.message); process.exit(1); }
  });

  addWriteFlags(
    accounts.command('update <id>').description('Update a related account by ID')
  ).action(async (id, opts) => {
    const client = requireAuth();
    const payload = buildAccountPayload(opts);
    if (Object.keys(payload).length === 0) { console.error(chalk.red('Error: No fields to update.')); process.exit(1); }
    payload.acc_account_id = id;
    const body = { RelatedAccount: payload };
    if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
    const spinner = ora(`Updating account ${id}...`).start();
    try {
      const res = await client.call('UpdateAccountingSystemRelatedAccount', body);
      printWarnings(res);
      spinner.stop();
      opts.json ? outputJson(res) : console.log(chalk.green(`Updated account ${id}`));
    } catch (err: any) { spinner.fail(err.message); process.exit(1); }
  });

  accounts
    .command('delete <id>')
    .description('Delete a related account by ID')
    .option('--yes', 'Skip confirmation prompt')
    .option('--json', 'Output response as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      if (!opts.yes) {
        console.error(chalk.yellow(`This will permanently delete account ${id}. Pass --yes to confirm.`));
        process.exit(1);
      }
      const body = { RelatedAccount: { acc_account_id: [id] } };
      const spinner = ora(`Deleting account ${id}...`).start();
      try {
        const res = await client.call('DeleteAccountingSystemRelatedAccount', body);
        printWarnings(res);
        spinner.stop();
        opts.json ? outputJson(res) : console.log(chalk.green(`Deleted account ${id}`));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  accounts.action(() => accounts.outputHelp());
  accounting.action(() => accounting.outputHelp());
}
