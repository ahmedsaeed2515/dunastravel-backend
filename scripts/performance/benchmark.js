const path = require('path');
const backendPath = path.resolve(__dirname, '../..');
const { Pool } = require(path.join(backendPath, 'node_modules/pg'));
require(path.join(backendPath, 'node_modules/dotenv')).config({ path: path.join(backendPath, '.env') });

function calculatePercentiles(samples) {
  if (!samples.length) return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = Number((sorted.reduce((acc, v) => acc + v, 0) / sorted.length).toFixed(2));
  return { p50, p95, p99, min, max, avg };
}

async function runDatabaseBenchmark() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not found in environment');
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5000,
  });

  console.log('===============================================================');
  console.log('DUNAS TRAVEL — FULL-STACK PERFORMANCE BENCHMARK HARNESS');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Database Host: Neon AWS us-east-1`);
  console.log('===============================================================\n');

  try {
    // 1. Direct Ping Latency (Network + TLS RTT to Neon)
    console.log('--- 1. Direct Network & TLS RTT to Database (SELECT 1) ---');
    const pingSamples = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await pool.query('SELECT 1');
      pingSamples.push(performance.now() - start);
    }
    const pingStats = calculatePercentiles(pingSamples);
    console.log(`Ping RTT (20 iterations): avg=${pingStats.avg}ms, p50=${pingStats.p50.toFixed(2)}ms, p95=${pingStats.p95.toFixed(2)}ms, p99=${pingStats.p99.toFixed(2)}ms`);

    // 2. High-Value Database Queries Latency
    console.log('\n--- 2. High-Value Business Query Profiles ---');
    const queryBenchmarks = [
      {
        name: 'Tours Catalog (Public List + Itinerary Count)',
        sql: `
          SELECT t.id, t.slug, t.title_jsonb, t.base_price_usd, t.duration_jsonb,
                 COUNT(i.id) as itinerary_count
          FROM tours t
          LEFT JOIN tour_itineraries i ON i.tour_id = t.id
          WHERE t.is_active = true AND t.deleted_at IS NULL
          GROUP BY t.id, t.slug, t.title_jsonb, t.base_price_usd, t.duration_jsonb
          ORDER BY t.created_at DESC
          LIMIT 20;
        `,
        iterations: 15,
      },
      {
        name: 'Tour Detail by Slug (with Itineraries & Images)',
        sql: `
          SELECT t.*, 
                 json_agg(DISTINCT i.*) FILTER (WHERE i.id IS NOT NULL) as itineraries,
                 json_agg(DISTINCT img.*) FILTER (WHERE img.id IS NOT NULL) as images
          FROM tours t
          LEFT JOIN tour_itineraries i ON i.tour_id = t.id
          LEFT JOIN tour_images img ON img.tour_id = t.id
          WHERE t.slug = 'classic-egypt-nile-cruise' AND t.is_active = true
          GROUP BY t.id;
        `,
        iterations: 15,
      },
      {
        name: 'Tour Availability 30-Day Lookup',
        sql: `
          SELECT a.id, a.tour_id, a.date, a.total_capacity, a.remaining_seats, a.status
          FROM tour_availabilities a
          WHERE a.tour_id = (SELECT id FROM tours WHERE slug = 'classic-egypt-nile-cruise' LIMIT 1)
            AND a.date >= CURRENT_DATE
          ORDER BY a.date ASC
          LIMIT 30;
        `,
        iterations: 15,
      },
      {
        name: 'CMS Blocks Catalog Fetch (hotels, packages, fleet)',
        sql: `
          SELECT key, content, updated_at
          FROM cms_blocks
          WHERE key IN ('hotels_catalog', 'holiday_packages', 'transportation_fleet');
        `,
        iterations: 15,
      },
      {
        name: 'Admin Dashboard Executive Summary (13 Individual Queries in Current Code)',
        isMulti: true,
        iterations: 10,
        run: async () => {
          const now = new Date();
          const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const to = now;
          const prevFrom = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
          const prevTo = from;

          const start = performance.now();
          await Promise.all([
            pool.query('SELECT status, COUNT(*), SUM(total_amount_usd) FROM bookings WHERE created_at >= $1 AND created_at <= $2 AND deleted_at IS NULL GROUP BY status', [from, to]),
            pool.query('SELECT status, COUNT(*), SUM(total_amount_usd) FROM bookings WHERE created_at >= $1 AND created_at <= $2 AND deleted_at IS NULL GROUP BY status', [prevFrom, prevTo]),
            pool.query("SELECT SUM(amount) FROM payments WHERE created_at >= $1 AND created_at <= $2 AND status = 'CAPTURED' AND is_refund = false", [from, to]),
            pool.query("SELECT SUM(amount) FROM payments WHERE created_at >= $1 AND created_at <= $2 AND status = 'CAPTURED' AND is_refund = false", [prevFrom, prevTo]),
            pool.query("SELECT SUM(amount) FROM refund_records WHERE created_at >= $1 AND created_at <= $2 AND status = 'COMPLETED'", [from, to]),
            pool.query("SELECT SUM(amount) FROM refund_records WHERE created_at >= $1 AND created_at <= $2 AND status = 'COMPLETED'", [prevFrom, prevTo]),
            pool.query("SELECT COUNT(*) FROM tours WHERE deleted_at IS NULL AND is_active = true AND status = 'PUBLISHED'"),
            pool.query('SELECT SUM(total_capacity), SUM(remaining_seats) FROM tour_availabilities WHERE date >= $1 AND date <= $2', [from, to]),
            pool.query("SELECT COUNT(*) FROM tailor_made_inquiries WHERE status IN ('NEWLY_RECEIVED', 'IN_PROGRESS')"),
            pool.query("SELECT COUNT(*) FROM contact_submissions WHERE status = 'NEW'"),
            pool.query("SELECT COUNT(*) FROM notification_delivery_logs WHERE status = 'FAILED' AND created_at >= $1", [from]),
            pool.query("SELECT COUNT(*) FROM analytics_events WHERE event_name = 'page_view' AND created_at >= $1 AND created_at <= $2", [from, to]),
            pool.query("SELECT COUNT(*) FROM analytics_events WHERE event_name = 'booking_started' AND created_at >= $1 AND created_at <= $2", [from, to]),
          ]);
          return performance.now() - start;
        }
      },
      {
        name: 'Consolidated Single-Query Executive Summary (Optimized CTE Target)',
        sql: `
          WITH current_period AS (
            SELECT
              COUNT(*) FILTER (WHERE b.created_at >= NOW() - INTERVAL '30 days') as total_bookings,
              COUNT(*) FILTER (WHERE b.created_at >= NOW() - INTERVAL '30 days' AND b.status IN ('CONFIRMED', 'PAID', 'PARTIALLY_PAID')) as confirmed_bookings,
              COALESCE(SUM(b.total_amount_usd) FILTER (WHERE b.created_at >= NOW() - INTERVAL '30 days'), 0) as booking_volume
            FROM bookings b
            WHERE b.deleted_at IS NULL
          ),
          captured_revenue AS (
            SELECT
              COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0) as current_revenue,
              COALESCE(SUM(amount) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'), 0) as prev_revenue
            FROM payments
            WHERE status = 'CAPTURED' AND is_refund = false
          ),
          inquiries_contacts AS (
            SELECT
              (SELECT COUNT(*) FROM tailor_made_inquiries WHERE status IN ('NEWLY_RECEIVED', 'IN_PROGRESS')) as open_inquiries,
              (SELECT COUNT(*) FROM contact_submissions WHERE status = 'NEW') as unread_contacts,
              (SELECT COUNT(*) FROM tours WHERE deleted_at IS NULL AND is_active = true AND status = 'PUBLISHED') as active_tours
          )
          SELECT * FROM current_period, captured_revenue, inquiries_contacts;
        `,
        iterations: 15,
      }
    ];

    const results = [];
    for (const benchmark of queryBenchmarks) {
      const samples = [];
      let payloadSize = 0;

      for (let i = 0; i < benchmark.iterations; i++) {
        if (benchmark.isMulti) {
          const duration = await benchmark.run();
          samples.push(duration);
        } else {
          const start = performance.now();
          const res = await pool.query(benchmark.sql);
          samples.push(performance.now() - start);
          if (i === 0) {
            payloadSize = Buffer.byteLength(JSON.stringify(res.rows));
          }
        }
      }

      const stats = calculatePercentiles(samples);
      results.push({
        query: benchmark.name,
        avgMs: stats.avg,
        p50Ms: Number(stats.p50.toFixed(2)),
        p95Ms: Number(stats.p95.toFixed(2)),
        p99Ms: Number(stats.p99.toFixed(2)),
        minMs: Number(stats.min.toFixed(2)),
        maxMs: Number(stats.max.toFixed(2)),
        bytes: payloadSize || 'N/A',
      });
    }

    console.table(results);

    console.log('\n===============================================================');
    console.log('DATABASE BENCHMARK COMPLETE');
    console.log('===============================================================');

  } catch (err) {
    console.error('Benchmark error:', err);
  } finally {
    await pool.end();
  }
}

runDatabaseBenchmark();
