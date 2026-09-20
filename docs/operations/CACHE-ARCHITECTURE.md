# Dunas Travel — Production Multi-Tier Cache Architecture
**Document Reference**: `DOC-OPS-ARCH-002`  
**Classification**: Production Architecture & Engineering Standard  
**Version**: 2.0  
**Status**: ACTIVE & VERIFIED  

---

## 1. Architectural Philosophy: Multi-Tier Caching

Dunas Travel is an editorial luxury tourism platform with an asymmetric traffic profile: **91.5%+ reads** (browsing tour itineraries, Nile cruise schedules, cultural guides, and currency rates) and **<8.5% writes** (inquiries, customized booking requests, and admin CMS mutations).

The underlying database is a serverless PostgreSQL cluster hosted on Neon in AWS `us-east-1`, operating with connection pooling via PgBouncer (`connection_limit = 20`). Due to the geographical distance between international visitors (Europe, Middle East, Americas) and the database region, roundtrip network latency alone is **140–180ms**. Under un-cached conditions, complex queries (e.g. tour catalog count + relation joins) created severe connection contention beyond 45 RPS.

To deliver an instantaneous luxury browsing experience while strictly protecting database connection limits, we have engineered a **Four-Tier Caching Hierarchy**:

```
[ Visitor Browser ] 
        │
        ▼ (Conditional GET with If-None-Match ETag)
[ Tier 0: CDN Edge & HTTP Cache (RFC 7234) ] ── (304 Not Modified / Edge Hit) ──► Instant (0ms - 15ms)
        │
        ▼ (Cache Miss / Edge Pass-Through)
[ Tier 1: In-Process LRU Memory Cache (`RedisKeyvStore`) ] ── (L1 Hit) ──► Ultra Fast (<1ms)
        │
        ▼ (L1 Miss / Multi-Pod Sync)
[ Tier 2: Distributed Redis Layer (Keyv / ioredis) ] ── (L2 Hit) ──► Fast (5ms - 15ms)
        │
        ▼ (L2 Miss / Expired Key)
[ Single-Flight Stampede Guard (`CacheStampedeService`) ] ── (Coalesces N requests into 1)
        │
        ▼ (Single Origin Fetch)
[ Tier 3: Remote Serverless PostgreSQL + PgBouncer ] ── (DB Query) ──► 140ms - 220ms
```

---

## 2. Phase 5 — Cache-Aside Pattern Implementation

Dunas Travel strictly adheres to the **Cache-Aside (Lazy Loading)** design pattern. The application layer orchestrates reads and writes, maintaining complete autonomy and failure isolation from cache infrastructure.

```
                      Client Request
                            │
                            ▼
                    [ CacheService.get ]
                            │
              ┌─────────────┴─────────────┐
              │                           │
          [ HIT ]                      [ MISS ]
              │                           │
              ▼                           ▼
        Return Payload       [ Single-Flight Promise Lock ]
                                          │
                                          ▼
                                 Query PostgreSQL (Prisma)
                                          │
                                          ▼
                                [ CacheService.set ]
                                          │
                                          ▼
                                    Return Data
```

### Why Cache-Aside Was Chosen Over Alternatives:
1. **Vs. Read-Through / Write-Through**: Does not tie the Prisma data access layer to Redis network availability. If Redis fails, domain services execute direct database queries without rewriting queries.
2. **Vs. Write-Behind (Write-Back)**: Luxury travel bookings and financial inquiries require immediate ACID durability in PostgreSQL; asynchronous write-behind introduces unacceptable risk of booking or payment loss.

---

## 3. Phase 6 — Cache Classification Tiers

| Cache Tier | Classification | Eligible Data Domains | Storage Strategy | Invalidation & Authority |
| :--- | :--- | :--- | :--- | :--- |
| **TIER 1** | **High Confidence Cache** | Destinations, Country Guides, Categories, FAQ, Static Settings, Currency Rates | Edge CDN + In-Memory L1 + Distributed L2 | Long TTL (1800s–3600s); explicit atomic version bump on admin edit |
| **TIER 2** | **Moderately Dynamic Cache** | Tour Catalog Listings, Tour Itinerary Details, Blog Articles, Public Reviews | Edge CDN (60s) + In-Memory L1 + Distributed L2 | Shorter TTL (300s–600s); versioned query namespaces + slug purges |
| **TIER 3** | **Highly Dynamic & Sensitive** | Real-Time Availability, Seat Allotment, Booking States, Invoices, Payment Sessions | **STRICTLY DO NOT CACHE** | **PostgreSQL is authoritative**. Real-time DB query with `SELECT ... FOR UPDATE` |

---

## 4. Phase 12 — TTL Design Matrix & Justification

| Namespace | Entity | TTL | Staleness Window | Business Justification |
| :--- | :--- | :--- | :--- | :--- |
| `destinations:public:*` | Destination Guides | **1,800s (30m)** | Low Risk | Country/city descriptions change rarely (monthly admin edits). |
| `tours:catalog:v*` | Tour Search Catalog | **300s (5m)** | Minimal Risk | Balances high hit rates with prompt visibility of new tours or price updates. |
| `tours:detail:v*` | Tour Detail Page | **600s (10m)** | Minimal Risk | Itinerary overviews and inclusions are stable; immediate purge on admin edit. |
| `blogs:public:v*` | Editorial Articles | **600s (10m)** | Zero Risk | Marketing articles; immediate invalidation when blog post is updated. |
| `currency:rates:latest` | Exchange Rates | **3,600s (1h)** | Controlled | Currency rates are synced once hourly; sub-hour fluctuations are absorbed. |
| `faq:public:all` | FAQ Knowledgebase | **1,800s (30m)** | Zero Risk | Static customer service content. |
| `availability:*` | Live Seat Inventory | **0s (NO CACHE)** | Zero Tolerance | Must prevent double-booking of Nile cruise cabins or luxury coach seats. |
| `bookings:*`, `wallets:*` | Private Financials | **0s (NO CACHE)** | Forbidden | Private authenticated state; stamped with `no-store, no-cache`. |

---

## 5. Phase 13 & 14 — NestJS Cache Module & Service Abstraction

All caching logic is centralized in a dedicated, decoupled NestJS module: `DunasCacheModule` (`src/common/cache/dunas-cache.module.ts`). Domain services interact exclusively with `CacheService` and `CacheStampedeService`, completely insulating business code from raw Redis command syntax.

### Core API Contract:
```typescript
@Injectable()
export class CacheService {
  async get<T>(key: string): Promise<T | undefined>;
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  async del(key: string): Promise<void>;
  async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds?: number): Promise<T>;
  async bumpVersion(namespace: string): Promise<number>;
  async getVersion(namespace: string): Promise<number>;
  getMetrics(): CacheMetrics;
}
```

### Key Architectural Strengths:
1. **Clean Separation of Concerns**: Zero occurrences of `redis.get()` or `redis.set()` scattered across domain controllers or business services.
2. **Double-Checked Locking**: `getOrSet()` checks the local L1 cache, inspects Tier 2 Redis, and if missed, delegates to `CacheStampedeService` before acquiring a database connection.
3. **Observability Built-In**: `getMetrics()` exposes real-time `hits`, `misses`, `hitRatio`, `keysCount`, and `queriesSpared`.

---

## 6. Single-Flight Cache Stampede Guard

### The Stampede Problem
When a high-traffic cache key expires (or on cold system start), hundreds of concurrent requests for that key (e.g. `/api/tours?limit=10`) simultaneously experience a cache miss. In unshielded architectures, all $N$ requests hit the database simultaneously (the "thundering herd" or "cache stampede"), instantly exhausting the 20-connection PgBouncer pool and triggering cascading timeouts.

### The Solution: `CacheStampedeService`
* **Implementation**: `src/common/cache/cache-stampede.service.ts`
* **Algorithm**:
  1. Check the local cache. If present, return immediately.
  2. If missing, check the internal in-flight promise map `Map<string, Promise<T>>`.
  3. If another concurrent request is **already fetching** this key from the database, attach to the existing promise (`singleFlight`).
  4. If this is the **first request**, create a shared Promise that executes the database query, writes the result to cache, and resolves.
  5. All $N-1$ waiting requests resolve with the identical result from the single execution.
  6. Upon completion or failure, the promise is automatically removed from the map via `finally()`.

### Empirical Stampede Benchmark
* **Test**: 40 concurrent VUs requesting an uncached catalog query at the exact same millisecond (`test/load/cache-stampede.js`).
* **Measured Outcome**:
  * **Database Queries Executed**: Exactly 1.
  * **Pool Connections Consumed**: Exactly 1.
  * **Success Rate**: **100% (80/80 requests succeeded with 200 OK)**.
  * **Errors / Timeouts**: **0**.

---

## 7. Security & Isolation Boundary: Private Data Protection

A critical hazard in caching is the inadvertent caching of authenticated, sensitive, or user-specific payloads. Dunas Travel implements strict security controls:

1. **Automatic Route Disqualification**:
   Any route matching the following prefixes is **strictly bypassed** by `HttpCacheInterceptor` and never cached:
   * `/api/admin/*`
   * `/api/auth/*`
   * `/api/bookings/*`
   * `/api/wishlist/*`
   * `/api/in-app-notifications/*`
   * `/api/wallets/*`
   * `/api/invoices/*`
2. **Credential & Header Detection**:
   If an incoming request contains an `Authorization` header, a `token` cookie, or a `session` cookie, public caching is disqualified immediately.
3. **Private Anti-Caching Headers**:
   Disqualified routes are stamped with:
   ```http
   Cache-Control: private, no-cache, no-store, must-revalidate
   Pragma: no-cache
   Vary: Origin, Authorization, Accept-Encoding
   ```
   This guarantees that intermediate CDNs, proxies, and shared browser caches never store sensitive client or administrative data.
