// src/mocks/handlers.js
import { http, HttpResponse } from 'msw';
import { db } from '../lib/db';
import { simulateLatency, maybeFailWrite } from './utils';

const STAGES = ['applied','screen','tech','offer','hired','rejected'];

/* sort helpers */
function parseSort(param) {
  const s = String(param || '').toLowerCase();
  if (s.includes(':')) {
    const [field, dir = 'asc'] = s.split(':');
    return { field, dir: dir === 'desc' ? 'desc' : 'asc' };
  }
  const map = {
    orderasc:  ['order', 'asc'],
    orderdesc: ['order', 'desc'],
    titleasc:  ['title', 'asc'],
    titledesc: ['title', 'desc'],
  };
  const [field, dir] = map[s] || ['order', 'asc'];
  return { field, dir };
}

/* helpers */
async function queryJobs({ search = '', status = '', page = '1', pageSize = '10', sort = 'orderAsc' }) {
  const p  = Math.max(1, parseInt(page) || 1);
  const ps = Math.max(1, parseInt(pageSize) || 10);
  const { field, dir } = parseSort(sort);

  let all = await db.jobs.toArray();

  if (search) {
    const s = search.toLowerCase();
    all = all.filter(j =>
      (j.title || '').toLowerCase().includes(s) ||
      (j.slug  || '').toLowerCase().includes(s)
    );
  }
  if (status) all = all.filter(j => j.status === status);

  if (field === 'title') {
    all.sort((a, b) => {
      const aa = (a.title || '');
      const bb = (b.title || '');
      const cmp = aa.localeCompare(bb, undefined, { sensitivity: 'base' });
      return dir === 'asc' ? cmp : -cmp;
    });
  } else {
    all.sort((a, b) => {
      const aa = Number.isFinite(a[field]) ? a[field] : 0;
      const bb = Number.isFinite(b[field]) ? b[field] : 0;
      const cmp = aa - bb;
      return dir === 'asc' ? cmp : -cmp;
    });
  }

  const total = all.length;
  const start = (p - 1) * ps;
  const data  = all.slice(start, start + ps);
  return { data, page: p, pageSize: ps, total };
}

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-').slice(0,60);
}

async function applyReorder({ jobId, fromOrder, toOrder }) {
  if (fromOrder === toOrder) return;
  const all = await db.jobs.orderBy('order').toArray();
  const maxOrder = all.length - 1;
  if (toOrder < 0 || toOrder > maxOrder) throw new Error('toOrder out of range');
  const moving = all.find(j => j.id === jobId);
  if (!moving) throw new Error('Job not found');
  const realFrom = moving.order;

  if (toOrder > realFrom) {
    const affected = all.filter(j => j.order > realFrom && j.order <= toOrder);
    for (const j of affected) await db.jobs.update(j.id, { order: j.order - 1 });
  } else {
    const affected = all.filter(j => j.order >= toOrder && j.order < realFrom);
    for (const j of affected) await db.jobs.update(j.id, { order: j.order + 1 });
  }
  await db.jobs.update(moving.id, { order: toOrder });
}

export const handlers = [
  /* ===== JOBS ===== */
  http.get('/jobs', async ({ request }) => {
    const url = new URL(request.url);
    const search   = url.searchParams.get('search') || '';
    const status   = url.searchParams.get('status') || '';
    const page     = url.searchParams.get('page') || '1';
    const pageSize = url.searchParams.get('pageSize') || '10';
    const sort     = url.searchParams.get('sort') || 'orderAsc';
    await simulateLatency();
    const result = await queryJobs({ search, status, page, pageSize, sort });
    return HttpResponse.json(result);
  }),

  http.get('/jobs/:id', async ({ params }) => {
    await simulateLatency();
    const id = Number(params.id);
    const job = await db.jobs.get(id);
    if (!job) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    return HttpResponse.json(job);
  }),

  http.get('/jobs/slug/:slug', async ({ params, request }) => {
    await simulateLatency();
    const url = new URL(request.url);
    const excludeId = Number(url.searchParams.get('excludeId') || 0);
    const slug = String(params.slug || '').toLowerCase();
    const matches = await db.jobs.where('slug').equals(slug).toArray();
    const conflict = matches.find(j => j.id !== excludeId);
    return HttpResponse.json({ available: !conflict, conflictId: conflict?.id ?? null });
  }),

  http.post('/jobs', async ({ request }) => {
    await simulateLatency();
    const maybe = maybeFailWrite(); if (maybe) return maybe;

    const body = await request.json();
    const title = (body.title||'').trim();
    if (!title) return HttpResponse.json({ message:'Title is required' }, { status:400 });

    let slug = slugify(title);
    const exists = await db.jobs.where('slug').equals(slug).count();
    if (exists > 0) slug = `${slug}-${Math.random().toString(36).slice(2,6)}`;

    const maxOrder = (await db.jobs.count()) - 1;
    const job = { title, slug, status:'active', tags:Array.isArray(body.tags)?body.tags:[], order: Math.max(0, maxOrder+1) };
    job.id = await db.jobs.add(job);
    return HttpResponse.json(job, { status: 201 });
  }),

  http.patch('/jobs/:id', async ({ params, request }) => {
    await simulateLatency();
    const maybe = maybeFailWrite(); if (maybe) return maybe;

    const id = Number(params.id);
    const job = await db.jobs.get(id);
    if (!job) return HttpResponse.json({ message:'Not found' }, { status:404 });

    const patch = await request.json();
    const updates = {};

    if (typeof patch.title === 'string') {
      const t = patch.title.trim();
      if (!t) return HttpResponse.json({ message:'Title cannot be empty' }, { status:400 });
      updates.title = t;

      let newSlug = slugify(t);
      const sameSlug = await db.jobs.where('slug').equals(newSlug).toArray();
      const conflict = sameSlug.some(j => j.id !== id);
      if (conflict) newSlug = `${newSlug}-${Math.random().toString(36).slice(2,6)}`;
      updates.slug = newSlug;
    }

    if (Array.isArray(patch.tags)) updates.tags = patch.tags.map(String);
    if (patch.status === 'active' || patch.status === 'archived') updates.status = patch.status;

    await db.jobs.update(id, updates);
    const fresh = await db.jobs.get(id);
    return HttpResponse.json(fresh);
  }),

  http.patch('/jobs/:id/reorder', async ({ params, request }) => {
    await simulateLatency();
    const maybe = maybeFailWrite(0.1); if (maybe) return maybe;

    const id = Number(params.id);
    const { fromOrder, toOrder } = await request.json();
    const exists = await db.jobs.get(id);
    if (!exists) return HttpResponse.json({ message:'Not found' }, { status:404 });

    try {
      await applyReorder({ jobId:id, fromOrder:Number(fromOrder), toOrder:Number(toOrder) });
    } catch (e) {
      return HttpResponse.json({ message:e.message||'Bad reorder' }, { status:400 });
    }

    return HttpResponse.json({ ok:true, fromOrder, toOrder });
  }),

  /* ===== CANDIDATES ===== */
  http.get('/candidates', async ({ request }) => {
    const url = new URL(request.url);
    const stage = url.searchParams.get('stage') || '';

    await simulateLatency();

    let items = await db.candidates.toArray();
    if (stage) items = items.filter(c => c.stage === stage);

    const jobs = await db.jobs.toArray();
    const titleById = new Map(jobs.map(j => [j.id, j.title]));
    const data = items.map(c => ({
      ...c,
      jobTitle: titleById.get(c.jobId) || `Job #${c.jobId}`
    }));

    return HttpResponse.json({ data, total: data.length });
  }),

  http.post('/candidates', async ({ request }) => {
    await simulateLatency();
    const maybe = maybeFailWrite(); if (maybe) return maybe;

    const body = await request.json();
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    let   stage = body.stage || 'applied';
    let   jobId = body.jobId;

    if (!name || !email) {
      return HttpResponse.json({ message: 'name and email are required' }, { status: 400 });
    }
    if (!STAGES.includes(stage)) stage = 'applied';

    if (!jobId) {
      const jobs = await db.jobs.toArray();
      jobId = jobs.length ? jobs[Math.floor(Math.random()*jobs.length)].id : 1;
    }

    const id = await db.candidates.add({ name, email, stage, jobId });
    await db.timelines.add({ candidateId: id, at: Date.now(), fromStage: 'applied', toStage: stage, note: 'Created' });

    const job = await db.jobs.get(jobId);
    return HttpResponse.json({ id, name, email, stage, jobId, jobTitle: job?.title || `Job #${jobId}` }, { status: 201 });
  }),

  http.get('/candidates/:id', async ({ params }) => {
    await simulateLatency();
    const id = Number(params.id);
    const c = await db.candidates.get(id);
    if (!c) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    const job = await db.jobs.get(c.jobId);
    return HttpResponse.json({ ...c, jobTitle: job?.title || `Job #${c.jobId}` });
  }),

  http.patch('/candidates/:id', async ({ params, request }) => {
    await simulateLatency();
    const maybe = maybeFailWrite(); if (maybe) return maybe;

    const id = Number(params.id);
    const c = await db.candidates.get(id);
    if (!c) return HttpResponse.json({ message: 'Not found' }, { status: 404 });

    const patch = await request.json();
    const updates = {};

    if (typeof patch.name === 'string') updates.name = patch.name.trim();
    if (typeof patch.email === 'string') updates.email = patch.email.trim().toLowerCase();
    if (typeof patch.jobId === 'number') updates.jobId = patch.jobId;

    if (typeof patch.stage === 'string' && STAGES.includes(patch.stage) && patch.stage !== c.stage) {
      await db.timelines.add({ candidateId: id, at: Date.now(), fromStage: c.stage, toStage: patch.stage, note: 'Stage change' });
      updates.stage = patch.stage;
    }

    await db.candidates.update(id, updates);
    const fresh = await db.candidates.get(id);
    const job = await db.jobs.get(fresh.jobId);
    return HttpResponse.json({ ...fresh, jobTitle: job?.title || `Job #${fresh.jobId}` });
  }),

  http.get('/candidates/:id/timeline', async ({ params }) => {
    await simulateLatency();
    const id = Number(params.id);
    const items = await db.timelines.where('candidateId').equals(id).toArray();
    items.sort((a,b)=>a.at-b.at);
    return HttpResponse.json({ data: items });
  }),

  /* ===== NOTES ===== */
  http.get('/candidates/:id/notes', async ({ params }) => {
    await simulateLatency();
    const candidateId = Number(params.id);
    const items = await db.notes.where('candidateId').equals(candidateId).toArray();
    items.sort((a,b)=>a.createdAt - b.createdAt);
    return HttpResponse.json({ data: items });
  }),

  http.post('/candidates/:id/notes', async ({ params, request }) => {
    await simulateLatency();
    const maybe = maybeFailWrite(); if (maybe) return maybe;

    const candidateId = Number(params.id);
    const { text='', mentions=[] } = await request.json();
    const trimmed = String(text).trim();
    if (!trimmed) {
      return HttpResponse.json({ message: 'Text is required' }, { status: 400 });
    }

    const createdAt = Date.now();
    const id = await db.notes.add({ candidateId, text: trimmed, mentions: Array.isArray(mentions)?mentions:[], createdAt });

    return HttpResponse.json({ id, candidateId, text: trimmed, mentions: Array.isArray(mentions)?mentions:[], createdAt }, { status: 201 });
  }),

  http.delete('/notes/:noteId', async ({ params }) => {
    await simulateLatency();
    const maybe = maybeFailWrite(); if (maybe) return maybe;

    const noteId = Number(params.noteId);
    const existed = await db.notes.get(noteId);
    if (!existed) return HttpResponse.json({ message: 'Not found' }, { status: 404 });
    await db.notes.delete(noteId);
    return HttpResponse.json({ ok: true });
  }),

  /* ===== ASSESSMENTS ===== */

  // NEW: return { exists: { [jobId]: boolean, ... } }
  http.get('/assessments/exists', async ({ request }) => {
    const url = new URL(request.url);
    const ids = (url.searchParams.get('jobIds') || '')
      .split(',')
      .map(n => Number(n))
      .filter(Boolean);

    const exists = {};
    for (const id of ids) {
      const rec = await db.assessments.where('jobId').equals(id).first();
      exists[id] = !!(rec && Array.isArray(rec.sections) && rec.sections.length > 0);
    }
    return HttpResponse.json({ exists });
  }),

  http.get('/assessments/:jobId', async ({ params }) => {
    await simulateLatency();
    const jobId = Number(params.jobId);
    const existing = await db.assessments.where('jobId').equals(jobId).first();
    if (!existing) {
      return HttpResponse.json({
        jobId,
        version: 1,
        updatedAt: Date.now(),
        sections: [],
      });
    }
    return HttpResponse.json(existing);
  }),

  http.put('/assessments/:jobId', async ({ params, request }) => {
    await simulateLatency();
    const maybe = maybeFailWrite(); if (maybe) return maybe;

    const jobId = Number(params.jobId);
    const body = await request.json();
    const record = {
      jobId,
      sections: Array.isArray(body.sections) ? body.sections : [],
      version: Number(body.version || 1),
      updatedAt: Date.now(),
    };

    const existing = await db.assessments.where('jobId').equals(jobId).first();
    if (existing?.id) {
      await db.assessments.update(existing.id, record);
      const out = await db.assessments.get(existing.id);
      return HttpResponse.json(out);
    } else {
      const id = await db.assessments.add(record);
      const out = await db.assessments.get(id);
      return HttpResponse.json(out, { status: 201 });
    }
  }),

  http.post('/assessments/:jobId/submit', async ({ params, request }) => {
    await simulateLatency();
    const maybe = maybeFailWrite(); if (maybe) return maybe;

    const jobId = Number(params.jobId);
    const { candidateId=null, answers={} } = await request.json();
    const createdAt = Date.now();
    const id = await db.submissions.add({ jobId, candidateId, answers, createdAt });
    return HttpResponse.json({ id, jobId, candidateId, createdAt }, { status: 201 });
  }),

  http.get('/assessments/:jobId/submissions', async ({ params, request }) => {
    await simulateLatency();
    const jobId = Number(params.jobId);
    const url = new URL(request.url);
    const candidateIdParam = url.searchParams.get('candidateId');

    let items = await db.submissions.where('jobId').equals(jobId).toArray();
    if (candidateIdParam) {
      items = items.filter(s => String(s.candidateId ?? '') === String(candidateIdParam));
    }
    items.sort((a,b) => b.createdAt - a.createdAt);

    return HttpResponse.json({ data: items });
  }),
];
