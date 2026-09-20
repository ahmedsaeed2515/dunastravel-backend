# Phase 0 Audit: Baseline Assumptions vs. Empirical Reality

**System**: Dunas Travel Luxury Tourism Ecosystem  
**Date**: September 20, 2026  
**Auditor**: Principal Performance Engineer & Reliability Architect  
**Principle**: Zero-Assumptions Protocol — Empirical Evidence Only  

---

## The 25 Core Audit Questions & Empirical Answers

### 1. What was actually tested?
A composite production workload modeled after luxury tourism user behavior across four user journeys:
- 65% Anonymous Catalog Browsing (`/api/tours`, `/api/blogs`)
- 20% VIP Custom Inquiries (`/api/tailor-made-inquiries`)
- 10% Authenticated Customer Operations (`/api/destinations`, `/api/faq`)
- 5% Admin Control Operations (`/api/admin/inquiries`, `/api/admin/users`)
All tests were executed live against the remote Neon PostgreSQL database in AWS `us-east-1` across transatlantic WAN (~160ms RTT).

### 2. What was the achieved RPS?
- **Smoke**: 0.45 RPS (1 VU)
- **Baseline**: 7.05 RPS (16 VUs)
- **Peak (High Season)**: 19.51 RPS (60 VUs)
- **Flash Spike**: 20.57 RPS (15 → 100 VUs in 10s)
- **Arrival Rate (Open)**: 30.29 RPS peak (20 iters/s)
- **Single-Replica Scaling**: 26.93 HTTP RPS (12 iters/s steady)
- **2-Replica Benchmark**: 32.34 HTTP RPS
- **3-Replica Benchmark**: 36.67 HTTP RPS

### 3. What was the arrival rate?
In open-model testing (`rps-breakpoint.js` and `arrival-rate.js`), arrival rates ranged from **3 iterations/second (~10 HTTP RPS)** up to **30 iterations/second (~100 HTTP RPS)**.

### 4. What was the actual throughput?
The maximum sustained throughput with **0.00% error rate** on a single container was **27–45 HTTP RPS** (~10–13 iters/s). Above 75 RPS, throughput plateaued as the database connection queue backed up.

### 5. What was the average latency?
- At 16 VUs: **710 ms**
- At 60 VUs (Peak): **745 ms**
- At 100 VUs (Spike Post-Fix): **780 ms**
- At Breakpoint (85+ RPS): **3,510 ms**

### 6. What was P50?
- Baseline: **514 ms**
- Peak: **540 ms**
- 1-Replica Scaling: **997 ms**
- Breakpoint Overload: **2,630 ms**

### 7. What was P90?
- Baseline: **1.62 s**
- Peak: **1.71 s**
- 1-Replica Scaling: **1.89 s**
- Breakpoint Overload: **7.28 s**

### 8. What was P95?
- Smoke: **1.94 s**
- Baseline: **2.12 s**
- Peak: **2.28 s**
- Spike Post-Fix: **3.15 s**
- 1-Replica Scaling: **2.50 s**
- 2-Replica Benchmark: **11.40 s** (under DB pool contention)
- 3-Replica Benchmark: **14.65 s** (under DB pool contention)
- Breakpoint Overload: **10.85 s**

### 9. What was P99?
- Baseline: **2.85 s**
- Peak: **3.15 s**
- Spike Post-Fix: **3.85 s**
- Breakpoint Overload: **19.27 s**

### 10. What was the error rate?
- Baseline & Peak: **< 0.05%**
- Spike Post-Fix: **0.00% (0 errors out of 1,710 requests)**
- 1-Replica Scaling: **0.00% (0 errors out of 1,055 requests)**
- 2-Replica Scaling: **0.83% (12 errors out of 1,430 requests)**
- 3-Replica Scaling: **3.01% (55 errors out of 1,826 requests)**
- Breakpoint Overload: **11.71% – 17.14%**

### 11. What was the actual concurrent request count?
- Baseline: 16 concurrent requests
- Peak: 60 concurrent requests
- Spike: Up to 100 concurrent requests
- Breakpoint: Up to 350 concurrent requests allocated in k6

### 12. What was the actual concurrent active-user model?
Little's Law formulation: Real human users spend 15–25s think time per page. A 270s session performs 13 requests ($0.0481\text{ req/s/user}$).
$$\mathbf{CCU_{\text{human}} = \text{Server RPS} \times 20.8}$$
- **45 RPS = 936 Concurrent Active Browsing Users** (~25,000 DAU)
- **80 RPS = 1,664 Concurrent Active Browsing Users** (~45,000 DAU)

### 13. How many database connections were active?
- At baseline: 3–6 active connections.
- At peak (60 VUs): 8–14 active connections.
- At saturation (85+ RPS): 20 active connections (100% of the Neon pool limit).

### 14. How many were waiting?
- At baseline/peak: 0 waiting connections.
- At 70–85 RPS: 5–18 waiting connections queued in PgBouncer.
- At 85+ RPS: 30–50+ requests queued, triggering Prisma 2,000ms transaction timeouts (`P2028`).

### 15. How many requests were queued?
Up to 294 dropped iterations / queued requests during the 24 iters/s stress test.

### 16. What caused failures?
1. **Pre-fix**: Prisma read-only queries (`count` + `findMany`) wrapped in `prisma.$transaction([])` hit the 2,000ms transaction timeout under PgBouncer connection queueing.
2. **Post-fix**: When traffic exceeds 85 RPS or when 3 replicas concurrently send requests, the 20-connection pool limit on Neon PostgreSQL is completely exhausted. Sockets wait > 2s to acquire a connection, triggering HTTP 503 (`TRANSACTION_FAILED`).

### 17. Was the application CPU-bound?
**NO.** Node.js process CPU stayed between 15% and 25% on a single core during all tests.

### 18. Was it memory-bound?
**NO.** Process RSS remained strictly flat at 150 MB to 244 MB during 30-minute soak tests. Zero leaks.

### 19. Was it database-bound?
**YES.** Specifically database-connection-pool bound.

### 20. Was it network-bound?
**PARTIALLY.** The transatlantic WAN latency (~160ms RTT) multiplies database connection hold times. Each query holds a pool socket for at least 170ms.

### 21. Was it connection-pool-bound?
**YES. ABSOLUTELY.** Neon PgBouncer pool cap (`connection_limit=20`) is the primary hard ceiling of the system.

### 22. Was it external-service-bound?
**NO.** GetPayIn and AI services are decoupled and not on the critical path of catalog browsing.

### 23. Was it cache-bound?
**YES.** Prior tests ran with **ZERO CACHE** because `REDIS_URL` had an unresolvable Upstash domain (`ENOTFOUND`) and there was no in-memory fallback. Every request hit the database directly.

### 24. Was the test closed-model or open-model?
Both:
- Closed-model: `smoke.js`, `baseline.js`, `peak.js`, `spike.js`, `soak.js`
- Open-model: `arrival-rate.js`, `rps-breakpoint.js`, `cluster-scaling.js`

### 25. Was the workload representative of production?
**YES.** 4 distinct weighted user journeys representing luxury tourism workflows with realistic endpoint distribution, real database slugs, and valid authentication tokens.
