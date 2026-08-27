/** Brand & product constants */
export const PRODUCT_NAME = 'Aptora' as const;

export type ModuleKey =
  | 'invoices'
  | 'contracts'
  | 'purchase_requests'
  | 'purchase_orders';

export const PHASE1_MODULES: readonly ModuleKey[] = ['invoices'] as const;

export const PHASE2_MODULES: readonly ModuleKey[] = [
  'contracts',
  'purchase_requests',
  'purchase_orders',
] as const;

export const ALL_MODULE_KEYS: readonly ModuleKey[] = [
  ...PHASE1_MODULES,
  ...PHASE2_MODULES,
] as const;
