/** Gabi / Ledgerline-aligned procure workflow constants (mock stages). */

export const CONTRACT_APPROVAL_CHAIN = [
  'Budget Owner',
  'Legal',
  'Tax',
  'Compliance',
  'Finance',
] as const;

export const ACCRUAL_APPROVAL_CHAIN = ['AP Manager', 'Controller'] as const;

export const CLM_TOOLS = [
  'Conga',
  'Docusign CLM',
  'PandaDoc',
  'IronClad',
] as const;

export const CONTRACT_DOC_CATEGORIES = [
  'draft',
  'executed',
  'correspondence',
  'paymentForm',
  'misc',
  'others',
] as const;

export const EXPENSE_CATEGORIES = [
  'Software & SaaS',
  'Professional Services',
  'Marketing',
  'Facilities',
  'Travel & Entertainment',
  'Consulting',
] as const;

export const DEPARTMENTS = [
  'G&A',
  'R&D',
  'Sales & Marketing',
  'Finance',
  'Operations',
] as const;

export type SignatureSigner = {
  name: string;
  role: string;
  status: 'Waiting' | 'Sent' | 'Signed';
  signedAt: string | null;
};

export type SignatureEnvelope = {
  status: 'Not started' | 'Sent' | 'Completed';
  envelopeId: string | null;
  sentAt: string | null;
  signers: SignatureSigner[];
};

export type RedFlag = {
  severity: 'High' | 'Medium' | 'Low';
  text: string;
};

export function emptySignature(ownerName: string, vendorName: string): SignatureEnvelope {
  return {
    status: 'Not started',
    envelopeId: null,
    sentAt: null,
    signers: [
      { name: ownerName || 'Budget Owner', role: 'Budget Owner', status: 'Waiting', signedAt: null },
      { name: 'CFO', role: 'CFO', status: 'Waiting', signedAt: null },
      {
        name: `${vendorName || 'Vendor'} Representative`,
        role: 'Vendor signatory',
        status: 'Waiting',
        signedAt: null,
      },
    ],
  };
}
