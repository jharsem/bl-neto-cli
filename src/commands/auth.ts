import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { saveConfig, hasConfig, loadConfig, clearConfig, maskKey, getConfigPath, SFTP_DEFAULTS } from '../lib/config.js';

export function registerAuthCommand(program: Command): void {
  const auth = program
    .command('auth')
    .description('Configure Neto API credentials');

  auth
    .command('setup')
    .description('Set up store credentials (interactive)')
    .option('--store-url <url>', 'Store URL (e.g. https://mystore.neto.com.au)')
    .option('--api-key <key>', 'API key')
    .option('--username <user>', 'API username')
    .action(async (opts) => {
      let storeUrl = opts.storeUrl;
      let apiKey = opts.apiKey;
      let username = opts.username;

      if (!storeUrl || !apiKey || !username) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'storeUrl',
            message: 'Store URL:',
            default: storeUrl,
            validate: (v: string) => {
              if (!v.trim()) return 'Store URL is required';
              return true;
            },
          },
          {
            type: 'input',
            name: 'apiKey',
            message: 'API Key:',
            default: apiKey,
            validate: (v: string) => v.trim() ? true : 'API key is required',
          },
          {
            type: 'input',
            name: 'username',
            message: 'API Username:',
            default: username,
            validate: (v: string) => v.trim() ? true : 'Username is required',
          },
        ]);
        storeUrl = answers.storeUrl;
        apiKey = answers.apiKey;
        username = answers.username;
      }

      // Normalize URL
      storeUrl = storeUrl.trim();
      if (!storeUrl.startsWith('http')) {
        storeUrl = `https://${storeUrl}`;
      }
      storeUrl = storeUrl.replace(/\/$/, '');

      saveConfig({
        store_url: storeUrl,
        api_key: apiKey.trim(),
        username: username.trim(),
      });

      console.log(chalk.green('Credentials saved to ' + getConfigPath()));
    });

  auth
    .command('status')
    .description('Show current authentication status')
    .action(() => {
      if (!hasConfig()) {
        console.log(chalk.yellow('Not configured. Run `neto auth setup` to get started.'));
        return;
      }
      const config = loadConfig();
      console.log(chalk.bold('Neto CLI Configuration'));
      console.log(`  Store URL:  ${config.store_url}`);
      console.log(`  Username:   ${config.username}`);
      console.log(`  API Key:    ${maskKey(config.api_key)}`);
      if (config.sftp) {
        console.log();
        console.log(chalk.bold('SFTP Configuration'));
        console.log(`  Host:       ${config.sftp.host}`);
        console.log(`  Port:       ${config.sftp.port}`);
        console.log(`  Username:   ${config.sftp.username}`);
        console.log(`  Password:   ${maskKey(config.sftp.password)}`);
        console.log(`  Remote:     ${config.sftp.remote_path}`);
      }
      console.log();
      console.log(`  Config:     ${getConfigPath()}`);
    });

  auth
    .command('clear')
    .description('Remove stored credentials')
    .action(async () => {
      if (!hasConfig()) {
        console.log(chalk.dim('No credentials stored.'));
        return;
      }
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Remove stored credentials?',
        default: false,
      }]);
      if (confirm) {
        clearConfig();
        console.log(chalk.green('Credentials removed.'));
      }
    });

  auth
    .command('sftp')
    .description('Configure SFTP credentials for theme management')
    .option('--host <host>', `SFTP host (default: ${SFTP_DEFAULTS.host})`)
    .option('--port <port>', `SFTP port (default: ${SFTP_DEFAULTS.port})`)
    .option('--sftp-user <user>', 'SFTP username')
    .option('--sftp-pass <pass>', 'SFTP password')
    .option('--remote-path <path>', `Remote theme path (default: ${SFTP_DEFAULTS.remote_path})`)
    .action(async (opts) => {
      if (!hasConfig()) {
        console.log(chalk.yellow('Run `neto auth setup` first to configure API credentials.'));
        return;
      }
      const config = loadConfig();

      let host = opts.host;
      let port = opts.port;
      let sftpUser = opts.sftpUser;
      let sftpPass = opts.sftpPass;
      let remotePath = opts.remotePath;

      if (!sftpUser || !sftpPass) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'host',
            message: 'SFTP Host:',
            default: host || config.sftp?.host || SFTP_DEFAULTS.host,
          },
          {
            type: 'input',
            name: 'port',
            message: 'SFTP Port:',
            default: String(port || config.sftp?.port || SFTP_DEFAULTS.port),
          },
          {
            type: 'input',
            name: 'sftpUser',
            message: 'SFTP Username:',
            default: sftpUser || config.sftp?.username,
            validate: (v: string) => v.trim() ? true : 'Username is required',
          },
          {
            type: 'password',
            name: 'sftpPass',
            message: 'SFTP Password:',
            validate: (v: string) => v.trim() ? true : 'Password is required',
          },
          {
            type: 'input',
            name: 'remotePath',
            message: 'Remote theme path:',
            default: remotePath || config.sftp?.remote_path || SFTP_DEFAULTS.remote_path,
          },
        ]);
        host = answers.host;
        port = answers.port;
        sftpUser = answers.sftpUser;
        sftpPass = answers.sftpPass;
        remotePath = answers.remotePath;
      }

      config.sftp = {
        host: host || SFTP_DEFAULTS.host,
        port: parseInt(port || String(SFTP_DEFAULTS.port), 10),
        username: sftpUser.trim(),
        password: sftpPass.trim(),
        remote_path: (remotePath || SFTP_DEFAULTS.remote_path).replace(/\/$/, ''),
      };

      saveConfig(config);
      console.log(chalk.green('SFTP credentials saved.'));
    });

  // Default action when just `neto auth` is run
  auth.action(() => {
    auth.outputHelp();
  });
}
