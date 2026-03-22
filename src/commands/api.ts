import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync } from 'node:fs';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient, getResponseKey } from '../lib/client.js';
import { outputJson, printWarnings } from '../lib/output.js';

const KNOWN_ACTIONS = [
  'GetItem', 'AddItem', 'UpdateItem',
  'GetOrder', 'AddOrder', 'UpdateOrder',
  'GetCustomer', 'AddCustomer', 'UpdateCustomer',
  'GetCategory', 'AddCategory', 'UpdateCategory',
  'GetContent', 'AddContent', 'UpdateContent',
  'GetPayment', 'AddPayment', 'GetPaymentMethods',
  'GetWarehouse', 'AddWarehouse', 'UpdateWarehouse',
  'GetSupplier', 'AddSupplier', 'UpdateSupplier',
  'GetVoucher', 'AddVoucher', 'UpdateVoucher', 'RedeemVoucher',
  'GetRma', 'AddRma',
  'GetShippingMethods', 'GetShippingQuote',
  'GetCurrencySettings', 'UpdateCurrencySettings',
  'GetCart',
  'AddCustomerLog', 'UpdateCustomerLog',
  'GetAccountingSystemRelatedAccounts', 'AddAccountingSystemRelatedAccount',
  'UpdateAccountingSystemRelatedAccount', 'DeleteAccountingSystemRelatedAccount',
];

function requireAuth(): NetoApiClient {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  return new NetoApiClient(loadConfig());
}

export function registerApiCommand(program: Command): void {
  program
    .command('api <action>')
    .description('Make a raw API call (e.g. neto api GetItem --filter \'{"SKU":["PROD1"]}\')')
    .option('--filter <json>', 'Filter JSON string')
    .option('--filter-file <path>', 'Path to a JSON file containing the filter')
    .option('--body <json>', 'Full request body JSON (overrides --filter)')
    .action(async (action, opts) => {
      const client = requireAuth();

      // Validate action
      if (!KNOWN_ACTIONS.includes(action)) {
        console.error(chalk.yellow(
          `Warning: "${action}" is not a recognized action. Known actions:\n` +
          KNOWN_ACTIONS.map(a => `  ${a}`).join('\n')
        ));
        console.error();
      }

      let body: Record<string, unknown> = {};

      if (opts.body) {
        try {
          body = JSON.parse(opts.body);
        } catch {
          console.error(chalk.red('Invalid JSON in --body'));
          process.exit(1);
        }
      } else {
        let filterJson: string | undefined = opts.filter;

        if (opts.filterFile) {
          try {
            filterJson = readFileSync(opts.filterFile, 'utf-8');
          } catch (err: any) {
            console.error(chalk.red(`Could not read filter file: ${err.message}`));
            process.exit(1);
          }
        }

        if (filterJson) {
          try {
            body = { Filter: JSON.parse(filterJson) };
          } catch {
            console.error(chalk.red('Invalid JSON in --filter'));
            process.exit(1);
          }
        }
      }

      const spinner = ora(`Calling ${action}...`).start();

      try {
        const res = await client.call(action, body);
        printWarnings(res);
        spinner.stop();
        outputJson(res);
      } catch (err: any) {
        spinner.fail(err.message);
        process.exit(1);
      }
    });

  // List available actions
  program
    .command('actions')
    .description('List all known API actions')
    .action(() => {
      console.log(chalk.bold('Available Neto API actions:\n'));
      const grouped: Record<string, string[]> = {};
      for (const action of KNOWN_ACTIONS) {
        const key = getResponseKey(action) || 'Other';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(action);
      }
      for (const [group, actions] of Object.entries(grouped)) {
        console.log(chalk.cyan(`  ${group}`));
        for (const a of actions) {
          console.log(`    ${a}`);
        }
      }
    });
}
