import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ToastProvider';
import { TEAM } from '../../lib/team';

const STAGES = ['applied','screen','tech','offer','hired','rejected'];

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
      borderRadius:999, fontSize:12, fontWeight:700, background:'rgba(255,255,255,.06)',
      border:'1px solid var(--line)', color:fg, textTransform:'capitalize'
    }}>
      <span style={{ width:6, height:6, borderRadius:999, background:dot }} />
      {stage}
    </span>
  );
}

async function getCandidate(id) {
  const res = await fetch(`/candidates/${id}`);
  const j = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(j.message || 'Candidate not found');
  return j;
}
async function getTimeline(id) {
  const res = await fetch(`/candidates/${id}/timeline`);
  if (!res.ok) throw new Error('Failed to load timeline');
  return res.json();
}
async function patchCandidate(id, patch) {
  const res = await fetch(`/candidates/${id}`, {
    method:'PATCH', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(patch)
  });
  const j = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(j.message || 'Update failed');
  return j;
}
async function getNotes(id) {
  const res = await fetch(`/candidates/${id}/notes`);
  if (!res.ok) throw new Error('Failed to load notes');
  return res.json();
}
async function postNote(id, payload) {
  const res = await fetch(`/candidates/${id}/notes`, {
    method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload),
  });
  const j = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(j.message || 'Failed to add note');
  return j;
}
async function deleteNote(noteId) {
  const res = await fetch(`/notes/${noteId}`, { method:'DELETE' });
  const j = await res.json().catch(()=> ({}));
  if (!res.ok) throw new Error(j.message || 'Failed to delete note');
  return j;
}
async function getSubmissions(jobId, candidateId) {
  const params = new URLSearchParams({ candidateId: String(candidateId) });
  const res = await fetch(`/assessments/${jobId}/submissions?${params}`);
  if (!res.ok) throw new Error('Failed to load submissions');
  return res.json();
}

function extractHandles(text) {
  const out = [];
  const re = /@([a-z0-9_]+)/gi;
  let m; while ((m = re.exec(text))) out.push(m[1]);
  return out;
}
function highlightMentions(text) {
  const parts = String(text).split(/(@[a-z0-9_]+)/gi);
  return parts.map((p, i) =>
    p.startsWith?.('@')
      ? <mark key={i} style={{ background:'#fff7cc26', padding:'0 2px', borderRadius:3 }}>{p}</mark>
      : <span key={i}>{p}</span>
  );
}

export default function CandidateProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const { data: cand, isLoading, isError, error } = useQuery({
    queryKey: ['candidate', id],
    queryFn: () => getCandidate(id),
  });
  const { data: timelineData, isLoading: tlLoading, refetch: refetchTimeline } = useQuery({
    queryKey: ['candidate', id, 'timeline'],
    queryFn: () => getTimeline(id),
  });
  const { data: notesData, isLoading: notesLoading, refetch: refetchNotes } = useQuery({
    queryKey: ['candidate', id, 'notes'],
    queryFn: () => getNotes(id),
  });
  const { data: subsData, isLoading: subsLoading, refetch: refetchSubs } = useQuery({
    queryKey: ['candidate', id, 'submissions', (cand?.jobId ?? 'none')],
    enabled: !!cand?.jobId,
    queryFn: () => getSubmissions(cand.jobId, cand.id),
  });

  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState('');

  useEffect(() => {
    if (cand) {
      setName(cand.name || '');
      setEmail(cand.email || '');
      setStage(cand.stage || 'applied');
    }
  }, [cand?.id]);

  const [noteText, setNoteText]       = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestions, setSuggestions] = useState(TEAM);
  const taRef = useRef(null);

  const timeline    = useMemo(() => timelineData?.data || [], [timelineData]);
  const notes       = useMemo(() => notesData?.data || [], [notesData]);
  const submissions = useMemo(() => subsData?.data || [], [subsData]);

  if (isLoading) return <div>Loading…</div>;
  if (isError) {
    return (
      <div style={{ color:'salmon' }}>
        Error: {error.message}
        <div style={{ marginTop:8 }}><button className="btn" onClick={() => nav('/candidates')}>Back to Candidates</button></div>
      </div>
    );
  }

  async function saveIdentity() {
    try {
      await patchCandidate(cand.id, { name: name.trim(), email: email.trim() });
      toast.show('Saved details');
      qc.invalidateQueries({ queryKey: ['candidate', id] });
    } catch (e) { toast.show(e.message, 'error'); }
  }
  async function applyStageChange() {
    try {
      if (stage === cand.stage) { toast.show('No stage change'); return; }
      await patchCandidate(cand.id, { stage });
      toast.show(`Moved to ${stage}`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['candidate', id] }),
        refetchTimeline()
      ]);
    } catch (e) { toast.show(e.message, 'error'); }
  }
  function fmt(ts) { try { return new Date(ts).toLocaleString(); } catch { return String(ts); } }

  function updateSuggestionsForCaret() {
    const ta = taRef.current;
    if (!ta) return setShowSuggest(false);
    const pos = ta.selectionStart ?? ta.value.length;
    const upto = ta.value.slice(0, pos);
    const m = upto.match(/@([a-z0-9_]*)$/i);
    if (!m) { setShowSuggest(false); return; }
    const query = (m[1] || '').toLowerCase();
    const filtered = TEAM.filter(t =>
      t.handle.toLowerCase().includes(query) || t.name.toLowerCase().includes(query)
    );
    setSuggestions(filtered);
    setShowSuggest(true);
  }
  function insertHandle(handle) {
    const ta = taRef.current; if (!ta) return;
    const pos = ta.selectionStart ?? ta.value.length;
    const upto = ta.value.slice(0, pos);
    const rest = ta.value.slice(pos);
    const m = upto.match(/@([a-z0-9_]*)$/i);
    let newText;
    if (m) {
      const start = m.index;
      newText = upto.slice(0, start) + '@' + handle + ' ' + rest;
    } else {
      newText = ta.value + ' @' + handle + ' ';
    }
    setNoteText(newText);
    setShowSuggest(false);
    requestAnimationFrame(() => {
      const p = (m ? (m.index + 1 + handle.length + 1) : (ta.value.length + handle.length + 3));
      ta.setSelectionRange(p, p);
      ta.focus();
    });
  }
  async function addNote() {
    const text = noteText.trim();
    if (!text) return;
    const handles = extractHandles(text);
    try {
      await postNote(cand.id, { text, mentions: handles });
      setNoteText('');
      toast.show('Note added');
      await refetchNotes();
    } catch (e) { toast.show(e.message, 'error'); }
  }
  async function removeNote(idToDelete) {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteNote(idToDelete);
      toast.show('Note deleted');
      await refetchNotes();
    } catch (e) { toast.show(e.message, 'error'); }
  }
  function exportSubmissionJSON(sub) {
    const blob = new Blob([JSON.stringify(sub, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dt = new Date(sub.createdAt).toISOString().replace(/[:.]/g,'-');
    a.download = `submission_job${sub.jobId}_cand${sub.candidateId ?? 'anon'}_${dt}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="h1" style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cand.name}</span>
            <StageBadge stage={cand.stage} />
          </div>
          <div className="subtle">Candidate #{cand.id} · Applying for <b>{cand.jobTitle}</b></div>
        </div>
        <Link to="/candidates" className="btn">← Back to Candidates</Link>
      </div>

      <div className="grid-2">
        <div style={{ display:'grid', gap:12 }}>
          <section className="card" style={{ padding:'12px' }}>
            <div style={{ fontWeight:800, marginBottom:8 }}>Identity</div>
            <div style={{ display:'grid', gap:10 }}>
              <label>
                <div style={{ marginBottom:6 }}>Name</div>
                <input className="input" value={name} onChange={e=>setName(e.target.value)} />
              </label>
              <label>
                <div style={{ marginBottom:6 }}>Email</div>
                <input className="input" value={email} onChange={e=>setEmail(e.target.value)} />
              </label>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                <button className="btn" onClick={() => { setName(cand.name || ''); setEmail(cand.email || ''); }}>Reset</button>
                <button className="btn btn-primary" onClick={saveIdentity}>Save details</button>
              </div>
            </div>
          </section>

          <section className="card" style={{ padding:'12px' }}>
            <div style={{ fontWeight:800, marginBottom:8 }}>Stage</div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <select className="select" value={stage} onChange={e=>setStage(e.target.value)} style={{ maxWidth: 220 }}>
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn btn-primary" onClick={applyStageChange}>Apply</button>
              <span className="subtle" style={{ fontSize:12 }}>Changing stage creates a timeline event.</span>
            </div>
          </section>

          <section className="card" style={{ padding:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
              <div style={{ fontWeight:800 }}>Assessment</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
                <Link
                  to={`/assessments/${cand.jobId}/fill?candidateId=${cand.id}`}
                  className="btn btn-primary"
                >
                  Open assessment for this candidate
                </Link>
                <button onClick={()=>refetchSubs()} className="btn" disabled={subsLoading}>
                  Refresh submissions
                </button>
              </div>
            </div>

            {subsLoading && <div>Loading submissions…</div>}
            {!subsLoading && submissions.length === 0 && <div className="subtle">No submissions yet.</div>}
            {!subsLoading && submissions.length > 0 && (
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {submissions.map(s => (
                  <li key={s.id} style={{ marginBottom:8 }}>
                    <div className="card" style={{ padding:'8px 10px', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <b>{fmt(s.createdAt)}</b>
                      <span className="subtle">Submission #{s.id}</span>
                      <span className="subtle">Job #{s.jobId}</span>
                      <span style={{ marginLeft:'auto' }}>
                        <button className="btn" onClick={()=>exportSubmissionJSON(s)}>Export JSON</button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div style={{ display:'grid', gap:12 }}>
          <section className="card" style={{ padding:'12px' }}>
            <div style={{ fontWeight:800, marginBottom:8 }}>Timeline</div>
            {tlLoading && <div>Loading timeline…</div>}
            {!tlLoading && timeline.length === 0 && <div className="subtle">No events yet.</div>}
            {!tlLoading && timeline.length > 0 && (
              <ul style={{ listStyle:'none', padding:0, margin:0 }}>
                {timeline.map((ev, i) => (
                  <li
                    key={ev.id ?? i}
                    style={{
                      display:'grid',
                      gridTemplateColumns:'auto 1fr',
                      gap:10,
                      alignItems:'start',
                      padding:'8px 0',
                      borderTop: i ? '1px dashed var(--line)' : 'none'
                    }}
                  >
                    <div className="subtle" style={{ fontSize:12, whiteSpace:'nowrap' }}>{fmt(ev.at)}</div>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                        <StageBadge stage={ev.fromStage} />
                        <span className="subtle">→</span>
                        <StageBadge stage={ev.toStage} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" style={{ padding:'12px' }}>
            <div style={{ fontWeight:800, marginBottom:8 }}>Notes</div>

            <div style={{ position:'relative', marginBottom:12 }}>
              <textarea
                ref={taRef}
                rows={4}
                value={noteText}
                placeholder="Type a note… use @ to mention a teammate (e.g., @meera)"
                onChange={e => setNoteText(e.target.value)}
                onKeyUp={updateSuggestionsForCaret}
                onClick={updateSuggestionsForCaret}
                className="input"
                style={{ resize:'vertical' }}
              />
              {showSuggest && suggestions.length > 0 && (
                <div
                  className="glass"
                  style={{
                    position:'absolute', left:10, bottom:10, transform:'translateY(100%)',
                    padding:6, minWidth:240, zIndex:2
                  }}
                >
                  {suggestions.map(u => (
                    <div
                      key={u.id}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => insertHandle(u.handle)}
                      className="menu-item"
                      style={{ borderRadius:8 }}
                    >
                      <b>@{u.handle}</b> <span className="subtle">— {u.name}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                <div className="subtle" style={{ fontSize:12 }}>Mentions saved as handles (e.g. <code>@aarav</code>).</div>
                <button className="btn btn-primary" onClick={addNote} disabled={!noteText.trim()}>Add note</button>
              </div>
            </div>

            {notesLoading && <div>Loading notes…</div>}
            {!notesLoading && notes.length === 0 && <div className="subtle">No notes yet.</div>}
            {!notesLoading && notes.length > 0 && (
              <ul style={{ padding:0, margin:0, listStyle:'none' }}>
                {[...notes].sort((a,b)=>b.createdAt-a.createdAt).map(n => (
                  <li key={n.id} className="card" style={{ padding:'10px 12px', marginBottom:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
                      <div className="subtle" style={{ fontSize:12 }}>{fmt(n.createdAt)}</div>
                      <button className="btn" onClick={()=>removeNote(n.id)} title="Delete note">Delete</button>
                    </div>
                    <div style={{ lineHeight:1.5 }}>{highlightMentions(n.text)}</div>
                    {Array.isArray(n.mentions) && n.mentions.length > 0 && (
                      <div className="subtle" style={{ marginTop:6, fontSize:12 }}>
                        Mentions: {n.mentions.map(h => <code key={h} style={{ marginRight:6 }}>@{h}</code>)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
