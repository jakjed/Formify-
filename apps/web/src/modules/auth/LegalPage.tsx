import { Link } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';
import { AuthBrand, AuthLegalFooter } from './AuthChrome';

type Kind = 'terms' | 'privacy' | 'dpa';

const COPY: Record<Kind, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms of Service',
    body: [
      `${PRODUCT_NAME} is an accounts payable workspace that captures, codes, and exports payment-ready invoices. Paying vendors stays in your ERP or bank.`,
      'By using the service you agree to use it only for your organization’s legitimate AP operations, keep credentials confidential, and not attempt to access other tenants’ data.',
      'This draft is provided for design-partner review. A signed order form and DPA govern production use.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    body: [
      `${PRODUCT_NAME} processes invoice documents and related master data as a processor on behalf of your organization (the controller).`,
      'Invoice files may be sent to AWS Textract in your tenant region when OCR is enabled. We do not use customer documents to train foundation models.',
      'You may request access, correction, or deletion through your tenant administrator. EU tenants are pinned to the EU region.',
    ],
  },
  dpa: {
    title: 'Data Processing Addendum',
    body: [
      `${PRODUCT_NAME} acts as processor; the customer is controller. Subprocessors: AWS (hosting, RDS, S3, Textract; optional Bedrock).`,
      'No training of models on customer content. AI assist is off by default and tenant-admin configurable.',
      'Incident notification: without undue delay and within 72 hours where GDPR requires. Retention of invoices and audit logs follows the order form (typically 7 years for financial records).',
    ],
  },
};

export function LegalPage({ kind }: { kind: Kind }) {
  const page = COPY[kind];
  return (
    <div className="auth">
      <article className="auth__card auth__card--wide">
        <AuthBrand />
        <h2>{page.title}</h2>
        {page.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p className="muted">
          <Link to="/login">Back to sign in</Link>
        </p>
        <AuthLegalFooter />
      </article>
    </div>
  );
}
