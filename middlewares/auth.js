const jwt = require('jsonwebtoken');

// Verifies the JWT and attaches { id, email, role, roleTable } to req.user.
// role/roleTable come from the token itself (set at login from auth_index),
// so every downstream check can trust req.user.role without re-querying.
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'token not found' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, roleTable }
    next();
  } catch (err) {
    res.status(403).json({ error: 'token is invalid or expired' });
  }
};

module.exports = verifyToken;
