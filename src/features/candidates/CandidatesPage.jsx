import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const STAGES = ['applied','screen','tech','offer','hired','rejected'];
const PAGE_SIZE = 50;

async function fetchCandidates({ stage = '' }) {
  const qs = new URLSearchParams();
  if (stage) qs.set('stage', stage);
  const res = await fetch(`/candidates?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to load candidates');
  return res.json(); 
}

function StageBadge({ stage }) {
  const map = {
    applied:  ['#22d3ee','#0e7490'],
    screen:   ['#60a5fa','#1d4ed8'],
    tech:     ['#a78bfa','#5b21b6'],
    offer:    ['#34d399','#065f46'],
    hired:    ['#86efac','#166534'],
    rejected: ['#fca5a5','#7f1d1d'],
  };
  const [fg, dot] = map[stage] || ['#e5e7eb','#6b7280'];
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      padding:'2px 8px', borderRadius:999, fontSize:12, fontWeight:700,
      background:'rgba(255,255,255,.06)', border:'1px solid var(--line)', color:fg, textTransform:'capitalize'
    }}>
      <span style={{ width:6, height:6, borderRadius:999, background:dot }} />
      {stage}
    </span>
  );
}

function Avatar({ id, size=40 }) {
  const url = `https://i.pravatar.cc/100?img=${(id % 70) + 1}`;
  return (
    <div style={{
      height:size, width:size, borderRadius:999, backgroundImage:`url(${url})`,
      backgroundSize:'cover', backgroundPosition:'center', flex:'0 0 auto'
    }} />
  );
}

export default function CandidatesPage() {

  const [stage, setStage] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  
  const [allRows, setAllRows] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  
  async function load() {
    try {
      setLoading(true); setErr('');
      const res = await fetchCandidates({ stage });
      setAllRows(res.data || []);
      setLoading(false);
    } catch (e) {
      setErr(e.message || 'Failed to load');
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [stage]);

 
  useEffect(() => { setPage(1); }, [stage, q]);

 
  const filteredAll = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return allRows;
    return allRows.filter(c =>
      c.name.toLowerCase().includes(s) ||
      c.email.toLowerCase().includes(s) ||
      (c.jobTitle || '').toLowerCase().includes(s)
    );
  }, [allRows, q]);

  
  const total = filteredAll.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = filteredAll.slice(start, start + PAGE_SIZE);

  return (
    <div style={{ display:'grid', gap:12 }}>
      {}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div>
          <div className="h1">Candidates</div>
          <div className="subtle">Search by name/email, filter by stage, open profiles.</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {}
      <div className="card" style={{ padding:'12px' }}>
        <div style={{ display:'grid', gap:8 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 220px', gap:8 }}>
            <input
              className="input"
              placeholder="Search name, email, or job…"
              value={q}
              onChange={(e)=> setQ(e.target.value)}
            />
            <select className="select" value={stage} onChange={e=>setStage(e.target.value)}>
              <option value="">All stages</option>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            gap:8, flexWrap:'wrap'
          }}>
            <div className="subtle">
              {loading ? 'Loading…' : `${pageRows.length} shown · Total ${total}`}
              {(q || stage) && (
                <> · <button className="btn btn-ghost" onClick={()=>{ setQ(''); setStage(''); }}>Clear filters</button></>
              )}
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <button className="btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1, p-1))}>← Prev</button>
              <div className="subtle">Page {page} / {totalPages}</div>
              <button className="btn" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages, p+1))}>Next →</button>
            </div>
          </div>
        </div>
      </div>

      {}
      {err && <div style={{ color:'salmon' }}>Error: {err}</div>}
      {!loading && pageRows.length === 0 && (
        <div className="subtle">No candidates found{q ? ' for this search' : ''}.</div>
      )}

      <div className="card" style={{ padding:'6px' }}>
        <div style={{ padding: '6px 0' }}>
          {pageRows.map((c) => (
            <div key={c.id} style={{ padding: '6px 4px' }}>
              <div
                className="card"
                style={{
                  display:'grid',
                  gridTemplateColumns:'auto 1fr auto',
                  gap:12, alignItems:'center', padding:'10px 12px'
                }}
              >
                <Avatar id={c.id} size={48} />
                <div style={{ minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <Link
                      to={`/candidates/${c.id}`}
                      style={{
                        fontWeight:800, textDecoration:'underline',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
                      }}
                    >
                      {c.name}
                    </Link>
                    <StageBadge stage={c.stage} />
                  </div>
                  <div className="subtle" style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.email}</span>
                    <span>•</span>
                    <span title={c.jobTitle}>Applying for: <b>{c.jobTitle}</b></span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <Link to={`/candidates/${c.id}`} className="btn">Open</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {}
      <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:6 }}>
        <button className="btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1, p-1))}>← Prev</button>
        <div className="subtle">Page {page} / {totalPages}</div>
        <button className="btn" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages, p+1))}>Next →</button>
      </div>
    </div>
  );
}
