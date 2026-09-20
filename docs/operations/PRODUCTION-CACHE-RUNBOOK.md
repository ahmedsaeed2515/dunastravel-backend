# Dunas Travel — Production Cache SRE Operations Runbook
**Document Reference**: `SOP-OPS-CACHE-005`  
**Target Audience**: Site Reliability Engineers (SRE), DevOps, On-Call Engineers  
**Classification**: Tier-1 Production Operations  
**Version**: 2.0  
**Status**: ACTIVE  

---

## 1. System Overview & Architecture Summary

Dunas Travel employs a 4-tier caching architecture:
* **Tier 0**: Edge CDN & Browser RFC 7234 HTTP caching (ETags + 304 Not Modified).
* **Tier 1**: Local Node.js in-process LRU cache (up to 5,000 keys, sub-millisecond).
* **Tier 2**: Distributed Redis layer via Keyv/ioredis (with autonomous fallback).
* **Tier 3**: Single-Flight Stampede Guard (`CacheStampedeService`) protecting the 20-connection Neon PgBouncer pool.

---

## 2. Key Monitoring Metrics & Alerting Thresholds

| Metric Name | Source | Warning Threshold | Critical Threshold | Action |
| :--- | :--- | :--- | :--- | :--- |
| **Cache Hit Ratio** | `CacheService.getMetrics()` | < 80% | < 65% | Check version bump rate; verify TTLs |
| **L1 Memory Entries** | `RedisKeyvStore.size()` | > 4,000 keys | > 4,800 keys | Monitor Node.js RSS heap memory |
| **PgBouncer Pool Usage**| Neon Metrics / DB Pool | > 12 / 20 | > 16 / 20 | Investigate un-cached endpoints |
| **HTTP 304 Response Rate**| Edge CDN Analytics | < 30% | < 15% | Verify client `If-None-Match` propagation |
| **Stampede Single-Flights**| `CacheStampedeService` | > 50 in-flight | > 100 in-flight | Check DB latency / connection queue |

---

## 3. Standard Operating Procedures (SOPs)

### SOP 1: Invalidate a Specific Tour or Resource
Use when a tour title, price, or itinerary is corrected in emergency and must be reflected immediately.
* **Via Admin API**:
  Updating the tour via the Admin Dashboard (`PATCH /api/tours/:id`) automatically triggers:
  1. Invalidation of `tours:detail:v{version}:{slug}:{lang}`.
  2. Invalidation of `landing-pages:public:*`.
  3. Atomic increment of `tours:catalog:version`.
* **Manual Invalidation via Curl**:
  ```bash
  curl -X POST "https://api.dunastravel.com/api/admin/cache/invalidate" \
    -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"namespace": "tours:detail", "key": "classic-program"}'
  ```

### SOP 2: Flush All Cached Tour Catalog Permutations
Use after bulk price adjustments or seasonal catalog imports.
* **Mechanism**: Bumping the catalog version renders all existing catalog filter keys obsolete in $O(1)$ time without Redis blocking.
* **Execution**:
  ```bash
  curl -X POST "https://api.dunastravel.com/api/admin/cache/bump-version" \
    -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"scope": "tours:catalog"}'
  ```

### SOP 3: Global Emergency Cache Flush
Use during major structural releases or database migrations.
* **Warning**: A global cache flush will cause incoming requests to hit the database origin. However, `CacheStampedeService` ensures that duplicate requests coalesce into 1 query per key, preventing connection pool exhaustion.
* **Execution**:
  ```bash
  curl -X POST "https://api.dunastravel.com/api/admin/cache/flush" \
    -H "Authorization: Bearer ${ADMIN_JWT_TOKEN}"
  ```

### SOP 4: Investigating High Database Pool Usage
If PgBouncer connection alerts fire (>15 active connections):
1. **Check Cache Metrics**:
   ```bash
   curl -s "http://localhost:5000/api/health" | jq .
   ```
2. **Identify Slow / Un-Cached Queries**:
   Inspect backend structured logs in CloudWatch / Datadog:
   ```json
   { "level": "warn", "context": "PrismaService", "durationMs": { "$gt": 200 } }
   ```
3. **Verify Route Classification**:
   Cross-reference requested paths against `docs/operations/PRODUCTION-ENDPOINT-TRAFFIC-MAP.md`. Ensure that high-volume public endpoints have not been accidentally assigned authentication guards or omitted from `HttpCacheInterceptor.publicRoutes`.

---

## 4. Edge CDN Purge Integration

When Dunas Travel is fronted by Cloudflare or Vercel Edge:
* **Purge by Tag / URL**:
  ```bash
  # Cloudflare Purge API example
  curl -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"files": ["https://dunastravel.com/api/tours"]}'
  ```
* **Browser Revalidation**:
  Because browser `max-age=60` is capped at 60 seconds, end-user browsers will naturally synchronize with the fresh origin version within 60 seconds without requiring hard cache wipes.
