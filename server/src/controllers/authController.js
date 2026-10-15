const userModel = require('../models/userModel');
const { hashPassword, checkPassword, createToken, readToken } = require('../services/auth');
const { validateSignUp, validateSignIn } = require('../services/authValidation');
const { COOKIE_NAME, TOKEN_DAYS } = require('../config/auth');

const UNIQUE_VIOLATION = '23505'; // PostgreSQL error code

// httpOnly: JavaScript in the page cannot read the token, so a script injected into the page
// cannot steal it. sameSite 'lax': other sites cannot send it along with their own forms.
// secure: only sent over HTTPS on the live site.
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

function signIn(res, user) {
  res.cookie(COOKIE_NAME, createToken(user), { ...cookieOptions(), maxAge: TOKEN_DAYS * 24 * 60 * 60 * 1000 });
}

function sendFieldErrors(res, status, errors) {
  return res.status(status).json({ error: { message: 'Some fields are not valid', fields: errors } });
}

// POST /api/auth/register { username, email, password }: creates the account and signs in
async function register(req, res) {
  const { value, errors } = validateSignUp(req.body);
  if (errors) return sendFieldErrors(res, 400, errors);

  let user;
  try {
    user = await userModel.create({
      username: value.username,
      email: value.email,
      passwordHash: await hashPassword(value.password),
    });
  } catch (err) {
    if (err.code !== UNIQUE_VIOLATION) throw err;
    // The unique indexes in schema.sql tell which field is taken
    const field = err.constraint === 'users_email_unique' ? 'email' : 'username';
    return sendFieldErrors(res, 409, { [field]: 'is already used' });
  }

  signIn(res, user);
  res.status(201).json({ data: user });
}

// POST /api/auth/login { login, password }: login is a username or an email.
// One message for every wrong sign-in, so it does not reveal which usernames exist.
async function login(req, res) {
  const { value, errors } = validateSignIn(req.body);
  if (errors) return sendFieldErrors(res, 400, errors);

  const found = await userModel.findForSignIn(value.login);
  const passwordOk = await checkPassword(value.password, found?.password_hash);
  if (!found || !passwordOk) {
    return res.status(401).json({ error: { message: 'Wrong username/email or password' } });
  }

  // Only the public fields go back to the browser, never password_hash
  const user = { id: found.id, username: found.username, email: found.email, role: found.role };
  signIn(res, user);
  res.json({ data: user });
}

// POST /api/auth/logout
function logout(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ data: { signed_out: true } });
}

// GET /api/auth/me: the signed-in user, or null for a guest
async function me(req, res) {
  const userId = readToken(req.cookies?.[COOKIE_NAME]);
  const user = userId ? await userModel.findById(userId) : null;
  res.json({ data: user });
}

module.exports = { register, login, logout, me };
