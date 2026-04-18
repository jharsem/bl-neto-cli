import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';
import { buildPayload, collectField, readJsonInput } from '../lib/payload-helpers.js';

// Verified against ../neto-docs-engineer/docs/suppliers/{addsupplier,updatesupplier}.md
const FLAG_MAP: Record<string, string> = {
  supplierId: 'SupplierID',
  reference: 'SupplierReference',
  company: 'SupplierCompany',
  email: 'SupplierEmail',
  phone: 'SupplierPhone',
  fax: 'SupplierFax',
  url: 'SupplierURL',
  street: 'SupplierStreet1',
  street2: 'SupplierStreet2',
  city: 'SupplierCity',
  state: 'SupplierState',
  postcode: 'SupplierPostcode',
  country: 'SupplierCountry',
  currencyCode: 'SupplierCurrencyCode',
  leadTime1: 'LeadTime1',
  leadTime2: 'LeadTime2',
  notifyByEmail: 'NotifyByEmail',
  exportTemplate: 'ExportTemplate',
  accountCode: 'AccountCode',
  factoryStreet: 'FactoryStreet1',
  factoryStreet2: 'FactoryStreet2',
  factoryCity: 'FactoryCity',
  factoryState: 'FactoryState',
  factoryPostcode: 'FactoryPostcode',
  factoryCountry: 'FactoryCountry',
  notes: 'SupplierNotes',
};

const DEFAULT_LIST_FIELDS = [
  'SupplierID', 'SupplierCompany', 'SupplierEmail',
  'SupplierPhone', 'SupplierCity', 'SupplierCountry', 'SupplierCurrencyCode',
];

const DEFAULT_GET_FIELDS = [
  'SupplierID', 'SupplierReference', 'SupplierCompany',
  'SupplierEmail', 'SupplierPhone', 'SupplierFax', 'SupplierURL',
  'SupplierStreet1', 'SupplierStreet2', 'SupplierCity',
  'SupplierState', 'SupplierPostcode', 'SupplierCountry',
  'SupplierCurrencyCode', 'LeadTime1', 'LeadTime2',
  'AccountCode', 'SupplierNotes',
];

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'ID', key: 'SupplierID', width: 10 },
  { header: 'Company', key: 'SupplierCompany', width: 24 },
  { header: 'Email', key: 'SupplierEmail', width: 24 },
  { header: 'Phone', key: 'SupplierPhone', width: 16 },
  { header: 'City', key: 'SupplierCity', width: 14 },
  { header: 'Country', key: 'SupplierCountry', width: 9 },
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
    .option('--supplier-id <id>', 'Supplier ID (string, max 25)')
    .option('--company <c>', 'Company name')
    .option('--email <addr>', 'Email address')
    .option('--phone <p>', 'Phone')
    .option('--fax <f>', 'Fax')
    .option('--url <u>', 'Website URL')
    .option('--street <s>', 'Street line 1')
    .option('--street2 <s>', 'Street line 2')
    .option('--city <c>', 'City')
    .option('--state <s>', 'State')
    .option('--postcode <p>', 'Postcode')
    .option('--country <c>', 'Country (2-letter code)')
    .option('--currency-code <c>', 'Supplier currency code (3-letter)')
    .option('--lead-time1 <days>', 'Lead time 1 (days)')
    .option('--lead-time2 <days>', 'Lead time 2 (days)')
    .option('--notify-by-email <bool>', 'Notify by email (True/False)')
    .option('--account-code <c>', 'Account code')
    .option('--factory-street <s>', 'Factory street line 1')
    .option('--factory-street2 <s>', 'Factory street line 2')
    .option('--factory-city <c>', 'Factory city')
    .option('--factory-state <s>', 'Factory state')
    .option('--factory-postcode <p>', 'Factory postcode')
    .option('--factory-country <c>', 'Factory country (2-letter code)')
    .option('--notes <t>', 'Supplier notes')
    .option('--field <key=value>', 'Set any API field (repeatable)', collectField, [])
    .option('--from-json [path]', 'Read from JSON file or stdin')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON');

export function registerSuppliersCommand(program: Command): void {
  const suppliers = program
    .command('suppliers')
    .description('Manage suppliers');

  suppliers
    .command('list')
    .description('List suppliers')
    .option('--limit <n>', 'Number of results', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--country <c>', 'Filter by country code')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Fetching suppliers...').start();
      try {
        const filter: Record<string, unknown> = {
          Limit: opts.limit,
          Page: opts.page,
          OutputSelector: fields,
        };
        if (opts.country) filter.SupplierCountry = [opts.country];
        const res = await client.callWithFilter('GetSupplier', filter);
        printWarnings(res);
        const items = res.Supplier || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.dim('No suppliers found.')); return; }
        opts.json ? outputJson(items) : outputTable(LIST_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  suppliers
    .command('get <id>')
    .description('Get supplier by ID')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_GET_FIELDS);
      const spinner = ora(`Fetching supplier ${id}...`).start();
      try {
        const res = await client.callWithFilter('GetSupplier', {
          SupplierID: [id],
          OutputSelector: fields,
        });
        printWarnings(res);
        const items = res.Supplier || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.yellow(`Supplier "${id}" not found.`)); return; }
        const s = items[0];
        opts.json ? outputJson(s) : (console.log(chalk.bold(`Supplier: ${s.SupplierCompany || s.SupplierID}`)), console.log(), outputDetail(s));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  addWriteFlags(
    suppliers.command('create').description('Create a new supplier')
  ).action(async (opts) => {
    const client = requireAuth();
    let items: Record<string, unknown>[];
    if (opts.fromJson !== undefined) {
      try { items = await readJsonInput(opts.fromJson); }
      catch (err: any) { console.error(chalk.red(`Error reading JSON: ${err.message}`)); process.exit(1); }
    } else {
      items = [buildPayload(FLAG_MAP, opts)];
    }
    const body = { Supplier: items };
    if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
    const spinner = ora(`Creating ${items.length} supplier${items.length !== 1 ? 's' : ''}...`).start();
    try {
      const res = await client.call('AddSupplier', body);
      printWarnings(res);
      spinner.stop();
      if (opts.json) {
        outputJson(res);
      } else {
        const created = res.Supplier;
        const list = Array.isArray(created) ? created : created ? [created] : [];
        for (const s of list as any[]) {
          console.log(chalk.green(`Created supplier "${s.SupplierID || ''}"`));
        }
      }
    } catch (err: any) { spinner.fail(err.message); process.exit(1); }
  });

  addWriteFlags(
    suppliers.command('update <id>').description('Update a supplier by ID')
  ).action(async (id, opts) => {
    const client = requireAuth();
    let items: Record<string, unknown>[];
    if (opts.fromJson !== undefined) {
      try {
        items = await readJsonInput(opts.fromJson);
        if (items.length === 1 && !items[0].SupplierID) items[0].SupplierID = id;
      } catch (err: any) { console.error(chalk.red(`Error reading JSON: ${err.message}`)); process.exit(1); }
    } else {
      const payload = buildPayload(FLAG_MAP, opts);
      if (Object.keys(payload).length === 0) { console.error(chalk.red('Error: No fields to update.')); process.exit(1); }
      payload.SupplierID = id;
      items = [payload];
    }
    const body = { Supplier: items };
    if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
    const spinner = ora(`Updating supplier ${id}...`).start();
    try {
      const res = await client.call('UpdateSupplier', body);
      printWarnings(res);
      spinner.stop();
      if (opts.json) {
        outputJson(res);
      } else {
        console.log(chalk.green(`Updated supplier ${id}`));
      }
    } catch (err: any) { spinner.fail(err.message); process.exit(1); }
  });

  suppliers.action(() => suppliers.outputHelp());
}
