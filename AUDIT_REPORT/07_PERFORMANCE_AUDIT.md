# 07 Performance Audit

## N+1 Queries
- File: `src/modules/admin/admin.service.ts`
- Line: 105
- Problem: Mapping over bookings and querying users inside the loop.
- Estimated impact: Heavy CPU load on scale.
