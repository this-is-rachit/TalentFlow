import Dexie from 'dexie';

export const db = new Dexie('talentflow_db');
db.version(1).stores({
  jobs: '++id, slug, status, order',               
  candidates: '++id, jobId, stage, email',        
  timelines: '++id, candidateId, at',              
  assessments: 'jobId',                             
  submissions: '++id, jobId, candidateId',        
  notes: '++id, candidateId, createdAt'           
});

export async function isSeeded() {
  const count = await db.jobs.count();
  return count > 0;
}
