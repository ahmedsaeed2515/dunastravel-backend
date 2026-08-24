/** Test-only deterministic fixture specification; never import from runtime code. */
export const DISPOSABLE_DATASET = {
  timezone: 'UTC', currency: 'USD',
  bookings: [
    { referenceCode: 'FIX-001', status: 'CONFIRMED', createdAt: '2026-01-10T10:00:00.000Z', totalUsd: '100.00', paidUsd: '100.00' },
    { referenceCode: 'FIX-002', status: 'PENDING', createdAt: '2026-01-11T10:00:00.000Z', totalUsd: '50.00', paidUsd: '0.00' },
    { referenceCode: 'FIX-003', status: 'CANCELLED', createdAt: '2026-02-01T10:00:00.000Z', totalUsd: '75.00', paidUsd: '0.00' },
  ],
  refund: { bookingReferenceCode: 'FIX-001', amountUsd: '100.00', idempotencyKey: 'fixture-refund-001' },
  expected: { january: { bookings: 2, grossUsd: '150.00', paidUsd: '100.00' }, february: { bookings: 1, grossUsd: '0.00' }, pagination: { total: 3, limit: 1, totalPages: 3 } },
} as const;
