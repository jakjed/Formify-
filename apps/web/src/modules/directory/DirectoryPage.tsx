import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../shared/lib/api';
import {
  entityQueryParam,
  getSelectedEntityId,
} from '../../shared/lib/entity';

type Tab = 'vendors' | 'gl' | 'costCenters' | 'tax' | 'terms' | 'categories';

type EntityRow = { id: string; name: string; code: string };

type PartyRef = { id: string; code: string; name: string };

type Vendor = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  taxId: string | null;
  entityId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankIban: string | null;
  bankSwift: string | null;
  paymentTermId: string | null;
  taxCodeId: string | null;
  glAccountId: string | null;
  active: boolean;
  entity?: PartyRef | null;
  paymentTerm?: PartyRef | null;
  taxCode?: PartyRef | null;
  glAccount?: (PartyRef & { accountType?: string }) | null;
};

type GlAccount = {
  id: string;
  code: string;
  name: string;
  accountType: 'liability' | 'expense';
  entityId: string | null;
  active: boolean;
  entity?: PartyRef | null;
};

type CodeName = {
  id: string;
  code: string;
  name: string;
  entityId: string | null;
  active: boolean;
  entity?: PartyRef | null;
};

type TaxCode = CodeName & { rateBps: number };
type PaymentTerm = CodeName & { netDays: number };

type ExpenseCategory = {
  id: string;
  code: string;
  name: string;
  keywords: string;
  active: boolean;
  entityId: string;
  glAccountId: string;
  entity?: PartyRef;
  glAccount?: PartyRef;
};

const tabs: { id: Tab; label: string }[] = [
  { id: 'vendors', label: 'Vendors' },
  { id: 'gl', label: 'GL accounts' },
  { id: 'costCenters', label: 'Cost centers' },
  { id: 'tax', label: 'Tax codes' },
  { id: 'terms', label: 'Payment terms' },
  { id: 'categories', label: 'Categories' },
];

function shortId(id: string) {
  return id.slice(0, 8);
}

function entityLabel(
  entityId: string | null | undefined,
  entity?: PartyRef | null,
) {
  if (entity) return `${entity.code} — ${entity.name}`;
  if (!entityId) return '—';
  return shortId(entityId);
}

export function DirectoryPage() {
  const [tab, setTab] = useState<Tab>('vendors');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [costCenters, setCostCenters] = useState<CodeName[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [liabilityAccounts, setLiabilityAccounts] = useState<GlAccount[]>([]);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editingGl, setEditingGl] = useState<GlAccount | null>(null);
  const [editingCc, setEditingCc] = useState<CodeName | null>(null);
  const [editingTax, setEditingTax] = useState<TaxCode | null>(null);
  const [editingTerm, setEditingTerm] = useState<PaymentTerm | null>(null);

  const [formEntityId, setFormEntityId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [rateBps, setRateBps] = useState('2300');
  const [netDays, setNetDays] = useState('30');
  const [accountType, setAccountType] = useState<'liability' | 'expense'>(
    'expense',
  );
  const [categoryEntityId, setCategoryEntityId] = useState('');
  const [categoryGlId, setCategoryGlId] = useState('');
  const [categoryKeywords, setCategoryKeywords] = useState('');

  const entityId = getSelectedEntityId();

  const listQs = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('includeInactive', 'true');
    sp.set('entityId', entityQueryParam(entityId));
    if (q.trim()) sp.set('q', q.trim());
    return sp.toString();
  }, [entityId, q]);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const ents = await apiFetch<EntityRow[]>('/api/entities');
      setEntities(ents);
      setFormEntityId((prev) => prev || ents[0]?.id || '');
      setCategoryEntityId((prev) => prev || ents[0]?.id || '');

      if (tab === 'vendors') {
        const [rows, liability, tax, pay] = await Promise.all([
          apiFetch<Vendor[]>(`/api/vendors?${listQs}`),
          apiFetch<GlAccount[]>(
            `/api/gl-accounts?includeInactive=true&accountType=liability&entityId=${entityQueryParam(entityId)}`,
          ),
          apiFetch<TaxCode[]>(
            `/api/tax-codes?includeInactive=true&entityId=${entityQueryParam(entityId)}`,
          ),
          apiFetch<PaymentTerm[]>(
            `/api/payment-terms?includeInactive=true&entityId=${entityQueryParam(entityId)}`,
          ),
        ]);
        setVendors(rows);
        setLiabilityAccounts(liability);
        setTaxCodes(tax);
        setTerms(pay);
      } else if (tab === 'gl') {
        setGlAccounts(await apiFetch<GlAccount[]>(`/api/gl-accounts?${listQs}`));
      } else if (tab === 'costCenters') {
        setCostCenters(
          await apiFetch<CodeName[]>(`/api/cost-centers?${listQs}`),
        );
      } else if (tab === 'tax') {
        setTaxCodes(await apiFetch<TaxCode[]>(`/api/tax-codes?${listQs}`));
      } else if (tab === 'terms') {
        setTerms(await apiFetch<PaymentTerm[]>(`/api/payment-terms?${listQs}`));
      } else {
        const [gl, cats] = await Promise.all([
          apiFetch<GlAccount[]>(
            `/api/gl-accounts?accountType=expense&entityId=${entityQueryParam(entityId)}`,
          ),
          apiFetch<ExpenseCategory[]>(
            `/api/expense-categories${entityId !== 'all' ? `?entityId=${entityId}` : ''}`,
          ),
        ]);
        setGlAccounts(gl);
        setCategories(cats);
        setCategoryGlId((prev) => prev || gl[0]?.id || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }, [tab, listQs, entityId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function resetCreateFields() {
    setCode('');
    setName('');
    setRateBps('2300');
    setNetDays('30');
    setAccountType('expense');
    setCategoryKeywords('');
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const entityPayload =
      formEntityId || (entityId !== 'all' ? entityId : undefined);
    try {
      if (tab === 'vendors') {
        await apiFetch('/api/vendors', {
          method: 'POST',
          body: JSON.stringify({
            code,
            name,
            entityId: entityPayload || undefined,
          }),
        });
      } else if (tab === 'gl') {
        await apiFetch('/api/gl-accounts', {
          method: 'POST',
          body: JSON.stringify({
            code,
            name,
            entityId: entityPayload || undefined,
            accountType,
          }),
        });
      } else if (tab === 'costCenters') {
        await apiFetch('/api/cost-centers', {
          method: 'POST',
          body: JSON.stringify({
            code,
            name,
            entityId: entityPayload || undefined,
          }),
        });
      } else if (tab === 'tax') {
        await apiFetch('/api/tax-codes', {
          method: 'POST',
          body: JSON.stringify({
            code,
            name,
            rateBps: Number(rateBps),
            entityId: entityPayload || undefined,
          }),
        });
      } else if (tab === 'terms') {
        await apiFetch('/api/payment-terms', {
          method: 'POST',
          body: JSON.stringify({
            code,
            name,
            netDays: Number(netDays),
            entityId: entityPayload || undefined,
          }),
        });
      } else {
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
      }
      resetCreateFields();
      setMessage('Created');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  async function patchRow(path: string, body: Record<string, unknown>) {
    setError(null);
    setMessage(null);
    try {
      await apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
      setMessage('Saved');
      setEditingVendor(null);
      setEditingGl(null);
      setEditingCc(null);
      setEditingTax(null);
      setEditingTerm(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  return (
    <section className="page">
      <h1>Directory</h1>
      <p className="lede">
        Master data scoped by Entity. Search and edit vendors, GL, tax, and
        terms.
      </p>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'tabs__btn tabs__btn--active' : 'tabs__btn'}
            onClick={() => {
              setTab(t.id);
              setQ('');
              setEditingVendor(null);
              setEditingGl(null);
              setEditingCc(null);
              setEditingTax(null);
              setEditingTerm(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="ok">{message}</p>}

      <div className="inline-form" style={{ marginBottom: '0.75rem' }}>
        <input
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search directory"
        />
      </div>

      {tab !== 'categories' && (
        <form className="inline-form" onSubmit={(e) => void onCreate(e)}>
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
            value={formEntityId}
            onChange={(e) => setFormEntityId(e.target.value)}
            aria-label="Entity"
          >
            <option value="">Entity (optional)</option>
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.code} — {ent.name}
              </option>
            ))}
          </select>
          {tab === 'gl' && (
            <select
              value={accountType}
              onChange={(e) =>
                setAccountType(e.target.value as 'liability' | 'expense')
              }
            >
              <option value="expense">Expense</option>
              <option value="liability">Liability</option>
            </select>
          )}
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
          <button type="submit">Add</button>
        </form>
      )}

      {tab === 'categories' && (
        <form className="inline-form" onSubmit={(e) => void onCreate(e)}>
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
              Expense GL
            </option>
            {glAccounts.map((gl) => (
              <option key={gl.id} value={gl.id}>
                {gl.code} — {gl.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Keywords (OCR)"
            value={categoryKeywords}
            onChange={(e) => setCategoryKeywords(e.target.value)}
          />
          <button type="submit">Add</button>
        </form>
      )}

      {editingVendor && (
        <VendorEditor
          vendor={editingVendor}
          entities={entities}
          taxCodes={taxCodes}
          terms={terms}
          liabilityAccounts={liabilityAccounts}
          onCancel={() => setEditingVendor(null)}
          onSave={(body) =>
            void patchRow(`/api/vendors/${editingVendor.id}`, body)
          }
        />
      )}

      {editingGl && (
        <EditPanel
          title={`Edit GL ${editingGl.code}`}
          onCancel={() => setEditingGl(null)}
          onSubmit={(data) =>
            void patchRow(`/api/gl-accounts/${editingGl.id}`, {
              name: String(data.get('name') ?? ''),
              entityId: String(data.get('entityId') ?? '') || null,
              accountType: String(data.get('accountType') ?? 'expense'),
              active: data.get('active') === 'on',
            })
          }
        >
          <label>
            Name
            <input name="name" defaultValue={editingGl.name} required />
          </label>
          <label>
            Entity
            <select name="entityId" defaultValue={editingGl.entityId ?? ''}>
              <option value="">—</option>
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.code} — {ent.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select name="accountType" defaultValue={editingGl.accountType}>
              <option value="expense">Expense</option>
              <option value="liability">Liability</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              name="active"
              defaultChecked={editingGl.active}
            />{' '}
            Active
          </label>
        </EditPanel>
      )}

      {editingCc && (
        <EditPanel
          title={`Edit cost center ${editingCc.code}`}
          onCancel={() => setEditingCc(null)}
          onSubmit={(data) =>
            void patchRow(`/api/cost-centers/${editingCc.id}`, {
              name: String(data.get('name') ?? ''),
              entityId: String(data.get('entityId') ?? '') || null,
              active: data.get('active') === 'on',
            })
          }
        >
          <label>
            Name
            <input name="name" defaultValue={editingCc.name} required />
          </label>
          <label>
            Entity
            <select name="entityId" defaultValue={editingCc.entityId ?? ''}>
              <option value="">—</option>
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.code} — {ent.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              name="active"
              defaultChecked={editingCc.active}
            />{' '}
            Active
          </label>
        </EditPanel>
      )}

      {editingTax && (
        <EditPanel
          title={`Edit tax code ${editingTax.code}`}
          onCancel={() => setEditingTax(null)}
          onSubmit={(data) =>
            void patchRow(`/api/tax-codes/${editingTax.id}`, {
              name: String(data.get('name') ?? ''),
              rateBps: Number(data.get('rateBps') ?? 0),
              entityId: String(data.get('entityId') ?? '') || null,
              active: data.get('active') === 'on',
            })
          }
        >
          <label>
            Name
            <input name="name" defaultValue={editingTax.name} required />
          </label>
          <label>
            Rate (bps)
            <input
              name="rateBps"
              type="number"
              defaultValue={editingTax.rateBps}
              required
            />
          </label>
          <label>
            Entity
            <select name="entityId" defaultValue={editingTax.entityId ?? ''}>
              <option value="">—</option>
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.code} — {ent.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              name="active"
              defaultChecked={editingTax.active}
            />{' '}
            Active
          </label>
        </EditPanel>
      )}

      {editingTerm && (
        <EditPanel
          title={`Edit payment term ${editingTerm.code}`}
          onCancel={() => setEditingTerm(null)}
          onSubmit={(data) =>
            void patchRow(`/api/payment-terms/${editingTerm.id}`, {
              name: String(data.get('name') ?? ''),
              netDays: Number(data.get('netDays') ?? 30),
              entityId: String(data.get('entityId') ?? '') || null,
              active: data.get('active') === 'on',
            })
          }
        >
          <label>
            Name
            <input name="name" defaultValue={editingTerm.name} required />
          </label>
          <label>
            Net days
            <input
              name="netDays"
              type="number"
              defaultValue={editingTerm.netDays}
              required
            />
          </label>
          <label>
            Entity
            <select name="entityId" defaultValue={editingTerm.entityId ?? ''}>
              <option value="">—</option>
              {entities.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.code} — {ent.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              name="active"
              defaultChecked={editingTerm.active}
            />{' '}
            Active
          </label>
        </EditPanel>
      )}

      <div className="table-wrap">
        {tab === 'vendors' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th>Entity</th>
                <th>Email</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td>
                    <code title={v.id}>{shortId(v.id)}</code>
                  </td>
                  <td>{v.code}</td>
                  <td>{v.name}</td>
                  <td>{entityLabel(v.entityId, v.entity)}</td>
                  <td>{v.email ?? '—'}</td>
                  <td>{v.active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => setEditingVendor(v)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'gl' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Entity</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {glAccounts.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.accountType}</td>
                  <td>{entityLabel(row.entityId, row.entity)}</td>
                  <td>{row.active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => setEditingGl(row)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'costCenters' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Entity</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {costCenters.map((row) => (
                <tr key={row.id}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{entityLabel(row.entityId, row.entity)}</td>
                  <td>{row.active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => setEditingCc(row)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'tax' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th>Rate</th>
                <th>Entity</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {taxCodes.map((row) => (
                <tr key={row.id}>
                  <td>
                    <code title={row.id}>{shortId(row.id)}</code>
                  </td>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{(row.rateBps / 100).toFixed(2)}%</td>
                  <td>{entityLabel(row.entityId, row.entity)}</td>
                  <td>{row.active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => setEditingTax(row)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'terms' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Code</th>
                <th>Name</th>
                <th>Net days</th>
                <th>Entity</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {terms.map((row) => (
                <tr key={row.id}>
                  <td>
                    <code title={row.id}>{shortId(row.id)}</code>
                  </td>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.netDays}</td>
                  <td>{entityLabel(row.entityId, row.entity)}</td>
                  <td>{row.active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => setEditingTerm(row)}
                    >
                      Edit
                    </button>
                  </td>
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
                      : shortId(row.entityId)}
                  </td>
                  <td>
                    {row.glAccount
                      ? `${row.glAccount.code} — ${row.glAccount.name}`
                      : shortId(row.glAccountId)}
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

function EditPanel({
  title,
  children,
  onCancel,
  onSubmit,
}: {
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSubmit: (data: FormData) => void;
}) {
  return (
    <form
      className="panel workspace-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      style={{ marginBottom: '1rem' }}
    >
      <h3>{title}</h3>
      {children}
      <div className="span-2 actions">
        <button type="submit">Save</button>
        <button type="button" className="secondary-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function VendorEditor({
  vendor,
  entities,
  taxCodes,
  terms,
  liabilityAccounts,
  onCancel,
  onSave,
}: {
  vendor: Vendor;
  entities: EntityRow[];
  taxCodes: TaxCode[];
  terms: PaymentTerm[];
  liabilityAccounts: GlAccount[];
  onCancel: () => void;
  onSave: (body: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="panel workspace-form"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const str = (k: string) => String(data.get(k) ?? '').trim();
        onSave({
          name: str('name'),
          email: str('email') || undefined,
          taxId: str('taxId') || undefined,
          entityId: str('entityId') || null,
          addressLine1: str('addressLine1') || undefined,
          addressLine2: str('addressLine2') || undefined,
          city: str('city') || undefined,
          region: str('region') || undefined,
          postalCode: str('postalCode') || undefined,
          country: str('country') || undefined,
          bankName: str('bankName') || undefined,
          bankAccount: str('bankAccount') || undefined,
          bankIban: str('bankIban') || undefined,
          bankSwift: str('bankSwift') || undefined,
          taxCodeId: str('taxCodeId') || null,
          paymentTermId: str('paymentTermId') || null,
          glAccountId: str('glAccountId') || null,
          active: data.get('active') === 'on',
        });
      }}
      style={{ marginBottom: '1rem' }}
    >
      <h3>
        Edit vendor {vendor.code}{' '}
        <span className="muted">
          · ID <code title={vendor.id}>{shortId(vendor.id)}</code>
        </span>
      </h3>
      <label>
        Name
        <input name="name" defaultValue={vendor.name} required />
      </label>
      <label>
        Email
        <input name="email" type="email" defaultValue={vendor.email ?? ''} />
      </label>
      <label>
        Tax ID
        <input name="taxId" defaultValue={vendor.taxId ?? ''} />
      </label>
      <label>
        Entity
        <select name="entityId" defaultValue={vendor.entityId ?? ''}>
          <option value="">—</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>
              {ent.code} — {ent.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Default tax code
        <select name="taxCodeId" defaultValue={vendor.taxCodeId ?? ''}>
          <option value="">—</option>
          {taxCodes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} — {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Default payment terms
        <select name="paymentTermId" defaultValue={vendor.paymentTermId ?? ''}>
          <option value="">—</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} — {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        GL account (Liability)
        <select name="glAccountId" defaultValue={vendor.glAccountId ?? ''}>
          <option value="">—</option>
          {liabilityAccounts.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} — {g.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Address line 1
        <input name="addressLine1" defaultValue={vendor.addressLine1 ?? ''} />
      </label>
      <label>
        Address line 2
        <input name="addressLine2" defaultValue={vendor.addressLine2 ?? ''} />
      </label>
      <label>
        City
        <input name="city" defaultValue={vendor.city ?? ''} />
      </label>
      <label>
        Region
        <input name="region" defaultValue={vendor.region ?? ''} />
      </label>
      <label>
        Postal code
        <input name="postalCode" defaultValue={vendor.postalCode ?? ''} />
      </label>
      <label>
        Country
        <input name="country" defaultValue={vendor.country ?? ''} />
      </label>
      <label>
        Bank name
        <input name="bankName" defaultValue={vendor.bankName ?? ''} />
      </label>
      <label>
        Bank account
        <input name="bankAccount" defaultValue={vendor.bankAccount ?? ''} />
      </label>
      <label>
        IBAN
        <input name="bankIban" defaultValue={vendor.bankIban ?? ''} />
      </label>
      <label>
        SWIFT
        <input name="bankSwift" defaultValue={vendor.bankSwift ?? ''} />
      </label>
      <label>
        <input type="checkbox" name="active" defaultChecked={vendor.active} />{' '}
        Active
      </label>
      <div className="span-2 actions">
        <button type="submit">Save vendor</button>
        <button type="button" className="secondary-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
