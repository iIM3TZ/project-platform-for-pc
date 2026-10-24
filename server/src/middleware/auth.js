const userModel = require('../models/userModel');
const { readToken } = require('../services/auth');
const { COOKIE_NAME } = require('../config/auth');

// The signed-in user from the cookie, read fresh from the database (so a removed admin role
// or a deleted account takes effect at once), or null for a guest
async function currentUser(req) {
  const userId = readToken(req.cookies?.[COOKIE_NAME]);
  return userId ? userModel.findById(userId) : null;
}

// API routes for signed-in users: 401 for guests. Puts the user in req.user.
async function requireAuth(req, res, next) {
  const user = await currentUser(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Please sign in' } });
  }
  req.user = user;
  next();
}

// API routes for admins only: 401 for guests, 403 for signed-in users who are not admins.
// This is the real protection; hiding the Admin link in the menu is not.
async function requireAdmin(req, res, next) {
  const user = await currentUser(req);
  if (!user) {
    return res.status(401).json({ error: { message: 'Please sign in' } });
  }
  if (user.role !== 'admin') {
    return res.status(403).json({ error: { message: 'Admins only' } });
  }
  req.user = user;
  next();
}

module.exports = { currentUser, requireAuth, requireAdmin };
