// Sign-in settings. The secret that signs the JWT comes from .env (JWT_SECRET) and is never
// committed. It is read when it is first needed, so the rest of the site still runs without it.

const COOKIE_NAME = 'token';
const TOKEN_DAYS = 7;
const BCRYPT_ROUNDS = 10; // bcrypt work factor: higher is slower to guess, and slower to sign in

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is missing or shorter than 32 characters in .env (see .env.example)');
  }
  return secret;
}

module.exports = { COOKIE_NAME, TOKEN_DAYS, BCRYPT_ROUNDS, jwtSecret };
