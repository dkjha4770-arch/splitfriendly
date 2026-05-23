const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("\n==================================================");
  console.error("❌ ERROR: DATABASE_URL environment variable is missing.");
  console.error("Please add DATABASE_URL=your_neon_connection_string to backend/.env");
  console.error("==================================================\n");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function setup() {
  console.log('Connecting to Neon PostgreSQL...');
  await client.connect();

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    console.log(`Reading schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Building tables and executing schema statements...');
    // We execute the statements in one go
    await client.query(schemaSql);
    console.log('✓ Executed schema SQL successfully.');

    console.log('==================================================');
    console.log('✓ NEON DB SETUP SUCCESSFUL: Tables created/verified.');
    console.log('==================================================');
  } catch (err) {
    console.error('❌ Neon setup failed:', err.message);
  } finally {
    await client.end();
  }
}

setup();
