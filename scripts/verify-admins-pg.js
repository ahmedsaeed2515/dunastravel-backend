const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_7ySL8IBrJYwN@ep-cool-sea-atufhdxz-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  });

  await client.connect();

  try {
    const res = await client.query(`UPDATE users SET is_verified = true WHERE role IN ('ADMIN', 'SUPER_ADMIN')`);
    console.log(`Updated ${res.rowCount} admin users to be verified.`);
    
    const check = await client.query(`SELECT email, role, is_verified FROM users WHERE role IN ('ADMIN', 'SUPER_ADMIN')`);
    console.log('Current admin users:', check.rows);
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

main();
