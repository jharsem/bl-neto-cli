import { buildPayload } from './payload-helpers.js';

// Maps Commander camelCase flag names to Neto API field names.
// Field names verified against ../neto-docs-engineer/docs/customers/addcustomer.md
export const CUSTOMER_FLAG_MAP: Record<string, string> = {
  username: 'Username',
  type: 'Type',
  password: 'Password',
  email: 'EmailAddress',
  secondaryEmail: 'SecondaryEmailAddress',
  firstName: 'FirstName',
  lastName: 'LastName',
  company: 'Company',
  phone: 'Phone',
  fax: 'Fax',
  dateOfBirth: 'DateOfBirth',
  gender: 'Gender',
  userGroup: 'UserGroup',
  creditLimit: 'CreditLimit',
  active: 'Active',
  newsletter: 'NewsletterSubscriber',
  sms: 'SMSSubscriber',
  abn: 'ABN',
  internalNotes: 'InternalNotes',
};

// Billing address flag → API child element
// Parent element is BillingAddress per addcustomer.md (children are Bill-prefixed)
const BILL_ADDRESS_MAP: Record<string, string> = {
  street: 'BillStreetLine1',
  street2: 'BillStreetLine2',
  city: 'BillCity',
  state: 'BillState',
  postcode: 'BillPostCode',
  country: 'BillCountry',
  billCompany: 'BillCompany',
  billPhone: 'BillPhone',
  billFax: 'BillFax',
};

const SHIP_ADDRESS_MAP: Record<string, string> = {
  shipStreet: 'ShipStreetLine1',
  shipStreet2: 'ShipStreetLine2',
  shipCity: 'ShipCity',
  shipState: 'ShipState',
  shipPostcode: 'ShipPostCode',
  shipCountry: 'ShipCountry',
  shipCompany: 'ShipCompany',
  shipPhone: 'ShipPhone',
  shipFax: 'ShipFax',
};

function buildBillingAddress(opts: Record<string, any>): Record<string, unknown> | undefined {
  const address: Record<string, unknown> = {};

  for (const [flag, apiField] of Object.entries(BILL_ADDRESS_MAP)) {
    if (opts[flag] !== undefined) address[apiField] = opts[flag];
  }

  // Denormalised address model: top-level fields populate the billing block unless an
  // explicit --bill-* override was provided. Confirmed against a live Neto store where
  // top-level Company/Phone don't propagate automatically.
  if (opts.firstName !== undefined) address.BillFirstName = opts.firstName;
  if (opts.lastName !== undefined) address.BillLastName = opts.lastName;
  if (opts.company !== undefined && address.BillCompany === undefined) address.BillCompany = opts.company;
  if (opts.phone !== undefined && address.BillPhone === undefined) address.BillPhone = opts.phone;
  if (opts.fax !== undefined && address.BillFax === undefined) address.BillFax = opts.fax;

  return Object.keys(address).length > 0 ? address : undefined;
}

function buildShippingAddress(
  opts: Record<string, any>,
  billing: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const address: Record<string, unknown> = {};

  // --ship-same-as-bill: copy Bill* → Ship* before applying overrides
  if (opts.shipSameAsBill && billing) {
    for (const [billKey, val] of Object.entries(billing)) {
      if (billKey.startsWith('Bill')) {
        address[`Ship${billKey.slice(4)}`] = val;
      }
    }
  }

  for (const [flag, apiField] of Object.entries(SHIP_ADDRESS_MAP)) {
    if (opts[flag] !== undefined) address[apiField] = opts[flag];
  }

  // --ship-first-name / --ship-last-name explicit overrides, else fall through from --first-name/--last-name only when copying
  if (opts.shipFirstName !== undefined) address.ShipFirstName = opts.shipFirstName;
  if (opts.shipLastName !== undefined) address.ShipLastName = opts.shipLastName;

  return Object.keys(address).length > 0 ? address : undefined;
}

/** Build a customer payload from CLI flags and --field entries */
export function buildCustomerPayload(
  opts: Record<string, any>,
  usernameOverride?: string,
): Record<string, unknown> {
  const customer = buildPayload(CUSTOMER_FLAG_MAP, opts);

  const billing = buildBillingAddress(opts);
  if (billing) customer.BillingAddress = billing;

  const shipping = buildShippingAddress(opts, billing);
  if (shipping) customer.ShippingAddress = shipping;

  if (usernameOverride) {
    customer.Username = usernameOverride;
  }

  return customer;
}
