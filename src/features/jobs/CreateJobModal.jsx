import { useEffect, useRef, useState } from 'react';

const PAGE_SIZE_BIG = 10000;

async function fetchAllJobs() {
  const qs = new URLSearchParams({ page: '1', pageSize: String(PAGE_SIZE_BIG) });
  const res = await fetch(`/jobs?${qs.toString()}`);
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || 'Failed to load jobs');
  return j.data || [];
}

async function postJob(payload) {
  const res = await fetch('/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.message || 'Create failed');
  return j;
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueSlug(base, taken) {
  let s = base;
  if (!s) s = `job-${Date.now()}`;
  if (!taken?.length) return s;
  if (!taken.includes(s)) return s;
  let n = 2;
  while (taken.includes(`${s}-${n}`)) n += 1;
  return `${s}-${n}`;
}

export default function CreateJobModal({ open, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [creating, setCreating] = useState(false);

  const [existingSlugs, setExistingSlugs] = useState([]);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setTagsInput('');
    setCreating(false);

    fetchAllJobs()
      .then(rows => setExistingSlugs(rows.map(r => r.slug).filter(Boolean)))
      .catch(() => setExistingSlugs([]));

    const t = setTimeout(() => firstFieldRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  function onBackdrop(e) {
    if (e.target === e.currentTarget) onClose?.();
  }

  async function create() {
    const t = title.trim();
    if (!t || creating) return;

    const tags = tagsInput
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

   
    const base = slugify(t);
    const slug = uniqueSlug(base, existingSlugs);

    try {
      setCreating(true);
      await postJob({ title: t, slug, tags });
      onCreated?.();
      onClose?.();
    } catch (e) {
      alert(e.message || 'Failed to create job');
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onBackdrop}>
      <div className="modal glass" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        {}
        <div className="modal-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div className="modal-title">Create Job</div>
          <button className="modal-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        {}
        <div className="modal-body">
          <label className="field">
            <div className="field-label">Title</div>
            <input
              ref={firstFieldRef}
              className="input"
              placeholder="e.g., Senior Frontend Engineer"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </label>

          <label className="field">
            <div className="field-label">Tags (comma-separated)</div>
            <input
              className="input"
              placeholder="e.g., remote, senior, full-time"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
            />
          </label>
        </div>

        {}
        <div className="modal-footer">
          <button className="btn" onClick={onClose} disabled={creating}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={create}
            disabled={creating || !title.trim()}
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
