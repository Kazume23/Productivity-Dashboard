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

  if (!s.habitGoals || typeof s.habitGoals !== "object" || Array.isArray(s.habitGoals)) {
    s.habitGoals = {};
  }

  s.habitGoals = {
    weekTarget: Math.min(200, Math.max(1, Math.round(Number(s.habitGoals.weekTarget) || 12))),
    monthTarget: Math.min(1000, Math.max(1, Math.round(Number(s.habitGoals.monthTarget) || 48)))
  };

  if (!s.habitFreeze || typeof s.habitFreeze !== "object" || Array.isArray(s.habitFreeze)) {
    s.habitFreeze = {};
  }

  if (!s.habitFreeze.used || typeof s.habitFreeze.used !== "object" || Array.isArray(s.habitFreeze.used)) {
    s.habitFreeze.used = {};
  }

  const freezeUsed = {};
  for (const [key, rawVal] of Object.entries(s.habitFreeze.used)) {
    if (!key.includes("|")) continue;
    if (!rawVal) continue;
    freezeUsed[key] = true;
  }

  s.habitFreeze = {
    monthlyLimit: Math.min(10, Math.max(1, Math.round(Number(s.habitFreeze.monthlyLimit) || 2))),
    used: freezeUsed
  };

  if (!s.reminders || typeof s.reminders !== "object" || Array.isArray(s.reminders)) {
    s.reminders = {};
  }

  const remindersRaw = s.reminders;

  const normalizeHour = (n, fallback) => {
    const value = Math.round(Number(n));
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.min(23, value));
  };

  let startHour = normalizeHour(remindersRaw.startHour, 9);
  let endHour = normalizeHour(remindersRaw.endHour, 20);
  if (endHour < startHour) {
    const temp = startHour;
    startHour = endHour;
    endHour = temp;
  }

  const lastSentAtByKey = {};
  if (remindersRaw.lastSentAtByKey && typeof remindersRaw.lastSentAtByKey === "object" && !Array.isArray(remindersRaw.lastSentAtByKey)) {
    for (const [key, rawVal] of Object.entries(remindersRaw.lastSentAtByKey)) {
      const ts = Number(rawVal);
      if (!Number.isFinite(ts) || ts <= 0) continue;
      lastSentAtByKey[String(key)] = ts;
    }
  }

  const sentCountByDate = {};
  if (remindersRaw.sentCountByDate && typeof remindersRaw.sentCountByDate === "object" && !Array.isArray(remindersRaw.sentCountByDate)) {
    for (const [key, rawVal] of Object.entries(remindersRaw.sentCountByDate)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key))) continue;
      const count = Math.max(0, Math.round(Number(rawVal) || 0));
      if (count <= 0) continue;
      sentCountByDate[String(key)] = count;
    }
  }

  const permissionRaw = String(remindersRaw.permission || "default").trim();
  const permission = permissionRaw === "granted" || permissionRaw === "denied"
    ? permissionRaw
    : "default";

  s.reminders = {
    enabled: !!remindersRaw.enabled,
    startHour,
    endHour,
    dailyLimit: Math.min(20, Math.max(1, Math.round(Number(remindersRaw.dailyLimit) || 2))),
    cooldownMin: Math.min(1440, Math.max(15, Math.round(Number(remindersRaw.cooldownMin) || 240))),
    permission,
    lastSentAtByKey,
    sentCountByDate,
    lastFallbackAt: Number(remindersRaw.lastFallbackAt) > 0 ? Number(remindersRaw.lastFallbackAt) : 0
  };

    s.todos = [];
  } else {
    s.todos = s.todos
      .filter((it) => it && typeof it === "object")
      .map((it) => {
        const priorityRaw = String(it.priority || "medium").trim();
        const priority = priorityRaw === "high" || priorityRaw === "low"
          ? priorityRaw
          : "medium";

        const recurrenceRaw = String(it.recurrence || "none").trim();
        const recurrence = recurrenceRaw === "daily" || recurrenceRaw === "weekly" || recurrenceRaw === "monthly"
          ? recurrenceRaw
          : "none";

        const laneRaw = String(it.lane || "backlog").trim();
        let lane = laneRaw === "progress" || laneRaw === "blocked" || laneRaw === "done"
          ? laneRaw
          : "backlog";

        const lastLaneRaw = String(it.lastLaneBeforeDone || "backlog").trim();
        const lastLaneBeforeDone = lastLaneRaw === "progress" || lastLaneRaw === "blocked"
          ? lastLaneRaw
          : "backlog";

        const done = !!it.done || lane === "done";
        if (done) lane = "done";

        const subtasks = Array.isArray(it.subtasks)
          ? it.subtasks
            .filter((sub) => sub && typeof sub === "object")
            .map((sub) => ({
              id: String(sub.id || crypto.randomUUID()),
              text: String(sub.text || "").trim(),
              done: !!sub.done,
              createdAt: Number(sub.createdAt) || Date.now()
            }))
            .filter((sub) => sub.text.length > 0)
          : [];

        const id = String(it.id || crypto.randomUUID());
        const recurrenceSeriesId = recurrence === "none"
          ? ""
          : String(it.recurrenceSeriesId || it.seriesId || id);

        return {
          id,
          dateISO: String(it.dateISO || s.selectedDate || toISO(startOfDay(new Date()))),
          text: String(it.text || "").trim(),
          priority,
          done,
          doneAt: done && Number(it.doneAt) > 0 ? Number(it.doneAt) : 0,
          createdAt: Number(it.createdAt) || Date.now(),
          recurrence,
          recurrenceSeriesId,
          lane,
          lastLaneBeforeDone,
          subtasks
        };
      })
      .filter((it) => it.text.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(it.dateISO));
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
    habitGoals: {
      weekTarget: 12,
      monthTarget: 48
    },
    habitFreeze: {
      monthlyLimit: 2,
      used: {}
    },
    reminders: {
      enabled: false,
      startHour: 9,
      endHour: 20,
      dailyLimit: 2,
      cooldownMin: 240,
      permission: "default",
      lastSentAtByKey: {},
      sentCountByDate: {},
      lastFallbackAt: 0
    },
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