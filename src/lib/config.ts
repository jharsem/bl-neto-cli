import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface SftpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  remote_path: string;
}

export interface NetoConfig {
  store_url: string;
  api_key: string;
  username: string;
  sftp?: SftpConfig;
}

export const SFTP_DEFAULTS = {
  host: 'sftp.neto.com.au',
  port: 1022,
  remote_path: '/httpdocs/assets/themes',
};

const CONFIG_DIR = join(homedir(), '.neto-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function hasConfig(): boolean {
  return existsSync(CONFIG_FILE);
}

export function loadConfig(): NetoConfig {
  if (!hasConfig()) {
    throw new Error('Not authenticated. Run `neto auth` first.');
  }
  const raw = readFileSync(CONFIG_FILE, 'utf-8');
  return JSON.parse(raw) as NetoConfig;
}

export function saveConfig(config: NetoConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

export function clearConfig(): void {
  if (existsSync(CONFIG_FILE)) {
    unlinkSync(CONFIG_FILE);
  }
}

export function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
