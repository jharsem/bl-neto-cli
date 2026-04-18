#!/usr/bin/env node

import { Command } from 'commander';
import { registerAuthCommand } from './commands/auth.js';
import { registerInfoCommand } from './commands/info.js';
import { registerProductsCommand } from './commands/products.js';
import { registerOrdersCommand } from './commands/orders.js';
import { registerCustomersCommand } from './commands/customers.js';
import { registerWarehousesCommand } from './commands/warehouses.js';
import { registerSuppliersCommand } from './commands/suppliers.js';
import { registerCategoriesCommand } from './commands/categories.js';
import { registerVouchersCommand } from './commands/vouchers.js';
import { registerContentCommand } from './commands/content.js';
import { registerRmaCommand } from './commands/rma.js';
import { registerPaymentsCommand } from './commands/payments.js';
import { registerShippingCommand } from './commands/shipping.js';
import { registerCurrencyCommand } from './commands/currency.js';
import { registerCartCommand } from './commands/cart.js';
import { registerAccountingCommand } from './commands/accounting.js';
import { registerApiCommand } from './commands/api.js';
import { registerThemeCommand } from './commands/theme.js';

const program = new Command();

program
  .name('neto')
  .description('CLI for the Neto/Maropost ecommerce API')
  .version('0.1.0');

registerAuthCommand(program);
registerInfoCommand(program);
registerProductsCommand(program);
registerOrdersCommand(program);
registerCustomersCommand(program);
registerWarehousesCommand(program);
registerSuppliersCommand(program);
registerCategoriesCommand(program);
registerVouchersCommand(program);
registerContentCommand(program);
registerRmaCommand(program);
registerPaymentsCommand(program);
registerShippingCommand(program);
registerCurrencyCommand(program);
registerCartCommand(program);
registerAccountingCommand(program);
registerApiCommand(program);
registerThemeCommand(program);

program.parse();
