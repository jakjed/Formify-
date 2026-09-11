export type ModuleLicenseMap = Record<string, boolean>;

export type TenantRecord = {
  id: string;
  name: string;
  slug: string;
  region: 'us' | 'eu';
  modules: ModuleLicenseMap;
  createdAt: string;
};

export type EntityRecord = {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  defaultCurrency: string;
  fxProviderKey: string;
};

export type EntityWriteInput = {
  name?: string;
  code?: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  defaultCurrency?: string;
  fxProviderKey?: string;
};
