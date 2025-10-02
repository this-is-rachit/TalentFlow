import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';

async function fetchAssessment(jobId) {
  const res = await fetch(`/assessments/${jobId}`);
  if (!res.ok) throw new Error('Failed to load assessment');
  return res.json();
}
async function saveAssessment(jobId, payload) {
  const res = await fetch(`/assessments/${jobId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || 'Save failed');
  return j;
}

const TYPES = [
  { key: 'single', label: 'Single Choice' },
  { key: 'multi',  label: 'Multi Choice'  },
  { key: 'short',  label: 'Short Text'    },
  { key: 'long',   label: 'Long Text'     },
  { key: 'number', label: 'Numeric'       },
  { key: 'file',   label: 'File Upload'   },
];

const newSection = () => ({
  id: crypto.randomUUID(),
  title: 'New Section',
  description: '',
  questions: [],
});

const newQuestion = (type='short') => ({
  id: crypto.randomUUID(),
  type,
  required: false,
  options: type === 'single' || type === 'multi' ? ['Option 1', 'Option 2'] : [],
  min: type === 'number' ? null : undefined,
  max: type === 'number' ? null : undefined,
  maxLength: type === 'short' ? 120 : type === 'long' ? 1000 : undefined,
  condition: null,
});

function shouldShow(q, answers) {
  if (!q.condition) return true;
  const { questionId, equalsValue } = q.condition || {};
  return (answers[questionId] ?? null) === equalsValue;
}

function PreviewForm({ assessment }) {
  const [answers, setAnswers] = useState({});
  const [errors, setErrors]   = useState({});

  function setAns(id, val) {
    setAnswers(a => ({ ...a, [id]: val }));
  }

  function validate() {
    const errs = {};
    for (const sec of assessment.sections || []) {
      for (const q of sec.questions || []) {
        if (!shouldShow(q, answers)) continue;
        const v = answers[q.id];
        if (q.required && (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0))) {
          errs[q.id] = 'Required';
        }
        if (q.type === 'number' && v !== undefined && v !== null && v !== '' ) {
          const num = Number(v);
          if (!Number.isFinite(num)) errs[q.id] = 'Must be a number';
          if (q.min != null && num < q.min) errs[q.id] = `Min ${q.min}`;
          if (q.max != null && num > q.max) errs[q.id] = `Max ${q.max}`;
        }
        if ((q.type === 'short' || q.type === 'long') && q.maxLength && typeof answers[q.id]==='string' && answers[q.id].length > q.maxLength) {
          errs[q.id] = `Max ${q.maxLength} chars`;
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function onFakeSubmit(e) {
    e.preventDefault();
    if (validate()) {
      alert('Preview OK ✅ (no submit in preview)');
    }
  }

  return (
    <form onSubmit={onFakeSubmit} className="preview">
      {(assessment.sections || []).map(sec => (
        <div key={sec.id} className="card" style={{ padding:'12px', marginBottom:10 }}>
          <div style={{ fontWeight:800, marginBottom:4 }}>{sec.title}</div>
          {sec.description && <div className="subtle" style={{ marginBottom:8 }}>{sec.description}</div>}

          <div style={{ display:'grid', gap:10 }}>
            {(sec.questions || []).map(q => {
              if (!shouldShow(q, answers)) return null;
              const err = errors[q.id];
              return (
                <div key={q.id}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <div style={{ fontWeight:700 }}>{q.title}</div>
                    <span className="subtle" style={{ fontSize:12, textTransform:'capitalize' }}>({q.type})</span>
                    {q.required && <span className="subtle" style={{ fontSize:12 }}>*</span>}
                  </div>

                  {q.type === 'single' && (
                    <div style={{ display:'grid', gap:6, marginTop:6 }}>
                      {q.options.map((opt, i) => (
                        <label key={i} className="menu-item" style={{ borderRadius:8 }}>
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === opt}
                            onChange={() => setAns(q.id, opt)}
                          />{' '}
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {q.type === 'multi' && (
                    <div style={{ display:'grid', gap:6, marginTop:6 }}>
                      {q.options.map((opt, i) => {
                        const arr = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                        const on = arr.includes(opt);
                        return (
                          <label key={i} className="menu-item" style={{ borderRadius:8 }}>
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={(e) => {
                                setAns(q.id, e.target.checked ? [...arr, opt] : arr.filter(x => x !== opt));
                              }}
                            />{' '}
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {q.type === 'short' && (
                    <input
                      className="input"
                      value={answers[q.id] || ''}
                      onChange={e => setAns(q.id, e.target.value)}
                      placeholder="Type your answer…"
                      maxLength={q.maxLength || undefined}
                    />
                  )}
                  {q.type === 'long' && (
                    <textarea
                      className="input"
                      rows={4}
                      value={answers[q.id] || ''}
                      onChange={e => setAns(q.id, e.target.value)}
                      placeholder="Type your answer…"
                      maxLength={q.maxLength || undefined}
                    />
                  )}
                  {q.type === 'number' && (
                    <input
                      className="input"
                      type="number"
                      value={answers[q.id] ?? ''}
                      onChange={e => setAns(q.id, e.target.value)}
                      placeholder={`${q.min != null ? `min ${q.min}` : ''}${q.max != null ? `, max ${q.max}` : ''}`}
                    />
                  )}
                  {q.type === 'file' && (
                    <div className="subtle">File upload stub (preview)</div>
                  )}

                  {err && <div style={{ color:'salmon', fontSize:12, marginTop:4 }}>{err}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ display:'flex', justifyContent:'flex-end' }}>
        <button className="btn">Run preview validation</button>
      </div>
    </form>
  );
}

export default function AssessmentBuilder() {
  const { jobId } = useParams();
  const toast = useToast();

  const [ass, setAss] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    try {
      setLoading(true); setErr('');
      const data = await fetchAssessment(jobId);
      setAss({
        jobId: Number(jobId),
        title: data.title || '',
        sections: Array.isArray(data.sections) ? data.sections : [],
      });
      setLoading(false);
    } catch (e) {
      setErr(e.message || 'Failed to load');
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [jobId]);

  const flatQuestions = useMemo(() => {
    const out = [];
    ass?.sections?.forEach(sec => sec.questions?.forEach(q => out.push(q)));
    return out;
  }, [ass]);

  async function save() {
    try {
      setSaving(true);
      await saveAssessment(jobId, ass);
      toast.show('Assessment saved');
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function addSection() {
    setAss(a => ({ ...a, sections: [...(a?.sections || []), newSection()] }));
  }
  function delSection(id) {
    setAss(a => ({ ...a, sections: a.sections.filter(s => s.id !== id) }));
  }
  function moveSection(id, dir) {
    setAss(a => {
      const arr = [...a.sections];
      const i = arr.findIndex(s => s.id === id);
      if (i === -1) return a;
      const j = i + dir;
      if (j < 0 || j >= arr.length) return a;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return { ...a, sections: arr };
    });
  }
  function editSection(id, patch) {
    setAss(a => ({ ...a, sections: a.sections.map(s => s.id === id ? { ...s, ...patch } : s) }));
  }

  function addQ(sectionId, type) {
    setAss(a => ({
      ...a,
      sections: a.sections.map(s => s.id === sectionId
        ? { ...s, questions: [...s.questions, newQuestion(type)] }
        : s
      ),
    }));
  }
  function delQ(sectionId, qid) {
    setAss(a => ({
      ...a,
      sections: a.sections.map(s => s.id === sectionId
        ? { ...s, questions: s.questions.filter(q => q.id !== qid) }
        : s
      ),
    }));
  }
  function moveQ(sectionId, qid, dir) {
    setAss(a => {
      const s = a.sections.find(x => x.id === sectionId);
      if (!s) return a;
      const arr = [...s.questions];
      const i = arr.findIndex(q => q.id === qid);
      if (i === -1) return a;
      const j = i + dir;
      if (j < 0 || j >= arr.length) return a;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return {
        ...a,
        sections: a.sections.map(sec => sec.id === sectionId ? { ...sec, questions: arr } : sec),
      };
    });
  }
  function editQ(sectionId, qid, patch) {
    setAss(a => ({
      ...a,
      sections: a.sections.map(s => s.id === sectionId
        ? { ...s, questions: s.questions.map(q => q.id === qid ? { ...q, ...patch } : q) }
        : s
      ),
    }));
  }

  if (loading) return <div>Loading…</div>;
  if (err) return <div style={{ color:'salmon' }}>Error: {err}</div>;
  if (!ass) return null;

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div>
          <div className="h1">Assessment Builder</div>
          <div className="subtle">Create and manage the assessment for this role.</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <Link to={`/jobs/${ass.jobId}`} className="btn">← Back to Job</Link>
          <Link to={`/assessments/${ass.jobId}/fill`} className="btn">Open runtime form</Link>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      <div className="card" style={{ padding:'12px' }}>
        <label style={{ display:'grid', gap:6 }}>
          <div style={{ fontWeight:800 }}>Assessment title</div>
          <input className="input" value={ass.title || ''} onChange={e => setAss(a => ({ ...a, title: e.target.value }))} placeholder="e.g., React Fundamentals" />
        </label>
      </div>

      <div className="builder-grid">
        <div className="card" style={{ padding:'12px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div style={{ fontWeight:800 }}>Sections & questions</div>
            <button className="btn" onClick={addSection}>+ Add section</button>
          </div>

          <div style={{ display:'grid', gap:10 }}>
            {ass.sections.map((sec, sIdx) => (
              <div key={sec.id} className="card" style={{ padding:'10px' }}>
                <div style={{ display:'grid', gap:8 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                    <input
                      className="input"
                      value={sec.title}
                      onChange={e => editSection(sec.id, { title: e.target.value })}
                    />
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn" onClick={() => moveSection(sec.id, -1)} disabled={sIdx===0}>↑</button>
                      <button className="btn" onClick={() => moveSection(sec.id, +1)} disabled={sIdx===ass.sections.length-1}>↓</button>
                      <button className="btn" onClick={() => delSection(sec.id)}>Delete</button>
                    </div>
                  </div>
                  <textarea
                    className="input"
                    rows={2}
                    placeholder="Section description (optional)…"
                    value={sec.description || ''}
                    onChange={e => editSection(sec.id, { description: e.target.value })}
                  />

                  <div style={{ display:'grid', gap:8 }}>
                    {(sec.questions || []).map((q, qIdx) => (
                      <div key={q.id} className="card" style={{ padding:'10px' }}>
                        <div style={{ display:'grid', gap:8 }}>
                          <div className="q-block">
                            <textarea
                              className="input q-title"
                              rows={3}
                              value={q.title}
                              onChange={e => editQ(sec.id, q.id, { title: e.target.value })}
                              placeholder="Type the question…"
                            />
                            <div className="q-toolbar">
                              <select
                                className="select"
                                value={q.type}
                                onChange={e => editQ(sec.id, q.id, newQuestion(e.target.value))}
                              >
                                {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                              </select>
                              <label className="menu-item" style={{ borderRadius:8 }}>
                                <input
                                  type="checkbox"
                                  checked={!!q.required}
                                  onChange={e => editQ(sec.id, q.id, { required: e.target.checked })}
                                /> required
                              </label>
                              <div className="spacer" />
                              <button className="btn" onClick={() => moveQ(sec.id, q.id, -1)} disabled={qIdx===0}>↑</button>
                              <button className="btn" onClick={() => moveQ(sec.id, q.id, +1)} disabled={qIdx===(sec.questions.length-1)}>↓</button>
                              <button className="btn" onClick={() => delQ(sec.id, q.id)}>Delete</button>
                            </div>
                          </div>

                          {(q.type === 'single' || q.type === 'multi') && (
                            <div>
                              <div className="subtle" style={{ marginBottom:6 }}>Options</div>
                              <div style={{ display:'grid', gap:6 }}>
                                {(q.options || []).map((opt, i) => (
                                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:6 }}>
                                    <input
                                      className="input"
                                      value={opt}
                                      onChange={e => {
                                        const opts = [...q.options];
                                        opts[i] = e.target.value;
                                        editQ(sec.id, q.id, { options: opts });
                                      }}
                                    />
                                    <button className="btn" onClick={() => editQ(sec.id, q.id, { options: q.options.filter((_, j) => j !== i) })}>Remove</button>
                                  </div>
                                ))}
                                <button className="btn" onClick={() => editQ(sec.id, q.id, { options: [...(q.options||[]), `Option ${q.options.length+1}`] })}>+ Add option</button>
                              </div>
                            </div>
                          )}

                          {q.type === 'number' && (
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                              <label>
                                <div className="subtle">Min (optional)</div>
                                <input className="input" type="number" value={q.min ?? ''} onChange={e => editQ(sec.id, q.id, { min: e.target.value === '' ? null : Number(e.target.value) })}/>
                              </label>
                              <label>
                                <div className="subtle">Max (optional)</div>
                                <input className="input" type="number" value={q.max ?? ''} onChange={e => editQ(sec.id, q.id, { max: e.target.value === '' ? null : Number(e.target.value) })}/>
                              </label>
                            </div>
                          )}

                          {(q.type === 'short' || q.type === 'long') && (
                            <label>
                              <div className="subtle">Max length (optional)</div>
                              <input className="input" type="number" value={q.maxLength ?? ''} onChange={e => editQ(sec.id, q.id, { maxLength: e.target.value === '' ? null : Number(e.target.value) })}/>
                            </label>
                          )}

                          <details>
                            <summary className="menu-item" style={{ borderRadius:8 }}>Conditional display (optional)</summary>
                            <div style={{ display:'grid', gap:6, paddingTop:6 }}>
                              <label>
                                <div className="subtle">Question to check</div>
                                <select
                                  className="select"
                                  value={q?.condition?.questionId || ''}
                                  onChange={e => {
                                    const id = e.target.value || null;
                                    editQ(sec.id, q.id, { condition: id ? { questionId: id, equalsValue: '' } : null });
                                  }}
                                >
                                  <option value="">— None —</option>
                                  {flatQuestions.filter(x => x.id !== q.id).map(x => (
                                    <option key={x.id} value={x.id}>{x.title}</option>
                                  ))}
                                </select>
                              </label>
                              {q?.condition?.questionId && (
                                <label>
                                  <div className="subtle">Equals value</div>
                                  <input
                                    className="input"
                                    value={q.condition.equalsValue ?? ''}
                                    onChange={e => editQ(sec.id, q.id, { condition: { ...q.condition, equalsValue: e.target.value } })}
                                    placeholder="e.g., Yes"
                                  />
                                </label>
                              )}
                            </div>
                          </details>
                        </div>
                      </div>
                    ))}

                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {TYPES.map(t => (
                        <button key={t.key} className="btn" onClick={() => addQ(sec.id, t.key)}>+ {t.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {ass.sections.length === 0 && (
              <div className="subtle">No sections yet. Click “Add section”.</div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <div style={{ fontWeight:800 }}>Live preview</div>
            <Link to={`/assessments/${ass.jobId}/fill`} className="btn">Open full form</Link>
          </div>
          <PreviewForm assessment={ass} />
        </div>
      </div>
    </div>
  );
}
