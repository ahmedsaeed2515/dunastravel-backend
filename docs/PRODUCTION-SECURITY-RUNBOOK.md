# Production Security Runbook — Dunas Travel Backend

Last Updated: 2026-07-26

## 1. Mandatory Production Environment Variables

Ensure the following environment variables are set securely in Production/Staging environments (never hardcoded in source code or committed to `.env`):

```bash
# Core Configuration
NODE_ENV=production
PORT=5000
JWT_SECRET=<min-64-character-random-hex-string>
JWT_REFRESH_SECRET=<min-64-character-random-hex-string>
GUEST_TOKEN_SECRET=<min-64-character-random-hex-string>

# PII Encryption
PII_ENCRYPTION_KEY=<64-character-hex-string>

# Cross-Origin & Security
CORS_ALLOWED_ORIGINS=https://dunastravel.com,https://dashboard.dunastravel.com
TRUST_PROXY_HOPS=1

# External Services
DATABASE_URL=postgresql://user:password@pg-host:5432/dunastravel?sslmode=require
REDIS_URL=rediss://:redis_password@redis-host:6379/0
# GetPayIn credentials must be supplied only after its official merchant
# documentation is reviewed. Never put them in frontend variables.
GETPAYIN_API_BASE_URL=
GETPAYIN_API_KEY=
GETPAYIN_WEBHOOK_SECRET=
GETPAYIN_MERCHANT_ID=
GETPAYIN_CONTRACT_VERSION=
```

---

## 2. Emergency Security Incident Procedures

### A. Secret or Token Leak Incident
1. **Rotate `JWT_SECRET` and `JWT_REFRESH_SECRET`**:
   - Immediately update environment variables in your deployment pipeline (e.g. Vercel, AWS ECS, Kubernetes).
   - Trigger a rolling restart of all application instances.
   - All existing user sessions will be invalidated immediately.

B. Compromised User or Agent Account
1. **Invalidate Session via DB Update**:
   - Run a targeted query or call admin API to bump `sessionVersion`:
     ```sql
     UPDATE users SET session_version = session_version + 1, refresh_token = NULL, status = 'SUSPENDED' WHERE id = 'compromised-user-id';
     ```

### C. Database Disaster Recovery & Backup Drill
1. Managed PostgreSQL Point-in-Time Recovery (PITR) is recommended.
2. Execute periodic restore tests into an isolated test database to verify backup integrity.
3. Encryption key rotation requires executing `npm run security:encrypt-pii` under new keys with key envelope migration.
