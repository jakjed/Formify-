export type AuthProviderType = 'local' | 'oidc' | 'saml';

export type AuthProviderConfig = {
  type: AuthProviderType;
  enabled: boolean;
  order: number;
  settings: Record<string, unknown>;
};

export type UserRole = 'admin' | 'ap_manager' | 'ap_clerk' | 'approver';

export type UserStatus = 'invited' | 'active' | 'locked';

export type EntityMembershipSummary = {
  id: string;
  entityId: string;
  isDefault: boolean;
  entity: { id: string; code: string; name: string };
};

export type UserRecord = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
  role: UserRole;
  status: UserStatus;
  canAccessDirectory: boolean;
  canApprove: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  createdAt: string;
  defaultEntityId?: string | null;
  entityMemberships?: EntityMembershipSummary[];
};

export type ApprovalDelegationRecord = {
  id: string;
  tenantId: string;
  fromUserId: string;
  toUserId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  active: boolean;
  createdAt: string;
  fromUser?: { id: string; email: string; displayName: string };
  toUser?: { id: string; email: string; displayName: string };
};

export type RequestUser = Omit<UserRecord, 'passwordHash'> & {
  authKind?: 'session' | 'api_key' | 'oauth_client';
  scopes?: string[];
  apiKeyId?: string;
  oauthClientId?: string;
};
