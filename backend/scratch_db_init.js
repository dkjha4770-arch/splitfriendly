const mysql = require('mysql2/promise');

const queries = [
  `CREATE TABLE IF NOT EXISTS users (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      unique_id VARCHAR(20) NOT NULL UNIQUE,
      dob_day TINYINT NOT NULL DEFAULT 1,
      display_name VARCHAR(50) DEFAULT NULL,
      avatar_color VARCHAR(100) DEFAULT '135deg,#9d00ff,#00d2ff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`,
  
  `CREATE TABLE IF NOT EXISTS expenses (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      date DATE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payer VARCHAR(50) NOT NULL,
      share DECIMAL(10,2) NOT NULL,
      where_spent VARCHAR(255) NOT NULL,
      category VARCHAR(50) DEFAULT 'other',
      payment_app VARCHAR(50) NOT NULL,
      members TEXT NOT NULL,
      squad_name VARCHAR(255) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;`,
  
  `CREATE TABLE IF NOT EXISTS squads (
      id INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      creator_id INT NOT NULL,
      members TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;`,
  
  `INSERT IGNORE INTO users (username, password, unique_id) VALUES ('Deepak@splitfriendly', '$2a$10$Odw3DJeCOWLJYdUo6PN11Opgrk7GUpA.0PaUpk4Zv6HWdYia.9G.y', 'SPT-FLY-S0001');`
];

async function setup() {
  console.log('Connecting to local MySQL on 127.0.0.1:3307...');
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: 'Deepak@07'
  });

  try {
    console.log('Ensuring database exists...');
    await connection.query('CREATE DATABASE IF NOT EXISTS `if0_41538343_sptfly` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    await connection.query('USE `if0_41538343_sptfly`;');

    console.log('Cleaning up existing tables for clean schema build...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('DROP TABLE IF EXISTS `squads`;');
    await connection.query('DROP TABLE IF EXISTS `expenses`;');
    await connection.query('DROP TABLE IF EXISTS `users`;');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('Building tables...');
    for (const sql of queries) {
      await connection.query(sql);
      console.log('✓ Executed query successfully.');
    }

    console.log('==================================================');
    console.log('✓ DB SETUP SUCCESSFUL: Database & schemas verified.');
    console.log('==================================================');
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
  } finally {
    await connection.end();
  }
}

setup();
