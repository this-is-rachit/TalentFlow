import { useMemo, useState, useEffect } from 'react';
import { useToast } from '../../components/ToastProvider';

function flattenQuestions(assessment) {
  const map = new Map();
  for (const sec of assessment.sections || []) {
    for (const q of sec.questions || []) map.set(q.id, q);
  }
  return map;
}
function isVisible(q, answers) {
  if (!q?.showIf) return true;
  const { questionId, equals } = q.showIf;
  return (answers?.[questionId] ?? null) === equals;
}
function validate(assessment, answers) {
  const qmap = flattenQuestions(assessment);
  const errors = {};
  for (const [qid, q] of qmap.entries()) {
    if (!isVisible(q, answers)) continue;

    const v = answers[qid];
    if (q.required) {
      const isEmpty =
        (q.type === 'multi' && (!Array.isArray(v) || v.length === 0)) ||
        (v === undefined || v === null || v === '');
      if (isEmpty) { errors[qid] = 'Required'; continue; }
    }
    if (q.type === 'numeric' && v !== undefined && v !== null && v !== '') {
      const num = Number(v);
      if (Number.isNaN(num)) errors[qid] = 'Must be a number';
      if (q.min !== undefined && num < q.min) errors[qid] = `Min ${q.min}`;
      if (q.max !== undefined && num > q.max) errors[qid] = `Max ${q.max}`;
    }
    if ((q.type === 'short' || q.type === 'long') && typeof v === 'string' && q.maxLength) {
      if (v.length > q.maxLength) errors[qid] = `Max length ${q.maxLength}`;
    }
  }
  return errors;
}

export default function AssessmentPreview({
  assessment,
  jobId,
  mode='preview',
  initialCandidateId = '',     
  lockCandidateId = false,     
}) {
  const toast = useToast();
  const [answers, setAnswers] = useState({});
  const [candidateId, setCandidateId] = useState(initialCandidateId);

  useEffect(() => { setCandidateId(initialCandidateId || ''); }, [initialCandidateId]);

  const qmap = useMemo(() => flattenQuestions(assessment), [assessment]);
  const [fieldErrors, setFieldErrors] = useState({});

  function setValue(qid, v) {
    setAnswers(a => ({ ...a, [qid]: v }));
  }

  async function submit() {
    const errs = validate(assessment, answers);
    if (Object.keys(errs).length > 0) {
      toast.show('Please fix validation errors', 'error');
      setFieldErrors(errs);
      return;
    }
    try {
      const res = await fetch(`/assessments/${jobId}/submit`, {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ candidateId: candidateId || null, answers })
      });
      if (!res.ok) {
        const j = await res.json().catch(()=>({}));
        throw new Error(j.message || 'Submit failed');
      }
      setAnswers({});
      setFieldErrors({});
      toast.show('Submitted');
    } catch (e) {
      toast.show(e.message, 'error');
    }
  }

  return (
    <div style={{ display:'grid', gap:12 }}>
      {mode === 'fill' && (
        <label>
          <div>Candidate ID (optional)</div>
          <input
            value={candidateId}
            onChange={e=>setCandidateId(e.target.value)}
            placeholder="e.g., 123"
            disabled={lockCandidateId}        
          />
        </label>
      )}

      {(assessment.sections || []).map((sec, sIdx) => (
        <div key={sec.id} style={{ border:'1px solid #e5e7eb', borderRadius:10, padding:12 }}>
          <b style={{ display:'block', marginBottom:8 }}>{sec.title || `Section ${sIdx+1}`}</b>

          <div style={{ display:'grid', gap:10 }}>
            {(sec.questions || []).map((q, i) => {
              const visible = isVisible(q, answers);
              if (!visible) return null;
              const err = fieldErrors[q.id];

              return (
                <div key={q.id} style={{ paddingBottom:8, borderBottom:'1px dashed #eee' }}>
                  <div style={{ marginBottom:6 }}>
                    <span style={{ fontWeight:600 }}>{q.label || `Question ${i+1}`}</span>
                    {q.required && <span style={{ color:'crimson', marginLeft:6 }}>*</span>}
                    <span style={{ fontSize:12, opacity:0.7, marginLeft:6 }}>({q.type})</span>
                  </div>

                  {q.type === 'single' && (
                    <select value={answers[q.id] ?? ''} onChange={e=>setValue(q.id, e.target.value)}>
                      <option value="">Select…</option>
                      {(q.options||[]).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  )}

                  {q.type === 'multi' && (
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                      {(q.options||[]).map(opt => {
                        const arr = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                        const checked = arr.includes(opt);
                        return (
                          <label key={opt} style={{ display:'inline-flex', gap:6, alignItems:'center' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e=>{
                                const next = new Set(arr);
                                if (e.target.checked) next.add(opt); else next.delete(opt);
                                setValue(q.id, Array.from(next));
                              }}
                            />
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {q.type === 'short' && (
                    <input
                      value={answers[q.id] ?? ''}
                      onChange={e=>setValue(q.id, e.target.value)}
                      maxLength={q.maxLength || 256}
                      placeholder={q.maxLength ? `Max ${q.maxLength} chars` : ''}
                      style={{ width:'100%' }}
                    />
                  )}

                  {q.type === 'long' && (
                    <textarea
                      rows={4}
                      value={answers[q.id] ?? ''}
                      onChange={e=>setValue(q.id, e.target.value)}
                      maxLength={q.maxLength || 2000}
                      placeholder={q.maxLength ? `Max ${q.maxLength} chars` : ''}
                      style={{ width:'100%' }}
                    />
                  )}

                  {q.type === 'numeric' && (
                    <input
                      type="number"
                      value={answers[q.id] ?? ''}
                      onChange={e=>setValue(q.id, e.target.value)}
                      placeholder={[
                        q.min!==undefined ? `min ${q.min}` : '',
                        q.max!==undefined ? `max ${q.max}` : ''
                      ].filter(Boolean).join(', ')}
                    />
                  )}

                  {q.type === 'file' && (
                    <input
                      type="file"
                      onChange={e=>{
                        const f = e.target.files?.[0];
                        if (f) setValue(q.id, { name:f.name, size:f.size, type:f.type });
                        else setValue(q.id, null);
                      }}
                    />
                  )}

                  {err && <div style={{ color:'crimson', marginTop:6 }}>{err}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {(assessment.sections || []).length === 0 && (
        <div style={{ opacity:0.7 }}>No sections yet.</div>
      )}

      <div>
        <button onClick={submit}>{mode === 'fill' ? 'Submit' : 'Submit (preview)'}</button>
      </div>
    </div>
  );
}
