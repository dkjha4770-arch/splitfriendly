const { Pool } = require('pg');
require('dotenv').config();

// Neon connection string will be provided via process.env.DATABASE_URL
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon secure connection
  }
};

let pool;

try {
  pool = new Pool(dbConfig);
  // Test connection
  pool.connect()
    .then((client) => {
      console.log(`\n==================================================`);
      console.log(`✓ DB SUCCESS: Connected to Neon PostgreSQL database`);
      console.log(`==================================================\n`);
      client.release();
    })
    .catch((err) => {
      console.error(`\n==================================================`);
      console.error(`❌ DB FAILURE: Could not connect to Neon PostgreSQL server: ${err.message}`);
      console.error(`Please check your DATABASE_URL environment variable.`);
      console.error(`==================================================\n`);
    });
} catch (err) {
  console.error('Error creating database pool:', err.message);
}

// Helper query function to emulate MySQL query behavior
async function query(sql, params = []) {
  // Translate MySQL '?' placeholders to PostgreSQL '$1', '$2', ... placeholders
  let index = 1;
  let pgSql = sql.replace(/\?/g, () => `$${index++}`);

  const trimmedSql = pgSql.trim().toUpperCase();
  const isInsert = trimmedSql.startsWith('INSERT');
  const isDelete = trimmedSql.startsWith('DELETE');
  const isUpdate = trimmedSql.startsWith('UPDATE');

  // Append RETURNING id to INSERT queries to get the inserted row ID
  if (isInsert && !trimmedSql.includes('RETURNING')) {
    pgSql += ' RETURNING id';
  }

  const client = await pool.connect();
  try {
    const res = await client.query(pgSql, params);

    if (isInsert) {
      return {
        insertId: res.rows[0] ? res.rows[0].id : null,
        affectedRows: res.rowCount
      };
    }

    if (isDelete || isUpdate) {
      return {
        affectedRows: res.rowCount
      };
    }

    // For SELECT queries, return rows array directly
    return res.rows;
  } catch (err) {
    console.error(`Database Query Error: ${err.message}. SQL: ${sql}`);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query
};
