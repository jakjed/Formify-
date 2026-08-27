export type AuthProviderType = 'local' | 'oidc' | 'saml';

export type AuthProviderConfig = {
  type: AuthProviderType;
  enabled: boolean;
  order: number;
  settings: Record<string, unknown>;
};

export type UserRecord = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: 'admin' | 'ap_manager' | 'ap_clerk' | 'approver';
  createdAt: string;
};

export type RequestUser = Omit<UserRecord, 'passwordHash'>;
