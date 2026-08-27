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
};
