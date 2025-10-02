// src/lib/seed.js
import { faker } from '@faker-js/faker';
import { db } from './db.js';

const STAGES = ['applied','screen','tech','offer','hired','rejected'];
const JOB_TAGS = ['frontend','backend','fullstack','intern','remote','contract'];

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g,'')
    .trim()
    .replace(/\s+/g,'-')
    .slice(0,60);
}

function randPick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

function q(id, type, title, extra = {}) {
  return {
    id,
    type,           // 'single' | 'multi' | 'short' | 'long' | 'number' | 'file'
    title,
    required: false,
    options: [],    // for 'single'/'multi'
    min: null,      // for 'number'
    max: null,      // for 'number'
    maxLength: undefined, // for 'short'/'long'
    condition: null,      // { questionId, equalsValue }
    ...extra,
  };
}

function buildAssessment(jobId) {
  return {
    jobId,
    version: 1,
    updatedAt: Date.now(),
    sections: [
      {
        id: `s1-${jobId}`,
        title: 'Basics',
        description: '',
        questions: [
          q('q1',  'short',  'Introduce yourself',               { required: true, maxLength: 200 }),
          q('q2',  'single', 'Preferred role',                    { required: true, options: ['Frontend','Backend','Fullstack'] }),
          q('q3',  'multi',  'Tech you use',                      { required: true, options: ['React','Node','SQL','Docker','AWS'] }),
          q('q4',  'number', 'Years of experience',               { required: true, min: 0, max: 20 }),
        ],
      },
      {
        id: `s2-${jobId}`,
        title: 'Advanced',
        description: '',
        questions: [
          q('q5',  'long',   'Recent project details',            { required: true, maxLength: 1000 }),
          q('q6',  'file',   'Upload portfolio'),
          q('q7',  'single', 'Open to relocate?',                 { required: true, options: ['Yes','No'] }),
          q('q8',  'short',  'Preferred city',                    { maxLength: 50, condition: { questionId: 'q7', equalsValue: 'Yes' } }),
          q('q9',  'number', 'Notice period (days)',              { min: 0, max: 120 }),
          q('q10', 'short',  'GitHub/Portfolio URL',              { maxLength: 120 }),
          q('q11', 'multi',  'Databases used',                    { options: ['Postgres','MySQL','MongoDB','SQLite'] }),
          q('q12', 'long',   'Why this role?',                    { required: true, maxLength: 600 }),
        ],
      },
    ],
  };
}

export async function seedIfEmpty() {
  const already = await db.jobs.count();
  if (already > 0) return;

  const jobs = [];
  for (let i = 0; i < 25; i++) {
    const title = faker.person.jobTitle();
    const j = {
      title,
      slug: slugify(title + '-' + faker.string.alphanumeric(4)),
      status: Math.random() < 0.75 ? 'active' : 'archived',
      tags: faker.helpers.arrayElements(JOB_TAGS, faker.number.int({ min: 1, max: 3 })),
      order: i,
    };
    j.id = await db.jobs.add(j);
    jobs.push(j);
  }

  for (let i = 0; i < 1000; i++) {
    const job = randPick(jobs);
    const name = faker.person.fullName();
    const email = faker.internet.email({
      firstName: name.split(' ')[0],
      lastName:  name.split(' ')[1] || 'user',
    });
    const stage = randPick(STAGES);
    const candidateId = await db.candidates.add({ name, email, jobId: job.id, stage });
    await db.timelines.add({ candidateId, at: Date.now(), fromStage: 'applied', toStage: stage, note: 'Created' });
  }

  const activeJobs = jobs.filter(j => j.status === 'active');
  const pick = faker.helpers.arrayElements(activeJobs, Math.max(3, Math.min(5, activeJobs.length)));
  for (const job of pick) {
    await db.assessments.add(buildAssessment(job.id));
  }

  console.log('Seeded: 25 jobs, 1000 candidates, >=3 assessments (12 questions each)');
}
