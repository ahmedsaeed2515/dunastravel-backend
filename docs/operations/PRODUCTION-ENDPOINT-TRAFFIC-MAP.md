# Production Endpoint Traffic Map & Characterization Matrix

**System**: Dunas Travel Luxury Tourism Ecosystem  
**Scope**: Complete Categorization of Endpoints, Performance Footprint, Caching & Failure Behavior  
**Date**: September 20, 2026  
**Auditor**: Principal SRE, Backend Architect & Database Performance Engineer  

---

## Category A: Public Read-Only Endpoints

High-frequency, anonymous, read-only endpoints forming the vast majority (~75%) of inbound traffic.

| Endpoint | Method | Avg Latency | P95 Latency | P99 Latency | Request Rate (% Mix) | DB Queries | DB Hold Time | Response Size | Cacheability | Auth | Rate Limit | Failure Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/tours` | GET | 514 ms | 2,280 ms | 3,150 ms | **35%** | 2 (`count`, `findMany`) | ~35 ms | 24–45 KB | **HIGH (Edge + HTTP + App)** | Public | 100/min | Fallback to cached catalog or 503 |
| `/api/tours/:slug` | GET | 420 ms | 1,934 ms | 2,800 ms | **20%** | 2 (`findUnique`, `reviews`) | ~25 ms | 8–18 KB | **HIGH (Edge + HTTP + App)** | Public | 100/min | 404 if not found; cached fallback |
| `/api/destinations` | GET | 380 ms | 1,850 ms | 2,500 ms | **10%** | 1 (`findMany`) | ~18 ms | 12–28 KB | **HIGH (Edge + HTTP + App)** | Public | 100/min | Stale cache acceptable for 1h |
| `/api/blogs` | GET | 350 ms | 1,750 ms | 2,400 ms | **5%** | 2 (`count`, `findMany`) | ~22 ms | 15–35 KB | **HIGH (Edge + HTTP + App)** | Public | 100/min | Stale cache acceptable for 30m |
| `/api/faq` | GET | 280 ms | 1,450 ms | 2,100 ms | **3%** | 1 (`findMany`) | ~12 ms | 6–14 KB | **HIGH (Edge + HTTP + App)** | Public | 100/min | Stale cache acceptable for 24h |
| `/api/currency/rates` | GET | 250 ms | 1,200 ms | 1,800 ms | **2%** | 1 (`findFirst`) | ~10 ms | 2–4 KB | **HIGH (App Cache 24h)** | Public | 100/min | Fallback to base USD rates |
| `/api/settings` | GET | 210 ms | 1,100 ms | 1,600 ms | **1%** | 1 (`findUnique`) | ~8 ms | 1–3 KB | **HIGH (App Cache 24h)** | Public | 100/min | Fallback to default config |

---

## Category B: User-Specific Read Endpoints

Authenticated, personalized read requests. Must **NEVER** be cached at the CDN or public edge.

| Endpoint | Method | Avg Latency | P95 Latency | P99 Latency | Request Rate (% Mix) | DB Queries | DB Hold Time | Response Size | Cacheability | Auth | Rate Limit | Failure Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/me` | GET | 290 ms | 1,350 ms | 1,900 ms | **4%** | 1 (`findUnique`) | ~14 ms | 1.5 KB | **PRIVATE ONLY (Client TanStack Query)** | Bearer JWT | 60/min | 401 Unauthorized |
| `/api/bookings/my` | GET | 420 ms | 1,850 ms | 2,600 ms | **3%** | 2 (`count`, `findMany`) | ~28 ms | 4–12 KB | **PRIVATE ONLY (`no-store`)** | Bearer JWT | 60/min | 401 Unauthorized |
| `/api/wishlist` | GET | 310 ms | 1,400 ms | 2,000 ms | **1%** | 1 (`findMany`) | ~15 ms | 2–6 KB | **PRIVATE ONLY (`no-store`)** | Bearer JWT | 60/min | Empty array if unauth |
| `/api/in-app-notifications` | GET | 280 ms | 1,250 ms | 1,800 ms | **1%** | 1 (`findMany`) | ~12 ms | 3–8 KB | **PRIVATE ONLY (`no-store`)** | Bearer JWT | 60/min | Empty array |

---

## Category C: Write Operations & Transactions

Mutating business transactions. Strictly non-cacheable, requires CSRF protection, anti-abuse throttling, and short transactional locks.

| Endpoint | Method | Avg Latency | P95 Latency | P99 Latency | Request Rate (% Mix) | DB Queries | DB Hold Time | Response Size | Cacheability | Auth | Rate Limit | Failure Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/tailor-made-inquiries` | POST | 720 ms | 2,758 ms | 3,800 ms | **7%** | 3 (`create`, `log`, `event`) | ~45 ms | 2 KB | **NO CACHE (`no-store`)** | Anonymous + CSRF | 10/min | 400 validation error; 503 retryable |
| `/api/bookings` | POST | 850 ms | 3,200 ms | 4,200 ms | **2%** | 4 (`tx: create, passengers, ledger`) | ~65 ms | 3 KB | **NO CACHE (`no-store`)** | Bearer JWT + CSRF | 10/min | Atomic rollback on error |
| `/api/reviews` | POST | 450 ms | 1,950 ms | 2,700 ms | **0.5%** | 2 (`findBooking`, `create`) | ~30 ms | 1.8 KB | **NO CACHE (`no-store`)** | Bearer JWT + CSRF | 5/min | 400 if booking invalid |
| `/api/contact-submissions` | POST | 480 ms | 2,100 ms | 2,900 ms | **0.5%** | 2 (`create`, `emailNotification`) | ~35 ms | 1.2 KB | **NO CACHE (`no-store`)** | Anonymous + CSRF | 5/min | Anti-bot reCAPTCHA/honeypot |

---

## Category D: Admin Operations

Administrative control plane used by operations, sales, and management teams. Requires `ADMIN` or `SUPER_ADMIN` RBAC.

| Endpoint | Method | Avg Latency | P95 Latency | P99 Latency | Request Rate (% Mix) | DB Queries | DB Hold Time | Response Size | Cacheability | Auth | Rate Limit | Failure Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/admin/inquiries` | GET | 680 ms | 3,100 ms | 4,500 ms | **2%** | 2 (`count`, `findMany` + assignee) | ~55 ms | 15–35 KB | **ADMIN CACHE (Short 10s TTL)** | ADMIN JWT | 60/min | 403 Forbidden |
| `/api/admin/users` | GET | 590 ms | 2,800 ms | 4,100 ms | **1%** | 2 (`count`, `findMany`) | ~40 ms | 12–25 KB | **ADMIN CACHE (Short 10s TTL)** | ADMIN JWT | 60/min | 403 Forbidden |
| `/api/admin/bookings` | GET | 750 ms | 3,400 ms | 4,800 ms | **1%** | 2 (`count`, `findMany` + joins) | ~60 ms | 20–50 KB | **ADMIN CACHE (Short 10s TTL)** | ADMIN JWT | 60/min | 403 Forbidden |
| `/api/admin/reports/*` | GET | 920 ms | 3,900 ms | 5,500 ms | **0.5%** | 3 (`aggregations`, `groupBys`) | ~85 ms | 10–30 KB | **APP CACHE (5 min TTL)** | ADMIN JWT | 30/min | 503 on pool saturation |
| `/api/admin/tours/*` | POST/PATCH | 620 ms | 2,600 ms | 3,800 ms | **0.5%** | 3 (`update`, `reorder`, `audit`) | ~50 ms | 8 KB | **NO CACHE (Triggers Purge)** | ADMIN JWT | 30/min | Purges catalog cache |

---

## Category E: Authentication Endpoints

High-security, brute-force sensitive endpoints.

| Endpoint | Method | Avg Latency | P95 Latency | P99 Latency | Request Rate (% Mix) | DB Queries | DB Hold Time | Response Size | Cacheability | Auth | Rate Limit | Failure Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | POST | 550 ms | 2,100 ms | 2,900 ms | **2%** | 1 (`findUnique` + bcrypt 10 salt) | ~15 ms DB, ~70ms CPU | 1.8 KB | **NO CACHE (`no-store`)** | Public + CSRF | 5/min | 401 with timing-safe delay |
| `/api/auth/register` | POST | 680 ms | 2,500 ms | 3,400 ms | **0.5%** | 2 (`findUnique`, `create`) | ~35 ms DB, ~70ms CPU | 2.0 KB | **NO CACHE (`no-store`)** | Public + CSRF | 3/min | 409 if user exists |
| `/api/auth/refresh` | POST | 320 ms | 1,400 ms | 2,000 ms | **1%** | 1 (`findUnique`, `updateToken`) | ~20 ms | 1.5 KB | **NO CACHE (`no-store`)** | Refresh Token | 20/min | 401 on token replay |
| `/api/csrf` | GET | 80 ms | 250 ms | 400 ms | **2%** | 0 (In-memory cookie token) | 0 ms | 0.5 KB | **NO CACHE (`no-store`)** | Public | 100/min | Issues signed double-submit cookie |

---

## Category F: External Integration Endpoints

Payment webhooks, currency sync, AI RAG retrieval.

| Endpoint | Method | Avg Latency | P95 Latency | P99 Latency | Request Rate (% Mix) | DB Queries | DB Hold Time | Response Size | Cacheability | Auth | Rate Limit | Failure Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/payments/webhook/getpayin` | POST | 450 ms | 1,800 ms | 2,500 ms | < 0.5% | 3 (`tx: idempotency, booking, invoice`) | ~40 ms | 0.5 KB | **NO CACHE (`no-store`)** | HMAC-SHA512 | IP Whitelist | 401 on bad HMAC; 200 on duplicate |
| `/api/ai/chat` | POST | 2,800 ms | 6,500 ms | 9,000 ms | < 0.5% | 1 (`vector/keyword retrieval`) | ~35 ms | 2–6 KB | **NO CACHE (Session context)**| Session ID | 15/min | Anthropic failover to Gemini |
