import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="page">
      <h1>Page not found</h1>
      <p className="lede">That route does not exist in Aptora.</p>
      <p>
        <Link to="/">Back to My Work</Link>
      </p>
    </section>
  );
}

export function ForbiddenPage() {
  return (
    <section className="page">
      <h1>Not allowed</h1>
      <p className="lede">You do not have permission for this action.</p>
      <p>
        <Link to="/">Back to My Work</Link>
      </p>
    </section>
  );
}
