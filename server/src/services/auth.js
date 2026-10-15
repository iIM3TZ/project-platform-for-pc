const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { TOKEN_DAYS, BCRYPT_ROUNDS, jwtSecret } = require('../config/auth');

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// A hash of a password nobody has, used when the username does not exist, so a wrong username
// takes as long as a wrong password and the timing does not reveal which usernames exist
let dummyHash = null;

async function checkPassword(password, hash) {
  if (!hash) {
    dummyHash ??= await bcrypt.hash('no-such-user-password', BCRYPT_ROUNDS);
    await bcrypt.compare(password, dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}

// The token only holds the user id (`sub`). The role is read from the database on each check,
// so removing someone's admin role takes effect at once.
function createToken(user) {
  return jwt.sign({ sub: String(user.id) }, jwtSecret(), { expiresIn: `${TOKEN_DAYS}d` });
}

// Returns the user id, or null for a missing, expired or forged token
function readToken(token) {
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, jwtSecret());
    const id = Number(sub);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') return null;
    throw err; // e.g. JWT_SECRET is missing: a server problem, not the user's
  }
}

module.exports = { hashPassword, checkPassword, createToken, readToken };
