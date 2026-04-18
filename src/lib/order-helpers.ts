import { buildPayload } from './payload-helpers.js';

// Fields shared by AddOrder and UpdateOrder.
// Verified against ../neto-docs-engineer/docs/orders-invoices/{addorder,updateorder}.md
const SHARED_FLAG_MAP: Record<string, string> = {
  orderId: 'OrderID',
  purchaseOrderNumber: 'PurchaseOrderNumber',
  onHoldType: 'OnHoldType',
  username: 'Username',
  email: 'Email',
  billFirstName: 'BillFirstName',
  billLastName: 'BillLastName',
  billCompany: 'BillCompany',
  billStreet: 'BillStreet1',
  billStreet2: 'BillStreet2',
  billCity: 'BillCity',
  billState: 'BillState',
  billPostcode: 'BillPostCode',
  billPhone: 'BillContactPhone',
  billCountry: 'BillCountry',
  shipFirstName: 'ShipFirstName',
  shipLastName: 'ShipLastName',
  shipCompany: 'ShipCompany',
  shipStreet: 'ShipStreet1',
  shipStreet2: 'ShipStreet2',
  shipCity: 'ShipCity',
  shipState: 'ShipState',
  shipPostcode: 'ShipPostCode',
  shipPhone: 'ShipContactPhone',
  shipCountry: 'ShipCountry',
  enableAddressValidation: 'EnableAddressValidation',
  dateRequired: 'DateRequired',
  salesPerson: 'SalesPerson',
  salesChannel: 'SalesChannel',
  shipInstructions: 'ShipInstructions',
  internalOrderNotes: 'InternalOrderNotes',
  orderStatus: 'OrderStatus',
  orderApproval: 'OrderApproval',
  stickyNoteTitle: 'StickyNoteTitle',
  stickyNote: 'StickyNote',
};

// Add-only fields (not accepted by UpdateOrder per its schema)
const ADD_ONLY_FLAG_MAP: Record<string, string> = {
  orderType: 'OrderType',
  userGroup: 'UserGroup',
  documentTemplate: 'DocumentTemplate',
  datePlaced: 'DatePlaced',
  dateInvoiced: 'DateInvoiced',
  dateDue: 'DateDue',
  earnRewards: 'EarnRewards',
  paymentMethod: 'PaymentMethod',
  paymentTerms: 'PaymentTerms',
  taxInclusive: 'TaxInclusive',
  taxFreeShipping: 'TaxFreeShipping',
  shippingMethod: 'ShippingMethod',
  shippingCost: 'ShippingCost',
  shippingDiscount: 'ShippingDiscount',
  signatureRequired: 'SignatureRequired',
  currencyCode: 'CurrencyCode',
};

// Update-only fields
const UPDATE_ONLY_FLAG_MAP: Record<string, string> = {
  deduceWarehouse: 'DeduceWarehouse',
  pickStatus: 'PickStatus',
  exportStatus: 'ExportStatus',
  sendOrderEmail: 'SendOrderEmail',
};

const SHIP_COPY: Array<[string, string]> = [
  ['BillFirstName', 'ShipFirstName'],
  ['BillLastName', 'ShipLastName'],
  ['BillCompany', 'ShipCompany'],
  ['BillStreet1', 'ShipStreet1'],
  ['BillStreet2', 'ShipStreet2'],
  ['BillCity', 'ShipCity'],
  ['BillState', 'ShipState'],
  ['BillPostCode', 'ShipPostCode'],
  ['BillContactPhone', 'ShipContactPhone'],
  ['BillCountry', 'ShipCountry'],
];

function applyShipSameAsBill(order: Record<string, unknown>): void {
  for (const [billKey, shipKey] of SHIP_COPY) {
    if (order[billKey] !== undefined && order[shipKey] === undefined) {
      order[shipKey] = order[billKey];
    }
  }
}

/** Parse --line SKU:QTY[:UnitPrice] entries into OrderLine objects */
export function parseOrderLines(specs: string[] | undefined): Record<string, unknown>[] | undefined {
  if (!specs || specs.length === 0) return undefined;
  return specs.map((spec) => {
    const parts = spec.split(':');
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid --line format: "${spec}". Use --line SKU:Quantity[:UnitPrice]`);
    }
    const qty = parseInt(parts[1], 10);
    if (isNaN(qty)) throw new Error(`Invalid quantity in --line "${spec}"`);
    const line: Record<string, unknown> = { SKU: parts[0], Quantity: qty };
    if (parts[2]) {
      const price = parseFloat(parts[2]);
      if (isNaN(price)) throw new Error(`Invalid unit price in --line "${spec}"`);
      line.UnitPrice = price;
    }
    return line;
  });
}

export function buildAddOrderPayload(opts: Record<string, any>): Record<string, unknown> {
  const order = buildPayload({ ...SHARED_FLAG_MAP, ...ADD_ONLY_FLAG_MAP }, opts);

  if (opts.shipSameAsBill) applyShipSameAsBill(order);

  const lines = parseOrderLines(opts.line);
  if (lines) order.OrderLine = lines;

  return order;
}

export function buildUpdateOrderPayload(
  opts: Record<string, any>,
  orderIdOverride?: string,
): Record<string, unknown> {
  const order = buildPayload({ ...SHARED_FLAG_MAP, ...UPDATE_ONLY_FLAG_MAP }, opts);

  if (opts.shipSameAsBill) applyShipSameAsBill(order);

  // Tracking details: build OrderLine with TrackingDetails when tracking flags are set.
  // Per updateorder.md, tracking lives on OrderLine, not top-level.
  if (opts.trackingNumber || opts.dateShipped || opts.trackingShippingMethod) {
    const td: Record<string, unknown> = {};
    if (opts.trackingShippingMethod) td.ShippingMethod = opts.trackingShippingMethod;
    if (opts.trackingNumber) td.TrackingNumber = opts.trackingNumber;
    if (opts.dateShipped) td.DateShipped = opts.dateShipped;
    const line: Record<string, unknown> = { TrackingDetails: td };
    if (opts.sku) line.SKU = opts.sku;
    order.OrderLine = [line];
  }

  if (orderIdOverride) order.OrderID = orderIdOverride;

  return order;
}
