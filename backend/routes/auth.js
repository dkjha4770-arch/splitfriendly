const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Register Endpoint
router.post('/register', async (req, res) => {
  let { username, password, confirm_password, dob_day } = req.body;
  
  if (!username || !password || !confirm_password || !dob_day) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  username = username.trim();
  password = password.trim();
  confirm_password = confirm_password.trim();
  dob_day = parseInt(dob_day);

  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return res.status(400).json({ error: 'Invalid username format. Must be 3-30 alphanumeric characters/underscores.' });
  }

  let finalUsername = username;
  if (!finalUsername.endsWith('@splitfriendly')) {
    finalUsername += '@splitfriendly';
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  if (password !== confirm_password) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  if (isNaN(dob_day) || dob_day < 1 || dob_day > 31) {
    return res.status(400).json({ error: 'Birth date day must be between 1 and 31.' });
  }

  try {
    // Check if username is taken
    const usersExist = await db.query('SELECT id FROM users WHERE username = ?', [finalUsername]);
    if (usersExist.length > 0) {
      return res.status(400).json({ error: 'Username already taken.' });
    }

    // Determine serial based on total users + 1
    const totalUsers = await db.query('SELECT COUNT(*) as count FROM users');
    const count = totalUsers[0].count + 1;
    const serial = String(count).padStart(2, '0');
    const dobStr = String(dob_day).padStart(2, '0');
    const uniqueId = `SPT-FLY-S${serial}${dobStr}`;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    await db.query(
      'INSERT INTO users (username, password, unique_id, dob_day) VALUES (?, ?, ?, ?)',
      [finalUsername, hashedPassword, uniqueId, dob_day]
    );

    return res.status(201).json({ success: true, unique_id: uniqueId });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Database error occurred during registration.' });
  }
});

// Login Endpoint
router.post('/login', async (req, res) => {
  let { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  username = username.trim();
  password = password.trim();

  // Handle auto suffixing if not entered
  let finalUsername = username;
  if (!finalUsername.includes('@')) {
    finalUsername += '@splitfriendly';
  }

  try {
    const rows = await db.query('SELECT id, username, password, unique_id, display_name, avatar_color, dob_day FROM users WHERE username = ?', [finalUsername]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    // Sign JWT
    const payload = {
      id: user.id,
      username: user.username,
      unique_id: user.unique_id
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'super_secret_splitfriendly_react_key_2026', {
      expiresIn: '24h'
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        unique_id: user.unique_id,
        display_name: user.display_name,
        avatar_color: user.avatar_color,
        dob_day: user.dob_day
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during authentication.' });
  }
});

// Logout Endpoint
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// Profile - Get
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const rows = await db.query(
      'SELECT username, display_name, avatar_color, unique_id, dob_day FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Issue a fresh token so clients authenticated via cookie can store it
    // for Bearer-based auth (fixes mobile Vercel->Render proxy issue).
    const freshToken = jwt.sign(
      { id: req.user.id, username: rows[0].username, unique_id: rows[0].unique_id },
      process.env.JWT_SECRET || 'super_secret_splitfriendly_react_key_2026',
      { expiresIn: '24h' }
    );

    return res.json({ success: true, user: rows[0], token: freshToken });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Server error fetching profile.' });
  }
});

// Profile - Update
router.post('/profile', authMiddleware, async (req, res) => {
  let { display_name, avatar_color, dob_day, new_password } = req.body;
  const id = req.user.id;

  display_name = (display_name || '').trim();
  avatar_color = (avatar_color || '135deg,#9d00ff,#00d2ff').trim();
  dob_day = parseInt(dob_day || 1);

  if (isNaN(dob_day) || dob_day < 1 || dob_day > 31) {
    dob_day = 1;
  }

  try {
    // Get existing unique_id
    const rows = await db.query('SELECT unique_id FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const existingUid = rows[0].unique_id || '';

    // Extract serial or assign based on index
    let serial;
    const match = existingUid.match(/SPT-FLY-S(\d{2})\d{2}/);
    if (match) {
      serial = match[1];
    } else {
      const countRows = await db.query('SELECT COUNT(*) as count FROM users WHERE id <= ?', [id]);
      serial = String(countRows[0].count).padStart(2, '0');
    }

    const dobStr = String(dob_day).padStart(2, '0');
    const newUid = `SPT-FLY-S${serial}${dobStr}`;

    // Update basic columns
    await db.query(
      'UPDATE users SET display_name = ?, avatar_color = ?, dob_day = ?, unique_id = ? WHERE id = ?',
      [display_name || null, avatar_color, dob_day, newUid, id]
    );

    // Update password if provided
    if (new_password && new_password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(new_password.trim(), salt);
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
    }

    // Generate fresh token with the new unique_id
    const freshToken = jwt.sign(
      { id, username: req.user.username, unique_id: newUid },
      process.env.JWT_SECRET || 'super_secret_splitfriendly_react_key_2026',
      { expiresIn: '24h' }
    );

    // Update cookie
    res.cookie('token', freshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({
      success: true,
      unique_id: newUid,
      display_name: display_name,
      token: freshToken
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Server error updating profile.' });
  }
});

module.exports = router;
