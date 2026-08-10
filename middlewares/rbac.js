// Role-Based Access Control.
// Must run AFTER verifyToken, since it reads req.user.role.
//
// Usage:
//   router.get('/ceo-only', verifyToken, requireRole('ceo'), controller.fn);
//   router.get('/managers-and-qa', verifyToken, requireRole('team_manager', 'qa'), controller.fn);
//
// Any role not explicitly listed is rejected — this is a default-deny
// allowlist, not a denylist, so a new endpoint is locked down unless
// someone deliberately opens it up.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role privileges' });
    }
    next();
  };
}

module.exports = { requireRole };
