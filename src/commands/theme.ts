import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { watch } from 'node:fs';
import { readdir, stat, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, dirname, posix } from 'node:path';
import SftpClient from 'ssh2-sftp-client';
import { loadConfig, hasConfig, type SftpConfig, SFTP_DEFAULTS } from '../lib/config.js';

function requireSftp(): SftpConfig {
  if (!hasConfig()) {
    console.error(chalk.red('Not authenticated. Run `neto auth setup` first.'));
    process.exit(1);
  }
  const config = loadConfig();
  if (!config.sftp) {
    console.error(chalk.red('SFTP not configured. Run `neto auth sftp` first.'));
    process.exit(1);
  }
  return config.sftp;
}

function createClient(sftp: SftpConfig): SftpClient {
  return new SftpClient();
}

async function connect(client: SftpClient, sftp: SftpConfig): Promise<void> {
  await client.connect({
    host: sftp.host,
    port: sftp.port,
    username: sftp.username,
    password: sftp.password,
  });
}

async function getLocalFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden dirs and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      files.push(...await getLocalFiles(full));
    } else {
      if (entry.name.startsWith('.')) continue;
      files.push(full);
    }
  }
  return files;
}

async function getRemoteFiles(client: SftpClient, remotePath: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await client.list(remotePath);
  for (const entry of entries) {
    const full = posix.join(remotePath, entry.name);
    if (entry.type === 'd') {
      if (entry.name.startsWith('.')) continue;
      files.push(...await getRemoteFiles(client, full));
    } else {
      if (entry.name.startsWith('.')) continue;
      files.push(full);
    }
  }
  return files;
}

export function registerThemeCommand(program: Command): void {
  const theme = program
    .command('theme')
    .description('Manage themes via SFTP');

  theme
    .command('list')
    .description('List themes on the remote server')
    .action(async () => {
      const sftp = requireSftp();
      const client = createClient(sftp);
      const spinner = ora('Connecting to SFTP...').start();

      try {
        await connect(client, sftp);
        spinner.text = 'Listing themes...';

        const entries = await client.list(sftp.remote_path);
        const themes = entries.filter(e => e.type === 'd' && !e.name.startsWith('.'));
        spinner.stop();

        if (themes.length === 0) {
          console.log(chalk.dim('No themes found.'));
        } else {
          console.log(chalk.bold('Themes on server:\n'));
          for (const t of themes) {
            console.log(`  ${chalk.cyan(t.name)}`);
          }
          console.log(chalk.dim(`\n${themes.length} theme${themes.length !== 1 ? 's' : ''}`));
        }
      } catch (err: any) {
        spinner.fail(`SFTP error: ${err.message}`);
        process.exit(1);
      } finally {
        await client.end();
      }
    });

  theme
    .command('pull [theme]')
    .description('Download a theme from the server')
    .option('--dest <dir>', 'Local destination directory', './theme')
    .action(async (themeName, opts) => {
      const sftp = requireSftp();
      const client = createClient(sftp);
      const spinner = ora('Connecting to SFTP...').start();

      try {
        await connect(client, sftp);

        // If no theme specified, list and ask
        if (!themeName) {
          spinner.text = 'Listing themes...';
          const entries = await client.list(sftp.remote_path);
          const themes = entries.filter(e => e.type === 'd' && !e.name.startsWith('.'));
          spinner.stop();

          if (themes.length === 0) {
            console.log(chalk.yellow('No themes found on server.'));
            await client.end();
            return;
          }

          console.log(chalk.bold('Available themes:'));
          themes.forEach((t, i) => console.log(`  ${i + 1}. ${t.name}`));
          console.log(chalk.dim('\nRun: neto theme pull <theme-name>'));
          await client.end();
          return;
        }

        const remotePath = posix.join(sftp.remote_path, themeName);

        // Check theme exists
        const exists = await client.exists(remotePath);
        if (!exists) {
          spinner.fail(`Theme "${themeName}" not found at ${remotePath}`);
          await client.end();
          return;
        }

        spinner.text = `Scanning ${themeName}...`;
        const remoteFiles = await getRemoteFiles(client, remotePath);
        spinner.text = `Downloading ${remoteFiles.length} files...`;

        let downloaded = 0;
        for (const remoteFile of remoteFiles) {
          const relPath = remoteFile.slice(remotePath.length + 1);
          const localPath = join(opts.dest, relPath);
          await mkdir(dirname(localPath), { recursive: true });

          const buffer = await client.get(remoteFile);
          if (Buffer.isBuffer(buffer)) {
            await writeFile(localPath, buffer);
          } else if (typeof buffer === 'string') {
            await writeFile(localPath, buffer, 'utf-8');
          }

          downloaded++;
          spinner.text = `Downloaded ${downloaded}/${remoteFiles.length}: ${relPath}`;
        }

        spinner.succeed(`Pulled ${downloaded} files from "${themeName}" to ${opts.dest}`);
      } catch (err: any) {
        spinner.fail(`SFTP error: ${err.message}`);
        process.exit(1);
      } finally {
        await client.end();
      }
    });

  theme
    .command('push [theme]')
    .description('Upload local theme files to the server')
    .option('--src <dir>', 'Local source directory', './theme')
    .option('--dry-run', 'Show what would be uploaded without uploading')
    .action(async (themeName, opts) => {
      const sftp = requireSftp();

      // Determine theme name from arg or directory name
      if (!themeName) {
        const srcStat = await stat(opts.src).catch(() => null);
        if (!srcStat?.isDirectory()) {
          console.error(chalk.red(`Source directory "${opts.src}" not found. Use --src to specify.`));
          process.exit(1);
        }
        // Use the directory name as theme name
        themeName = opts.src.split('/').filter(Boolean).pop() || 'theme';
      }

      const localFiles = await getLocalFiles(opts.src);
      if (localFiles.length === 0) {
        console.log(chalk.yellow(`No files found in "${opts.src}".`));
        return;
      }

      const remotePath = posix.join(sftp.remote_path, themeName);

      if (opts.dryRun) {
        console.log(chalk.bold(`Would upload ${localFiles.length} files to ${remotePath}:\n`));
        for (const f of localFiles) {
          const rel = relative(opts.src, f);
          console.log(`  ${rel}`);
        }
        return;
      }

      const client = createClient(sftp);
      const spinner = ora('Connecting to SFTP...').start();

      try {
        await connect(client, sftp);
        spinner.text = `Uploading ${localFiles.length} files to "${themeName}"...`;

        let uploaded = 0;
        for (const localFile of localFiles) {
          const rel = relative(opts.src, localFile);
          const remoteFile = posix.join(remotePath, rel.split('/').join('/'));
          const remoteDir = posix.dirname(remoteFile);

          // Ensure remote directory exists
          const dirExists = await client.exists(remoteDir);
          if (!dirExists) {
            await client.mkdir(remoteDir, true);
          }

          const content = await readFile(localFile);
          await client.put(content, remoteFile);

          uploaded++;
          spinner.text = `Uploaded ${uploaded}/${localFiles.length}: ${rel}`;
        }

        spinner.succeed(`Pushed ${uploaded} files to "${themeName}"`);
      } catch (err: any) {
        spinner.fail(`SFTP error: ${err.message}`);
        process.exit(1);
      } finally {
        await client.end();
      }
    });

  theme
    .command('watch [theme]')
    .description('Watch for local changes and auto-push to server')
    .option('--src <dir>', 'Local source directory', './theme')
    .action(async (themeName, opts) => {
      const sftp = requireSftp();

      const srcStat = await stat(opts.src).catch(() => null);
      if (!srcStat?.isDirectory()) {
        console.error(chalk.red(`Source directory "${opts.src}" not found.`));
        process.exit(1);
      }

      if (!themeName) {
        themeName = opts.src.split('/').filter(Boolean).pop() || 'theme';
      }

      const remotePath = posix.join(sftp.remote_path, themeName);
      console.log(chalk.bold(`Watching ${opts.src} → ${sftp.host}:${remotePath}`));
      console.log(chalk.dim('Press Ctrl+C to stop.\n'));

      // Debounce uploads
      const pending = new Map<string, NodeJS.Timeout>();

      const uploadFile = async (filePath: string) => {
        const rel = relative(opts.src, filePath);
        const remoteFile = posix.join(remotePath, rel.split('/').join('/'));
        const client = createClient(sftp);

        try {
          await connect(client, sftp);
          const remoteDir = posix.dirname(remoteFile);
          const dirExists = await client.exists(remoteDir);
          if (!dirExists) {
            await client.mkdir(remoteDir, true);
          }

          const content = await readFile(filePath);
          await client.put(content, remoteFile);
          const time = new Date().toLocaleTimeString();
          console.log(`  ${chalk.dim(time)} ${chalk.green('↑')} ${rel}`);
        } catch (err: any) {
          console.error(`  ${chalk.red('✗')} ${rel}: ${err.message}`);
        } finally {
          await client.end();
        }
      };

      const watcher = watch(opts.src, { recursive: true }, (event, filename) => {
        if (!filename || filename.startsWith('.')) return;
        const filePath = join(opts.src, filename);

        // Debounce: wait 300ms before uploading
        const existing = pending.get(filePath);
        if (existing) clearTimeout(existing);

        pending.set(filePath, setTimeout(async () => {
          pending.delete(filePath);
          const fileStat = await stat(filePath).catch(() => null);
          if (fileStat?.isFile()) {
            await uploadFile(filePath);
          }
        }, 300));
      });

      // Keep process alive
      process.on('SIGINT', () => {
        watcher.close();
        console.log(chalk.dim('\nStopped watching.'));
        process.exit(0);
      });
    });

  theme.action(() => theme.outputHelp());
}
