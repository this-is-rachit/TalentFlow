import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useToast } from '../../components/ToastProvider';

async function fetchAssessment(jobId) {
  const res = await fetch(`/assessments/${jobId}`);
  if (!res.ok) throw new Error('Failed to load assessment');
  return res.json();
}
async function submitAssessment(jobId, payload) {
  const res = await fetch(`/assessments/${jobId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || 'Submit failed');
  return j;
}

/* ---- normalize to a single shape (works for seeded + builder data) ---- */
function normalizeQuestion(q) {
  const id = q.id || crypto.randomUUID();
  const typeMap = { numeric: 'number' };
  const type = typeMap[q.type] || q.type || 'short';
  const title = q.title || q.label || 'Untitled question';
  let condition = q.condition || null;
  if (!condition && q.showIf && typeof q.showIf === 'object') {
    const k = Object.keys(q.showIf)[0];
    if (k) condition = { questionId: k, equalsValue: q.showIf[k] };
  }
  return {
    id,
    type,
    title,
    required: !!q.required,
    options: Array.isArray(q.options) ? q.options : [],
    min: q.min ?? null,
    max: q.max ?? null,
    maxLength: q.maxLength ?? (type === 'short' ? 120 : type === 'long' ? 1000 : null),
    condition,
  };
}
function normalizeAssessment(a) {
  return {
    jobId: a.jobId,
    sections: (a.sections || []).map(s => ({
      id: s.id || crypto.randomUUID(),
      title: s.title || 'Section',
      description: s.description || '',
      questions: (s.questions || []).map(normalizeQuestion),
    })),
  };
}
function shouldShow(q, answers) {
  if (!q.condition) return true;
  const { questionId, equalsValue } = q.condition || {};
  return (answers[questionId] ?? null) === equalsValue;
}

export default function AssessmentFillPage() {
  const { jobId } = useParams();
  const toast = useToast();

  const [ass, setAss] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true); setErr('');
        const raw = await fetchAssessment(jobId);
        setAss(normalizeAssessment(raw));
      } catch (e) {
        setErr(e.message || 'Failed to load');
      } finally { setLoading(false); }
    })();
  }, [jobId]);

  const allQs = useMemo(() => {
    const out = [];
    ass?.sections?.forEach(sec => sec.questions?.forEach(q => out.push(q)));
    return out;
  }, [ass]);

  function setAns(id, val) {
    setAnswers(a => ({ ...a, [id]: val }));
  }

  function validate() {
    const errs = {};
    for (const sec of ass.sections || []) {
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

  async function onSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    try {
      setSubmitting(true);
      await submitAssessment(jobId, { candidateId: null, answers });
      toast.show('Submitted ✅');
      setAnswers({});
    } catch (e2) {
      toast.show(e2.message || 'Submit failed', 'error');
    } finally { setSubmitting(false); }
  }

  if (loading) return <div>Loading…</div>;
  if (err) return <div style={{ color:'salmon' }}>Error: {err}</div>;
  if (!ass) return null;

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div className="h1">Assessment: Job {ass.jobId}</div>
        <Link to={`/assessments/${ass.jobId}`} className="btn">Open builder</Link>
      </div>

      <form onSubmit={onSubmit}>
        <div className="card runtime-card">
          <div className="assess-form">
            {(ass.sections || []).map(sec => (
              <section key={sec.id} className="assess-section">
                <h3 className="sec-title">{sec.title}</h3>
                {sec.description && <div className="subtle" style={{ marginBottom:6 }}>{sec.description}</div>}

                {(sec.questions || []).map(q => {
                  if (!shouldShow(q, answers)) return null;
                  const errMsg = errors[q.id];
                  return (
                    <div key={q.id} className="assess-q">
                      <div className="q-head">
                        <div style={{ fontWeight:700 }}>{q.title}</div>
                        {q.required && <span className="subtle" style={{ fontSize:12 }}>*</span>}
                      </div>

                      {q.type === 'single' && (
                        <div className="assess-options">
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
                        <div className="assess-options">
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
                        <div className="subtle">File upload stub (runtime)</div>
                      )}

                      {errMsg && <div style={{ color:'salmon', fontSize:12 }}>{errMsg}</div>}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>

          <div className="runtime-actions">
            <button className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
