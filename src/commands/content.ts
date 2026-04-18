import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';
import { buildPayload, collectField, readJsonInput } from '../lib/payload-helpers.js';

// Verified against ../neto-docs-engineer/docs/content/{addcontent,updatecontent}.md
const FLAG_MAP: Record<string, string> = {
  name: 'ContentName',
  type: 'ContentType',
  reference: 'ContentReference',
  parentId: 'ParentContentID',
  sortOrder: 'SortOrder',
  active: 'Active',
  onSiteMap: 'OnSiteMap',
  onMenu: 'OnMenu',
  allowReviews: 'AllowReviews',
  requireLogin: 'RequireLogin',
  automaticUrl: 'AutomaticURL',
  contentUrl: 'ContentURL',
  author: 'Author',
  shortDescription1: 'ShortDescription1',
  shortDescription2: 'ShortDescription2',
  shortDescription3: 'ShortDescription3',
  description1: 'Description1',
  description2: 'Description2',
  description3: 'Description3',
  label1: 'Label1',
  label2: 'Label2',
  label3: 'Label3',
  seoTitle: 'SEOPageTitle',
  seoHeading: 'SEOPageHeading',
  seoDescription: 'SEOMetaDescription',
  seoKeywords: 'SEOMetaKeywords',
  seoCanonical: 'SEOCanonicalURL',
  searchKeywords: 'SearchKeywords',
  headerTemplate: 'HeaderTemplate',
  bodyTemplate: 'BodyTemplate',
  footerTemplate: 'FooterTemplate',
  datePosted: 'DatePosted',
};

const DEFAULT_LIST_FIELDS = [
  'ContentID', 'ContentName', 'ContentType', 'ParentContentID',
  'Active', 'OnMenu', 'SortOrder', 'ContentURL', 'DatePosted',
];

const DEFAULT_GET_FIELDS = [
  'ContentID', 'ContentName', 'ContentType', 'ContentReference',
  'ParentContentID', 'Active', 'SortOrder', 'OnSiteMap', 'OnMenu',
  'AllowReviews', 'RequireLogin', 'ContentURL', 'Author',
  'ShortDescription1', 'Description1',
  'SEOPageTitle', 'SEOMetaDescription', 'SEOCanonicalURL',
  'DatePosted', 'DateUpdated',
];

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'ID', key: 'ContentID', width: 8 },
  { header: 'Name', key: 'ContentName', width: 30 },
  { header: 'Type', key: 'ContentType', width: 16 },
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
    .option('--name <n>', 'Content page name')
    .option('--type <t>', 'Content type (required on create)')
    .option('--reference <r>', 'Content reference slug')
    .option('--parent-id <id>', 'Parent content ID')
    .option('--sort-order <n>', 'Sort order')
    .option('--active <bool>', 'Active (True/False)')
    .option('--on-site-map <bool>', 'Include in sitemap (True/False)')
    .option('--on-menu <bool>', 'Show in menu (True/False)')
    .option('--allow-reviews <bool>', 'Allow reviews (True/False)')
    .option('--require-login <bool>', 'Require login (True/False)')
    .option('--automatic-url <bool>', 'Auto-generate URL (True/False)')
    .option('--content-url <u>', 'Content URL slug')
    .option('--author <a>', 'Author name')
    .option('--short-description1 <t>', 'Short description 1')
    .option('--short-description2 <t>', 'Short description 2')
    .option('--short-description3 <t>', 'Short description 3')
    .option('--description1 <t>', 'Description 1 (HTML)')
    .option('--description2 <t>', 'Description 2 (HTML)')
    .option('--description3 <t>', 'Description 3 (HTML)')
    .option('--label1 <t>', 'Label 1')
    .option('--label2 <t>', 'Label 2')
    .option('--label3 <t>', 'Label 3')
    .option('--seo-title <t>', 'SEO page title')
    .option('--seo-heading <t>', 'SEO page heading')
    .option('--seo-description <t>', 'SEO meta description')
    .option('--seo-keywords <t>', 'SEO meta keywords')
    .option('--seo-canonical <u>', 'SEO canonical URL')
    .option('--search-keywords <t>', 'Search keywords')
    .option('--header-template <t>', 'Header template name')
    .option('--body-template <t>', 'Body template name')
    .option('--footer-template <t>', 'Footer template name')
    .option('--date-posted <dt>', 'Date posted (YYYY-MM-DD HH:MM:SS)')
    .option('--field <key=value>', 'Set any API field (repeatable)', collectField, [])
    .option('--from-json [path]', 'Read from JSON file or stdin')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON');

export function registerContentCommand(program: Command): void {
  const content = program
    .command('content')
    .description('Manage CMS content pages');

  content
    .command('list')
    .description('List content pages')
    .option('--limit <n>', 'Number of results', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--type <t>', 'Filter by content type')
    .option('--active <bool>', 'Filter by active status (True/False)', 'True')
    .option('--all', 'Include inactive pages')
    .option('--parent-id <id>', 'Filter by parent content ID')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Fetching content pages...').start();
      try {
        const filter: Record<string, unknown> = {
          Limit: opts.limit,
          Page: opts.page,
          OutputSelector: fields,
        };
        if (!opts.all) filter.Active = opts.active;
        if (opts.type) filter.ContentType = opts.type;
        if (opts.parentId) filter.ParentContentID = [opts.parentId];
        const res = await client.callWithFilter('GetContent', filter);
        printWarnings(res);
        const items = res.Content || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.dim('No content pages found.')); return; }
        opts.json ? outputJson(items) : outputTable(LIST_COLUMNS, items);
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  content
    .command('get <id>')
    .description('Get content page by ID')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (id, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_GET_FIELDS);
      const spinner = ora(`Fetching content ${id}...`).start();
      try {
        const res = await client.callWithFilter('GetContent', {
          ContentID: [id],
          OutputSelector: fields,
        });
        printWarnings(res);
        const items = res.Content || [];
        spinner.stop();
        if (items.length === 0) { console.log(chalk.yellow(`Content "${id}" not found.`)); return; }
        const c = items[0];
        opts.json ? outputJson(c) : (console.log(chalk.bold(`Content: ${c.ContentName}`)), console.log(), outputDetail(c));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  addWriteFlags(
    content.command('create').description('Create a new content page')
  ).action(async (opts) => {
    const client = requireAuth();
    let items: Record<string, unknown>[];
    if (opts.fromJson !== undefined) {
      try { items = await readJsonInput(opts.fromJson); }
      catch (err: any) { console.error(chalk.red(`Error reading JSON: ${err.message}`)); process.exit(1); }
    } else {
      if (!opts.name) { console.error(chalk.red('Error: --name is required.')); process.exit(1); }
      if (!opts.type) { console.error(chalk.red('Error: --type is required.')); process.exit(1); }
      items = [buildPayload(FLAG_MAP, opts)];
    }
    const body = { Content: items };
    if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
    const spinner = ora(`Creating ${items.length} content page${items.length !== 1 ? 's' : ''}...`).start();
    try {
      const res = await client.call('AddContent', body);
      printWarnings(res);
      spinner.stop();
      if (opts.json) {
        outputJson(res);
      } else {
        const created = res.Content;
        const list = Array.isArray(created) ? created : created ? [created] : [];
        if (list.length === 0) {
          console.log(chalk.yellow('No content ID returned — check warnings above.'));
        } else {
          for (const c of list as any[]) {
            console.log(chalk.green(`Created content page ${c.ContentID}`));
          }
        }
      }
    } catch (err: any) { spinner.fail(err.message); process.exit(1); }
  });

  addWriteFlags(
    content.command('update <id>').description('Update a content page by ID')
  ).action(async (id, opts) => {
    const client = requireAuth();
    let items: Record<string, unknown>[];
    if (opts.fromJson !== undefined) {
      try {
        items = await readJsonInput(opts.fromJson);
        if (items.length === 1 && !items[0].ContentID) items[0].ContentID = id;
      } catch (err: any) { console.error(chalk.red(`Error reading JSON: ${err.message}`)); process.exit(1); }
    } else {
      const payload = buildPayload(FLAG_MAP, opts);
      if (Object.keys(payload).length === 0) { console.error(chalk.red('Error: No fields to update.')); process.exit(1); }
      payload.ContentID = id;
      items = [payload];
    }
    const body = { Content: items };
    if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
    const spinner = ora(`Updating content ${id}...`).start();
    try {
      const res = await client.call('UpdateContent', body);
      printWarnings(res);
      spinner.stop();
      opts.json ? outputJson(res) : console.log(chalk.green(`Updated content ${id}`));
    } catch (err: any) { spinner.fail(err.message); process.exit(1); }
  });

  content.action(() => content.outputHelp());
}
