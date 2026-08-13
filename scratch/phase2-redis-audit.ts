import 'dotenv/config';
import Redis from 'ioredis';
import { RedisKeyvStore } from '../src/common/cache/redis-keyv.store';

async function auditRedis() {
  console.log('=== PHASE 2 REDIS / UPSTASH CONNECTION AUDIT ===\n');

  const redisUrl = process.env.REDIS_URL || '';
  console.log('REDIS_URL configured:', redisUrl ? redisUrl.replace(/:[^:@]+@/, ':****@') : 'NONE');

  if (!redisUrl) {
    console.log('❌ REDIS_URL is missing from environment.');
    return;
  }

  // 1. Direct ioredis Test
  console.log('\n--- 1. Testing Direct ioredis Connection ---');
  const directClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  try {
    await directClient.connect();
    console.log('✅ Connection: SUCCESS');

    const ping = await directClient.ping();
    console.log('✅ PING response:', ping);

    const testKey = `audit:test:${Date.now()}`;
    await directClient.set(testKey, 'phase2_verified', 'EX', 10);
    console.log('✅ SET key with 10s EXPIRE: SUCCESS');

    const val = await directClient.get(testKey);
    console.log('✅ GET key response:', val);

    await directClient.del(testKey);
    console.log('✅ DEL key: SUCCESS');

    await directClient.disconnect();
  } catch (err: any) {
    console.error('❌ Direct Redis connection failed:', err.message);
  }

  // 2. RedisKeyvStore Test
  console.log('\n--- 2. Testing RedisKeyvStore Integration ---');
  const store = new RedisKeyvStore(redisUrl);

  try {
    await store.set('test_key', { message: 'hello_dunas' }, 5000);
    console.log('✅ RedisKeyvStore SET: SUCCESS');

    const cachedVal = await store.get('test_key');
    console.log('✅ RedisKeyvStore GET:', cachedVal);

    await store.delete('test_key');
    console.log('✅ RedisKeyvStore DELETE: SUCCESS');

    await store.disconnect();
  } catch (err: any) {
    console.error('❌ RedisKeyvStore operations failed:', err.message);
  }

  // 3. Simulated Redis Failure / Fallback Test
  console.log('\n--- 3. Testing Redis Failure & Fallback Behavior ---');
  const brokenStore = new RedisKeyvStore('rediss://invalid_user:invalid_pass@invalid-host.upstash.io:6379');

  console.log('Testing GET under broken Redis connection...');
  const fallbackGet = await brokenStore.get('missing_key');
  console.log('Fallback GET result (expected undefined):', fallbackGet);

  console.log('Testing SET under broken Redis connection...');
  await brokenStore.set('failing_key', { data: 'test' }, 2000);
  console.log('Fallback SET completed without throwing unhandled exception.');

  await brokenStore.disconnect();
  console.log('\n=== REDIS AUDIT COMPLETE ===');
}

auditRedis().catch(err => {
  console.error('Redis Audit Error:', err);
  process.exit(1);
});
