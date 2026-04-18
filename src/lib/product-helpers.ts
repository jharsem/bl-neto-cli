import { buildPayload } from './payload-helpers.js';

export {
  collectField,
  parseFieldEntries,
  readJsonInput,
  launchEditor,
  diffObjects,
} from './payload-helpers.js';

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

/** Commander repeatable option collector for category IDs */
export function collectCategory(val: string, acc: string[]): string[] {
  acc.push(val);
  return acc;
}

/** Build an item payload object from CLI flags and --field entries */
export function buildItemPayload(
  opts: Record<string, any>,
  skuOverride?: string,
): Record<string, unknown> {
  const item = buildPayload(FLAG_MAP, opts);

  // Special handling: --category (repeatable) → Categories structure
  if (opts.category?.length > 0) {
    item.Categories = opts.category.map((id: string) => ({ CategoryID: id }));
  }

  // Special handling: --quantity + --warehouse-id → nested WarehouseQuantity element
  // (per docs/products/additem.md: WarehouseQuantity is a nested type with required WarehouseID + Quantity)
  if (opts.quantity !== undefined) {
    if (opts.warehouseId === undefined) {
      throw new Error('--quantity requires --warehouse-id. Use `neto api GetWarehouse --filter \'{"OutputSelector":["WarehouseID","Name"]}\'` to list warehouses.');
    }
    item.WarehouseQuantity = [{
      WarehouseID: opts.warehouseId,
      Quantity: opts.quantity,
    }];
  }

  if (skuOverride) {
    item.SKU = skuOverride;
  }

  return item;
}

/** Strip readonly fields from a product object for editing */
export function stripReadonlyFields(product: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...product };
  for (const field of READONLY_FIELDS) {
    delete cleaned[field];
  }
  return cleaned;
}
