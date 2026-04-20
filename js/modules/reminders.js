let remindersTimerId = null;
let remindersEventsBound = false;

function ensureReminderConfig() {
  if (!state || typeof state !== "object") return false;

  if (!state.reminders || typeof state.reminders !== "object" || Array.isArray(state.reminders)) {
    state.reminders = {
      enabled: false,
      startHour: 9,
      endHour: 20,
      dailyLimit: 2,
      cooldownMin: 240,
      permission: "default",
      lastSentAtByKey: {},
      sentCountByDate: {},
      lastFallbackAt: 0
    };
  }

  if (!state.reminders.lastSentAtByKey || typeof state.reminders.lastSentAtByKey !== "object" || Array.isArray(state.reminders.lastSentAtByKey)) {
    state.reminders.lastSentAtByKey = {};
  }

  if (!state.reminders.sentCountByDate || typeof state.reminders.sentCountByDate !== "object" || Array.isArray(state.reminders.sentCountByDate)) {
    state.reminders.sentCountByDate = {};
  }

  return true;
}

function getReminderPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  const p = String(Notification.permission || "default");
  if (p === "granted" || p === "denied") return p;
  return "default";
}

function pruneReminderMaps(todayISO) {
  if (!ensureReminderConfig()) return;

  for (const [iso, count] of Object.entries(state.reminders.sentCountByDate)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      delete state.reminders.sentCountByDate[iso];
      continue;
    }

    if (count <= 0 || iso < toISO(addDays(fromISO(todayISO), -45))) {
      delete state.reminders.sentCountByDate[iso];
    }
  }

  const staleThreshold = Date.now() - 45 * 24 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(state.reminders.lastSentAtByKey)) {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0 || n < staleThreshold) {
      delete state.reminders.lastSentAtByKey[key];
    }
  }
}

function reminderWithinHours(now, cfg) {
  const hour = now.getHours();
  const start = Math.max(0, Math.min(23, Math.round(Number(cfg.startHour) || 9)));
  const end = Math.max(0, Math.min(23, Math.round(Number(cfg.endHour) || 20)));

  if (end >= start) {
    return hour >= start && hour <= end;
  }

  return hour >= start || hour <= end;
}

function reminderDailyCount(todayISO) {
  if (!ensureReminderConfig()) return 0;
  return Math.max(0, Math.round(Number(state.reminders.sentCountByDate[todayISO]) || 0));
}

function markReminderSent(reminderKey, todayISO, nowMs) {
  if (!ensureReminderConfig()) return;

  state.reminders.lastSentAtByKey[reminderKey] = nowMs;
  state.reminders.sentCountByDate[todayISO] = reminderDailyCount(todayISO) + 1;
}

function canNotifyByCooldown(reminderKey, cooldownMs, nowMs) {
  const last = Number(state.reminders.lastSentAtByKey[reminderKey] || 0);
  if (!Number.isFinite(last) || last <= 0) return true;
  return (nowMs - last) >= cooldownMs;
}

function buildTodoReminderCandidates(todayISO) {
  const out = [];
  const todos = Array.isArray(state.todos) ? state.todos : [];

  for (const todo of todos) {
    if (!todo || typeof todo !== "object") continue;
    if (todo.done) continue;

    const dateISO = String(todo.dateISO || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) continue;
    if (dateISO > todayISO) continue;

    let severity = dateISO < todayISO ? 3 : 2;
    if (typeof getTodoSlaInfo === "function") {
      const sla = getTodoSlaInfo(todo);
      if (sla.status === "overdue") severity = 3;
      else if (sla.status === "risk") severity = Math.max(severity, 2);
    }

    const text = String(todo.text || "Zadanie").trim();

    out.push({
      type: "todo",
      key: `todo:${todo.id}`,
      severity,
      orderDate: dateISO,
      title: severity >= 3 ? "Edward: zalegle ToDo" : "Edward: ToDo na dzis",
      body: text.length > 140 ? `${text.slice(0, 137)}...` : text,
      toast: `Przypomnienie ToDo: ${text}`
    });
  }

  out.sort((a, b) => {
    if (a.severity !== b.severity) return b.severity - a.severity;
    if (a.orderDate !== b.orderDate) return a.orderDate.localeCompare(b.orderDate);
    return a.body.localeCompare(b.body);
  });

  return out;
}

function buildHabitReminderCandidates(todayISO) {
  const out = [];
  const habits = Array.isArray(state.habits) ? state.habits : [];

  for (const habit of habits) {
    if (!habit || typeof habit !== "object") continue;

    const key = `${habit.id}|${todayISO}`;
    const val = state.entries?.[key] ?? 0;
    if (val === 1) continue;

    if (typeof isHabitFreezeActive === "function" && isHabitFreezeActive(habit.id, todayISO)) {
      continue;
    }

    const name = String(habit.name || "Nawyk").trim() || "Nawyk";

    out.push({
      type: "habit",
      key: `habit:${habit.id}:${todayISO}`,
      severity: 1,
      orderDate: todayISO,
      title: "Edward: check nawyku",
      body: `Brakuje wpisu dla: ${name}`,
      toast: `Przypomnienie nawyku: ${name}`
    });
  }

  return out;
}

function pickReminderCandidate(candidates, cooldownMs, nowMs) {
  for (const candidate of candidates) {
    if (canNotifyByCooldown(candidate.key, cooldownMs, nowMs)) {
      return candidate;
    }
  }
  return null;
}

function sendReminder(candidate, cfg, nowMs) {
  const permission = getReminderPermission();
  state.reminders.permission = permission === "unsupported" ? state.reminders.permission : permission;

  if (permission === "granted") {
    try {
      const notif = new Notification(candidate.title, {
        body: candidate.body,
        tag: candidate.key,
        renotify: false
      });

      notif.onclick = () => {
        window.focus();
        if (candidate.type === "todo" && typeof setView === "function") {
          setView("todo");
        }
        if (candidate.type === "habit" && typeof setView === "function") {
          setView("habits");
        }
      };

      return true;
    } catch (error) {
      console.error("notification_send_failed", error);
    }
  }

  if (typeof showToast !== "function") return false;

  const fallbackCooldownMs = Math.max(30 * 60 * 1000, (Number(cfg.cooldownMin) || 240) * 60 * 1000);
  const lastFallbackAt = Number(state.reminders.lastFallbackAt || 0);
  if ((nowMs - lastFallbackAt) < fallbackCooldownMs) {
    return false;
  }

  state.reminders.lastFallbackAt = nowMs;
  showToast(candidate.toast, "info", 4200);
  return true;
}

function evaluateRemindersNow(force = false) {
  if (!ensureReminderConfig()) return;

  const cfg = state.reminders;
  if (!cfg.enabled) return;

  const now = new Date();
  const todayISO = toISO(startOfDay(now));

  pruneReminderMaps(todayISO);

  if (!force && !reminderWithinHours(now, cfg)) return;

  const dailyLimit = Math.max(1, Math.round(Number(cfg.dailyLimit) || 2));
  if (reminderDailyCount(todayISO) >= dailyLimit) return;

  const cooldownMs = Math.max(15, Math.round(Number(cfg.cooldownMin) || 240)) * 60 * 1000;
  const nowMs = Date.now();

  const candidates = [
    ...buildTodoReminderCandidates(todayISO),
    ...buildHabitReminderCandidates(todayISO)
  ];

  if (!candidates.length) return;

  const selected = pickReminderCandidate(candidates, cooldownMs, nowMs);
  if (!selected) return;

  const sent = sendReminder(selected, cfg, nowMs);
  if (!sent) return;

  markReminderSent(selected.key, todayISO, nowMs);
  saveState();
}

function initReminders() {
  if (!ensureReminderConfig()) return;

  if (remindersTimerId) return;

  remindersTimerId = setInterval(() => {
    evaluateRemindersNow(false);
  }, 60000);

  if (!remindersEventsBound) {
    remindersEventsBound = true;

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) evaluateRemindersNow(false);
    });

    window.addEventListener("focus", () => {
      evaluateRemindersNow(false);
    });
  }

  setTimeout(() => evaluateRemindersNow(true), 3200);
}
