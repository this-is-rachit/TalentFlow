import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';

async function getJob(id) {
  const res = await fetch(`/jobs/${id}`);
  const j = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(j.message || 'Not found');
  return j;
}
async function patchJob(id, patch) {
  const res = await fetch(`/jobs/${id}`, {
    method:'PATCH', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(patch)
  });
  const j = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(j.message || 'Update failed');
  return j;
}

function StatusBadge({ status }) {
  const s = String(status);
  const bg = s === 'active' ? 'rgba(34, 197, 94, .15)' : 'rgba(239, 68, 68, .12)';
  const color = s === 'active' ? '#86efac' : '#fca5a5';
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6, background:bg, color, padding:'2px 8px', borderRadius:999, border:'1px solid rgba(255,255,255,.08)', fontSize:12, fontWeight:600, textTransform:'capitalize' }}>
      <span style={{ display:'inline-block', width:6, height:6, borderRadius:999, background: s==='active' ? '#22c55e' : '#ef4444' }} />
      {s}
    </span>
  );
}

export default function JobDetail() {
  const { jobId } = useParams();
  const toast = useToast();

  const [job, setJob] = useState(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    try {
      setLoading(true); setErr('');
      const j = await getJob(jobId);
      setJob(j);
      setTitle(j.title || '');
      setTags(Array.isArray(j.tags) ? j.tags.join(', ') : '');
      setLoading(false);
    } catch (e) { setErr(e.message || 'Failed to load'); setLoading(false); }
  }
  useEffect(() => { load();  }, [jobId]);

  async function save() {
    try {
      const cleanTags = tags.split(',').map(s=>s.trim()).filter(Boolean);
      await patchJob(job.id, { title: title.trim(), tags: cleanTags });
      toast.show('Title updated'); await load();
    } catch (e) { toast.show(e.message, 'error'); }
  }
  async function toggleStatus() {
    try { await patchJob(job.id, { status: job.status === 'active' ? 'archived' : 'active' }); toast.show('Status updated'); await load(); }
    catch (e) { toast.show(e.message, 'error'); }
  }

  if (loading) return <div>Loading…</div>;
  if (err) return <div style={{ color:'salmon' }}>Error: {err}</div>;

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div>
          <div className="h1" style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span>{job.title}</span>
            <StatusBadge status={job.status} />
          </div>
          <div className="subtle">Job #{job.id}</div> {}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <Link to="/jobs" className="btn">← Back</Link>
          <button className="btn" onClick={toggleStatus}>{job.status === 'active' ? 'Archive' : 'Unarchive'}</button>
          <Link to={`/assessments/${job.id}`} className="btn btn-primary">Open Assessment Builder</Link>
        </div>
      </div>

      <div className="card" style={{ padding:'12px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }}>
          <label>
            <div style={{ marginBottom:6 }}>Title</div>
            <input className="input" value={title} onChange={e=>setTitle(e.target.value)} />
          </label>
          <label>
            <div style={{ marginBottom:6 }}>Tags (comma-separated)</div>
            <input className="input" value={tags} onChange={e=>setTags(e.target.value)} />
          </label>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn" onClick={load}>Reset</button>
            <button className="btn btn-primary" onClick={save}>Save changes</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding:'12px' }}>
        <div style={{ fontWeight:700, marginBottom:8 }}>Quick links</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <Link to={`/assessments/${job.id}`} className="btn">Assessment Builder</Link>
          <Link to={`/assessments/${job.id}/fill`} className="btn">Assessment Runtime</Link>
        </div>
      </div>
    </div>
  );
}
