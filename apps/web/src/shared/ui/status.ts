/** Semantic status tones — brand teal is identity, not every status. */
export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const INVOICE_STATUS_TONE: Record<string, StatusTone> = {
  extracting: 'info',
  captured: 'info',
  needs_review: 'warning',
  exception: 'danger',
  in_approval: 'warning',
  approved: 'success',
  exported: 'neutral',
  void: 'neutral',
  paid: 'success',
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  extracting: 'Extracting',
  captured: 'Captured',
  needs_review: 'Needs review',
  exception: 'Exception',
  in_approval: 'In approval',
  approved: 'Approved',
  exported: 'Exported',
  void: 'Void',
  paid: 'Paid',
};

export function invoiceStatusTone(status: string): StatusTone {
  return INVOICE_STATUS_TONE[status] ?? 'neutral';
}

export function invoiceStatusLabel(status: string): string {
  return INVOICE_STATUS_LABEL[status] ?? status.replace(/_/g, ' ');
}

export function ocrConfidenceTone(confidence: number | null | undefined): StatusTone {
  if (confidence == null) return 'neutral';
  if (confidence < 0.5) return 'danger';
  if (confidence < 0.7) return 'warning';
  return 'success';
}

export function ageTone(ageHours: number): StatusTone {
  if (ageHours >= 48) return 'danger';
  if (ageHours >= 24) return 'warning';
  return 'neutral';
}
