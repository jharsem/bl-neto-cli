import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';
import { buildPayload, collectField, readJsonInput } from '../lib/payload-helpers.js';

// Verified against ../neto-docs-engineer/docs/warehouses/{addwarehouse,updatewarehouse}.md
const FLAG_MAP: Record<string, string> = {
  reference: 'WarehouseReference',
  name: 'WarehouseName',
  isPrimary: 'IsPrimary',
  isActive: 'IsActive',
  showQuantity: 'ShowQuantity',
  contact: 'WarehouseContact',
  phone: 'WarehousePhone',
  street: 'WarehouseStreet1',
  street2: 'WarehouseStreet2',
  city: 'WarehouseCity',
  state: 'WarehouseState',
  postcode: 'WarehousePostcode',
  country: 'WarehouseCountry',
  notes: 'WarehouseNotes',
};

const DEFAULT_LIST_FIELDS = [
  'WarehouseID', 'WarehouseReference', 'WarehouseName',
  'IsPrimary', 'IsActive', 'WarehouseCity', 'WarehouseCountry',
];

const DEFAULT_GET_FIELDS = [
  'WarehouseID', 'WarehouseReference', 'WarehouseName',
  'IsPrimary', 'IsActive', 'ShowQuantity',
  'WarehouseContact', 'WarehousePhone',
  'WarehouseStreet1', 'WarehouseStreet2', 'WarehouseCity',
  'WarehouseState', 'WarehousePostcode', 'WarehouseCountry',
  'WarehouseNotes',
];

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'ID', key: 'WarehouseID', width: 6 },
  { header: 'Reference', key: 'WarehouseReference', width: 14 },
  { header: 'Name', key: 'WarehouseName', width: 22 },
  { header: 'Primary', key: 'IsPrimary', width: 9 },
  { header: 'Active', key: 'IsActive', width: 8 },
  { header: 'City', key: 'WarehouseCity', width: 16 },
  { header: 'Country', key: 'WarehouseCountry', width: 9 },
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
    .option('--reference <r>', 'Warehouse reference (required on create, max 10 chars)')
    .option('--name <n>', 'Warehouse name')
    .option('--is-primary <bool>', 'Primary warehouse (True/False — required on create)')
    .option('--is-active <bool>', 'Active (True/False)')
    .option('--show-quantity <bool>', 'Show quantity on storefront (True/False)')
    .option('--contact <c>', 'Contact name')
    .option('--phone <p>', 'Phone')
    .option('--street <s>', 'Street line 1')
    .option('--street2 <s>', 'Street line 2')
    .option('--city <c>', 'City')
    .option('--state <s>', 'State')
    .option('--postcode <p>', 'Postcode')
    .option('--country <c>', 'Country')
    .option('--notes <t>', 'Notes')
    .option('--field <key=value>', 'Set any API field (repeatable)', collectField, [])
    .option('--from-json [path]', 'Read from JSON file or stdin')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON');

export function registerWarehousesCommand(program: Command): void {
  const warehouses = program
    .command('warehouses')
    .description('Manage warehouses');

  warehouses
    .command('list')
    .description('List warehouses')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Fetching warehouses...').start();
      try {
        const res = await client.callWithFilter('GetWarehouse', {
          IsActive: ['True'],
          OutputSelector: fields,
        });
        printWarnings(res);
        const items = res.Warehouse || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.dim('No warehouses found.')); return; }
        opts.json ? outputJson(items) : outputTable(LIST_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  warehouses
    .command('get <id>')
    .description('Get warehouse by ID or reference')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_GET_FIELDS);
      const spinner = ora(`Fetching warehouse ${id}...`).start();
      try {
        const filter = /^\d+$/.test(id)
          ? { WarehouseID: [id], OutputSelector: fields }
          : { WarehouseReference: [id], OutputSelector: fields };
        const res = await client.callWithFilter('GetWarehouse', filter);
        printWarnings(res);
        const items = res.Warehouse || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.yellow(`Warehouse "${id}" not found.`)); return; }
        const w = items[0];
        opts.json ? outputJson(w) : (console.log(chalk.bold(`Warehouse: ${w.WarehouseName || w.WarehouseReference}`)), console.log(), outputDetail(w));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  addWriteFlags(
    warehouses.command('create').description('Create a new warehouse')
  ).action(async (opts) => {
    const client = requireAuth();
    let items: Record<string, unknown>[];
    if (opts.fromJson !== undefined) {
      try { items = await readJsonInput(opts.fromJson); }
      catch (err: any) { console.error(chalk.red(`Error reading JSON: ${err.message}`)); process.exit(1); }
    } else {
      if (!opts.reference) { console.error(chalk.red('Error: --reference is required.')); process.exit(1); }
      if (!opts.isPrimary) { console.error(chalk.red('Error: --is-primary is required (True/False).')); process.exit(1); }
      items = [buildPayload(FLAG_MAP, opts)];
    }
    const body = { Warehouse: items };
    if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
    const spinner = ora(`Creating ${items.length} warehouse${items.length !== 1 ? 's' : ''}...`).start();
    try {
      const res = await client.call('AddWarehouse', body);
      printWarnings(res);
      spinner.stop();
      if (opts.json) {
        outputJson(res);
      } else {
        const created = res.Warehouse;
        const list = Array.isArray(created) ? created : created ? [created] : [];
        for (const w of list as any[]) {
          console.log(chalk.green(`Created warehouse ${w.WarehouseID} (${w.WarehouseReference || ''})`));
        }
      }
    } catch (err: any) { spinner.fail(err.message); process.exit(1); }
  });

  addWriteFlags(
    warehouses.command('update <id>').description('Update a warehouse by ID')
  ).action(async (id, opts) => {
    const client = requireAuth();
    let items: Record<string, unknown>[];
    if (opts.fromJson !== undefined) {
      try {
        items = await readJsonInput(opts.fromJson);
        if (items.length === 1 && !items[0].WarehouseID) items[0].WarehouseID = id;
      } catch (err: any) { console.error(chalk.red(`Error reading JSON: ${err.message}`)); process.exit(1); }
    } else {
      const payload = buildPayload(FLAG_MAP, opts);
      const fieldCount = Object.keys(payload).length;
      if (fieldCount === 0) { console.error(chalk.red('Error: No fields to update.')); process.exit(1); }
      payload.WarehouseID = id;
      // UpdateWarehouse also requires IsPrimary even on updates
      if (!payload.IsPrimary) { console.error(chalk.red('Error: --is-primary is required by the Neto API even for updates.')); process.exit(1); }
      items = [payload];
    }
    const body = { Warehouse: items };
    if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
    const spinner = ora(`Updating warehouse ${id}...`).start();
    try {
      const res = await client.call('UpdateWarehouse', body);
      printWarnings(res);
      spinner.stop();
      if (opts.json) {
        outputJson(res);
      } else {
        console.log(chalk.green(`Updated warehouse ${id}`));
      }
    } catch (err: any) { spinner.fail(err.message); process.exit(1); }
  });

  warehouses.action(() => warehouses.outputHelp());
}
