const LEGACY_KEY = "habit_app_v1";
const LS_ANON_KEY = "habit_app_anon_v1";

function getUserStorageKey(username = AUTH_USER) {
  return username ? `habit_app_user_${username}` : null;
}

function getActiveStorageKey() {
  return AUTH_USER ? getUserStorageKey(AUTH_USER) : LS_ANON_KEY;
}

function migrateLegacyState() {
  if (!localStorage.getItem(LS_ANON_KEY) && localStorage.getItem(LEGACY_KEY)) {
    localStorage.setItem(LS_ANON_KEY, localStorage.getItem(LEGACY_KEY));
  }
}

function readStateFromKey(key) {
  if (!key) return null;

  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function writeStateToKey(key, value) {
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function readAnonState() {
  return readStateFromKey(LS_ANON_KEY);
}

function writeAnonState(value) {
  writeStateToKey(LS_ANON_KEY, value);
}

function readUserState(username = AUTH_USER) {
  const key = getUserStorageKey(username);
  return readStateFromKey(key);
}

function writeUserState(value, username = AUTH_USER) {
  const key = getUserStorageKey(username);
  writeStateToKey(key, value);
}

function readLocalState() {
  return readStateFromKey(getActiveStorageKey());
}

function writeLocalState(value) {
  writeStateToKey(getActiveStorageKey(), value);
}

function persistLocal() {
  writeLocalState(state);
}

function importAnonStateToUserStorage(username = AUTH_USER, { overwrite = false } = {}) {
  const userKey = getUserStorageKey(username);
  if (!userKey) return false;

  const anonRaw = localStorage.getItem(LS_ANON_KEY);
  if (!anonRaw) return false;

  if (!overwrite && localStorage.getItem(userKey)) {
    return false;
  }

  localStorage.setItem(userKey, anonRaw);
  return true;
}