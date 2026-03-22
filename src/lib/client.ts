import { type NetoConfig } from './config.js';

export class NetoApiError extends Error {
  constructor(
    public action: string,
    public statusCode: number,
    public errors: string[],
  ) {
    super(`API error for ${action}: ${errors.join(', ')}`);
    this.name = 'NetoApiError';
  }
}

const RESPONSE_KEYS: Record<string, string> = {
  GetItem: 'Item',
  AddItem: 'Item',
  UpdateItem: 'Item',
  GetOrder: 'Order',
  AddOrder: 'Order',
  UpdateOrder: 'Order',
  GetCustomer: 'Customer',
  AddCustomer: 'Customer',
  UpdateCustomer: 'Customer',
  GetCategory: 'Category',
  AddCategory: 'Category',
  UpdateCategory: 'Category',
  GetContent: 'Content',
  AddContent: 'Content',
  UpdateContent: 'Content',
  GetPayment: 'Payment',
  AddPayment: 'Payment',
  GetPaymentMethods: 'PaymentMethod',
  GetWarehouse: 'Warehouse',
  AddWarehouse: 'Warehouse',
  UpdateWarehouse: 'Warehouse',
  GetSupplier: 'Supplier',
  AddSupplier: 'Supplier',
  UpdateSupplier: 'Supplier',
  GetVoucher: 'Voucher',
  AddVoucher: 'Voucher',
  UpdateVoucher: 'Voucher',
  RedeemVoucher: 'Voucher',
  GetRma: 'Rma',
  AddRma: 'Rma',
  GetShippingMethods: 'ShippingMethod',
  GetShippingQuote: 'ShippingQuote',
  GetCurrencySettings: 'CurrencySettings',
  UpdateCurrencySettings: 'CurrencySettings',
  GetCart: 'Cart',
};

export function getResponseKey(action: string): string | undefined {
  return RESPONSE_KEYS[action];
}

export class NetoApiClient {
  private baseUrl: string;
  private apiKey: string;
  private username: string;

  constructor(config: NetoConfig) {
    this.baseUrl = config.store_url.replace(/\/$/, '');
    this.apiKey = config.api_key;
    this.username = config.username;
  }

  async call(action: string, body: Record<string, unknown> = {}): Promise<any> {
    const url = `${this.baseUrl}/do/WS/NetoAPI`;

    const headers: Record<string, string> = {
      'NETOAPI_ACTION': action,
      'NETOAPI_KEY': this.apiKey,
      'NETOAPI_USERNAME': this.username,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (response.status === 429) {
          const wait = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, wait));
          continue;
        }

        if (!response.ok) {
          const text = await response.text();
          throw new NetoApiError(action, response.status, [
            `HTTP ${response.status}: ${text.slice(0, 200)}`,
          ]);
        }

        const data = await response.json();

        if (data?.Messages?.Error?.length) {
          throw new NetoApiError(action, 200, data.Messages.Error);
        }

        return data;
      } catch (err) {
        if (err instanceof NetoApiError) throw err;
        lastError = err as Error;
        if (attempt < 2) continue;
      }
    }

    throw lastError || new Error(`Failed to call ${action}`);
  }

  async callWithFilter(
    action: string,
    filter: Record<string, unknown>,
  ): Promise<any> {
    return this.call(action, { Filter: filter });
  }
}
