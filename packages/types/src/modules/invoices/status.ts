export type InvoiceStatus =
  | 'captured'
  | 'extracting'
  | 'needs_review'
  | 'exception'
  | 'in_approval'
  | 'approved'
  | 'exported'
  | 'void'
  | 'paid';

/** Locked billable domain event */
export const BILLABLE_EVENT_INVOICE_APPROVED = 'invoice.approved' as const;

export type BillableEventType = typeof BILLABLE_EVENT_INVOICE_APPROVED;
