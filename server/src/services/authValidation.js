// Checks the sign-up and sign-in forms. Returns { value } with clean values, or { errors } by field.

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/; // the same rule as the users table
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores anything after 72 bytes

const text = (value) => (typeof value === 'string' ? value.trim() : '');

function validateSignUp(input = {}) {
  const username = text(input.username);
  const email = text(input.email).toLowerCase();
  const password = typeof input.password === 'string' ? input.password : '';
  const errors = {};

  if (!USERNAME_PATTERN.test(username)) {
    errors.username = 'must be 3 to 20 English letters, numbers or _';
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'must be a valid email';
  }
  if (password.length < MIN_PASSWORD) {
    errors.password = `must be at least ${MIN_PASSWORD} characters`;
  } else if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    errors.password = 'is too long';
  }

  return Object.keys(errors).length > 0 ? { errors } : { value: { username, email, password } };
}

// `login` is a username or an email
function validateSignIn(input = {}) {
  const login = text(input.login);
  const password = typeof input.password === 'string' ? input.password : '';
  const errors = {};

  if (!login || login.length > 254) errors.login = 'is required';
  if (!password || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) errors.password = 'is required';

  return Object.keys(errors).length > 0 ? { errors } : { value: { login, password } };
}

module.exports = { validateSignUp, validateSignIn };
