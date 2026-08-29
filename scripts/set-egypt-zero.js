require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('--- UPDATING EGYPT TOURS TO $0 USD ---');
  
  // Update base_price_usd to 0 for all tours where country in ('Egypt', 'Egito', 'Egipto') or linked to 'egypt' landing page
  const updateQuery = `
    UPDATE tours
    SET base_price_usd = 0.00, updated_at = NOW()
    WHERE id IN (
      SELECT t.id FROM tours t
      LEFT JOIN tour_landing_page_tours tlpt ON t.id = tlpt.tour_id
      LEFT JOIN tour_landing_pages tlp ON tlpt.landing_page_id = tlp.id
      WHERE LOWER(t.country) IN ('egypt', 'egito', 'egipto')
         OR LOWER(tlp.slug) = 'egypt'
         OR LOWER(t.slug) IN (
           'cairo-express-4d', 'cairo-express-alexandria-5d', 'egito-classico-8d',
           'egito-classico-ii-9d', 'egito-historico-10d', 'cairo-cruzeiro-sharm-11d',
           'grande-ramses-10d', 'tesouros-egipto-9d', 'complete-egypt-8d',
           'classic-program', 'honeymoon-in-egypt', 'journey-of-the-holy-family-10-days',
           'egypt-jordan-combined-14d', 'hurghada-4d3n', 'sharm-4d3n', 'siwa-oasis-alexandria'
         )
    )
    RETURNING id, slug, base_price_usd;
  `;

  const res = await pool.query(updateQuery);
  console.log(`Updated ${res.rows.length} Egypt tours to $0 USD:`);
  res.rows.forEach(r => {
    console.log(` - ${r.slug}: $${r.base_price_usd}`);
  });
}

main().catch(console.error).finally(() => pool.end());
