-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    unique_id VARCHAR(20) NOT NULL UNIQUE,
    dob_day SMALLINT NOT NULL DEFAULT 1,
    display_name VARCHAR(50) DEFAULT NULL,
    avatar_color VARCHAR(100) DEFAULT '135deg,#9d00ff,#00d2ff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Squads Table
CREATE TABLE IF NOT EXISTS squads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    creator_id INT NOT NULL,
    members TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Default Admin User
INSERT INTO users (username, password, unique_id) 
VALUES ('admin@splitfriendly', '$2a$10$T8Z40x9pC1pT7qH9X6zY3eUeKk7K87XW5Bw6S5R7o2k6qP5t4v9Wy', 'SPT-FLY-S0001')
ON CONFLICT (username) DO NOTHING;
