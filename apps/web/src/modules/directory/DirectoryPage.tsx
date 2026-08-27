import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../shared/lib/api';

type Tab = 'vendors' | 'gl' | 'costCenters' | 'tax' | 'terms' | 'categories';

type Vendor = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  active: boolean;
};

type CodeName = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

type TaxCode = CodeName & { rateBps: number };
type PaymentTerm = CodeName & { netDays: number };

type EntityRow = { id: string; name: string; code: string };

type ExpenseCategory = {
  id: string;
  code: string;
  name: string;
  keywords: string;
  active: boolean;
  entityId: string;
  glAccountId: string;
  entity?: { id: string; code: string; name: string };
  glAccount?: { id: string; code: string; name: string };
};

const tabs: { id: Tab; label: string }[] = [
  { id: 'vendors', label: 'Vendors' },
  { id: 'gl', label: 'GL accounts' },
  { id: 'costCenters', label: 'Cost centers' },
  { id: 'tax', label: 'Tax codes' },
  { id: 'terms', label: 'Payment terms' },
  { id: 'categories', label: 'Categories' },
];

export function DirectoryPage() {
  const [tab, setTab] = useState<Tab>('vendors');
  const [error, setError] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [glAccounts, setGlAccounts] = useState<CodeName[]>([]);
  const [costCenters, setCostCenters] = useState<CodeName[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  const [vendorCode, setVendorCode] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [rateBps, setRateBps] = useState('2300');
  const [netDays, setNetDays] = useState('30');
  const [categoryEntityId, setCategoryEntityId] = useState('');
  const [categoryGlId, setCategoryGlId] = useState('');
  const [categoryKeywords, setCategoryKeywords] = useState('');

  const refresh = useCallback(async () => {
    setError(null);
    try {
      if (tab === 'vendors') {
        setVendors(await apiFetch<Vendor[]>('/api/vendors?includeInactive=true'));
      } else if (tab === 'gl') {
        setGlAccounts(await apiFetch<CodeName[]>('/api/gl-accounts?includeInactive=true'));
      } else if (tab === 'costCenters') {
        setCostCenters(await apiFetch<CodeName[]>('/api/cost-centers?includeInactive=true'));
      } else if (tab === 'tax') {
        setTaxCodes(await apiFetch<TaxCode[]>('/api/tax-codes?includeInactive=true'));
      } else if (tab === 'categories') {
        const [ents, gl, cats] = await Promise.all([
          apiFetch<EntityRow[]>('/api/entities'),
          apiFetch<CodeName[]>('/api/gl-accounts'),
          apiFetch<ExpenseCategory[]>('/api/expense-categories'),
        ]);
        setEntities(ents);
        setGlAccounts(gl);
        setCategories(cats);
        setCategoryEntityId((prev) => prev || ents[0]?.id || '');
        setCategoryGlId((prev) => prev || gl[0]?.id || '');
      } else {
        setTerms(await apiFetch<PaymentTerm[]>('/api/payment-terms?includeInactive=true'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (tab === 'vendors') {
        await apiFetch('/api/vendors', {
          method: 'POST',
          body: JSON.stringify({ code: vendorCode, name: vendorName }),
        });
        setVendorCode('');
        setVendorName('');
      } else if (tab === 'gl') {
        await apiFetch('/api/gl-accounts', {
          method: 'POST',
          body: JSON.stringify({ code, name }),
        });
        setCode('');
        setName('');
      } else if (tab === 'costCenters') {
        await apiFetch('/api/cost-centers', {
          method: 'POST',
          body: JSON.stringify({ code, name }),
        });
        setCode('');
        setName('');
      } else if (tab === 'tax') {
        await apiFetch('/api/tax-codes', {
          method: 'POST',
          body: JSON.stringify({ code, name, rateBps: Number(rateBps) }),
        });
        setCode('');
        setName('');
      } else if (tab === 'categories') {
        await apiFetch('/api/expense-categories', {
          method: 'POST',
          body: JSON.stringify({
            code,
            name,
            entityId: categoryEntityId,
            glAccountId: categoryGlId,
            keywords: categoryKeywords.trim() || undefined,
          }),
        });
        setCode('');
        setName('');
        setCategoryKeywords('');
      } else {
        await apiFetch('/api/payment-terms', {
          method: 'POST',
          body: JSON.stringify({ code, name, netDays: Number(netDays) }),
        });
        setCode('');
        setName('');
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  async function deactivateVendor(id: string) {
    await apiFetch(`/api/vendors/${id}`, { method: 'DELETE' });
    await refresh();
  }

  return (
    <section className="page">
      <h1>Directory</h1>
      <p className="lede">Master data for vendors and financial coding.</p>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tabs__btn tabs__btn--active' : 'tabs__btn'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <form className="inline-form" onSubmit={onCreate}>
        {tab === 'vendors' ? (
          <>
            <input
              placeholder="Code"
              value={vendorCode}
              onChange={(e) => setVendorCode(e.target.value)}
              required
            />
            <input
              placeholder="Name"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              required
            />
          </>
        ) : tab === 'categories' ? (
          <>
            <input
              placeholder="Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <select
              value={categoryEntityId}
              onChange={(e) => setCategoryEntityId(e.target.value)}
              required
            >
              <option value="" disabled>
                Entity
              </option>
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.code} — {ent.name}
                </option>
              ))}
            </select>
            <select
              value={categoryGlId}
              onChange={(e) => setCategoryGlId(e.target.value)}
              required
            >
              <option value="" disabled>
                GL account
              </option>
              {glAccounts.map((gl) => (
                <option key={gl.id} value={gl.id}>
                  {gl.code} — {gl.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Keywords (comma-separated, for OCR)"
              value={categoryKeywords}
              onChange={(e) => setCategoryKeywords(e.target.value)}
            />
          </>
        ) : (
          <>
            <input
              placeholder="Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            {tab === 'tax' && (
              <input
                placeholder="Rate (bps)"
                value={rateBps}
                onChange={(e) => setRateBps(e.target.value)}
                required
              />
            )}
            {tab === 'terms' && (
              <input
                placeholder="Net days"
                value={netDays}
                onChange={(e) => setNetDays(e.target.value)}
                required
              />
            )}
          </>
        )}
        <button type="submit">Add</button>
      </form>

      <div className="table-wrap">
        {tab === 'vendors' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td>{v.code}</td>
                  <td>{v.name}</td>
                  <td>{v.email ?? '—'}</td>
                  <td>{v.active ? 'Active' : 'Inactive'}</td>
                  <td>
                    {v.active && (
                      <button type="button" className="linkish" onClick={() => void deactivateVendor(v.id)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'gl' && <CodeTable rows={glAccounts} />}
        {tab === 'costCenters' && <CodeTable rows={costCenters} />}
        {tab === 'tax' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {taxCodes.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{(row.rateBps / 100).toFixed(2)}%</td>
                  <td>{row.active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'terms' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Net days</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.netDays}</td>
                  <td>{row.active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'categories' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Entity</th>
                <th>GL</th>
                <th>Keywords</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>
                    {row.entity
                      ? `${row.entity.code} — ${row.entity.name}`
                      : row.entityId.slice(0, 8)}
                  </td>
                  <td>
                    {row.glAccount
                      ? `${row.glAccount.code} — ${row.glAccount.name}`
                      : row.glAccountId.slice(0, 8)}
                  </td>
                  <td>{row.keywords || '—'}</td>
                  <td>{row.active ? 'Active' : 'Inactive'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function CodeTable({ rows }: { rows: CodeName[] }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.code}</td>
            <td>{row.name}</td>
            <td>{row.active ? 'Active' : 'Inactive'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
