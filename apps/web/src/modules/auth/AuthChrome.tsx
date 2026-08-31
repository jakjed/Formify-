import { Link } from 'react-router-dom';
import { PRODUCT_NAME } from '@aptora/types';

export function AuthLegalFooter() {
  return (
    <p className="muted auth__legal">
      <Link to="/legal/terms">Terms</Link>
      {' · '}
      <Link to="/legal/privacy">Privacy</Link>
      {' · '}
      <Link to="/legal/dpa">DPA</Link>
    </p>
  );
}

export function AuthBrand() {
  return (
    <div className="auth__brand">
      <img
        className="auth__mark"
        src="/brand/procure-ledger-mark.png"
        width={72}
        height={72}
        alt=""
      />
      <h1>{PRODUCT_NAME}</h1>
    </div>
  );
}
