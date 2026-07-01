import { cleanupCertification } from './setup-certification';
import { runJourney1Guest } from './journeys/journey-1-guest';
import { runJourney2Registration } from './journeys/journey-2-registration';
import { runJourney3Customer } from './journeys/journey-3-customer';
import { runJourney4Lifecycle } from './journeys/journey-4-lifecycle';
import { runJourney5Admin } from './journeys/journey-5-admin';
import { runJourney6Company } from './journeys/journey-6-company';
import { runJourney7Agent } from './journeys/journey-7-agent';
import { runJourney8Finance } from './journeys/journey-8-finance';
import { runJourney9CRM } from './journeys/journey-9-crm';
import { runJourney10Media } from './journeys/journey-10-media';
import { runJourney11AI } from './journeys/journey-11-ai';
import { runJourney12ErrorHandling } from './journeys/journey-12-error-handling';

async function runAll() {
  const wait = () => new Promise(r => setTimeout(r, 2000));
  console.log('🚀 Starting Phase 8 E2E Certification Runner');
  try {
    await runJourney1Guest(); await wait();
    await runJourney2Registration(); await wait();
    await runJourney3Customer(); await wait();
    await runJourney4Lifecycle(); await wait();
    await runJourney5Admin(); await wait();
    await runJourney6Company(); await wait();
    await runJourney7Agent(); await wait();
    await runJourney8Finance(); await wait();
    await runJourney9CRM(); await wait();
    await runJourney10Media(); await wait();
    await runJourney11AI(); await wait();
    await runJourney12ErrorHandling();
    console.log('\n✅ All journeys executed successfully!');
  } catch (error: any) {
    console.error('\n❌ Certification Failed:', error.message);
  } finally {
    await cleanupCertification();
    console.log('🛑 Prisma disconnected. Logs saved to certification-logs folder.');
  }
}

runAll();
