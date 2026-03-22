import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';

const DEFAULT_LIST_FIELDS = [
  'Username', 'ID', 'EmailAddress', 'FirstName', 'LastName',
  'Type', 'Active', 'DateAdded',
];
const DEFAULT_GET_FIELDS = [
  'Username', 'ID', 'EmailAddress', 'FirstName', 'LastName',
  'Type', 'Active', 'DateAdded', 'DateUpdated',
  'Company', 'Phone', 'Fax',
  'BillingAddress', 'ShippingAddress',
  'AccountBalance', 'CreditLimit',
  'NewsletterSubscriber', 'DateOfBirth',
];

const LIST_COLUMNS: ColumnDef[] = [
  { header: 'ID', key: 'ID', width: 10 },
  { header: 'Username', key: 'Username', width: 20 },
  { header: 'Name', key: '_name', width: 20 },
  { header: 'Email', key: 'EmailAddress', width: 25 },
  { header: 'Type', key: 'Type', width: 10 },
  { header: 'Active', key: 'Active', width: 8 },
];

function requireAuth(): NetoApiClient {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  return new NetoApiClient(loadConfig());
}

export function registerCustomersCommand(program: Command): void {
  const customers = program
    .command('customers')
    .description('Manage customers');

  customers
    .command('list')
    .description('List customers')
    .option('--limit <n>', 'Number of results', '50')
    .option('--page <n>', 'Page number (0-indexed)', '0')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--type <type>', 'Filter by type (Customer/Prospect)')
    .option('--active <bool>', 'Filter by active status (True/False)', 'True')
    .option('--all', 'Include inactive customers')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_LIST_FIELDS);
      const spinner = ora('Fetching customers...').start();

      try {
        const filter: Record<string, unknown> = {
          Limit: opts.limit,
          Page: opts.page,
          OutputSelector: fields,
        };
        if (opts.type) filter.Type = [opts.type];
        if (!opts.all) filter.Active = [opts.active];

        const res = await client.callWithFilter('GetCustomer', filter);
        printWarnings(res);
        const items = (res.Customer || []).map((c: any) => ({
          ...c,
          _name: [c.FirstName, c.LastName].filter(Boolean).join(' '),
        }));
        spinner.stop();

        if (items.length === 0) {
          console.log(chalk.dim('No customers found.'));
          return;
        }

        if (opts.json) {
          outputJson(res.Customer);
        } else {
          outputTable(LIST_COLUMNS, items);
        }
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    });

  customers
    .command('get <identifier>')
    .description('Get customer details by username or ID')
    .option('--fields <fields>', 'Comma-separated fields to return')
    .option('--json', 'Output as JSON')
    .action(async (identifier, opts) => {
      const client = requireAuth();
      const fields = parseFields(opts.fields, DEFAULT_GET_FIELDS);
      const spinner = ora(`Fetching customer ${identifier}...`).start();

      try {
        // Try by username first
        let res = await client.callWithFilter('GetCustomer', {
          Username: [identifier],
          OutputSelector: fields,
        });
        let items = res.Customer || [];

        // If not found, try by ID
        if (items.length === 0 && /^\d+$/.test(identifier)) {
          res = await client.callWithFilter('GetCustomer', {
            ID: [identifier],
            OutputSelector: fields,
          });
          items = res.Customer || [];
        }

        printWarnings(res);
        spinner.stop();

        if (items.length === 0) {
          console.log(chalk.yellow(`Customer "${identifier}" not found.`));
          return;
        }

        const customer = items[0];
        if (opts.json) {
          outputJson(customer);
        } else {
          const name = [customer.FirstName, customer.LastName].filter(Boolean).join(' ');
          console.log(chalk.bold(`Customer: ${name || customer.Username}`));
          console.log();
          outputDetail(customer);
        }
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    });

  customers.action(() => customers.outputHelp());
}
