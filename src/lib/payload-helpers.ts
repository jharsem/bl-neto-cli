import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

/** Commander repeatable option collector */
export function collectField(val: string, acc: string[]): string[] {
  acc.push(val);
  return acc;
}

/** Parse --field Key=Value entries into a record */
export function parseFieldEntries(fields: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of fields) {
    const eqIdx = entry.indexOf('=');
    if (eqIdx === -1) {
      throw new Error(`Invalid --field format: "${entry}". Use --field Key=Value`);
    }
    result[entry.slice(0, eqIdx)] = entry.slice(eqIdx + 1);
  }
  return result;
}

/**
 * Build a payload object from CLI flags using a camelCase→API-field map.
 * Skips undefined flags, merges --field Key=Value entries (explicit flags win).
 */
export function buildPayload(
  flagMap: Record<string, string>,
  opts: Record<string, any>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const [flag, apiField] of Object.entries(flagMap)) {
    if (opts[flag] !== undefined) {
      payload[apiField] = opts[flag];
    }
  }

  if (opts.field?.length > 0) {
    const extras = parseFieldEntries(opts.field);
    for (const [key, val] of Object.entries(extras)) {
      if (!(key in payload)) {
        payload[key] = val;
      }
    }
  }

  return payload;
}

/** Read JSON input from a file path or stdin */
export async function readJsonInput(fromJson: string | boolean): Promise<Record<string, unknown>[]> {
  let raw: string;

  if (fromJson === true || fromJson === '-') {
    if (process.stdin.isTTY) {
      throw new Error('No input on stdin. Pipe JSON or provide a file path: --from-json input.json');
    }
    raw = await readStdin();
  } else {
    raw = readFileSync(fromJson as string, 'utf-8');
  }

  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) return parsed;
  // Unwrap common single-resource envelopes (e.g. {Item: [...]}, {Customer: [...]})
  for (const key of Object.keys(parsed)) {
    if (Array.isArray(parsed[key])) return parsed[key];
  }
  return [parsed];
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/** Open data in $EDITOR and return the edited result */
export function launchEditor(data: Record<string, unknown>): Record<string, unknown> {
  const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
  const tmpFile = join(tmpdir(), `neto-edit-${Date.now()}.json`);

  writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');

  try {
    execSync(`${editor} "${tmpFile}"`, { stdio: 'inherit' });
    const edited = readFileSync(tmpFile, 'utf-8');
    return JSON.parse(edited);
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
  }
}

/** Compute only the changed fields between two objects */
export function diffObjects(
  original: Record<string, unknown>,
  edited: Record<string, unknown>,
): Record<string, unknown> | null {
  const changes: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(edited)) {
    if (JSON.stringify(val) !== JSON.stringify(original[key])) {
      changes[key] = val;
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}
