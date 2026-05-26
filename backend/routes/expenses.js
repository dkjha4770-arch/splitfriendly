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

// Reusable function to process expense aliases
function processExpenseAliases(exp, aliasMap) {
  let decodedMems = [];
  try {
    decodedMems = typeof exp.members === 'string' ? JSON.parse(exp.members || '[]') : exp.members;
  } catch (err) {
    decodedMems = exp.members || [];
  }

  if (decodedMems && typeof decodedMems === 'object' && !Array.isArray(decodedMems)) {
    const newMems = {};
    for (const [k, v] of Object.entries(decodedMems)) {
      const kl = k.toLowerCase();
      const resolvedKey = aliasMap[kl] || k.split('@')[0].toLowerCase();
      newMems[resolvedKey] = v;
    }
    exp.members = newMems;
  } else if (Array.isArray(decodedMems)) {
    exp.members = decodedMems.map(mstr => {
      if (typeof mstr === 'string') {
        const ml = mstr.toLowerCase();
        return aliasMap[ml] || mstr.split('@')[0].toLowerCase();
      }
      return mstr;
    });
  } else {
    exp.members = decodedMems || [];
  }

  const payerLower = (exp.payer || '').toLowerCase();
  exp.payer = aliasMap[payerLower] || (exp.payer || '').split('@')[0].toLowerCase();
  exp.amount = parseFloat(exp.amount || 0);
  exp.share = parseFloat(exp.share || 0);
  return exp;
}

// GET Combined Data (expenses & user-relevant squads) - matches action=get_data
router.get('/data', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const username = req.user.username;

  try {
    const aliasMap = await getAliasMap();

    // Fetch user details for self checks
    const meRows = await db.query('SELECT unique_id FROM users WHERE id = ?', [userId]);
    const myUniqueId = (meRows[0]?.unique_id || '').toLowerCase();
    const myHandle = username.split('@')[0].toLowerCase();

    // Fetch expenses
    const rawExpenses = await db.query(
      'SELECT id, date, amount, payer, share, where_spent, category, payment_app, members, squad_name FROM expenses ORDER BY date DESC, id DESC'
    );
    const expenses = rawExpenses.map(exp => processExpenseAliases(exp, aliasMap));

    // Fetch all users to construct an avatar and displayName mapping
    const allUsers = await db.query('SELECT username, display_name, avatar_color, unique_id FROM users');
    const userMap = {};
    const userProfiles = allUsers.map(u => {
      const handle = u.username.split('@')[0].toLowerCase();
      const info = {
        displayName: u.display_name || handle,
        avatarColor: u.avatar_color,
        uid: u.unique_id
      };
      userMap[handle] = info;
      if (u.unique_id) {
        userMap[u.unique_id.toLowerCase()] = info;
      }
      return {
        username: handle,
        display_name: u.display_name,
        avatar_color: u.avatar_color,
        unique_id: u.unique_id
      };
    });

    // Fetch squads
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
          (myUniqueId !== '' && mUid.includes(myUniqueId)) ||
          (myUniqueId !== '' && myUniqueId.includes(mUid))
        ) {
          isMember = true;
          break;
        }
      }

      if (s.creator_id === userId || isMember) {
        // Rewrite squad member names to user aliases and inject profile info
        const updatedMems = mems.map(m => {
          if (m && m.name) {
            const ml = m.name.split('@')[0].toLowerCase();
            const mappedUser = userMap[ml] || {};
            return {
              ...m,
              name: aliasMap[ml] || ml,
              display_name: mappedUser.displayName || m.display_name || ml,
              avatar_color: mappedUser.avatarColor || m.avatar_color || '135deg,#9d00ff,#00d2ff'
            };
          }
          return m;
        });
        s.members = updatedMems;
        mySquads.push(s);
      }
    }

    return res.json({ expenses, squads: mySquads, users: userProfiles });
  } catch (err) {
    console.error('Error fetching data:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET Expenses - matches action=get_expenses
router.get('/', authMiddleware, async (req, res) => {
  try {
    const aliasMap = await getAliasMap();
    const rawExpenses = await db.query(
      'SELECT id, date, amount, payer, share, where_spent, category, payment_app, members, squad_name FROM expenses ORDER BY date DESC, id DESC'
    );
    const expenses = rawExpenses.map(exp => processExpenseAliases(exp, aliasMap));
    return res.json(expenses);
  } catch (err) {
    console.error('Error fetching expenses:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST Add Expense - matches action=add_expense
router.post('/', authMiddleware, async (req, res) => {
  const { date, amount, payer, share, where, category, app, members, squad_name } = req.body;
  const userId = req.user.id;

  if (!date || amount === undefined || !payer || share === undefined || !where || !app || !members) {
    return res.status(400).json({ error: 'Missing required tactical parameters.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO expenses (user_id, date, amount, payer, share, where_spent, category, payment_app, members, squad_name) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        date,
        amount,
        payer,
        share,
        where,
        category || 'other',
        app,
        JSON.stringify(members),
        squad_name || null
      ]
    );

    return res.status(201).json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('Error saving expense:', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST Delete Expense - matches action=delete_expense
router.post('/delete', authMiddleware, async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Invalid expense ID' });
  }

  try {
    if (req.user.isAdmin) {
      await db.query('DELETE FROM expenses WHERE id = ?', [id]);
    } else {
      const result = await db.query('DELETE FROM expenses WHERE id = ? AND user_id = ?', [id, req.user.id]);
      if (result.affectedRows === 0) {
        return res.status(403).json({ error: 'Unauthorized to delete this tactical entry.' });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting expense:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET CSV Export - matches action=export_csv
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const rawExpenses = await db.query(
      'SELECT date, where_spent, category, payer, amount, share, payment_app, members FROM expenses ORDER BY date DESC'
    );

    // Build CSV contents
    const headers = ['Date', 'Description', 'Category', 'Payer', 'Amount', 'Your Share', 'App', 'Group Members'];
    
    // Helper to format/escape CSV cell values
    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        str = str.replace(/"/g, '""');
        return `"${str}"`;
      }
      return str;
    };

    const rows = [headers.join(',')];
    for (const exp of rawExpenses) {
      let membersStr = '';
      try {
        const mems = typeof exp.members === 'string' ? JSON.parse(exp.members || '[]') : exp.members;
        if (Array.isArray(mems)) {
          membersStr = mems.join(', ');
        } else if (mems && typeof mems === 'object') {
          membersStr = Object.keys(mems).join(', ');
        }
      } catch (e) {
        membersStr = String(exp.members || '');
      }

      const row = [
        escapeCsv(exp.date),
        escapeCsv(exp.where_spent),
        escapeCsv(exp.category),
        escapeCsv(exp.payer),
        escapeCsv(exp.amount),
        escapeCsv(exp.share),
        escapeCsv(exp.payment_app),
        escapeCsv(membersStr)
      ];
      rows.push(row.join(','));
    }

    const csvContent = rows.join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="split_friendly_report.csv"');
    return res.send(csvContent);
  } catch (err) {
    console.error('CSV Export error:', err);
    return res.status(500).json({ error: 'Server error generating CSV.' });
  }
});

module.exports = router;
