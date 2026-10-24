const USERS_KEY = 'study-planner-local-users';
export const LOCAL_TOKEN_PREFIX = 'local-study-planner:';
const PASSWORD_ITERATIONS = 120_000;

function createLocalAuthError(code, message) {
  return Object.assign(new Error(message), { code });
}

function readUsers() {
  const stored = globalThis.localStorage.getItem(USERS_KEY);
  if (!stored) return [];
  try {
    const users = JSON.parse(stored);
    if (!Array.isArray(users)) throw new TypeError('Format akun lokal tidak valid.');
    return users;
  } catch (error) {
    throw createLocalAuthError('LOCAL_STORAGE_ERROR', `Akun lokal tidak dapat dibaca: ${error.message}`);
  }
}

function writeUsers(users) {
  globalThis.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function cryptoApi() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw createLocalAuthError('LOCAL_AUTH_UNAVAILABLE', 'Browser ini tidak mendukung penyimpanan akun lokal yang aman.');
  }
  return globalThis.crypto;
}

function randomSalt() {
  const bytes = cryptoApi().getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, salt) {
  const crypto = cryptoApi();
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: new TextEncoder().encode(salt),
    iterations: PASSWORD_ITERATIONS,
    hash: 'SHA-256',
  }, material, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createSession(user) {
  const id = user.id;
  return {
    token: `${LOCAL_TOKEN_PREFIX}${id}`,
    user: { id, name: user.name, email: user.email },
    local: true,
  };
}

export async function registerLocalAccount({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = readUsers();
  const existing = users.find((user) => user.email === normalizedEmail);
  if (existing) {
    if (existing.passwordHash === await hashPassword(password, existing.salt)) return createSession(existing);
    throw createLocalAuthError('EMAIL_EXISTS', 'Email sudah memiliki akun lokal. Silakan login dengan password akun lokal tersebut.');
  }

  const user = {
    id: globalThis.crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    salt: randomSalt(),
  };
  user.passwordHash = await hashPassword(password, user.salt);
  users.push(user);
  writeUsers(users);
  return createSession(user);
}

export async function loginLocalAccount({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = readUsers().find((account) => account.email === normalizedEmail);
  if (!user || user.passwordHash !== await hashPassword(password, user.salt)) {
    throw createLocalAuthError('INVALID_CREDENTIALS', 'Akun lokal tidak ditemukan atau password tidak cocok di browser ini.');
  }
  return createSession(user);
}

export function getLocalUser(token) {
  if (typeof token !== 'string' || !token.startsWith(LOCAL_TOKEN_PREFIX)) return null;
  const id = token.slice(LOCAL_TOKEN_PREFIX.length);
  const user = readUsers().find((account) => account.id === id);
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

export function isLocalToken(token) {
  return typeof token === 'string' && token.startsWith(LOCAL_TOKEN_PREFIX);
}
