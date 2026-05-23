const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Helper to construct alias map
async function getAliasMap() {
  const aliasMap = {};
  try {
    const users = await db.query('SELECT username, unique_id FROM users WHERE unique_id IS NOT NULL');
    for (const u of users) {
      const handle = u.username.split('@')[0].toLowerCase();
      const uid = u.unique_id;
      const parts = uid.split('-');
      const sfx = parts[parts.length - 1].toLowerCase();
      if (sfx) aliasMap[sfx] = handle;
      aliasMap[uid.toLowerCase()] = handle;
      aliasMap[u.username.toLowerCase()] = handle;
    }
  } catch (err) {
    console.error('Error building alias map:', err);
  }
  return aliasMap;
}

// GET Squads - matches action=get_squads
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const username = req.user.username;

  try {
    const aliasMap = await getAliasMap();

    // Fetch user details for self checks
    const meRows = await db.query('SELECT unique_id FROM users WHERE id = ?', [userId]);
    const myUniqueId = (meRows[0]?.unique_id || '').toLowerCase();
    const myHandle = username.split('@')[0].toLowerCase();

    // Fetch all squads
    const rawSquads = await db.query(
      'SELECT s.id, s.name, s.creator_id, s.members, u.username as creator FROM squads s JOIN users u ON s.creator_id = u.id'
    );

    const mySquads = [];
    for (const s of rawSquads) {
      let mems = [];
      try {
        mems = typeof s.members === 'string' ? JSON.parse(s.members || '[]') : s.members;
      } catch (err) {
        mems = [];
      }

      let isMember = false;
      for (const m of mems) {
        if (!m || !m.name) continue;
        const mName = m.name.split('@')[0].toLowerCase();
        const mUid = (m.uid || '').toLowerCase();

        if (
          mName === myHandle ||
          (myUniqueId !== '' && mUid === myUniqueId)
        ) {
          isMember = true;
          break;
        }
      }

      if (s.creator_id === userId || isMember) {
        // Rewrite squad member names to user aliases
        const updatedMems = mems.map(m => {
          if (m && m.name) {
            const ml = m.name.split('@')[0].toLowerCase();
            return {
              ...m,
              name: aliasMap[ml] || ml
            };
          }
          return m;
        });
        s.members = updatedMems;
        mySquads.push(s);
      }
    }

    return res.json(mySquads);
  } catch (err) {
    console.error('Error fetching squads:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST Create/Update Squad - matches action=save_squad
router.post('/save', authMiddleware, async (req, res) => {
  const { id, name, members } = req.body;
  const userId = req.user.id;
  const username = req.user.username;

  if (!name || !members) {
    return res.status(400).json({ error: 'Invalid squad parameters.' });
  }

  try {
    // Get active unique ID for member verification checks
    const meRows = await db.query('SELECT unique_id FROM users WHERE id = ?', [userId]);
    const myUniqueId = (meRows[0]?.unique_id || '').toLowerCase();
    const myHandle = username.split('@')[0].toLowerCase();

    const memsJson = JSON.stringify(members);

    let existing = null;
    if (id) {
      const rows = await db.query('SELECT * FROM squads WHERE id = ?', [id]);
      if (rows.length > 0) existing = rows[0];
    } else {
      // Check if squad already exists by Name for this user
      const rows = await db.query('SELECT * FROM squads WHERE name = ? AND creator_id = ?', [name, userId]);
      if (rows.length > 0) existing = rows[0];
    }

    if (existing) {
      // AUTHORIZATION: Only creator OR existing members can update
      let canUpdate = (existing.creator_id === userId);

      if (!canUpdate) {
        let oldMems = [];
        try {
          oldMems = typeof existing.members === 'string' ? JSON.parse(existing.members || '[]') : existing.members;
        } catch (e) {
          oldMems = [];
        }

        for (const om of oldMems) {
          if (!om || !om.name) continue;
          const omLabel = om.name.split('@')[0].toLowerCase();
          const omUid = (om.uid || '').toLowerCase();
          if (omLabel === myHandle || (myUniqueId !== '' && omUid === myUniqueId)) {
            canUpdate = true;
            break;
          }
        }
      }

      if (canUpdate) {
        await db.query('UPDATE squads SET name = ?, members = ? WHERE id = ?', [name, memsJson, existing.id]);
        return res.json({ success: true, updated: existing.id });
      } else {
        return res.status(403).json({ error: 'Unauthorized: Only squad operatives can authorize configuration changes.' });
      }
    } else {
      // INSERT new squad
      const result = await db.query('INSERT INTO squads (name, creator_id, members) VALUES (?, ?, ?)', [
        name,
        userId,
        memsJson
      ]);
      return res.json({ success: true, id: result.insertId });
    }
  } catch (err) {
    console.error('Error saving squad:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST Delete Squad - matches action=delete_squad
router.post('/delete', authMiddleware, async (req, res) => {
  const { id } = req.body;
  const userId = req.user.id;

  if (!id) {
    return res.status(400).json({ error: 'Invalid squad ID' });
  }

  try {
    const result = await db.query('DELETE FROM squads WHERE id = ? AND creator_id = ?', [id, userId]);
    if (result.affectedRows === 0) {
      return res.status(403).json({ error: 'Unauthorized: Only the creator of the squad can decommission it.' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting squad:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
