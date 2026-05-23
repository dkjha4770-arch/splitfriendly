const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function provision() {
  console.log('Provisioning administrative account `Deepak@splitfriendly`...');
  
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: 'Deepak@07',
    database: 'if0_41538343_sptfly'
  });

  try {
    const username = 'Deepak@splitfriendly';
    const password = 'Deepak@07';
    const displayName = 'Deepak';
    const uniqueId = 'SPT-FLY-ADMIN-07';

    // Hash password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Check if user exists
    const [rows] = await connection.query('SELECT id FROM users WHERE username = ?', [username]);
    if (rows.length > 0) {
      console.log(`User ${username} already exists.`);
      return;
    }

    // Insert user
    await connection.query(
      'INSERT INTO users (username, password, display_name, unique_id, dob_day) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, displayName, uniqueId, 7]
    );

    console.log('==================================================');
    console.log('✓ ADMIN PROVISIONED SUCCESSFULLY');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log(`Unique ID: ${uniqueId}`);
    console.log('==================================================');
  } catch (err) {
    console.error('❌ Provisioning failed:', err.message);
  } finally {
    await connection.end();
  }
}

provision();
