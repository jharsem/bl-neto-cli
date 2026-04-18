import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputTable, outputJson, outputDetail, printWarnings, parseFields, type ColumnDef } from '../lib/output.js';
import { collectField, readJsonInput } from '../lib/payload-helpers.js';
import { buildCustomerPayload } from '../lib/customer-helpers.js';

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

  // Common flag set for create/update (keeps the two command definitions tight)
  const addWriteFlags = (cmd: Command) =>
    cmd
      .option('--username <u>', 'Customer username')
      .option('--type <type>', 'Customer or Prospect')
      .option('--password <p>', 'Password')
      .option('--email <addr>', 'Email address')
      .option('--secondary-email <addr>', 'Secondary email')
      .option('--first-name <n>', 'First name')
      .option('--last-name <n>', 'Last name')
      .option('--company <c>', 'Company name')
      .option('--phone <p>', 'Phone')
      .option('--fax <f>', 'Fax')
      .option('--date-of-birth <YYYY-MM-DD>', 'Date of birth')
      .option('--gender <g>', 'Gender')
      .option('--user-group <id>', 'User group')
      .option('--credit-limit <amount>', 'Credit limit')
      .option('--active <bool>', 'Is active (True/False)')
      .option('--newsletter <bool>', 'Newsletter subscriber (True/False)')
      .option('--sms <bool>', 'SMS subscriber (True/False)')
      .option('--abn <abn>', 'ABN')
      .option('--internal-notes <text>', 'Internal notes')
      .option('--street <s>', 'Billing street line 1')
      .option('--street2 <s>', 'Billing street line 2')
      .option('--city <c>', 'Billing city')
      .option('--state <s>', 'Billing state')
      .option('--postcode <p>', 'Billing postcode')
      .option('--country <c>', 'Billing country')
      .option('--ship-same-as-bill', 'Copy billing address to shipping')
      .option('--ship-street <s>', 'Shipping street line 1')
      .option('--ship-street2 <s>', 'Shipping street line 2')
      .option('--ship-city <c>', 'Shipping city')
      .option('--ship-state <s>', 'Shipping state')
      .option('--ship-postcode <p>', 'Shipping postcode')
      .option('--ship-country <c>', 'Shipping country')
      .option('--ship-first-name <n>', 'Shipping first name (if different)')
      .option('--ship-last-name <n>', 'Shipping last name (if different)')
      .option('--field <key=value>', 'Set any API field (repeatable)', collectField, [])
      .option('--from-json [path]', 'Read from JSON file or stdin')
      .option('--dry-run', 'Show payload without sending')
      .option('--json', 'Output response as JSON');

  addWriteFlags(
    customers
      .command('create')
      .description('Create a new customer')
  ).action(async (opts) => {
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
      if (!opts.username) {
        console.error(chalk.red('Error: --username is required. Use --from-json for bulk creation.'));
        process.exit(1);
      }
      try {
        items = [buildCustomerPayload(opts)];
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
    }

    const body = { Customer: items };

    if (opts.dryRun) {
      console.log(chalk.bold('Dry run — would send:'));
      outputJson(body);
      return;
    }

    const spinner = ora(`Creating ${items.length} customer${items.length !== 1 ? 's' : ''}...`).start();

    try {
      const res = await client.call('AddCustomer', body);
      printWarnings(res);
      spinner.stop();

      if (opts.json) {
        outputJson(res);
      } else {
        const created = res.Customer || items;
        for (const c of created as any[]) {
          console.log(chalk.green(`Created customer "${c.Username || ''}"`));
        }
      }
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

  addWriteFlags(
    customers
      .command('update <username>')
      .description('Update an existing customer')
  ).action(async (username, opts) => {
    const client = requireAuth();

    let items: Record<string, unknown>[];

    if (opts.fromJson !== undefined) {
      try {
        items = await readJsonInput(opts.fromJson);
        if (items.length === 1 && !items[0].Username) {
          items[0].Username = username;
        }
      } catch (err: any) {
        console.error(chalk.red(`Error reading JSON: ${err.message}`));
        process.exit(1);
      }
    } else {
      let payload: Record<string, unknown>;
      try {
        payload = buildCustomerPayload(opts, username);
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
      const fieldCount = Object.keys(payload).filter(k => k !== 'Username').length;
      if (fieldCount === 0) {
        console.error(chalk.red('Error: No fields to update. Provide flags, --field, or --from-json.'));
        process.exit(1);
      }
      items = [payload];
    }

    const body = { Customer: items };

    if (opts.dryRun) {
      console.log(chalk.bold('Dry run — would send:'));
      outputJson(body);
      return;
    }

    const spinner = ora(`Updating customer ${username}...`).start();

    try {
      const res = await client.call('UpdateCustomer', body);
      printWarnings(res);
      spinner.stop();

      if (opts.json) {
        outputJson(res);
      } else {
        const fieldCount = Object.keys(items[0]).filter(k => k !== 'Username').length;
        console.log(chalk.green(`Updated customer ${username} (${fieldCount} field${fieldCount !== 1 ? 's' : ''} changed)`));
      }
    } catch (err: any) {
      spinner.fail(err.message);
      process.exit(1);
    }
  });

  customers.action(() => customers.outputHelp());
}
