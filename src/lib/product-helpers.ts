import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// Maps Commander camelCase flag names to Neto API field names
export const FLAG_MAP: Record<string, string> = {
  sku: 'SKU',
  name: 'Name',
  brand: 'Brand',
  model: 'Model',
  price: 'DefaultPrice',
  costPrice: 'CostPrice',
  rrp: 'RRP',
  description: 'Description',
  shortDescription: 'ShortDescription',
  active: 'IsActive',
  visible: 'Visible',
  supplier: 'PrimarySupplier',
  imageUrl: 'ImageURL',
};

// Fields that shouldn't be sent back when editing
export const READONLY_FIELDS = [
  'ID', 'InventoryID',
  'DateAdded', 'DateAddedLocal', 'DateAddedUTC',
  'DateCreatedLocal', 'DateCreatedUTC',
  'DateUpdated', 'DateUpdatedLocal', 'DateUpdatedUTC',
  'CommittedQuantity', 'AvailableSellQuantity',
];

// Broad field set for the edit command
export const EDIT_FIELDS = [
  'SKU', 'ParentSKU', 'Name', 'Brand', 'Model',
  'DefaultPrice', 'PromotionPrice', 'RRP', 'CostPrice',
  'IsActive', 'Approved', 'Visible',
  'Description', 'ShortDescription', 'Features', 'Specifications',
  'Warranty', 'TermsAndConditions', 'AvailabilityDescription',
  'PrimarySupplier', 'Categories',
  'ImageURL', 'Images',
  'SEOPageTitle', 'SEOMetaKeywords', 'SEOPageHeading', 'SEOMetaDescription',
  'ShippingHeight', 'ShippingLength', 'ShippingWidth', 'ShippingWeight',
  'ItemHeight', 'ItemLength', 'ItemWidth',
  'UPC', 'AccountingCode', 'TaxCategory', 'TaxFreeItem', 'TaxInclusive',
  'SearchKeywords', 'Group', 'ShippingCategory',
  'Misc01', 'Misc02', 'Misc03', 'Misc04', 'Misc05',
];

/** Commander repeatable option collector */
export function collectField(val: string, acc: string[]): string[] {
  acc.push(val);
  return acc;
}

/** Commander repeatable option collector for category IDs */
export function collectCategory(val: string, acc: string[]): string[] {
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

/** Build an item payload object from CLI flags and --field entries */
export function buildItemPayload(
  opts: Record<string, any>,
  skuOverride?: string,
): Record<string, unknown> {
  const item: Record<string, unknown> = {};

  // Map common flags
  for (const [flag, apiField] of Object.entries(FLAG_MAP)) {
    if (opts[flag] !== undefined) {
      item[apiField] = opts[flag];
    }
  }

  // Special handling: --category (repeatable) → Categories structure
  if (opts.category?.length > 0) {
    item.Categories = opts.category.map((id: string) => ({ CategoryID: id }));
  }

  // Special handling: --quantity → WarehouseQuantity
  if (opts.quantity !== undefined) {
    item.DefaultQuantity = opts.quantity;
  }

  // Merge --field entries (explicit flags take precedence)
  if (opts.field?.length > 0) {
    const extras = parseFieldEntries(opts.field);
    for (const [key, val] of Object.entries(extras)) {
      if (!(key in item)) {
        item[key] = val;
      }
    }
  }

  // Apply SKU override (for update command where SKU comes from argument)
  if (skuOverride) {
    item.SKU = skuOverride;
  }

  return item;
}

/** Read JSON input from a file path or stdin */
export async function readJsonInput(fromJson: string | boolean): Promise<Record<string, unknown>[]> {
  let raw: string;

  if (fromJson === true || fromJson === '-') {
    if (process.stdin.isTTY) {
      throw new Error('No input on stdin. Pipe JSON or provide a file path: --from-json product.json');
    }
    raw = await readStdin();
  } else {
    raw = readFileSync(fromJson as string, 'utf-8');
  }

  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) return parsed;
  if (parsed.Item && Array.isArray(parsed.Item)) return parsed.Item;
  return [parsed];
}

/** Read all data from stdin */
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
  const tmpFile = join(tmpdir(), `neto-product-${Date.now()}.json`);

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

/** Strip readonly fields from a product object for editing */
export function stripReadonlyFields(product: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...product };
  for (const field of READONLY_FIELDS) {
    delete cleaned[field];
  }
  return cleaned;
}
