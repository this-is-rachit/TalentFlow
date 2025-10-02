
import { delay, HttpResponse } from 'msw';

export async function simulateLatency() {
  
  await delay(200 + Math.floor(Math.random()*1000));
}

export function maybeFailWrite(prob = 0.08) {
 
  if (Math.random() < prob) {
    return HttpResponse.json({ message: 'Random write failure (simulated)' }, { status: 500 });
  }
  return null;
}
