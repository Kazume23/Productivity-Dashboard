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

  if (!Array.isArray(s.todos)) {
    s.todos = [];
  } else {
    s.todos = s.todos
      .filter((it) => it && typeof it === "object")
      .map((it) => ({
        id: it.id || crypto.randomUUID(),
        dateISO: it.dateISO || s.selectedDate || toISO(startOfDay(new Date())),
        text: String(it.text || "").trim(),
        priority: it.priority || "medium",
        done: !!it.done,
        doneAt: Number(it.doneAt) > 0 ? Number(it.doneAt) : 0,
        createdAt: Number(it.createdAt) || Date.now()
      }))
      .filter((it) => it.text.length > 0);
  }
  if (!Array.isArray(s.expenses)) {
    s.expenses = [];
  } else {
    s.expenses = s.expenses
      .filter((it) => it && typeof it === "object")
      .map((it) => ({
        id: String(it.id || crypto.randomUUID()),
        dateISO: String(it.dateISO || s.selectedDate || toISO(startOfDay(new Date()))),
        amount: Number(it.amount) || 0,
        what: String(it.what || "").trim(),
        category: String(it.category || "Inne").trim() || "Inne",
        score: String(it.score || "B").trim() || "B",
        period: String(it.period || "once").trim() || "once",
        createdAt: Number(it.createdAt) || Date.now()
      }))
      .filter((it) => it.amount > 0 && it.what.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(it.dateISO));
  }

  if (!Array.isArray(s.expBudgets)) {
    s.expBudgets = [];
  } else {
    s.expBudgets = s.expBudgets
      .filter((it) => it && typeof it === "object")
      .map((it) => ({
        id: String(it.id || crypto.randomUUID()),
        category: String(it.category || "Inne").trim() || "Inne",
        limit: Number(it.limit) || 0,
        alertPct: Math.min(100, Math.max(1, Math.round(Number(it.alertPct) || 80))),
        createdAt: Number(it.createdAt) || Date.now()
      }))
      .filter((it) => it.limit > 0);
  }

  if (!Array.isArray(s.expRecurring)) {
    s.expRecurring = [];
  } else {
    s.expRecurring = s.expRecurring
      .filter((it) => it && typeof it === "object")
      .map((it) => {
        const periodRaw = String(it.period || "monthly").trim();
        const period = periodRaw === "weekly" || periodRaw === "yearly" ? periodRaw : "monthly";
        const nextDateRaw = String(it.nextDate || "").trim();
        const nextDate = /^\d{4}-\d{2}-\d{2}$/.test(nextDateRaw)
          ? nextDateRaw
          : toISO(startOfDay(new Date()));

        return {
          id: String(it.id || crypto.randomUUID()),
          name: String(it.name || "").trim(),
          amount: Number(it.amount) || 0,
          category: String(it.category || "Subskrypcje").trim() || "Subskrypcje",
          period,
          nextDate,
          active: it.active !== false,
          createdAt: Number(it.createdAt) || Date.now()
        };
      })
      .filter((it) => it.name.length > 0 && it.amount > 0);
  }

  if (!Array.isArray(s.expSavingsGoals)) {
    s.expSavingsGoals = [];
  } else {
    s.expSavingsGoals = s.expSavingsGoals
      .filter((it) => it && typeof it === "object")
      .map((it) => {
        const deadlineRaw = String(it.deadlineISO || it.deadline || "").trim();
        const deadlineISO = /^\d{4}-\d{2}-\d{2}$/.test(deadlineRaw) ? deadlineRaw : "";

        return {
          id: String(it.id || crypto.randomUUID()),
          name: String(it.name || "").trim(),
          target: Number(it.target) || 0,
          current: Math.max(0, Number(it.current) || 0),
          deadlineISO,
          createdAt: Number(it.createdAt) || Date.now()
        };
      })
      .filter((it) => it.name.length > 0 && it.target > 0);
  }

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
    expBudgets: [],
    expRecurring: [],
    expSavingsGoals: [],
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