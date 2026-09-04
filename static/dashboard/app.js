const { useState, useEffect, useCallback, useRef } = React;

let auth = null;

async function initFirebase() {
  const res = await fetch('/api/config/firebase');
  const config = await res.json();
  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }
  auth = firebase.auth();
  return auth;
}

async function apiCall(method, path, body = null) {
  const token = await auth?.currentUser?.getIdToken();
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function formatCurrency(amount) {
  const n = parseFloat(amount) || 0;
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }) {
  const map = {
    Pending:      { bg: '#FFF3CD', fg: '#856404' },
    Accepted:     { bg: '#CCE5FF', fg: '#004085' },
    'Picked Up':  { bg: '#D4EDDA', fg: '#155724' },
    'In Transit': { bg: '#D4EDDA', fg: '#155724' },
    Arrived:      { bg: '#CCE5FF', fg: '#004085' },
    Delivered:    { bg: '#D4EDDA', fg: '#155724' },
    Cancelled:    { bg: '#F8D7DA', fg: '#721C24' },
    Expired:      { bg: '#E2E3E5', fg: '#383D41' },
    Active:       { bg: '#D4EDDA', fg: '#155724' },
    Completed:    { bg: '#CCE5FF', fg: '#004085' },
    Inactive:     { bg: '#E2E3E5', fg: '#383D41' },
  };
  const s = map[status] || { bg: '#E2E3E5', fg: '#383D41' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: s.bg, color: s.fg }}>
      {status}
    </span>
  );
}

function StatCard({ title, value, icon, accent, sub }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Alert({ type, children, onClose }) {
  const s = type === 'error'
    ? { bg: '#FEE2E2', color: '#DC2626', border: '#FCA5A5' }
    : { bg: '#D1FAE5', color: '#059669', border: '#6EE7B7' };
  return (
    <div style={{ ...s, border: `1px solid ${s.border}`, padding: '12px 16px', borderRadius: 8, fontSize: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{children}</span>
      {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.color, fontSize: 16, padding: '0 4px' }}>✕</button>}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #F3F4F6', borderTop: '3px solid #FF6B35', animation: 'spin .7s linear infinite' }} />
    </div>
  );
}

function Empty({ icon, title, sub, action }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '64px 32px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontWeight: 600, color: '#374151', fontSize: 16 }}>{title}</div>
      {sub && <div style={{ color: '#9CA3AF', fontSize: 14, marginTop: 8 }}>{sub}</div>}
      {action && <div style={{ marginTop: 20 }}>{action}</div>}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6B7280', padding: '0 4px' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
      <span style={{ fontSize: 13, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', textAlign: 'right', maxWidth: '60%' }}>{value || '—'}</span>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
      setError(err.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#FFF5EE,#FFE0CC)' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 48, width: 400, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,.12)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: '#FF6B35', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>📦</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>ParcelPeer</h1>
          <p style={{ color: '#6B7280', fontSize: 14, margin: 0 }}>Provider Dashboard</p>
        </div>

        {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

        <form onSubmit={submit}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Email</label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="you@example.com" autoComplete="email"
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 14 }}
          />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Password</label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)} required
            placeholder="••••••••" autoComplete="current-password"
            style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', outline: 'none', marginBottom: 24 }}
          />
          <button
            type="submit" disabled={loading}
            style={{ width: '100%', padding: 14, background: loading ? '#FEB896' : '#FF6B35', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage, user, onLogout }) {
  const nav = [
    { id: 'overview',   label: 'Overview',        icon: '📊' },
    { id: 'parcels',    label: 'Available Jobs',   icon: '📦' },
    { id: 'deliveries', label: 'My Deliveries',    icon: '🚚' },
    { id: 'routes',     label: 'My Routes',        icon: '🗺️' },
    { id: 'earnings',   label: 'Earnings',         icon: '💰' },
    { id: 'profile',    label: 'Profile',          icon: '👤' },
  ];

  return (
    <div style={{ width: 240, minHeight: '100vh', background: '#111827', display: 'flex', flexDirection: 'column', padding: '24px 14px', boxSizing: 'border-box', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40, padding: '0 6px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FF6B35', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📦</div>
        <div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>ParcelPeer</div>
          <div style={{ color: '#6B7280', fontSize: 11 }}>Provider Portal</div>
        </div>
      </div>

      <nav style={{ flex: 1 }}>
        {nav.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 8, border: 'none', background: page === item.id ? '#FF6B35' : 'transparent', color: page === item.id ? 'white' : '#9CA3AF', fontSize: 14, fontWeight: 500, cursor: 'pointer', marginBottom: 2, textAlign: 'left' }}
          >
            <span style={{ fontSize: 17 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <div style={{ borderTop: '1px solid #1F2937', paddingTop: 16 }}>
        <div style={{ color: '#9CA3AF', fontSize: 13, padding: '0 8px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.displayName || user?.email?.split('@')[0] || 'Provider'}
        </div>
        <div style={{ color: '#4B5563', fontSize: 12, padding: '0 8px', marginBottom: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email}
        </div>
        <button
          onClick={onLogout}
          style={{ width: '100%', padding: '9px 14px', background: 'transparent', border: '1px solid #1F2937', borderRadius: 8, color: '#6B7280', fontSize: 13, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          🚪 Sign Out
        </button>
      </div>
    </div>
  );
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────

function OverviewPage({ user, setPage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [parcels, wallet] = await Promise.all([
          apiCall('GET', '/parcels'),
          apiCall('GET', '/wallet/balance').catch(() => ({ balance: 0 })),
        ]);
        const mine = parcels.filter(p => p.transporterId === user.uid);
        const delivered = mine.filter(p => p.status === 'Delivered');
        const active = mine.filter(p => ['Accepted', 'Picked Up', 'In Transit', 'Arrived'].includes(p.status));
        const earnings = delivered.reduce((s, p) => s + parseFloat(p.compensation || 0), 0);
        const avgEarnings = delivered.length > 0 ? earnings / delivered.length : 0;
        const onTimeRate = delivered.length > 0 ? Math.round((delivered.length / mine.filter(p => p.status !== 'Cancelled').length) * 100) : 0;
        setData({ mine, delivered, active, earnings, avgEarnings, onTimeRate, balance: wallet.balance || 0 });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 24px' }}>Welcome back 👋</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard title="Wallet Balance"   value={formatCurrency((data?.balance || 0) / 100)} icon="💳" accent="#FF6B35" />
        <StatCard title="Total Earned"     value={formatCurrency(data?.earnings)}               icon="💰" accent="#10B981" sub={`Avg ${formatCurrency(data?.avgEarnings)} / job`} />
        <StatCard title="Completed"        value={data?.delivered.length || 0}                  icon="✅" accent="#3B82F6" sub={data?.onTimeRate > 0 ? `${data.onTimeRate}% completion rate` : null} />
        <StatCard title="Active Jobs"      value={data?.active.length || 0}                     icon="🚚" accent="#F59E0B" />
      </div>

      {data?.active?.length > 0 && (
        <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>🚚 Active Jobs</h3>
            <button onClick={() => setPage('deliveries')} style={{ background: 'none', border: 'none', color: '#FF6B35', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
          </div>
          <div style={{ padding: '12px 24px' }}>
            {data.active.slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < data.active.slice(0, 3).length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 500, color: '#111827', fontSize: 14 }}>{p.origin} → {p.destination}</div>
                  <div style={{ color: '#9CA3AF', fontSize: 12 }}>📅 {formatDate(p.pickupDate)}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>Recent Deliveries</h3>
          <button onClick={() => setPage('deliveries')} style={{ background: 'none', border: 'none', color: '#FF6B35', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>View all →</button>
        </div>
        {(!data?.mine?.length) ? (
          <div style={{ padding: '48px 32px', textAlign: 'center', color: '#9CA3AF' }}>
            No deliveries yet — accept your first job from <button onClick={() => setPage('parcels')} style={{ background: 'none', border: 'none', color: '#FF6B35', cursor: 'pointer', fontWeight: 600, fontSize: 'inherit', padding: 0 }}>Available Jobs</button>.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9FAFB' }}>
                {['Route', 'Pickup Date', 'Compensation', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.mine.slice(0, 8).map((p, i) => (
                <tr key={p.id} style={{ borderTop: i > 0 ? '1px solid #F3F4F6' : 'none' }}>
                  <td style={{ padding: '13px 24px' }}>
                    <div style={{ fontWeight: 500, color: '#111827', fontSize: 14 }}>{p.origin}</div>
                    <div style={{ color: '#9CA3AF', fontSize: 12 }}>→ {p.destination}</div>
                  </td>
                  <td style={{ padding: '13px 24px', color: '#6B7280', fontSize: 14 }}>{formatDate(p.pickupDate)}</td>
                  <td style={{ padding: '13px 24px', fontWeight: 600, color: '#FF6B35', fontSize: 14 }}>{formatCurrency(p.compensation)}</td>
                  <td style={{ padding: '13px 24px' }}><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── AVAILABLE JOBS ───────────────────────────────────────────────────────────

function ParcelsPage({ user }) {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await apiCall('GET', '/parcels');
      setParcels(all.filter(p => p.status === 'Pending' && !p.transporterId));
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to load jobs. Please try again.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const accept = async (id) => {
    setAccepting(id);
    setMsg(null);
    try {
      await apiCall('PATCH', `/parcels/${id}/accept`, { transporterId: user.uid });
      setMsg({ type: 'success', text: 'Job accepted! Check My Deliveries to manage it.' });
      setSelected(null);
      await load();
    } catch (e) {
      setMsg({ type: 'error', text: 'Could not accept this job. It may have already been taken.' });
    } finally {
      setAccepting(null);
    }
  };

  const sizes = ['all', 'small', 'medium', 'large', 'extra_large'];

  const filtered = parcels.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.origin?.toLowerCase().includes(q) || p.destination?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
    const matchSize = sizeFilter === 'all' || p.size === sizeFilter;
    return matchSearch && matchSize;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Available Jobs</h2>
        <button
          onClick={load}
          style={{ padding: '8px 16px', background: '#F3F4F6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by route or description…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 220, padding: '9px 14px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, outline: 'none' }}
        />
        <select
          value={sizeFilter} onChange={e => setSizeFilter(e.target.value)}
          style={{ padding: '9px 14px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, outline: 'none', background: 'white', cursor: 'pointer' }}
        >
          {sizes.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All sizes' : s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <Empty icon="📭" title="No jobs available right now" sub={search || sizeFilter !== 'all' ? 'Try adjusting your filters' : 'Check back soon for new delivery requests'} />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ color: '#6B7280', fontSize: 13 }}>{filtered.length} job{filtered.length !== 1 ? 's' : ''} available</div>
          {filtered.map(p => (
            <div key={p.id} style={{ background: 'white', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#FF6B35', background: '#FFF5EE', padding: '2px 10px', borderRadius: 12 }}>
                    {(p.size || 'medium').charAt(0).toUpperCase() + (p.size || 'medium').slice(1).replace('_', ' ')}
                  </span>
                  {p.isFragile && <span style={{ fontSize: 12, color: '#D97706', background: '#FFFBEB', padding: '2px 10px', borderRadius: 12 }}>⚠️ Fragile</span>}
                </div>
                <div style={{ fontWeight: 600, color: '#111827', fontSize: 15, marginBottom: 4 }}>
                  {p.origin} → {p.destination}
                </div>
                {p.description && (
                  <div style={{ color: '#6B7280', fontSize: 13, marginBottom: 8, maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>
                )}
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#9CA3AF', flexWrap: 'wrap' }}>
                  <span>📅 {formatDate(p.pickupDate)}</span>
                  {p.weight && <span>⚖️ {p.weight} kg</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#FF6B35', marginBottom: 12 }}>{formatCurrency(p.compensation)}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setSelected(p)}
                    style={{ padding: '10px 16px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => accept(p.id)}
                    disabled={accepting === p.id}
                    style={{ padding: '10px 22px', background: accepting === p.id ? '#E5E7EB' : '#FF6B35', color: accepting === p.id ? '#9CA3AF' : 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: accepting === p.id ? 'not-allowed' : 'pointer' }}
                  >
                    {accepting === p.id ? 'Accepting…' : 'Accept'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <Modal title="Job Details" onClose={() => setSelected(null)}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <StatusBadge status={selected.status} />
              {selected.isFragile && <span style={{ fontSize: 12, color: '#D97706', background: '#FFFBEB', padding: '3px 10px', borderRadius: 12 }}>⚠️ Fragile</span>}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
              {selected.origin} → {selected.destination}
            </div>
            {selected.description && <div style={{ color: '#6B7280', fontSize: 14 }}>{selected.description}</div>}
          </div>
          <InfoRow label="Compensation" value={<span style={{ color: '#FF6B35', fontSize: 15 }}>{formatCurrency(selected.compensation)}</span>} />
          <InfoRow label="Parcel Size" value={(selected.size || 'medium').charAt(0).toUpperCase() + (selected.size || 'medium').slice(1).replace('_', ' ')} />
          {selected.weight && <InfoRow label="Weight" value={`${selected.weight} kg`} />}
          <InfoRow label="Pickup Date" value={formatDate(selected.pickupDate)} />
          {selected.deliveryDeadline && <InfoRow label="Delivery Deadline" value={formatDate(selected.deliveryDeadline)} />}
          {selected.receiverName && <InfoRow label="Receiver Name" value={selected.receiverName} />}
          {selected.receiverPhone && <InfoRow label="Receiver Phone" value={selected.receiverPhone} />}
          {selected.specialInstructions && <InfoRow label="Special Instructions" value={selected.specialInstructions} />}
          <InfoRow label="Posted" value={formatDateTime(selected.createdAt)} />
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button
              onClick={() => setSelected(null)}
              style={{ flex: 1, padding: 12, background: '#F3F4F6', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 14, cursor: 'pointer', color: '#374151' }}
            >
              Close
            </button>
            <button
              onClick={() => accept(selected.id)}
              disabled={accepting === selected.id}
              style={{ flex: 2, padding: 12, background: accepting === selected.id ? '#E5E7EB' : '#FF6B35', color: accepting === selected.id ? '#9CA3AF' : 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: accepting === selected.id ? 'not-allowed' : 'pointer' }}
            >
              {accepting === selected.id ? 'Accepting…' : 'Accept This Job'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MY DELIVERIES ────────────────────────────────────────────────────────────

function DeliveriesPage({ user }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [filter, setFilter] = useState('active');
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await apiCall('GET', '/parcels');
      setDeliveries(all.filter(p => p.transporterId === user.uid));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const nextStatus = { Accepted: 'Picked Up', 'Picked Up': 'In Transit', 'In Transit': 'Arrived', Arrived: 'Delivered' };
  const activeSet = new Set(['Accepted', 'Picked Up', 'In Transit', 'Arrived']);

  const updateStatus = async (id, status) => {
    setUpdating(id);
    setMsg(null);
    try {
      await apiCall('PATCH', `/parcels/${id}`, { status });
      setMsg({ type: 'success', text: `Status updated to "${status}" successfully.` });
      if (selected?.id === id) setSelected(s => ({ ...s, status }));
      await load();
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to update status. Please try again.' });
    } finally {
      setUpdating(null);
    }
  };

  const filtered = filter === 'active'
    ? deliveries.filter(p => activeSet.has(p.status))
    : deliveries.filter(p => p.status === 'Delivered');

  const statusSteps = ['Accepted', 'Picked Up', 'In Transit', 'Arrived', 'Delivered'];

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 20px' }}>My Deliveries</h2>

      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[['active', '🚚 Active'], ['done', '✅ Completed']].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: filter === id ? '#FF6B35' : '#F3F4F6', color: filter === id ? 'white' : '#374151', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}
          >{label}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#9CA3AF', fontSize: 13 }}>{filtered.length} job{filtered.length !== 1 ? 's' : ''}</span>
          <button onClick={load} style={{ padding: '8px 14px', background: '#F3F4F6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>🔄</button>
        </div>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <Empty
          icon={filter === 'active' ? '🚚' : '✅'}
          title={filter === 'active' ? 'No active deliveries' : 'No completed deliveries yet'}
          sub={filter === 'active' ? 'Accept jobs from Available Jobs to get started' : ''}
        />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {filtered.map(p => {
            const next = nextStatus[p.status];
            const stepIdx = statusSteps.indexOf(p.status);
            return (
              <div key={p.id} style={{ background: 'white', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: '#111827', fontSize: 15, marginBottom: 4 }}>
                      {p.origin} → {p.destination}
                    </div>
                    <div style={{ color: '#9CA3AF', fontSize: 13, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>📅 {formatDate(p.pickupDate)}</span>
                      {p.receiverName && <span>👤 {p.receiverName}</span>}
                      {p.isFragile && <span style={{ color: '#D97706' }}>⚠️ Fragile</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#FF6B35', marginBottom: 6 }}>{formatCurrency(p.compensation)}</div>
                    <StatusBadge status={p.status} />
                  </div>
                </div>

                {filter === 'active' && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#F9FAFB', borderRadius: 8, padding: '10px 14px', overflowX: 'auto' }}>
                    {statusSteps.slice(0, -1).map((step, i) => (
                      <React.Fragment key={step}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: i <= stepIdx ? '#FF6B35' : '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', fontWeight: 700 }}>
                            {i < stepIdx ? '✓' : i === stepIdx ? '●' : '○'}
                          </div>
                          <span style={{ fontSize: 10, color: i <= stepIdx ? '#FF6B35' : '#9CA3AF', whiteSpace: 'nowrap', fontWeight: i === stepIdx ? 600 : 400 }}>{step}</span>
                        </div>
                        {i < statusSteps.length - 2 && <div style={{ flex: 1, height: 2, background: i < stepIdx ? '#FF6B35' : '#E5E7EB', alignSelf: 'flex-start', marginTop: 9, minWidth: 20 }} />}
                      </React.Fragment>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelected(p)}
                    style={{ padding: '8px 18px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
                  >
                    View Details
                  </button>
                  {next && (
                    <button
                      onClick={() => updateStatus(p.id, next)}
                      disabled={updating === p.id}
                      style={{ padding: '8px 18px', background: updating === p.id ? '#E5E7EB' : '#111827', color: updating === p.id ? '#9CA3AF' : 'white', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 13, cursor: updating === p.id ? 'not-allowed' : 'pointer' }}
                    >
                      {updating === p.id ? 'Updating…' : `Mark as ${next}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <Modal title="Delivery Details" onClose={() => setSelected(null)}>
          <div style={{ marginBottom: 16 }}>
            <StatusBadge status={selected.status} />
          </div>
          <InfoRow label="Route" value={`${selected.origin} → ${selected.destination}`} />
          <InfoRow label="Compensation" value={<span style={{ color: '#FF6B35' }}>{formatCurrency(selected.compensation)}</span>} />
          <InfoRow label="Pickup Date" value={formatDate(selected.pickupDate)} />
          {selected.deliveryDeadline && <InfoRow label="Deadline" value={formatDate(selected.deliveryDeadline)} />}
          {selected.receiverName && <InfoRow label="Receiver" value={selected.receiverName} />}
          {selected.receiverPhone && <InfoRow label="Receiver Phone" value={selected.receiverPhone} />}
          {selected.receiverAddress && <InfoRow label="Receiver Address" value={selected.receiverAddress} />}
          <InfoRow label="Size" value={(selected.size || '—').replace('_', ' ')} />
          {selected.weight && <InfoRow label="Weight" value={`${selected.weight} kg`} />}
          {selected.isFragile && <InfoRow label="Fragile" value="Yes ⚠️" />}
          {selected.description && <InfoRow label="Description" value={selected.description} />}
          {selected.specialInstructions && <InfoRow label="Special Instructions" value={selected.specialInstructions} />}
          {nextStatus[selected.status] && (
            <button
              onClick={() => { updateStatus(selected.id, nextStatus[selected.status]); }}
              disabled={updating === selected.id}
              style={{ width: '100%', marginTop: 24, padding: 12, background: updating === selected.id ? '#E5E7EB' : '#FF6B35', color: updating === selected.id ? '#9CA3AF' : 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: updating === selected.id ? 'not-allowed' : 'pointer' }}
            >
              {updating === selected.id ? 'Updating…' : `Mark as ${nextStatus[selected.status]}`}
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── MY ROUTES ────────────────────────────────────────────────────────────────

function RoutesPage({ user }) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    origin: '', destination: '', departureDate: '', departureTime: '',
    frequency: 'one_time', maxParcelSize: 'medium', maxWeight: '', availableCapacity: '',
    pricePerKg: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [matchingParcels, setMatchingParcels] = useState(null);
  const [loadingMatches, setLoadingMatches] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall('GET', `/users/${user.uid}/routes`);
      setRoutes(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleChange = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const resetForm = () => {
    setForm({ origin: '', destination: '', departureDate: '', departureTime: '', frequency: 'one_time', maxParcelSize: 'medium', maxWeight: '', availableCapacity: '', pricePerKg: '', notes: '' });
    setShowForm(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const body = {
        origin: form.origin,
        destination: form.destination,
        departureDate: new Date(`${form.departureDate}T${form.departureTime || '08:00'}`).toISOString(),
        departureTime: form.departureTime || null,
        frequency: form.frequency,
        maxParcelSize: form.maxParcelSize || null,
        maxWeight: form.maxWeight ? parseFloat(form.maxWeight) : null,
        availableCapacity: form.availableCapacity ? parseInt(form.availableCapacity) : null,
        pricePerKg: form.pricePerKg ? Math.round(parseFloat(form.pricePerKg) * 100) : null,
        notes: form.notes || null,
      };
      await apiCall('POST', '/routes', body);
      setMsg({ type: 'success', text: 'Route posted successfully! You can now receive matching parcel requests.' });
      resetForm();
      await load();
    } catch (e) {
      setMsg({ type: 'error', text: 'Failed to post route. Please check your details and try again.' });
    } finally {
      setSaving(false);
    }
  };

  const deleteRoute = async (id) => {
    if (!confirm('Delete this route?')) return;
    setDeleting(id);
    try {
      await apiCall('DELETE', `/routes/${id}`);
      setMsg({ type: 'success', text: 'Route deleted.' });
      await load();
    } catch (e) {
      setMsg({ type: 'error', text: 'Could not delete route.' });
    } finally {
      setDeleting(null);
    }
  };

  const loadMatches = async (routeId) => {
    if (matchingParcels?.routeId === routeId) { setMatchingParcels(null); return; }
    setLoadingMatches(routeId);
    try {
      const data = await apiCall('GET', `/routes/${routeId}/matching-parcels`);
      setMatchingParcels({ routeId, parcels: Array.isArray(data) ? data : [] });
    } catch (e) {
      setMsg({ type: 'error', text: 'Could not load matching parcels.' });
    } finally {
      setLoadingMatches(null);
    }
  };

  const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' };
  const labelStyle = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>My Routes</h2>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{ padding: '9px 20px', background: '#FF6B35', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {showForm ? '✕ Cancel' : '+ Post Route'}
        </button>
      </div>

      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {showForm && (
        <div style={{ background: 'white', borderRadius: 12, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: '#111827' }}>Post a New Route</h3>
          <form onSubmit={submit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Origin *</label>
                <input required value={form.origin} onChange={e => handleChange('origin', e.target.value)} placeholder="e.g. Cape Town" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Destination *</label>
                <input required value={form.destination} onChange={e => handleChange('destination', e.target.value)} placeholder="e.g. Johannesburg" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Departure Date *</label>
                <input required type="date" value={form.departureDate} onChange={e => handleChange('departureDate', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Departure Time</label>
                <input type="time" value={form.departureTime} onChange={e => handleChange('departureTime', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Frequency</label>
                <select value={form.frequency} onChange={e => handleChange('frequency', e.target.value)} style={{ ...inputStyle, background: 'white', cursor: 'pointer' }}>
                  <option value="one_time">One Time</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Max Parcel Size</label>
                <select value={form.maxParcelSize} onChange={e => handleChange('maxParcelSize', e.target.value)} style={{ ...inputStyle, background: 'white', cursor: 'pointer' }}>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                  <option value="extra_large">Extra Large</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Max Weight (kg)</label>
                <input type="number" min="0" step="0.1" value={form.maxWeight} onChange={e => handleChange('maxWeight', e.target.value)} placeholder="e.g. 10" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Available Capacity (parcels)</label>
                <input type="number" min="1" step="1" value={form.availableCapacity} onChange={e => handleChange('availableCapacity', e.target.value)} placeholder="e.g. 3" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Price per kg (R)</label>
                <input type="number" min="0" step="0.01" value={form.pricePerKg} onChange={e => handleChange('pricePerKg', e.target.value)} placeholder="e.g. 25.00" style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} placeholder="Any additional info for senders…" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={resetForm} style={{ padding: '10px 24px', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ padding: '10px 28px', background: saving ? '#E5E7EB' : '#FF6B35', color: saving ? '#9CA3AF' : 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Posting…' : 'Post Route'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <Spinner /> : routes.length === 0 ? (
        <Empty
          icon="🗺️"
          title="No routes posted yet"
          sub="Post your travel routes so senders can find you and request deliveries along your path."
          action={<button onClick={() => setShowForm(true)} style={{ padding: '10px 24px', background: '#FF6B35', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Post Your First Route</button>}
        />
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {routes.map(r => (
            <div key={r.id} style={{ background: 'white', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#111827', fontSize: 15, marginBottom: 4 }}>{r.origin} → {r.destination}</div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 13, color: '#9CA3AF', flexWrap: 'wrap' }}>
                    <span>📅 {formatDate(r.departureDate)}{r.departureTime ? ` at ${r.departureTime}` : ''}</span>
                    <span style={{ textTransform: 'capitalize' }}>🔁 {r.frequency?.replace('_', ' ')}</span>
                    {r.maxParcelSize && <span>📦 Up to {r.maxParcelSize.replace('_', ' ')}</span>}
                    {r.maxWeight && <span>⚖️ Max {r.maxWeight} kg</span>}
                    {r.pricePerKg && <span>💰 {formatCurrency(r.pricePerKg / 100)}/kg</span>}
                  </div>
                  {r.notes && <div style={{ color: '#6B7280', fontSize: 13, marginTop: 8 }}>{r.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  <StatusBadge status={r.status} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => loadMatches(r.id)}
                  disabled={loadingMatches === r.id}
                  style={{ padding: '7px 16px', background: matchingParcels?.routeId === r.id ? '#FF6B35' : '#F3F4F6', color: matchingParcels?.routeId === r.id ? 'white' : '#374151', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                >
                  {loadingMatches === r.id ? 'Loading…' : matchingParcels?.routeId === r.id ? 'Hide Matches' : '🎯 View Matching Parcels'}
                </button>
                <button
                  onClick={() => deleteRoute(r.id)}
                  disabled={deleting === r.id}
                  style={{ padding: '7px 16px', background: 'transparent', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 13, cursor: deleting === r.id ? 'not-allowed' : 'pointer' }}
                >
                  {deleting === r.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>

              {matchingParcels?.routeId === r.id && (
                <div style={{ marginTop: 16, borderTop: '1px solid #F3F4F6', paddingTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
                    Matching Parcels ({matchingParcels.parcels.length})
                  </div>
                  {matchingParcels.parcels.length === 0 ? (
                    <div style={{ color: '#9CA3AF', fontSize: 13 }}>No matching parcel requests found for this route right now.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {matchingParcels.parcels.map(p => (
                        <div key={p.id} style={{ background: '#F9FAFB', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{p.origin} → {p.destination}</div>
                            <div style={{ fontSize: 12, color: '#9CA3AF' }}>📅 {formatDate(p.pickupDate)} · {(p.size || 'medium').replace('_', ' ')}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: '#FF6B35', fontSize: 15 }}>{formatCurrency(p.compensation)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EARNINGS ─────────────────────────────────────────────────────────────────

function EarningsPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [wallet, txns, sub] = await Promise.all([
          apiCall('GET', '/wallet/balance').catch(() => ({ balance: 0 })),
          apiCall('GET', '/wallet/transactions?limit=50').catch(() => []),
          apiCall('GET', '/subscription').catch(() => null),
        ]);
        setBalance(wallet.balance || 0);
        setTransactions(Array.isArray(txns) ? txns : []);
        setSubscription(sub);
      } catch (e) {
        setError('Could not load earnings data.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const initTopup = async (e) => {
    e.preventDefault();
    const amount = parseFloat(topupAmount);
    if (!amount || amount < 10) { setMsg({ type: 'error', text: 'Minimum top-up amount is R10.' }); return; }
    setTopupLoading(true);
    setMsg(null);
    try {
      const data = await apiCall('POST', '/wallet/topup/initialize', {
        amount: Math.round(amount * 100),
        email: auth?.currentUser?.email,
      });
      if (data?.authorizationUrl || data?.authorization_url) {
        window.open(data.authorizationUrl || data.authorization_url, '_blank');
        setMsg({ type: 'success', text: 'Payment page opened in a new tab. Your balance will update after payment.' });
        setShowTopup(false);
        setTopupAmount('');
      } else {
        setMsg({ type: 'error', text: 'Could not initiate top-up. Please try again.' });
      }
    } catch (e) {
      setMsg({ type: 'error', text: 'Top-up failed. Please try again.' });
    } finally {
      setTopupLoading(false);
    }
  };

  const credits = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + (t.amount || 0), 0);
  const debits = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + (t.amount || 0), 0);

  if (loading) return <Spinner />;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 24px' }}>Earnings</h2>

      {error && <Alert type="error">{error}</Alert>}
      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'linear-gradient(135deg,#FF6B35,#FF9A6C)', borderRadius: 16, padding: '28px 32px', color: 'white', gridColumn: 'span 2' }}>
          <div style={{ fontSize: 13, opacity: .8, marginBottom: 8 }}>Available Balance</div>
          <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 8 }}>{formatCurrency(balance / 100)}</div>
          <div style={{ fontSize: 12, opacity: .65, marginBottom: 16 }}>South African Rand · Secured by ParcelPeer</div>
          <button
            onClick={() => setShowTopup(s => !s)}
            style={{ padding: '9px 20px', background: 'rgba(255,255,255,.2)', color: 'white', border: '1.5px solid rgba(255,255,255,.4)', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {showTopup ? '✕ Cancel' : '+ Top Up Wallet'}
          </button>
        </div>
        <StatCard title="Total Credits" value={formatCurrency(credits / 100)} icon="📈" accent="#10B981" />
        <StatCard title="Total Debits" value={formatCurrency(debits / 100)} icon="📉" accent="#EF4444" />
        {subscription && (
          <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>Subscription Plan</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', textTransform: 'capitalize', marginBottom: 4 }}>{subscription.tier || 'Free'}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>Platform fee: {subscription.platformFeePercentage || 10}%</div>
          </div>
        )}
      </div>

      {showTopup && (
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: '#111827' }}>Top Up Wallet</h3>
          <form onSubmit={initTopup} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Amount (R)</label>
              <input
                type="number" min="10" step="1" required
                value={topupAmount} onChange={e => setTopupAmount(e.target.value)}
                placeholder="e.g. 100"
                style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[50, 100, 200, 500].map(amt => (
                <button key={amt} type="button" onClick={() => setTopupAmount(String(amt))}
                  style={{ padding: '10px 14px', background: topupAmount === String(amt) ? '#FF6B35' : '#F3F4F6', color: topupAmount === String(amt) ? 'white' : '#374151', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  R{amt}
                </button>
              ))}
            </div>
            <button type="submit" disabled={topupLoading}
              style={{ padding: '10px 24px', background: topupLoading ? '#E5E7EB' : '#FF6B35', color: topupLoading ? '#9CA3AF' : 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: topupLoading ? 'not-allowed' : 'pointer' }}>
              {topupLoading ? 'Opening…' : 'Proceed to Pay'}
            </button>
          </form>
          <div style={{ marginTop: 12, fontSize: 12, color: '#9CA3AF' }}>Payments are processed securely via Paystack. You will be redirected to complete payment.</div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F3F4F6' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>Transaction History</h3>
        </div>
        {transactions.length === 0 ? (
          <div style={{ padding: '48px 32px', textAlign: 'center', color: '#9CA3AF' }}>No transactions yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  {['Description', 'Date', 'Amount', 'Balance After'].map(h => (
                    <th key={h} style={{ padding: '12px 24px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={t.id || i} style={{ borderTop: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '13px 24px' }}>
                      <div style={{ fontWeight: 500, color: '#111827', fontSize: 14 }}>{t.description || t.type}</div>
                      <div style={{ color: '#9CA3AF', fontSize: 12, textTransform: 'capitalize' }}>{t.type}</div>
                    </td>
                    <td style={{ padding: '13px 24px', color: '#6B7280', fontSize: 14, whiteSpace: 'nowrap' }}>{formatDate(t.createdAt)}</td>
                    <td style={{ padding: '13px 24px', fontWeight: 600, fontSize: 14, color: t.type === 'debit' ? '#DC2626' : '#059669', whiteSpace: 'nowrap' }}>
                      {t.type === 'debit' ? '−' : '+'}{formatCurrency((t.amount || 0) / 100)}
                    </td>
                    <td style={{ padding: '13px 24px', color: '#6B7280', fontSize: 14, whiteSpace: 'nowrap' }}>
                      {t.balanceAfter != null ? formatCurrency(t.balanceAfter / 100) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────

function ProfilePage({ user }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [msg, setMsg] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, revs, sub] = await Promise.all([
          apiCall('GET', `/users/${user.uid}`).catch(() => null),
          apiCall('GET', `/users/${user.uid}/reviews`).catch(() => []),
          apiCall('GET', '/subscription').catch(() => null),
        ]);
        if (p) {
          setProfile(p);
          setName(p.displayName || p.name || '');
          setPhone(p.phone || '');
          setBio(p.bio || '');
        } else {
          setName(user.displayName || '');
        }
        setReviews(Array.isArray(revs) ? revs : []);
        setSubscription(sub);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await apiCall('PATCH', `/users/${user.uid}`, { displayName: name, phone, bio });
      setMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (e) {
      setMsg({ type: 'error', text: 'Could not save changes. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) { setMsg({ type: 'error', text: 'Password must be at least 6 characters.' }); return; }
    setChangingPwd(true);
    setMsg(null);
    try {
      await auth.currentUser.updatePassword(newPassword);
      setMsg({ type: 'success', text: 'Password updated successfully.' });
      setNewPassword('');
      setShowPasswordForm(false);
    } catch (e) {
      if (e.code === 'auth/requires-recent-login') {
        setMsg({ type: 'error', text: 'Please sign out and back in before changing your password.' });
      } else {
        setMsg({ type: 'error', text: e.message || 'Could not update password.' });
      }
    } finally {
      setChangingPwd(false);
    }
  };

  const inputStyle = { width: '100%', padding: '10px 14px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 16, outline: 'none', fontFamily: 'inherit' };

  if (loading) return <Spinner />;

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1) : null;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 24px' }}>Profile</h2>

      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 24 }}>

        <div style={{ background: 'white', borderRadius: 12, padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 24px' }}>Personal Info</h3>
          <form onSubmit={save}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Phone Number</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" style={inputStyle} />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell senders a bit about yourself…" style={{ ...inputStyle, resize: 'vertical' }} />
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Email</label>
            <input value={user.email} disabled style={{ ...inputStyle, background: '#F9FAFB', color: '#9CA3AF' }} />
            <button
              type="submit" disabled={saving}
              style={{ padding: '11px 28px', background: saving ? '#E5E7EB' : '#FF6B35', color: saving ? '#9CA3AF' : 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>

          <div style={{ borderTop: '1px solid #F3F4F6', marginTop: 24, paddingTop: 20 }}>
            <button
              onClick={() => setShowPasswordForm(s => !s)}
              style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 18px', fontSize: 13, color: '#374151', cursor: 'pointer', fontWeight: 500 }}
            >
              🔐 {showPasswordForm ? 'Cancel' : 'Change Password'}
            </button>
            {showPasswordForm && (
              <form onSubmit={changePassword} style={{ marginTop: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>New Password</label>
                <input
                  type="password" required minLength={6} autoComplete="new-password"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  style={{ ...inputStyle, marginBottom: 12 }}
                />
                <button type="submit" disabled={changingPwd}
                  style={{ padding: '9px 20px', background: changingPwd ? '#E5E7EB' : '#111827', color: changingPwd ? '#9CA3AF' : 'white', border: 'none', borderRadius: 8, fontWeight: 500, fontSize: 13, cursor: changingPwd ? 'not-allowed' : 'pointer' }}>
                  {changingPwd ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 20px' }}>Provider Stats</h3>
            <div style={{ display: 'grid', gap: 0 }}>
              {[
                ['Rating', avgRating ? `⭐ ${avgRating} (${reviews.length} review${reviews.length !== 1 ? 's' : ''})` : `⭐ ${profile?.rating || 'No reviews yet'}`],
                ['Wallet Balance', formatCurrency((profile?.walletBalance || 0) / 100)],
                ['Member Since', formatDate(profile?.createdAt || user.metadata?.creationTime)],
                ['Account Type', profile?.role || 'provider'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <span style={{ fontSize: 14, color: '#6B7280' }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', textTransform: 'capitalize', textAlign: 'right', maxWidth: '60%' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {subscription && (
            <div style={{ background: 'white', borderRadius: 12, padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 20px' }}>Subscription</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: subscription.tier === 'business' ? '#FEF3C7' : subscription.tier === 'premium' ? '#EDE9FE' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {subscription.tier === 'business' ? '🏢' : subscription.tier === 'premium' ? '⭐' : '🆓'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18, color: '#111827', textTransform: 'capitalize' }}>{subscription.tier || 'Free'} Plan</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>Platform fee: {subscription.platformFeePercentage || 10}%</div>
                </div>
              </div>
              {subscription.monthlyParcelLimit && (
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  Monthly limit: {subscription.monthlyParcelLimit} parcels
                </div>
              )}
            </div>
          )}
        </div>

        {reviews.length > 0 && (
          <div style={{ background: 'white', borderRadius: 12, padding: 32, boxShadow: '0 1px 3px rgba(0,0,0,.08)', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: '0 0 20px' }}>
              Reviews ({reviews.length}) · Avg {avgRating} ⭐
            </h3>
            <div style={{ display: 'grid', gap: 12 }}>
              {reviews.slice(0, 5).map((r, i) => (
                <div key={r.id || i} style={{ borderBottom: '1px solid #F3F4F6', paddingBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>
                      {'⭐'.repeat(Math.max(1, Math.min(5, Math.round(r.rating || 5))))}
                      <span style={{ marginLeft: 6, color: '#6B7280', fontWeight: 400 }}>{r.rating}/5</span>
                    </span>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>{formatDate(r.createdAt)}</span>
                  </div>
                  {r.comment && <div style={{ fontSize: 14, color: '#374151' }}>{r.comment}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState('overview');
  const [initErr, setInitErr] = useState('');

  useEffect(() => {
    initFirebase()
      .then(a => a.onAuthStateChanged(u => { setUser(u); setReady(true); }))
      .catch(e => { console.error(e); setInitErr('Initialization failed. Please refresh the page.'); setReady(true); });
  }, []);

  const logout = () => auth?.signOut();

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #F3F4F6', borderTop: '3px solid #FF6B35', animation: 'spin .7s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ color: '#9CA3AF', fontSize: 14 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (initErr) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#DC2626', fontSize: 15, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          {initErr}
          <br />
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 20px', background: '#FF6B35', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Refresh</button>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const pages = {
    overview:   <OverviewPage   user={user} setPage={setPage} />,
    parcels:    <ParcelsPage    user={user} />,
    deliveries: <DeliveriesPage user={user} />,
    routes:     <RoutesPage     user={user} />,
    earnings:   <EarningsPage   user={user} />,
    profile:    <ProfilePage    user={user} />,
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F3F4F6' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        button:hover:not(:disabled) { opacity: .88; }
        input:focus, textarea:focus, select:focus { border-color: #FF6B35 !important; box-shadow: 0 0 0 3px rgba(255,107,53,.1); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #9CA3AF; }
      `}</style>
      <Sidebar page={page} setPage={setPage} user={user} onLogout={logout} />
      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', minWidth: 0 }}>
        {pages[page]}
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
