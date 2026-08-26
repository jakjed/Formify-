export type TenantId = string & { readonly __brand: 'TenantId' };
export type EntityId = string & { readonly __brand: 'EntityId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type InvoiceId = string & { readonly __brand: 'InvoiceId' };

export function asTenantId(id: string): TenantId {
  return id as TenantId;
}
export function asEntityId(id: string): EntityId {
  return id as EntityId;
}
export function asUserId(id: string): UserId {
  return id as UserId;
}
export function asInvoiceId(id: string): InvoiceId {
  return id as InvoiceId;
}
