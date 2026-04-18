import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';
import { buildPayload, collectField, readJsonInput } from '../lib/payload-helpers.js';

// Verified against ../neto-docs-engineer/docs/categories/{addcategory,updatecategory}.md
const FLAG_MAP: Record<string, string> = {
  name: 'CategoryName',
  reference: 'CategoryReference',
  parentId: 'ParentCategoryID',
  sortOrder: 'SortOrder',
  active: 'Active',
  onSiteMap: 'OnSiteMap',
  onMenu: 'OnMenu',
  allowReviews: 'AllowReviews',
  requireLogin: 'RequireLogin',
  shortDescription1: 'ShortDescription1',
  shortDescription2: 'ShortDescription2',
  shortDescription3: 'ShortDescription3',
  description1: 'Description1',
  description2: 'Description2',
  description3: 'Description3',
};

const DEFAULT_LIST_FIELDS = [
  'CategoryID', 'CategoryName', 'ParentCategoryID',
  'Active', 'OnMenu', 'SortOrder', 'DatePosted',
];

const DEFAULT_GET_FIELDS = [
  'CategoryID', 'CategoryName', 'CategoryReference',
  'ParentCategoryID', 'Active', 'SortOrder',
  'OnSiteMap', 'OnMenu', 'AllowReviews', 'RequireLogin',
  'ShortDescription1', 'Description1', 'DatePosted', 'DateUpdated',
];

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'ID', key: 'CategoryID', width: 8 },
  { header: 'Name', key: 'CategoryName', width: 28 },
  { header: 'Parent ID', key: 'ParentCategoryID', width: 10 },
  { header: 'Active', key: 'Active', width: 8 },
  { header: 'On Menu', key: 'OnMenu', width: 9 },
  { header: 'Sort', key: 'SortOrder', width: 6 },
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
    .option('--name <n>', 'Category name (required on create)')
    .option('--reference <r>', 'Category reference slug')
    .option('--parent-id <id>', 'Parent category ID (omit for top-level)')
    .option('--sort-order <n>', 'Sort order integer')
    .option('--active <bool>', 'Active on storefront (True/False)')
    .option('--on-site-map <bool>', 'Include in XML sitemap (True/False)')
    .option('--on-menu <bool>', 'Show in navigation menu (True/False)')
    .option('--allow-reviews <bool>', 'Allow product reviews (True/False)')
    .option('--require-login <bool>', 'Require login to view (True/False)')
    .option('--short-description1 <t>', 'Short description 1')
    .option('--short-description2 <t>', 'Short description 2')
    .option('--short-description3 <t>', 'Short description 3')
    .option('--description1 <t>', 'Description 1 (HTML)')
    .option('--description2 <t>', 'Description 2 (HTML)')
    .option('--description3 <t>', 'Description 3 (HTML)')
    .option('--field <key=value>', 'Set any API field (repeatable)', collectField, [])
    .option('--from-json [path]', 'Read from JSON file or stdin')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON');

export function registerCategoriesCommand(program: Command): void {
  const categories = program
    .command('categories')
    .description('Manage product categories');

  categories
    .command('list')
    .description('List categories')
    .option('--limit <n>', 'Number of results', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--active <bool>', 'Filter by active status (True/False)', 'True')
    .option('--all', 'Include inactive categories')
    .option('--parent-id <id>', 'Filter by parent category ID')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Fetching categories...').start();
      try {
        const filter: Record<string, unknown> = {
          Limit: opts.limit,
          Page: opts.page,
          OutputSelector: fields,
        };
        if (!opts.all) filter.Active = opts.active;
        if (opts.parentId) filter.ParentCategoryID = [opts.parentId];
        const res = await client.callWithFilter('GetCategory', filter);
        printWarnings(res);
        const items = res.Category || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.dim('No categories found.')); return; }
        opts.json ? outputJson(items) : outputTable(LIST_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  categories
    .command('get <id>')
    .description('Get category by ID')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_GET_FIELDS);
      const spinner = ora(`Fetching category ${id}...`).start();
      try {
        const res = await client.callWithFilter('GetCategory', {
          CategoryID: [id],
          OutputSelector: fields,
        });
        printWarnings(res);
        const items = res.Category || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.yellow(`Category "${id}" not found.`)); return; }
        const c = items[0];
        opts.json ? outputJson(c) : (console.log(chalk.bold(`Category: ${c.CategoryName}`)), console.log(), outputDetail(c));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  addWriteFlags(
    categories.command('create').description('Create a new category')
  ).action(async (opts) => {
    const client = requireAuth();
    let items: Record<string, unknown>[];
    if (opts.fromJson !== undefined) {
      try { items = await readJsonInput(opts.fromJson); }
      catch (err: any) { console.error(chalk.red(`Error reading JSON: ${err.message}`)); process.exit(1); }
    } else {
      if (!opts.name) { console.error(chalk.red('Error: --name is required.')); process.exit(1); }
      items = [buildPayload(FLAG_MAP, opts)];
    }
    const body = { Category: items };
    if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
    const spinner = ora(`Creating ${items.length} categor${items.length !== 1 ? 'ies' : 'y'}...`).start();
    try {
      const res = await client.call('AddCategory', body);
      printWarnings(res);
      spinner.stop();
      if (opts.json) {
        outputJson(res);
      } else {
        const created = res.Category;
        const list = Array.isArray(created) ? created : created ? [created] : [];
        for (const c of list as any[]) {
          console.log(chalk.green(`Created category ${c.CategoryID}`));
        }
      }
    } catch (err: any) { spinner.fail(err.message); process.exit(1); }
  });

  addWriteFlags(
    categories.command('update <id>').description('Update a category by ID')
  ).action(async (id, opts) => {
    const client = requireAuth();
    let items: Record<string, unknown>[];
    if (opts.fromJson !== undefined) {
      try {
        items = await readJsonInput(opts.fromJson);
        if (items.length === 1 && !items[0].CategoryID) items[0].CategoryID = id;
      } catch (err: any) { console.error(chalk.red(`Error reading JSON: ${err.message}`)); process.exit(1); }
    } else {
      const payload = buildPayload(FLAG_MAP, opts);
      if (Object.keys(payload).length === 0) { console.error(chalk.red('Error: No fields to update.')); process.exit(1); }
      payload.CategoryID = id;
      items = [payload];
    }
    const body = { Category: items };
    if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
    const spinner = ora(`Updating category ${id}...`).start();
    try {
      const res = await client.call('UpdateCategory', body);
      printWarnings(res);
      spinner.stop();
      if (opts.json) {
        outputJson(res);
      } else {
        console.log(chalk.green(`Updated category ${id}`));
      }
    } catch (err: any) { spinner.fail(err.message); process.exit(1); }
  });

  categories.action(() => categories.outputHelp());
}
