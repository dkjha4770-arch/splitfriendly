const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Helper to check if requester is administrator
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Security protocol breach: Administrative clearance required.' });
  }
  next();
}

// GET User List (Authorized for logged-in users) - matches action=get_users
router.get('/', authMiddleware, async (req, res) => {
  try {
    const rawUsers = await db.query(
      'SELECT id, username, unique_id, display_name FROM users ORDER BY username ASC'
    );

    const users = rawUsers.map(u => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      name: u.username.split('@')[0].toLowerCase(),
      uid: u.unique_id || 'SPT-FLY-000'
    }));

    return res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST Admin Decommission User - matches action=delete_user
router.post('/delete', authMiddleware, requireAdmin, async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'No operative specified for decommissioning.' });
  }

  // Prevent self-deletion
  if (parseInt(user_id) === req.user.id) {
    return res.status(400).json({ error: 'Operation Denied: The Command Administrator cannot be decommissioned via standard protocols.' });
  }

  try {
    await db.query('DELETE FROM users WHERE id = ?', [user_id]);
    return res.json({ success: true, id: user_id });
  } catch (err) {
    console.error('Error deleting user:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST Admin Reset Password - matches action=admin_reset_password
router.post('/reset-password', authMiddleware, requireAdmin, async (req, res) => {
  const { user_id, new_password } = req.body;

  if (!user_id || !new_password) {
    return res.status(400).json({ error: 'Incomplete tactical parameters.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password.trim(), salt);

    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user_id]);
    return res.json({ success: true, id: user_id });
  } catch (err) {
    console.error('Error resetting user password:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
