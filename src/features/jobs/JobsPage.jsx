import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CreateJobModal from './CreateJobModal';

const PAGE_SIZE = 10;

async function fetchJobs({ search = '', status = '', page = 1, pageSize = PAGE_SIZE, sort = 'orderAsc' }) {
  const qs = new URLSearchParams();
  if (search) qs.set('search', search);
  if (status) qs.set('status', status);
  if (sort) qs.set('sort', sort);
  qs.set('page', String(page));
  qs.set('pageSize', String(pageSize));

  const res = await fetch(`/jobs?${qs.toString()}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || 'Failed to load jobs');
  return j;
}

async function patchJob(id, patch) {
  const res = await fetch(`/jobs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || 'Update failed');
  return j;
}

async function reorderJob(id, fromOrder, toOrder) {
  const res = await fetch(`/jobs/${id}/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromOrder, toOrder }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || 'Reorder failed');
  return j;
}

async function fetchAssessmentExists(ids) {
  if (!ids?.length) return {};
  const qs = new URLSearchParams({ jobIds: ids.join(',') });
  const res = await fetch(`/assessments/exists?${qs.toString()}`);
  const j = await res.json().catch(() => ({ exists: {} }));
  return j.exists || {};
}

function StatusBadge({ status }) {
  const on = status === 'active';
  const color = on ? '#22c55e' : '#ef4444';
  const bg = on ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)';
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6, padding:'2px 8px',
      borderRadius:999, fontSize:12, fontWeight:700, background:bg, color:color,
      border:'1px solid var(--line)', textTransform:'capitalize'
    }}>
      <span style={{ width:6, height:6, borderRadius:999, background:color }} />
      {on ? 'Active' : 'Archived'}
    </span>
  );
}

export default function JobsPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort]     = useState('orderAsc');

  const [page, setPage] = useState(1);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [showCreate, setShowCreate] = useState(false);

  const [assessMap, setAssessMap] = useState({});

  async function load() {
    try {
      setLoading(true); setErr('');
      const { data, total } = await fetchJobs({ search, status, page, pageSize: PAGE_SIZE, sort });
      setRows(data || []);
      setTotal(total || 0);
      const ids = (data || []).map(j => j.id);
      const m = await fetchAssessmentExists(ids);
      setAssessMap(m);
      setLoading(false);
    } catch (e) {
      setErr(e.message || 'Failed to load');
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, status, page, sort]);

  function resetFilters() {
    setSearch(''); setStatus(''); setSort('orderAsc'); setPage(1);
  }

  async function toggleArchive(job) {
    try {
      await patchJob(job.id, { status: job.status === 'active' ? 'archived' : 'active' });
      await load();
    } catch (e) { alert(e.message); }
  }

  async function move(job, dir) {
    const from = job.order ?? 0;
    const to = from + dir;
    if (to < 0) return;
    try {
      await reorderJob(job.id, from, to);
      await load();
    } catch (e) { alert(e.message); }
  }

  return (
    <div style={{ display:'grid', gap:12 }}>
      {/* Header */}
      <div className="jobs-toolbar">
        <div>
          <div className="h1">Jobs</div>
          <div className="subtle">Create, filter, and manage job postings.</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn" onClick={load}>Refresh</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Job</button>
        </div>
      </div>

      {/* Filters + Sort + Pager */}
      <div className="card" style={{ padding:'12px' }}>
        <div className="jobs-filter-row">
          <input
            className="input"
            placeholder="Search title…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />

          <select className="select" value={status} onChange={(e)=>{ setStatus(e.target.value); setPage(1); }}>
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>

          <select className="select" value={sort} onChange={(e)=>setSort(e.target.value)}>
            <option value="orderAsc">Sort: Order ↑</option>
            <option value="orderDesc">Sort: Order ↓</option>
            <option value="titleAsc">Title A→Z</option>
            <option value="titleDesc">Title Z→A</option>
          </select>

          <div className="pager">
            <div className="subtle">{loading ? 'Loading…' : `${total} results`}</div>
            <button className="btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1, p-1))}>← Prev</button>
            <div className="subtle">Page {page} / {totalPages}</div>
            <button className="btn" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages, p+1))}>Next →</button>
            {(search || status || sort !== 'orderAsc') && (
              <button className="btn btn-ghost" onClick={resetFilters}>Clear</button>
            )}
          </div>
        </div>
      </div>

      {/* Errors */}
      {err && <div style={{ color:'salmon' }}>Error: {err}</div>}

      {/* List */}
      <div className="card" style={{ padding: '6px' }}>
        {rows.map((j) => (
          <div key={j.id} style={{ padding: '6px 4px' }}>
            <div className="card" style={{ padding:'12px' }}>
              <div className="job-card">
                {/* LEFT: title + meta */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <b className="job-title">
                      <Link to={`/jobs/${j.id}`} style={{ textDecoration:'none' }}>{j.title}</Link>
                    </b>
                    {assessMap[j.id] && (
                      <span className="chip" style={{ borderColor:'var(--accent)', background:'rgba(139,92,246,.15)' }}>
                        Assessment
                      </span>
                    )}
                    <StatusBadge status={j.status} />
                  </div>

                  <div className="subtle" style={{ marginTop:6 }}>Order: {j.order ?? 0}</div>
                </div>

                {/* RIGHT: actions */}
                <div className="job-actions">
                  <button className="btn" onClick={() => {
                    const title = prompt('Edit title', j.title);
                    if (title && title.trim() && title.trim() !== j.title) {
                      patchJob(j.id, { title: title.trim() }).then(load).catch(e => alert(e.message));
                    }
                  }}>Edit</button>

                  {j.status === 'active' ? (
                    <button className="btn" onClick={() => toggleArchive(j)}>Archive</button>
                  ) : (
                    <button className="btn" onClick={() => toggleArchive(j)}>Unarchive</button>
                  )}

                  {assessMap[j.id] && (
                    <>
                      <Link className="btn" to={`/assessments/${j.id}`}>Builder</Link>
                      <Link className="btn" to={`/assessments/${j.id}/fill`}>Form</Link>
                    </>
                  )}

                  <span className="subtle">Reorder</span>
                  <button className="btn" onClick={() => move(j, -1)}>↑</button>
                  <button className="btn" onClick={() => move(j, +1)}>↓</button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loading && rows.length === 0 && (
          <div className="subtle" style={{ padding:12 }}>No jobs found.</div>
        )}
      </div>

      {/* Bottom pager */}
      <div className="pager" style={{ justifyContent:'flex-end' }}>
        <button className="btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1, p-1))}>← Prev</button>
        <div className="subtle">Page {page} / {totalPages}</div>
        <button className="btn" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages, p+1))}>Next →</button>
      </div>

      <CreateJobModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={load}
      />
    </div>
  );
}
