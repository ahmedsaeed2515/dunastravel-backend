# Manual Production Security Actions & External Requirements

Last Updated: 2026-07-26

The following security controls cannot be verified or executed solely by code patches and require manual operations or cloud infrastructure configuration:

---

## 1. Infrastructure & WAF Configuration
- [ ] **Cloudflare / AWS WAF Integration**: Enable Managed OWASP Ruleset for Web Application Firewall (WAF).
- [ ] **DDoS Protection**: Enforce IP Rate Limiting & Bot Management at the Edge CDN layer (e.g. Cloudflare Enterprise).
- [ ] **Strict HSTS Header**: Enforce `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` at Nginx / Vercel Edge.

---

## 2. Database Backup & Disaster Recovery (SRE)
- [ ] **Managed PostgreSQL PITR**: Enable Point-In-Time Recovery with 30-day retention on Managed Database provider (AWS RDS / DigitalOcean / Supabase).
- [ ] **Isolated Restore Verification**: Schedule quarterly automated DB restore drills into disposable environments.

---

## 3. Key Custody & Cloud Security
- [ ] **AWS KMS / Vault Key Custody**: Store `PII_ENCRYPTION_KEY` and `JWT_SECRET` in a dedicated Key Management System (AWS KMS / HashiCorp Vault).
- [ ] **GetPayIn webhook verification**: After receiving the official Direct
  API contract, configure its documented signature mechanism and prove that
  invalid signatures fail closed in production.
