# 06 Security Audit

## Unsecured Endpoints
- File: `src/modules/inquiries/public-inquiries.controller.ts`
- Line: 20
- Description: Missing @UseGuards(JwtAuthGuard).
- Exploit: DoS via bot spam.
- Fix: Add rate limiting.
