export type AuthProviderType = 'local' | 'oidc' | 'saml';

export type AuthProviderConfig = {
  type: AuthProviderType;
  enabled: boolean;
  order: number;
  settings: Record<string, unknown>;
};

export type UserRole = 'admin' | 'ap_manager' | 'ap_clerk' | 'approver';

export type UserStatus = 'invited' | 'active' | 'locked';

export type UserRecord = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
  role: UserRole;
  status: UserStatus;
  failedLoginCount: number;
  lockedUntil: string | null;
  createdAt: string;
};

export type RequestUser = Omit<UserRecord, 'passwordHash'> & {
  authKind?: 'session' | 'api_key';
  scopes?: string[];
  apiKeyId?: string;
};
