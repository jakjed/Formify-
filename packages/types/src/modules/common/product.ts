/** Brand & product constants */
export const PRODUCT_NAME = 'Aptora' as const;

export type ModuleKey =
  | 'invoices'
  | 'contracts'
  | 'purchase_requests'
  | 'purchase_orders';

export const PHASE1_MODULES: readonly ModuleKey[] = ['invoices'] as const;
