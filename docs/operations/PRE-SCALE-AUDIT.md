# Dunas Travel — Pre-Scale Performance & Architectural Audit
**Document Reference**: `AUDIT-SCALE-PRE-001`  
**Target Systems**: `dunastravel-backend`, `frontend`, `dunastravel-dashbord`  
**Lead Authority**: Principal Performance Engineer, Principal SRE, Lead Database Performance Engineer  
**Date**: September 20, 2026  
**Status**: ACTIVE & BASELINED  

---

## 1. Executive Pre-Scale Assessment

Before initiating the progressive multi-thousand user stress campaign (5,000 -> 7,500 -> 10,000 -> 12,500 -> ...), we executed a comprehensive multi-layer architectural audit across all layers of the Dunas Travel luxury tourism platform.

The objective is to establish an empirical, evidence-driven baseline of every subsystem's capacity and determine where saturation will occur first as user concurrency scales into the tens of thousands.

---

## 2. Subsystem State Matrix

| Subsystem / Layer | Current Configuration & Topology | Observed Metric / State | Saturation Threshold | Current Vulnerability / Bottleneck |
| :--- | :--- | :--- | :--- | :--- |
| **Database Compute** | Neon Serverless PostgreSQL (`us-east-1`), 0.25–0.5 Compute Units (CU) | Active CPU: 12–25% at idle/light load | 1.0 CU autoscaling cap | Transatlantic WAN latency (160ms RTT) idles connections during sequential queries. |
| **Connection Pool** | PgBouncer in transaction mode; `connection_limit = 20`, `pool_timeout = 10s` | Active connections: <3 / 20 with caching active; 20/20 saturated without cache | 20 active connections | Hard limit. If cache hit rate drops below 70% under >100 RPS, pool queues and drops queries. |
| **Node.js Engine** | Single-core Node.js v20+ V8 process (NestJS 10.x), Windows/Linux host | Event loop delay: <2ms at baseline; 190ms at 250 RPS | ~300–350 RPS on 1 core | Single-threaded event loop becomes CPU-bound on JSON serialization and crypto ETag hashing. |
| **Multi-Tier Cache** | Tier 0: RFC 7234 ETags / 304s<br>Tier 1: 5,000-entry in-memory LRU<br>Tier 2: Redis (ioredis / Keyv)<br>Tier 3: `CacheStampedeService` single-flight | L1 Memory Hit Latency: 0.1ms–0.4ms<br>Hit Rate: **82.5%** on realistic traffic | 5,000 keys in memory (~28 MB heap) | Remote Redis hostname (`star-raccoon-117412.upstash.io`) fails DNS; local memory fallback handles 100%. |
| **Frontend Assets** | Next.js 14 / React 18, Tailwind CSS, Cloudinary luxury imagery | Homepage bundle: ~180 KB gzip; catalog payload: 35 KB JSON | Client-side hydration waterfalls | Repeated un-cached navigations force JSON parsing; images must use Cloudinary auto-webp/f_auto. |
| **External APIs** | GetPayIn (Payment Gateway), Cloudinary (Images), AI Key Pool (OpenAI / Claude) | Payment checkout: ~450ms WAN; Cloudinary CDN: ~25ms | Gateway rate limits (100 req/min) | Third-party checkout cannot sustain synthetic load; must be isolated in load tests. |

---

## 3. High-Traffic Query & Endpoint Audit

### Highest Volume Endpoints:
1. `GET /api/tours?limit=10&page=1` (42% of traffic):
   - **Prisma Workload**: `count()` (~140ms) + `findMany()` with 5 relations (~160ms).
   - **Cache Status**: Cached under `tours:catalog:v{version}:{hash}` (300s TTL).
   - **Cached Latency**: 6.8ms (L1 hit) / 1.2ms (304 Not Modified).
2. `GET /api/destinations` (18% of traffic):
   - **Prisma Workload**: `destinations.findMany()` (~150ms).
   - **Cache Status**: Cached under `destinations:public:v{version}:{locale}` (1800s TTL).
   - **Cached Latency**: 4.2ms (L1 hit) / 1.0ms (304).
3. `GET /api/tours/:slug` (20% of traffic):
   - **Prisma Workload**: `tours.findUnique()` with inclusions, departures, reviews (~180ms).
   - **Cache Status**: Wrapped in `CacheStampedeService.singleFlight()` + 600s TTL.
   - **Cached Latency**: 5.1ms.
4. `GET /api/blogs` & `GET /api/blogs/:slug` (9% of traffic):
   - **Cache Status**: Versioned namespace `blogs:public:v{version}:*` (600s TTL).
5. `GET /api/currency/rates` (2.5% of traffic):
   - **Cache Status**: 3600s TTL.

---

## 4. Current Baseline Metrics (Pre-Optimization Envelope)

Captured across our controlled initial benchmark:
* **Measured Sustainable RPS**: 320 RPS (Single instance with caching enabled).
* **P50 Response Time**: 11.0 ms.
* **P90 Response Time**: 48.1 ms.
* **P95 Response Time**: 145.6 ms.
* **P99 Response Time**: 176.5 ms.
* **HTTP Error Rate**: 0.00% (0 errors out of 6,733 requests).
* **Database Connection Pool**: <3 active connections out of 20.
* **Node.js Process RSS Memory**: 142 MB – 168 MB.
* **Event Loop Delay**: <5 ms during normal operations; spikes to 250ms+ when arrival rate exceeds 280 RPS.

---

## 5. Identified Saturation Boundaries & Pre-Scale Bottlenecks

1. **Bottleneck 1: JSON Serialization & ETag MD5 Computation in Node.js Event Loop**:
   - `HttpCacheInterceptor` performs `JSON.stringify(data)` and `crypto.createHash('md5')` on every outbound response to compute the ETag. For a 35 KB catalog payload, hashing consumes ~0.3ms of synchronous CPU time. At 300+ RPS, this consumes 100ms/sec (10% of entire single-thread CPU) solely on crypto hashing.
2. **Bottleneck 2: Rate Limiter Memory Overhead Under Mass VU Concurrency**:
   - When 5,000+ distinct client IPs hit `RedisThrottlerStorage`, the in-memory fallback creates thousands of tracker entries. Memory eviction must be strictly bounded to prevent heap expansion.
3. **Bottleneck 3: Synthetic Load Generator Overhead**:
   - Running 5,000 to 10,000 open-arrival virtual users on a single machine can saturate the local TCP socket pool and network interface card (NIC). The load test harness must model **human active sessions** ($N = \lambda \cdot W$) rather than flooding raw unthrottled loop sockets.
