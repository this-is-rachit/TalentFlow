import { db } from './db';
import { seedIfEmpty } from './seed';

export async function resetAndReseed() {
  await db.transaction('rw', db.jobs, db.candidates, db.timelines, db.assessments, db.submissions, db.notes, async () => {
    await Promise.all([
      db.jobs.clear(),
      db.candidates.clear(),
      db.timelines.clear(),
      db.assessments.clear(),
      db.submissions.clear(),
      db.notes.clear(),
    ]);
  });
  await seedIfEmpty();
}
