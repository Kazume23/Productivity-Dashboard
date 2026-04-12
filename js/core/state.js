let state;

function ensureMeta() {
  if (!state._meta) state._meta = {};
  state._meta.user = AUTH_USER ? AUTH_USER : "anon";

  if (typeof state._meta.updatedAtMs !== "number") {
    state._meta.updatedAtMs = 0;
  }

  if (typeof state._meta.version !== "number" || state._meta.version < 0) {
    state._meta.version = 0;
  }
}

function touchMeta() {
  ensureMeta();
  state._meta.updatedAtMs = Date.now();
}

function sanitizeState(s) {
  if (!Array.isArray(s.habits)) s.habits = [];

  if (!s.entries || typeof s.entries !== "object" || Array.isArray(s.entries)) {
    s.entries = {};
  }

  const normalizedEntries = {};
  for (const [key, rawVal] of Object.entries(s.entries)) {
    if (!key.includes("|")) continue;

    const v = Number(rawVal);
    if (v === 1 || v === -1) {
      normalizedEntries[key] = v;
    }
  }
  s.entries = normalizedEntries;

  if (!Array.isArray(s.todos)) s.todos = [];
  if (!Array.isArray(s.expenses)) s.expenses = [];
  if (!Array.isArray(s.wishlist)) s.wishlist = [];
  if (!s.selectedDate) s.selectedDate = toISO(startOfDay(new Date()));

  if (typeof s.viewMonth !== "number") {
    s.viewMonth = new Date().getMonth();
  }

  if (typeof s.viewYear !== "number") {
    s.viewYear = new Date().getFullYear();
  }

  if (!s.chartMode || (s.chartMode !== "week" && s.chartMode !== "month")) {
    s.chartMode = "week";
  }

  if (s.expFilterCategory === undefined) {
    s.expFilterCategory = "";
  }

  if (!s.wishSortMode) {
    s.wishSortMode = "date-desc";
  }

  return s;
}

function getDefaultState() {
  const today = startOfDay(new Date());

  return {
    habits: [
      { id: crypto.randomUUID(), name: "Wstać o 6:00" },
      { id: crypto.randomUUID(), name: "Trening" },
      { id: crypto.randomUUID(), name: "Czytanie" }
    ],
    entries: {},
    todos: [],
    expenses: [],
    wishlist: [],
    selectedDate: toISO(today),
    viewMonth: today.getMonth(),
    viewYear: today.getFullYear(),
    chartMode: "week",
    wishSortMode: "date-desc",
    expFilterCategory: ""
  };
}

function loadState() {
  migrateLegacyState();

  const raw = readLocalState();

  if (!raw) {
    return getDefaultState();
  }

  return sanitizeState(raw);
}

function saveState(opts = {}) {
  const sync =
    opts && typeof opts.sync === "boolean"
      ? opts.sync
      : true;

  touchMeta();
  writeLocalState(state);

  if (sync && typeof queueServerSync === "function") {
    queueServerSync("saveState");
  }
}

const initialRawState = readLocalState();

state = loadState();

const hadMetaUser = state?._meta?.user ?? null;
const hadMetaUpdatedAtMs = state?._meta?.updatedAtMs ?? 0;

ensureMeta();

const shouldSeedAnonymousStorage = !AUTH_USER && !initialRawState;

const shouldPersistMetaImmediately =
  !AUTH_USER &&
  (
    hadMetaUser !== state._meta.user ||
    typeof hadMetaUpdatedAtMs !== "number" ||
    hadMetaUpdatedAtMs <= 0
  );

if (shouldSeedAnonymousStorage || shouldPersistMetaImmediately) {
  if (state._meta.updatedAtMs <= 0) {
    state._meta.updatedAtMs = Date.now();
  }

  persistLocal();
}