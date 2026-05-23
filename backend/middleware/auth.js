const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // Read token from cookie or Authorization header
  let token = req.cookies?.token || '';

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_splitfriendly_react_key_2026');
    req.user = decoded;

    // Check if the user is an admin based on PHP rules
    const usernamePart = (req.user.username || '').split('@')[0].toLowerCase();
    req.user.isAdmin = (usernamePart === 'deepak' || usernamePart === 'admin');

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}

module.exports = authMiddleware;
