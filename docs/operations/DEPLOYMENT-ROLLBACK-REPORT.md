# Deployment, Zero-Downtime Releases & Rollback Playbook
**Target Ecosystem**: Dunas Travel Production Platforms  
**Frontend Deployment**: Vercel Edge Network  
**Dashboard Deployment**: Vercel Enterprise  
**Backend API Deployment**: Containerized Node 22 (Railway / Render / AWS ECS)  
**Database**: Neon Serverless PostgreSQL with Prisma ORM  
**Date**: September 20, 2026  
**Auditor**: Principal Release Engineer / SRE  

---

## 1. Release Architecture & Principles

To achieve continuous deployment without customer-facing downtime, Dunas Travel adheres to three foundational release principles:
1. **Atomic Frontend Rollbacks**: Static and edge frontends deploy immutably with unique content hashes.
2. **Backward-Compatible Database Migrations (Expand/Contract)**: Database migrations MUST NEVER introduce breaking changes to currently running API instances.
3. **Graceful Backend Drain & Health Gates**: New backend versions only accept traffic after passing `/api/health`. Old instances drain active TCP connections over a 15-second grace period.

---

## 2. Deployment Procedures

### Frontend & Admin Dashboard (Vercel)
1. **Preflight**: Automated PR checks run `tsc --noEmit`, ESLint, and Vitest suite.
2. **Preview Deployment**: Vercel generates unique preview URL for visual QA.
3. **Production Promotion**: Merging to `main` triggers production build and deployment.
4. **Traffic Cutover**: Instant DNS atomic switch at edge CDN nodes (< 1s).

### Backend API (`dunastravel-backend`)
1. **Build Step**:
   ```bash
   npm run build
   ```
2. **Database Migration Gate**:
   ```bash
   npx prisma migrate deploy
   ```
   *Note: Only non-destructive, backward-compatible migrations are executed during deployment.*
3. **Container Boot & Health Check Verification**:
   - Container boots in isolated container.
   - Orchestrator probes `GET /api/health` every 2s for 15s.
   - Requires `{"status":"ok","info":{"database":{"status":"up"}}}` with HTTP 200.
4. **Rolling Cutover**:
   - Traffic routes to new container.
   - SIGTERM sent to old container; `app.enableShutdownHooks()` drains in-flight requests (15s timeout).

---

## 3. Rollback Playbook & Recovery Scenarios

### Scenario 1: Critical Frontend Bug / Regression
- **Trigger**: P0 UI error, broken checkout button, or failed localization.
- **Rollback Time**: **< 15 seconds**.
- **Execution**:
  1. Open Vercel Dashboard -> Deployments.
  2. Locate previous known-good deployment hash.
  3. Click **Instant Rollback**.
  4. Instant CDN cache invalidation and pointer update.
  5. Confirm rollback via browser verification.

### Scenario 2: Backend API Failure / Memory Leak
- **Trigger**: Error rate > 1%, elevated latency P95 > 3s, or unhandled exceptions.
- **Rollback Time**: **< 60 seconds**.
- **Execution**:
  1. In Cloud Orchestrator (Railway / AWS ECS):
     - Trigger rollback to previous Docker image tag (e.g. `dunas-backend:v1.4.2`).
  2. Orchestrator routes traffic back to previous image version.
  3. In-flight requests on degraded version receive graceful termination.

### Scenario 3: Failed Database Migration (Expand/Contract Model)
- **Design Rule**:
  - Phase 1 (Expand): Add nullable columns, new tables, non-blocking indexes.
  - Phase 2 (Deploy Code): Deploy application code that reads/writes new columns.
  - Phase 3 (Contract): After 14 days of stable operation, deprecate and remove old columns in a separate release.
- **Rollback Strategy**:
  - Because columns are added as nullable or with defaults, reverting backend code to the previous version requires **NO database rollback**. The previous code ignores the new columns and functions flawlessly.

---

## 4. Emergency Kill Switches

| Component | Kill Switch Mechanism | Effect |
| :--- | :--- | :--- |
| **Payment Gateway** | `FEATURE_PAYMENTS_ENABLED=false` | Disables online checkout; prompts user to submit VIP inquiry |
| **GuideR AI Concierge** | `FEATURE_GUIDER_AI=false` | Replaces interactive AI with static WhatsApp concierge link |
| **Media Uploads** | `FEATURE_MEDIA_UPLOADS=false` | Blocks admin file uploads during object storage degradation |
| **Rate Limit Emergency Mode** | `RATE_LIMIT_GLOBAL_MAX=20` | Tightens API rate limits to protect backend from DDoS |
