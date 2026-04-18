import chalk from 'chalk';
import Table from 'cli-table3';

export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
}

export function outputTable(columns: ColumnDef[], rows: Record<string, unknown>[]): void {
  const table = new Table({
    head: columns.map(c => chalk.cyan(c.header)),
    colWidths: columns.map(c => c.width ?? null),
    wordWrap: true,
    style: { head: [], border: [] },
  });

  for (const row of rows) {
    table.push(columns.map(c => String(row[c.key] ?? '')));
  }

  console.log(table.toString());
  console.log(chalk.dim(`${rows.length} result${rows.length !== 1 ? 's' : ''}`));
}

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function outputDetail(data: Record<string, unknown>, keys?: string[]): void {
  const displayKeys = keys || Object.keys(data);
  const maxKeyLen = Math.max(...displayKeys.map(k => k.length));

  for (const key of displayKeys) {
    const val = data[key];
    const label = chalk.cyan(key.padEnd(maxKeyLen));

    if (val === null || val === undefined || val === '') {
      console.log(`  ${label}  ${chalk.dim('—')}`);
    } else if (typeof val === 'object') {
      console.log(`  ${label}  ${JSON.stringify(val)}`);
    } else {
      console.log(`  ${label}  ${val}`);
    }
  }
}

export function printWarnings(data: any): void {
  // Neto returns Messages in inconsistent shapes (array of {Warning}, object {Warning: [...] | {...}})
  const msgs = data?.Messages;
  if (!msgs) return;
  const items: any[] = [];
  if (Array.isArray(msgs)) {
    for (const m of msgs) {
      if (!m?.Warning) continue;
      items.push(...(Array.isArray(m.Warning) ? m.Warning : [m.Warning]));
    }
  } else if (msgs.Warning) {
    items.push(...(Array.isArray(msgs.Warning) ? msgs.Warning : [msgs.Warning]));
  }
  for (const w of items) {
    const msg = typeof w === 'string' ? w : (w?.Message ?? JSON.stringify(w));
    console.error(chalk.yellow(`Warning: ${msg}`));
  }
}

export function parseFields(fieldsStr: string | undefined, defaults: string[]): string[] {
  if (!fieldsStr) return defaults;
  return fieldsStr.split(',').map(f => f.trim()).filter(Boolean);
}
