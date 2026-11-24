import { useCallback, useEffect, useRef, useState } from 'react';

const API_URL = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000/api' : '')
).replace(/\/+$/, '');
const API_ORIGIN = API_URL.replace(/\/api$/, '');
const CATEGORIES = ['Keys', 'Electronics', 'ID / Cards', 'Books / Stationery', 'Other'];
const DEVELOPERS = [
  'Mawejje Alesha',
  'Osire Samuel',
  'Nangiro Apollo',
  'Okumu Oscar Ebiru',
  'Mulungi Favour Priscilla',
  'Nimusima Cuthbert',
];

async function request(path, { token, body, ...options } = {}) {
  if (!API_URL) {
    throw new Error('VITE_API_URL is not configured for this deployment.');
  }

  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let requestBody = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: requestBody,
  });
  const responseText = await response.text();
  let data = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error('The server returned an invalid response.');
    }
  }

  if (!response.ok) {
    throw new Error(data.error || 'The request could not be completed.');
  }
  return data;
}

function readSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('ucu_user') || 'null');
  } catch {
    return null;
  }
}

function formatStatus(status) {
  return status.replaceAll('_', ' ');
}

function statusStyle(status) {
  if (status === 'RETURNED') return 'bg-slate-200 text-slate-800';
  if (status === 'CLAIM_APPROVED') return 'bg-blue-100 text-blue-900';
  return 'bg-emerald-100 text-emerald-900';
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ucu_token') || '');
  const [user, setUser] = useState(readSavedUser);
  const [view, setView] = useState('browse');
  const [authMode, setAuthMode] = useState('login');
  const [showDevelopers, setShowDevelopers] = useState(false);
  const [authForm, setAuthForm] = useState({
    full_name: '',
    reg_no: '',
    email: '',
    password: '',
  });
  const [notice, setNotice] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [claims, setClaims] = useState([]);
  const [filters, setFilters] = useState({
    keyword: '',
    category: '',
    location: '',
    date: '',
    type: '',
  });
  const [reportForm, setReportForm] = useState({
    report_type: 'FOUND',
    title: '',
    category: 'Keys',
    public_description: '',
    private_details: '',
    campus_location: '',
    incident_date: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [claimingItem, setClaimingItem] = useState(null);
  const [evidenceText, setEvidenceText] = useState('');
  const [reviewInputs, setReviewInputs] = useState({});
  const noticeTimer = useRef(null);

  const notify = useCallback((type, text) => {
    setNotice({ type, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice({ type: '', text: '' }), 5000);
  }, []);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const fetchItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value),
      ).toString();
      const data = await request(`/items${query ? `?${query}` : ''}`, { token });
      setItems(data);
    } catch (error) {
      notify('error', error.message || 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, [filters, notify, token]);

  const fetchClaims = useCallback(async () => {
    if (!token) return;
    try {
      setClaims(await request('/claims', { token }));
    } catch (error) {
      notify('error', error.message || 'Could not load claims.');
    }
  }, [notify, token]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleAuth = async (event) => {
    event.preventDefault();
    setLoading(true);
    const endpoint = authMode === 'login' ? '/login' : '/register';
    try {
      const data = await request(endpoint, {
        method: 'POST',
        body: authForm,
      });

      if (authMode === 'register') {
        notify('success', data.message || 'Registration successful. You may now sign in.');
        setAuthMode('login');
        setAuthForm((current) => ({ ...current, password: '' }));
        return;
      }

      localStorage.setItem('ucu_token', data.token);
      localStorage.setItem('ucu_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setView(data.user.role === 'ADMIN' ? 'admin' : 'browse');
      setAuthForm({ full_name: '', reg_no: '', email: '', password: '' });
    } catch (error) {
      notify('error', error.message || 'Server unreachable. Ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ucu_token');
    localStorage.removeItem('ucu_user');
    setToken('');
    setUser(null);
    setItems([]);
    setClaims([]);
    setView('browse');
  };

  const handleCreateReport = async (event) => {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData();
    Object.entries(reportForm).forEach(([key, value]) => formData.append(key, value));
    if (imageFile) formData.append('image', imageFile);

    try {
      const data = await request('/items', {
        method: 'POST',
        token,
        body: formData,
      });
      notify('success', data.message || 'Report submitted.');
      setReportForm({
        report_type: 'FOUND',
        title: '',
        category: 'Keys',
        public_description: '',
        private_details: '',
        campus_location: '',
        incident_date: '',
      });
      setImageFile(null);
      setView('browse');
      await fetchItems();
    } catch (error) {
      notify('error', error.message || 'Could not submit the report.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClaim = async (event) => {
    event.preventDefault();
    if (!claimingItem) return;
    setLoading(true);
    try {
      const data = await request('/claims', {
        method: 'POST',
        token,
        body: {
          item_id: claimingItem.item_id,
          evidence_text: evidenceText,
        },
      });
      notify('success', data.message || 'Claim submitted for review.');
      setClaimingItem(null);
      setEvidenceText('');
      setView('claims');
      await fetchClaims();
    } catch (error) {
      notify('error', error.message || 'Could not submit the claim.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminReview = async (claimId, decision) => {
    const reason = reviewInputs[claimId] || '';
    if (!reason.trim()) {
      notify('error', 'Please enter a reason before approving or rejecting.');
      return;
    }
    setLoading(true);
    try {
      const data = await request(`/claims/${claimId}/review`, {
        method: 'PATCH',
        token,
        body: { decision, admin_reason: reason.trim() },
      });
      notify('success', data.message || 'Claim reviewed.');
      await Promise.all([fetchClaims(), fetchItems()]);
    } catch (error) {
      notify('error', error.message || 'Could not review the claim.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReturn = async (itemId) => {
    setLoading(true);
    try {
      const data = await request(`/items/${itemId}/return`, {
        method: 'PATCH',
        token,
      });
      notify('success', data.message || 'Item marked as returned.');
      await Promise.all([fetchItems(), fetchClaims()]);
    } catch (error) {
      notify('error', error.message || 'Could not update the item.');
    } finally {
      setLoading(false);
    }
  };

  const updateAuthField = (event) => {
    setAuthForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  if (!token || !user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/ucu-campus-library.png')" }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-slate-950/30" />
        <div className="relative z-10 w-full max-w-md rounded-xl border border-white/30 bg-white/20 p-6 shadow-2xl backdrop-blur-md">
          <h1 className="text-center text-2xl font-bold text-slate-900">
            UCU Campus Lost &amp; Found
          </h1>
          <p className="mt-1 text-center text-sm font-medium text-slate-700">
            Uganda Christian University · Mukono Campus
          </p>
          <p className="mb-6 mt-3 text-center text-sm leading-relaxed text-slate-800">
            Helping our campus community report lost belongings, find recovered items, and return them to their owners.
          </p>
          {notice.text && <Notice notice={notice} />}
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <>
                <FormField label="Full Name" htmlFor="full_name">
                  <input
                    id="full_name"
                    name="full_name"
                    required
                    autoComplete="name"
                    className={inputClass}
                    value={authForm.full_name}
                    onChange={updateAuthField}
                  />
                </FormField>
                <FormField label="Registration Number" htmlFor="reg_no">
                  <input
                    id="reg_no"
                    name="reg_no"
                    required
                    placeholder="e.g. S25D14/020"
                    className={inputClass}
                    value={authForm.reg_no}
                    onChange={updateAuthField}
                  />
                </FormField>
              </>
            )}
            <FormField label="University Email" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className={inputClass}
                value={authForm.email}
                onChange={updateAuthField}
              />
            </FormField>
            <FormField label="Password" htmlFor="password">
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                className={inputClass}
                value={authForm.password}
                onChange={updateAuthField}
              />
            </FormField>
            <button type="submit" disabled={loading} className={primaryButtonClass + ' w-full'}>
              {loading ? 'Processing…' : authMode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setAuthMode((mode) => (mode === 'login' ? 'register' : 'login'));
              setNotice({ type: '', text: '' });
            }}
            className="mt-4 w-full rounded p-1 text-sm font-semibold text-blue-900 underline focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            {authMode === 'login' ? 'Need a student account? Register here' : 'Already have an account? Sign in'}
          </button>
          <button
            type="button"
            onClick={() => setShowDevelopers(true)}
            className="mt-2 w-full rounded p-1 text-sm font-semibold text-slate-900 underline focus:outline-none focus:ring-2 focus:ring-blue-700"
          >
            Meet the Developers
          </button>
        </div>
        {showDevelopers && (
          <div
            role="presentation"
            className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/60 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setShowDevelopers(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setShowDevelopers(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="developers-heading"
              className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/50 bg-white/95 p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 id="developers-heading" className="text-xl font-bold text-slate-900">
                    Meet the Developers
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    The team behind UCU Campus Lost &amp; Found.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close developers"
                  onClick={() => setShowDevelopers(false)}
                  className="rounded px-2 py-1 text-xl leading-none text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-700"
                >
                  &times;
                </button>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {DEVELOPERS.map((name) => {
                  const initials = name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join('');
                  return (
                    <li
                      key={name}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-bold text-white"
                      >
                        {initials}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{name}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-blue-950 text-white shadow">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-lg font-bold">UCU Campus Lost &amp; Found</h1>
            <p className="text-xs text-blue-200">
              {user.full_name} ({user.reg_no}) · Role: {user.role}
            </p>
          </div>
          <nav aria-label="Main navigation" className="flex flex-wrap gap-2">
            <NavButton active={view === 'browse'} onClick={() => setView('browse')}>
              Browse Items
            </NavButton>
            <NavButton active={view === 'report'} onClick={() => setView('report')}>
              + Report Item
            </NavButton>
            <NavButton active={view === 'claims'} onClick={() => setView('claims')}>
              {user.role === 'ADMIN' ? 'All Claims' : 'My Claims'}
            </NavButton>
            {user.role === 'ADMIN' && (
              <NavButton active={view === 'admin'} onClick={() => setView('admin')} accent>
                Admin Review
              </NavButton>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium hover:bg-red-600 focus:ring-2 focus:ring-white"
            >
              Log Out
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        {notice.text && <Notice notice={notice} />}
        {view === 'browse' && (
          <section aria-labelledby="browse-heading">
            <h2 id="browse-heading" className="sr-only">Browse reports</h2>
            <div className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
              <FilterField label="Keyword" htmlFor="f-kw">
                <input
                  id="f-kw"
                  placeholder="Keys, charger…"
                  className={inputClass}
                  value={filters.keyword}
                  onChange={(event) => setFilters({ ...filters, keyword: event.target.value })}
                />
              </FilterField>
              <FilterField label="Report Type" htmlFor="f-type">
                <select
                  id="f-type"
                  className={inputClass}
                  value={filters.type}
                  onChange={(event) => setFilters({ ...filters, type: event.target.value })}
                >
                  <option value="">All Reports</option>
                  <option value="FOUND">Found Items</option>
                  <option value="LOST">Lost Items</option>
                </select>
              </FilterField>
              <FilterField label="Category" htmlFor="f-cat">
                <select
                  id="f-cat"
                  className={inputClass}
                  value={filters.category}
                  onChange={(event) => setFilters({ ...filters, category: event.target.value })}
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </FilterField>
              <FilterField label="Campus Location" htmlFor="f-loc">
                <input
                  id="f-loc"
                  placeholder="e.g. N5B, Library"
                  className={inputClass}
                  value={filters.location}
                  onChange={(event) => setFilters({ ...filters, location: event.target.value })}
                />
              </FilterField>
              <FilterField label="Date" htmlFor="f-date">
                <input
                  id="f-date"
                  type="date"
                  className={inputClass}
                  value={filters.date}
                  onChange={(event) => setFilters({ ...filters, date: event.target.value })}
                />
              </FilterField>
            </div>

            {loading ? (
              <p className="py-8 text-center text-slate-600" role="status">Loading listings…</p>
            ) : items.length === 0 ? (
              <p className="rounded-xl border bg-white py-8 text-center text-slate-600">
                No items match your current filters.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <article key={item.item_id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className={`rounded px-2.5 py-0.5 text-xs font-bold ${item.report_type === 'FOUND' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'}`}>
                          {item.report_type}
                        </span>
                        <span className={`rounded px-2.5 py-0.5 text-xs font-bold ${statusStyle(item.status)}`}>
                          {formatStatus(item.status)}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{item.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.category} · {item.campus_location} · {item.incident_date?.slice(0, 10)}
                      </p>
                      {item.image_url && (
                        <img
                          src={`${API_ORIGIN}${item.image_url}`}
                          alt={item.title}
                          className="mt-3 h-36 w-full rounded-lg border object-cover"
                        />
                      )}
                      <p className="mt-3 text-sm text-slate-700">{item.public_description}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <span className="text-xs text-slate-500">By: {item.reporter_name}</span>
                      {item.report_type === 'FOUND' && item.status === 'OPEN' && item.reporter_id !== user.user_id && (
                        <button
                          type="button"
                          onClick={() => setClaimingItem(item)}
                          className="rounded bg-blue-900 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 focus:ring-2 focus:ring-blue-600"
                        >
                          Claim This Item
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {view === 'report' && (
          <section className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold">Report a Lost or Found Item</h2>
            <form onSubmit={handleCreateReport} className="space-y-4">
              <FormField label="Report Type" htmlFor="r-type">
                <select
                  id="r-type"
                  className={inputClass}
                  value={reportForm.report_type}
                  onChange={(event) => setReportForm({ ...reportForm, report_type: event.target.value })}
                >
                  <option value="FOUND">I Found an Item</option>
                  <option value="LOST">I Lost an Item</option>
                </select>
              </FormField>
              <FormField label="Item Title" htmlFor="r-title">
                <input
                  id="r-title"
                  required
                  placeholder="e.g. Set of keys with blue keyring"
                  className={inputClass}
                  value={reportForm.title}
                  onChange={(event) => setReportForm({ ...reportForm, title: event.target.value })}
                />
              </FormField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Category" htmlFor="r-cat">
                  <select
                    id="r-cat"
                    className={inputClass}
                    value={reportForm.category}
                    onChange={(event) => setReportForm({ ...reportForm, category: event.target.value })}
                  >
                    {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </FormField>
                <FormField label="Date Lost/Found" htmlFor="r-date">
                  <input
                    id="r-date"
                    type="date"
                    required
                    className={inputClass}
                    value={reportForm.incident_date}
                    onChange={(event) => setReportForm({ ...reportForm, incident_date: event.target.value })}
                  />
                </FormField>
              </div>
              <FormField label="Campus Location" htmlFor="r-loc">
                <input
                  id="r-loc"
                  required
                  placeholder="e.g. N5B, Hamu Mukasa Library"
                  className={inputClass}
                  value={reportForm.campus_location}
                  onChange={(event) => setReportForm({ ...reportForm, campus_location: event.target.value })}
                />
              </FormField>
              <FormField label="Public Description" htmlFor="r-pub">
                <textarea
                  id="r-pub"
                  required
                  rows={2}
                  placeholder="Keep private marks or phone numbers out."
                  className={inputClass}
                  value={reportForm.public_description}
                  onChange={(event) => setReportForm({ ...reportForm, public_description: event.target.value })}
                />
              </FormField>
              {reportForm.report_type === 'FOUND' && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                  <FormField label="Private Identifying Details" htmlFor="r-priv">
                    <p className="mb-1 text-xs text-amber-800">
                      Hidden from public listings. Record details only the real owner would know.
                    </p>
                    <textarea
                      id="r-priv"
                      required
                      rows={2}
                      className={inputClass}
                      value={reportForm.private_details}
                      onChange={(event) => setReportForm({ ...reportForm, private_details: event.target.value })}
                    />
                  </FormField>
                </div>
              )}
              <FormField label="Optional Photograph" htmlFor="r-img">
                <input
                  id="r-img"
                  type="file"
                  accept="image/*"
                  className="mt-1 w-full text-sm"
                  onChange={(event) => setImageFile(event.target.files?.[0] || null)}
                />
                <p className="mt-1 text-xs text-slate-500">Do not include private details in the photo.</p>
              </FormField>
              <button type="submit" disabled={loading} className={primaryButtonClass + ' w-full'}>
                {loading ? 'Submitting…' : 'Submit Report'}
              </button>
            </form>
          </section>
        )}

        {view === 'claims' && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">
              {user.role === 'ADMIN' ? 'All Submitted Claims' : 'My Ownership Claims'}
            </h2>
            {claims.length === 0 ? (
              <p className="rounded-xl border bg-white p-6 text-slate-600">No claims recorded yet.</p>
            ) : claims.map((claim) => (
              <article key={claim.claim_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold">{claim.item_title}</h3>
                  <ClaimStatus status={claim.status} />
                </div>
                <p className="mt-2 text-sm"><strong>Private Evidence:</strong> {claim.evidence_text}</p>
                {claim.admin_reason && (
                  <p className="mt-2 rounded border border-blue-200 bg-blue-50 p-2 text-sm text-blue-950">
                    <strong>Administrator Response:</strong> {claim.admin_reason}
                  </p>
                )}
              </article>
            ))}
          </section>
        )}

        {view === 'admin' && user.role === 'ADMIN' && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Claim Verification &amp; Handover</h2>
            {claims.length === 0 ? (
              <p className="rounded-xl border bg-white p-6 text-slate-600">No claims need review.</p>
            ) : claims.map((claim) => (
              <article key={claim.claim_id} className="space-y-3 rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold">
                      {claim.item_title} <span className="text-sm font-normal">(Item: {formatStatus(claim.item_status)})</span>
                    </h3>
                    <p className="text-xs text-slate-600">
                      Claimant: {claim.claimant_name} ({claim.claimant_reg})
                    </p>
                  </div>
                  <ClaimStatus status={claim.status} />
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div className="rounded border border-amber-200 bg-amber-50 p-3">
                    <strong>Finder&apos;s Private Item Details:</strong>
                    <p className="mt-1">{claim.item_private_details || 'None recorded'}</p>
                  </div>
                  <div className="rounded border border-blue-200 bg-blue-50 p-3">
                    <strong>Claimant&apos;s Private Proof:</strong>
                    <p className="mt-1">{claim.evidence_text}</p>
                  </div>
                </div>
                {claim.status === 'PENDING' && claim.item_status === 'OPEN' && (
                  <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                    <input
                      aria-label={`Decision reason for claim ${claim.claim_id}`}
                      placeholder="Enter verification reason or collection instructions"
                      className={inputClass + ' flex-1'}
                      value={reviewInputs[claim.claim_id] || ''}
                      onChange={(event) => setReviewInputs({
                        ...reviewInputs,
                        [claim.claim_id]: event.target.value,
                      })}
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAdminReview(claim.claim_id, 'APPROVED')}
                      className="rounded bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => handleAdminReview(claim.claim_id, 'REJECTED')}
                      className="rounded bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-600"
                    >
                      Reject
                    </button>
                  </div>
                )}
                {claim.status === 'APPROVED' && claim.item_status === 'CLAIM_APPROVED' && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleConfirmReturn(claim.item_id)}
                    className="rounded bg-blue-900 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
                  >
                    Confirm Collection &amp; Mark Returned
                  </button>
                )}
              </article>
            ))}
          </section>
        )}
      </main>

      {claimingItem && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setClaimingItem(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-heading"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 id="claim-heading" className="text-lg font-bold">Submit Ownership Claim</h2>
            <p className="mt-1 text-sm text-slate-600">
              Item: <strong>{claimingItem.title}</strong>
            </p>
            <form onSubmit={handleSubmitClaim} className="mt-4 space-y-4">
              <FormField label="Private Ownership Evidence" htmlFor="claim-ev">
                <p className="mb-1 text-xs text-slate-500">
                  Describe unique hidden details visible only to you and the administrator.
                </p>
                <textarea
                  id="claim-ev"
                  required
                  minLength={5}
                  rows={3}
                  className={inputClass}
                  value={evidenceText}
                  onChange={(event) => setEvidenceText(event.target.value)}
                />
              </FormField>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClaimingItem(null)}
                  className="rounded border px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} className={primaryButtonClass}>
                  {loading ? 'Submitting…' : 'Submit Private Claim'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-700';
const primaryButtonClass = 'rounded-lg bg-blue-900 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 focus:ring-4 focus:ring-blue-300';

function Notice({ notice }) {
  const styles = notice.type === 'error'
    ? 'border-red-300 bg-red-100 text-red-900'
    : 'border-emerald-300 bg-emerald-100 text-emerald-900';
  return (
    <div role="alert" aria-live="polite" className={`mb-4 rounded-lg border p-3 text-sm font-semibold ${styles}`}>
      {notice.text}
    </div>
  );
}

function FormField({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-800">{label}</label>
      {children}
    </div>
  );
}

function FilterField({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function NavButton({ active, accent = false, onClick, children }) {
  const base = accent ? 'bg-amber-700 hover:bg-amber-600' : 'bg-blue-900 hover:bg-blue-800';
  const selected = accent ? 'bg-amber-600' : 'bg-blue-700';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-white ${active ? selected : base}`}
    >
      {children}
    </button>
  );
}

function ClaimStatus({ status }) {
  const styles = status === 'APPROVED'
    ? 'bg-emerald-100 text-emerald-900'
    : status === 'REJECTED'
      ? 'bg-red-100 text-red-900'
      : 'bg-amber-100 text-amber-900';
  return (
    <span className={`rounded px-2.5 py-1 text-xs font-bold ${styles}`}>
      {status}
    </span>
  );
}
