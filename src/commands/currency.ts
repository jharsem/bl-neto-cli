import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadConfig, hasConfig } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';
import { outputDetail, outputJson, printWarnings } from '../lib/output.js';

// Verified against ../neto-docs-engineer/docs/currency/{getcurrencysettings,updatecurrencysettings}.md

function requireAuth(): NetoApiClient {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  return new NetoApiClient(loadConfig());
}

export function registerCurrencyCommand(program: Command): void {
  const currency = program
    .command('currency')
    .description('View and update store currency settings');

  currency
    .command('get')
    .description('Get currency settings')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const spinner = ora('Fetching currency settings...').start();
      try {
        const res = await client.call('GetCurrencySettings', {});
        printWarnings(res);
        // Response: { CurrencySettings: [{ DEFAULTCOUNTRY, DEFAULTCURRENCY, GST_AMT }] }
        const settings = Array.isArray(res.CurrencySettings)
          ? res.CurrencySettings[0]
          : res.CurrencySettings;
        spinner.stop();
        if (!settings) { console.log(chalk.dim('No currency settings returned.')); return; }
        opts.json ? outputJson(settings) : (console.log(chalk.bold('Currency Settings')), console.log(), outputDetail(settings));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  currency
    .command('update')
    .description('Update store currency settings')
    .option('--country <c>', 'Default country code')
    .option('--currency <c>', 'Default currency code (3-letter)')
    .option('--gst-inc <v>', 'GST inclusive in control panel (GST_INC_CPANEL value)')
    .option('--gst-amt <n>', 'GST amount / rate')
    .option('--dry-run', 'Show payload without sending')
    .option('--json', 'Output response as JSON')
    .action(async (opts) => {
      const client = requireAuth();
      const settings: Record<string, unknown> = {};
      if (opts.country) settings.DEFAULTCOUNTRY = opts.country;
      if (opts.currency) settings.DEFAULTCURRENCY = opts.currency;
      if (opts.gstInc !== undefined) settings.GST_INC_CPANEL = opts.gstInc;
      if (opts.gstAmt !== undefined) settings.GST_AMT = opts.gstAmt;
      if (Object.keys(settings).length === 0) {
        console.error(chalk.red('Error: No fields to update.'));
        process.exit(1);
      }
      const body = { CurrencySettings: settings };
      if (opts.dryRun) { console.log(chalk.bold('Dry run — would send:')); outputJson(body); return; }
      const spinner = ora('Updating currency settings...').start();
      try {
        const res = await client.call('UpdateCurrencySettings', body);
        printWarnings(res);
        spinner.stop();
        opts.json ? outputJson(res) : console.log(chalk.green('Updated currency settings.'));
      } catch (err: any) { spinner.fail(err.message); process.exit(1); }
    });

  currency.action(() => currency.outputHelp());
}
