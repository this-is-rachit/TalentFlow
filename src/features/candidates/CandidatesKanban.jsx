import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';

const STAGES = [
  { key: 'applied',  label: 'Applied' },
  { key: 'screen',   label: 'Screening' },
  { key: 'tech',     label: 'Interview' }, 
  { key: 'offer',    label: 'Offer' },
  { key: 'hired',    label: 'Hired' },
  { key: 'rejected', label: 'Rejected' },
];

async function fetchStage(stage) {
  const res = await fetch(`/candidates?stage=${encodeURIComponent(stage)}`);
  if (!res.ok) throw new Error('Failed to load ' + stage);
  const { data } = await res.json();
  return (data || []).map(c => ({ ...c, jobTitle: c.jobTitle || '—' }));
}
async function patchStage(id, stage) {
  const res = await fetch(`/candidates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage })
  });
  const j = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(j.message || 'Move failed');
  return j;
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
      display:'inline-flex', alignItems:'center', gap:6, padding:'2px 8px',
      borderRadius:999, fontSize:12, fontWeight:700,
      background:'rgba(255,255,255,.06)', border:'1px solid var(--line)',
      color: fg, textTransform:'capitalize'
    }}>
      <span style={{ width:6, height:6, borderRadius:999, background: dot }} />
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
    }}/>
  );
}

export default function KanbanBoard() {
  const toast = useToast();
  const [cols, setCols] = useState(() => Object.fromEntries(STAGES.map(s => [s.key, []])));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [hoverCol, setHoverCol] = useState('');

  const total = useMemo(
    () => Object.values(cols).reduce((n, arr) => n + arr.length, 0),
    [cols]
  );

  async function load() {
    try {
      setLoading(true); setErr('');
      const entries = await Promise.all(STAGES.map(async s => [s.key, await fetchStage(s.key)]));
      setCols(Object.fromEntries(entries));
      setLoading(false);
    } catch (e) {
      setErr(e.message || 'Failed to load board');
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

 
  function onDragStart(e, candId, fromStage) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ candId, fromStage }));
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e, toStage) {
    e.preventDefault();
    setHoverCol(toStage);
  }
  function onDragLeave() { setHoverCol(''); }
  async function onDrop(e, toStage) {
    e.preventDefault();
    setHoverCol('');
    let payload;
    try { payload = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); } catch { return; }
    const { candId, fromStage } = payload || {};
    if (!candId || !fromStage || toStage === fromStage) return;

 
    setCols(prev => {
      const next = { ...prev };
      const fromList = [...next[fromStage]];
      const idx = fromList.findIndex(c => c.id === candId);
      if (idx === -1) return prev;
      const item = fromList.splice(idx, 1)[0];
      next[fromStage] = fromList;
      next[toStage] = [item, ...next[toStage]];
      return next;
    });

    try {
      await patchStage(candId, toStage);
      toast.show(`Moved to ${toStage}`);
    } catch (e2) {
   
      setCols(prev => {
        const next = { ...prev };
        const toList = [...next[toStage]];
        const idx = toList.findIndex(c => c.id === candId);
        if (idx !== -1) {
          const [item] = toList.splice(idx, 1);
          next[toStage] = toList;
          next[fromStage] = [item, ...next[fromStage]];
        }
        return next;
      });
      toast.show(e2.message || 'Move failed (rolled back)', 'error');
    }
  }

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div>
          <div className="h1">Candidate Board</div>
          <div className="subtle">Drag and drop candidates to move them through the hiring pipeline.</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>

      {err && <div style={{ color:'salmon' }}>Error: {err}</div>}

      <div className="kanban glass">
        {STAGES.map(s => (
          <section
            key={s.key}
            className={`kanban-col ${hoverCol === s.key ? 'drop-hover' : ''}`}
            onDragOver={(e)=>onDragOver(e, s.key)}
            onDragLeave={onDragLeave}
            onDrop={(e)=>onDrop(e, s.key)}
          >
            <header className="kanban-head">
              <h3 className="kanban-title">{s.label}</h3>
              <span className="count-pill">{cols[s.key]?.length ?? 0}</span>
            </header>

            <div className="kanban-drop">
              {loading && <div className="subtle">Loading…</div>}
              {!loading && (cols[s.key]?.length ?? 0) === 0 && (
                <div className="subtle">No candidates</div>
              )}

              {cols[s.key]?.map(c => (
                <article
                  key={c.id}
                  className="card kanban-card"
                  draggable
                  onDragStart={(e)=>onDragStart(e, c.id, s.key)}
                  title={`${c.name} • ${c.email}`}
                >
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'auto 1fr auto',
                    gap:10,
                    alignItems:'center'
                  }}>
                    <Avatar id={c.id} size={40} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <Link to={`/candidates/${c.id}`} className="kanban-name">{c.name}</Link>
                        <StageBadge stage={c.stage} />
                      </div>
                      {}
                    </div>
                    <Link to={`/candidates/${c.id}`} className="btn">Open</Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="subtle">Total candidates loaded: {total}</div>
    </div>
  );
}
