const HABIT_TEMPLATE_PRESETS = {
  morning: ["Pobudka o 6:00", "Szklanka wody", "Plan dnia 10 min"],
  work: ["Deep work 45 min", "Inbox zero", "Podsumowanie dnia"],
  health: ["Trening", "Spacer 30 min", "Sen przed 23:00"]
};

function ensureHabitsData() {
  if (!Array.isArray(state.habits)) state.habits = [];

  if (!state.entries || typeof state.entries !== "object" || Array.isArray(state.entries)) {
    state.entries = {};
  }

  if (!state.habitGoals || typeof state.habitGoals !== "object" || Array.isArray(state.habitGoals)) {
    state.habitGoals = {
      weekTarget: 12,
      monthTarget: 48
    };
  }

  state.habitGoals.weekTarget = Math.min(200, Math.max(1, Math.round(Number(state.habitGoals.weekTarget) || 12)));
  state.habitGoals.monthTarget = Math.min(1000, Math.max(1, Math.round(Number(state.habitGoals.monthTarget) || 48)));

  if (!state.habitFreeze || typeof state.habitFreeze !== "object" || Array.isArray(state.habitFreeze)) {
    state.habitFreeze = {
      monthlyLimit: 2,
      used: {}
    };
  }

  if (!state.habitFreeze.used || typeof state.habitFreeze.used !== "object" || Array.isArray(state.habitFreeze.used)) {
    state.habitFreeze.used = {};
  }

  state.habitFreeze.monthlyLimit = Math.min(10, Math.max(1, Math.round(Number(state.habitFreeze.monthlyLimit) || 2)));

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
}

function normalizeHabitName(name) {
  return String(name || "").trim();
}

function freezeKey(habitId, dateISO) {
  return `${habitId}|${dateISO}`;
}

function isHabitFreezeActive(habitId, dateISO) {
  ensureHabitsData();
  return !!state.habitFreeze.used[freezeKey(habitId, dateISO)];
}

function getHabitCurrentStreak(habitId, fromDateObj = getSelectedDateObj()) {
  ensureHabitsData();

  let streak = 0;
  let day = startOfDay(fromDateObj);

  for (let guard = 0; guard < 3650; guard++) {
    const iso = toISO(day);
    const entry = state.entries[freezeKey(habitId, iso)] ?? 0;

    if (entry === 1 || isHabitFreezeActive(habitId, iso)) {
      streak += 1;
      day = addDays(day, -1);
      continue;
    }

    break;
  }

  return streak;
}

function monthKeyFromISO(dateISO) {
  return String(dateISO || "").slice(0, 7);
}

function countFreezeUsedForMonth(monthKey) {
  ensureHabitsData();

  let count = 0;
  const usedMap = state.habitFreeze.used || {};

  for (const [key, used] of Object.entries(usedMap)) {
    if (!used || !key.includes("|")) continue;

    const parts = key.split("|");
    if (parts.length !== 2) continue;

    const iso = parts[1];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue;
    if (monthKeyFromISO(iso) !== monthKey) continue;

    count += 1;
  }

  return count;
}

function getHabitMonthBounds(dateObj) {
  const base = startOfDay(dateObj);
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    start: startOfDay(start),
    end: startOfDay(end)
  };
}

function countHabitDoneInRange(startDate, endDate) {
  ensureHabitsData();

  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const dayCount = Math.max(1, Math.floor((end - start) / 86400000) + 1);

  let done = 0;

  for (let i = 0; i < dayCount; i++) {
    const iso = toISO(addDays(start, i));
    for (const h of state.habits) {
      const val = state.entries[freezeKey(h.id, iso)] ?? 0;
      if (val === 1) done += 1;
    }
  }

  return done;
}

function getHabitsGoalProgress() {
  const selected = getSelectedDateObj();
  const weekStart = startOfWeekMonday(selected);
  const weekEnd = addDays(weekStart, 6);
  const monthBounds = getHabitMonthBounds(selected);

  return {
    weekDone: countHabitDoneInRange(weekStart, weekEnd),
    monthDone: countHabitDoneInRange(monthBounds.start, monthBounds.end)
  };
}

function renderHabitFreezeSelect() {
  if (!habitFreezeHabit) return;

  const prev = String(habitFreezeHabit.value || "").trim();
  habitFreezeHabit.innerHTML = "";

  if (!state.habits.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Brak nawyków";
    habitFreezeHabit.appendChild(opt);
    habitFreezeHabit.disabled = true;
    syncCustomSelect(habitFreezeHabit);
    return;
  }

  habitFreezeHabit.disabled = false;

  for (const h of state.habits) {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = h.name || "Nawyk";
    habitFreezeHabit.appendChild(opt);
  }

  const hasPrev = state.habits.some((h) => h.id === prev);
  habitFreezeHabit.value = hasPrev ? prev : state.habits[0].id;
  syncCustomSelect(habitFreezeHabit);
}

function reminderPermissionState() {
  if (typeof Notification === "undefined") return "unsupported";
  const perm = String(Notification.permission || "default");
  if (perm === "granted" || perm === "denied") return perm;
  return "default";
}

function reminderStatusText() {
  const cfg = state.reminders || {};
  const perm = reminderPermissionState();

  if (!cfg.enabled) {
    return "Przypomnienia są wyłączone.";
  }

  if (perm === "unsupported") {
    return "Przeglądarka nie wspiera Notification API. Działa tylko fallback toast.";
  }

  if (perm === "granted") {
    return `Aktywne: ${cfg.startHour}:00-${cfg.endHour}:00, limit ${cfg.dailyLimit}/dzień, cooldown ${cfg.cooldownMin} min.`;
  }

  if (perm === "denied") {
    return "Brak zgody przeglądarki. Aktywny jest fallback toast zamiast systemowych powiadomień.";
  }

  return "Przypomnienia włączone, ale wymagają zgody przeglądarki.";
}

function renderHabitsPro() {
  ensureHabitsData();

  if (habitTemplateSelect) {
    if (!habitTemplateSelect.value) {
      habitTemplateSelect.value = "morning";
    }
    syncCustomSelect(habitTemplateSelect);
  }

  if (habitGoalWeek) habitGoalWeek.value = String(state.habitGoals.weekTarget);
  if (habitGoalMonth) habitGoalMonth.value = String(state.habitGoals.monthTarget);

  const progress = getHabitsGoalProgress();
  if (habitGoalWeekProgress) {
    habitGoalWeekProgress.textContent = `${progress.weekDone}/${state.habitGoals.weekTarget}`;
  }
  if (habitGoalMonthProgress) {
    habitGoalMonthProgress.textContent = `${progress.monthDone}/${state.habitGoals.monthTarget}`;
  }

  const selectedISO = state.selectedDate || toISO(startOfDay(new Date()));
  const monthKey = monthKeyFromISO(selectedISO);
  const used = countFreezeUsedForMonth(monthKey);
  const credits = Math.max(0, state.habitFreeze.monthlyLimit - used);

  if (habitFreezeLimit) habitFreezeLimit.value = String(state.habitFreeze.monthlyLimit);
  if (habitFreezeCredits) habitFreezeCredits.textContent = String(credits);
  if (habitFreezeInfo) {
    habitFreezeInfo.textContent = `Użyto ${used}/${state.habitFreeze.monthlyLimit} (${monthKey})`;
  }

  renderHabitFreezeSelect();

  const reminders = state.reminders || {};
  if (habitRemindersEnabled) habitRemindersEnabled.checked = !!reminders.enabled;
  if (habitReminderStartHour) habitReminderStartHour.value = String(reminders.startHour ?? 9);
  if (habitReminderEndHour) habitReminderEndHour.value = String(reminders.endHour ?? 20);
  if (habitReminderDailyLimit) habitReminderDailyLimit.value = String(reminders.dailyLimit ?? 2);
  if (habitReminderCooldown) habitReminderCooldown.value = String(reminders.cooldownMin ?? 240);

  const permission = reminderPermissionState();
  if (permission !== "unsupported") {
    state.reminders.permission = permission;
  }
  if (habitReminderStatus) {
    habitReminderStatus.textContent = reminderStatusText();
  }
}

function renderHabits() {
  ensureHabitsData();

  const selected = fromISO(state.selectedDate);
  const weekStart = startOfWeekMonday(selected);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  renderHabitsPro();

  if (habRange) {
    habRange.textContent = `${fmtPL(weekStart)} do ${fmtPL(addDays(weekStart, 6))}`;
  }

  const trHead = document.createElement("tr");
  const thHabit = document.createElement("th");
  thHabit.textContent = "Nawyk";
  thHabit.className = "thHabit";
  trHead.appendChild(thHabit);

  const thDel = document.createElement("th");
  thDel.className = "thDel";
  thDel.textContent = "";
  trHead.appendChild(thDel);

  for (const d of weekDates) {
    const th = document.createElement("th");
    th.className = "thDay";
    th.textContent = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
    if (sameDay(d, selected)) th.classList.add("thToday");
    trHead.appendChild(th);
  }

  if (habThead) {
    habThead.innerHTML = "";
    habThead.appendChild(trHead);
  }

  if (habTbody) habTbody.innerHTML = "";

  for (const h of state.habits) {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.className = "tdHabit";
    const nameDiv = document.createElement("div");
    nameDiv.className = "habitName";
    nameDiv.contentEditable = "true";
    nameDiv.spellcheck = false;
    nameDiv.textContent = h.name;
    nameDiv.addEventListener("blur", () => {
      const v = normalizeHabitName(nameDiv.textContent);
      h.name = v.length ? v : "Nawyk";
      saveState();
      renderHabitsPro();
    });
    nameDiv.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        nameDiv.blur();
      }
    });
    tdName.appendChild(nameDiv);
    tr.appendChild(tdName);

    const tdDel = document.createElement("td");
    tdDel.className = "tdCell";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "habitDel";
    delBtn.textContent = "×";
    delBtn.title = "Usuń nawyk";
    delBtn.addEventListener("click", () => deleteHabit(h.id));
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    for (const d of weekDates) {
      const dateISO = toISO(d);
      const key = freezeKey(h.id, dateISO);
      const val = state.entries[key] ?? 0;
      const frozen = isHabitFreezeActive(h.id, dateISO);

      const td = document.createElement("td");
      td.className = "tdCell";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cellBtn";

      if (val === 1) {
        btn.classList.add("cellDone");
      } else if (val === -1) {
        btn.classList.add("cellFail");
      } else if (frozen) {
        btn.classList.add("cellFreeze");
        btn.textContent = "F";
        btn.title = "Streak freeze";
      }

      btn.addEventListener("click", () => cycleEntry(h.id, dateISO));
      td.appendChild(btn);
      tr.appendChild(td);
    }

    habTbody?.appendChild(tr);
  }

  if (typeof renderOverviewPanels === "function") renderOverviewPanels();
}

function cycleEntry(habitId, dateISO) {
  ensureHabitsData();

  const key = freezeKey(habitId, dateISO);
  const current = state.entries[key] ?? 0;
  let next;

  if (current === 0) next = 1;
  else if (current === 1) next = -1;
  else next = 0;

  if (next === 0) {
    delete state.entries[key];
  } else {
    state.entries[key] = next;
  }

  if (state.habitFreeze.used[key]) {
    delete state.habitFreeze.used[key];
  }

  saveState();
  renderHabits();
  renderChart();
}

function deleteHabit(habitId) {
  ensureHabitsData();

  state.habits = state.habits.filter((h) => h.id !== habitId);

  for (const entryKey of Object.keys(state.entries)) {
    if (entryKey.startsWith(habitId + "|")) {
      delete state.entries[entryKey];
    }
  }

  for (const freezeKeyName of Object.keys(state.habitFreeze.used || {})) {
    if (freezeKeyName.startsWith(habitId + "|")) {
      delete state.habitFreeze.used[freezeKeyName];
    }
  }

  saveState();
  renderHabits();
  renderChart();
}

function addHabitWithName(rawName) {
  const name = normalizeHabitName(rawName);
  if (!name) return false;

  state.habits.push({ id: crypto.randomUUID(), name });
  return true;
}

function addHabit() {
  ensureHabitsData();

  const name = habitName?.value.trim();
  if (!name) return;

  const added = addHabitWithName(name);
  if (!added) return;

  habitName.value = "";
  saveState();
  renderHabits();
  renderChart();
}

function openHabitModal() {
  if (!habitOverlay) return;
  if (habitModalName) habitModalName.value = "";
  showOverlay(habitOverlay);
  setTimeout(() => habitModalName?.focus(), 0);
}

function closeHabitModal() {
  if (!habitOverlay) return;
  hideOverlay(habitOverlay);
}

function addHabitFromModal() {
  ensureHabitsData();

  const name = habitModalName?.value.trim();
  if (!name) return;

  const added = addHabitWithName(name);
  if (!added) return;

  saveState();
  renderHabits();
  renderChart();
  closeHabitModal();
}

function addHabitTemplatePreset() {
  ensureHabitsData();

  const presetId = String(habitTemplateSelect?.value || "morning").trim();
  const preset = HABIT_TEMPLATE_PRESETS[presetId] || HABIT_TEMPLATE_PRESETS.morning;

  const existing = new Set(
    state.habits.map((h) => normalizeHabitName(h.name).toLowerCase())
  );

  let addedCount = 0;
  for (const name of preset) {
    const key = normalizeHabitName(name).toLowerCase();
    if (!key || existing.has(key)) continue;

    state.habits.push({ id: crypto.randomUUID(), name: normalizeHabitName(name) });
    existing.add(key);
    addedCount += 1;
  }

  if (addedCount === 0) {
    if (typeof showToast === "function") {
      showToast("Szablon nie dodał nowych pozycji (duplikaty).", "info", 3200);
    }
    return;
  }

  saveState();
  renderHabits();
  renderChart();

  if (typeof showToast === "function") {
    showToast(`Dodano ${addedCount} nawyków z szablonu.`, "success", 2800);
  }
}

function saveHabitGoals() {
  ensureHabitsData();

  const weekTarget = Math.min(200, Math.max(1, Math.round(Number(habitGoalWeek?.value) || state.habitGoals.weekTarget || 12)));
  const monthTarget = Math.min(1000, Math.max(1, Math.round(Number(habitGoalMonth?.value) || state.habitGoals.monthTarget || 48)));

  state.habitGoals.weekTarget = weekTarget;
  state.habitGoals.monthTarget = monthTarget;

  saveState();
  renderHabitsPro();

  if (typeof showToast === "function") {
    showToast("Cele nawyków zapisane.", "success", 2500);
  }
}

function saveHabitFreezeLimit() {
  ensureHabitsData();

  state.habitFreeze.monthlyLimit = Math.min(10, Math.max(1, Math.round(Number(habitFreezeLimit?.value) || state.habitFreeze.monthlyLimit || 2)));

  saveState();
  renderHabitsPro();

  if (typeof showToast === "function") {
    showToast("Limit streak freeze zapisany.", "success", 2500);
  }
}

function useHabitFreezeForSelectedDate() {
  ensureHabitsData();

  const habitId = String(habitFreezeHabit?.value || "").trim();
  if (!habitId) {
    if (typeof showToast === "function") {
      showToast("Najpierw wybierz nawyk do freeze.", "error", 3200);
    }
    return;
  }

  const selectedISO = String(state.selectedDate || toISO(startOfDay(new Date())));
  const todayISO = toISO(startOfDay(new Date()));

  if (selectedISO > todayISO) {
    if (typeof showToast === "function") {
      showToast("Freeze działa tylko dla dnia bieżącego lub wcześniejszego.", "error", 3400);
    }
    return;
  }

  const key = freezeKey(habitId, selectedISO);
  if (state.habitFreeze.used[key]) {
    if (typeof showToast === "function") {
      showToast("Freeze dla tego nawyku i dnia już istnieje.", "info", 2800);
    }
    return;
  }

  const currentVal = state.entries[key] ?? 0;
  if (currentVal === 1) {
    if (typeof showToast === "function") {
      showToast("Nawyk jest już oznaczony jako wykonany, freeze nie jest potrzebny.", "info", 3600);
    }
    return;
  }

  const monthKey = monthKeyFromISO(selectedISO);
  const usedInMonth = countFreezeUsedForMonth(monthKey);
  const creditsLeft = Math.max(0, state.habitFreeze.monthlyLimit - usedInMonth);

  if (creditsLeft <= 0) {
    if (typeof showToast === "function") {
      showToast("Brak dostępnych freeze w tym miesiącu.", "error", 3400);
    }
    return;
  }

  state.habitFreeze.used[key] = true;

  if (currentVal === -1) {
    delete state.entries[key];
  }

  saveState();
  renderHabits();
  renderChart();

  if (typeof showToast === "function") {
    showToast("Freeze zapisany dla wybranego nawyku.", "success", 2800);
  }
}

function saveHabitReminderSettings() {
  ensureHabitsData();

  let startHour = Math.max(0, Math.min(23, Math.round(Number(habitReminderStartHour?.value) || 9)));
  let endHour = Math.max(0, Math.min(23, Math.round(Number(habitReminderEndHour?.value) || 20)));
  if (endHour < startHour) {
    const temp = startHour;
    startHour = endHour;
    endHour = temp;
  }

  state.reminders.enabled = !!habitRemindersEnabled?.checked;
  state.reminders.startHour = startHour;
  state.reminders.endHour = endHour;
  state.reminders.dailyLimit = Math.min(20, Math.max(1, Math.round(Number(habitReminderDailyLimit?.value) || 2)));
  state.reminders.cooldownMin = Math.min(1440, Math.max(15, Math.round(Number(habitReminderCooldown?.value) || 240)));

  const permission = reminderPermissionState();
  if (permission !== "unsupported") {
    state.reminders.permission = permission;
  }

  saveState();
  renderHabitsPro();

  if (typeof initReminders === "function") initReminders();
  if (typeof evaluateRemindersNow === "function") evaluateRemindersNow(true);

  if (typeof showToast === "function") {
    showToast("Ustawienia przypomnień zapisane.", "success", 2600);
  }
}

async function requestHabitReminderPermission() {
  ensureHabitsData();

  if (typeof Notification === "undefined") {
    if (typeof showToast === "function") {
      showToast("Ta przeglądarka nie wspiera Notification API.", "error", 3600);
    }
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted" || permission === "denied") {
      state.reminders.permission = permission;
      saveState();
    }

    renderHabitsPro();
    if (typeof evaluateRemindersNow === "function") evaluateRemindersNow(true);

    if (typeof showToast === "function") {
      if (permission === "granted") {
        showToast("Powiadomienia systemowe zostały włączone.", "success", 3200);
      } else if (permission === "denied") {
        showToast("Zgoda została odrzucona. Działa fallback toast.", "info", 3600);
      } else {
        showToast("Zgoda nie została jeszcze przyznana.", "info", 3200);
      }
    }
  } catch (error) {
    console.error("notification_permission_failed", error);
    if (typeof showToast === "function") {
      showToast("Nie udało się pobrać zgody powiadomień.", "error", 3600);
    }
  }
}

function initHabits() {
  ensureHabitsData();

  addHabitBtn?.addEventListener("click", addHabit);
  habitName?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addHabit();
  });

  habitSave?.addEventListener("click", addHabitFromModal);
  habitClose?.addEventListener("click", closeHabitModal);
  habitCancel?.addEventListener("click", closeHabitModal);
  habitOverlay?.addEventListener("click", (e) => {
    if (e.target === habitOverlay) closeHabitModal();
  });

  habitTemplateAdd?.addEventListener("click", addHabitTemplatePreset);
  habitGoalSave?.addEventListener("click", saveHabitGoals);
  habitFreezeSave?.addEventListener("click", saveHabitFreezeLimit);
  habitFreezeUse?.addEventListener("click", useHabitFreezeForSelectedDate);
  habitReminderSave?.addEventListener("click", saveHabitReminderSettings);
  habitReminderPermission?.addEventListener("click", requestHabitReminderPermission);

  document.addEventListener("keydown", (e) => {
    if (habitOverlay?.classList.contains("isOpen") && e.key === "Escape") closeHabitModal();
  });

  renderHabitsPro();
}
