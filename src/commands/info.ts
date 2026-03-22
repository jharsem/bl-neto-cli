import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { hasConfig, loadConfig, maskKey } from '../lib/config.js';
import { NetoApiClient } from '../lib/client.js';

export function registerInfoCommand(program: Command): void {
  program
    .command('info')
    .description('Show store connection info and test connectivity')
    .action(async () => {
      if (!hasConfig()) {
        console.log(chalk.yellow('Not configured. Run `neto auth setup` first.'));
        return;
      }

      const config = loadConfig();
      console.log(chalk.bold('Store Configuration'));
      console.log(`  URL:       ${config.store_url}`);
      console.log(`  Username:  ${config.username}`);
      console.log(`  API Key:   ${maskKey(config.api_key)}`);
      console.log();

      const spinner = ora('Testing connection...').start();
      try {
        const client = new NetoApiClient(config);
        const res = await client.callWithFilter('GetItem', {
          Limit: '1',
          Page: '0',
          IsActive: ['True'],
          OutputSelector: ['SKU'],
        });
        const items = res.Item || [];
        spinner.succeed(`Connected — store has active products`);
      } catch (err: any) {
        spinner.fail(`Connection failed: ${err.message}`);
      }
    });
}
