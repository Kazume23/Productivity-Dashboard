const LEGACY_KEY = "habit_app_v1";
const LS_ANON_KEY = "habit_app_anon_v1";
const LS_USER_KEY = AUTH_USER ? ("habit_app_user_" + AUTH_USER) : null;
const LS_KEY = AUTH_USER ? LS_USER_KEY : LS_ANON_KEY;

function migrateLegacyState() {
  if (!localStorage.getItem(LS_ANON_KEY) && localStorage.getItem(LEGACY_KEY)) {
    localStorage.setItem(LS_ANON_KEY, localStorage.getItem(LEGACY_KEY));
  }

  if (AUTH_USER && !localStorage.getItem(LS_USER_KEY) && localStorage.getItem(LS_ANON_KEY)) {
    localStorage.setItem(LS_USER_KEY, localStorage.getItem(LS_ANON_KEY));
  }
}

function readLocalState() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(LS_KEY);
    return null;
  }
}

function writeLocalState(value) {
  localStorage.setItem(LS_KEY, JSON.stringify(value));
}

function persistLocal() {
  writeLocalState(state);
}
