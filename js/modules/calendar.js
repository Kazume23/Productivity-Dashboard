function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const gridStart = startOfWeekMonday(first);
  const days = [];
  let d = gridStart;

  for (let i = 0; i < 42; i++) {
    days.push(new Date(d));
    d = addDays(d, 1);
  }

  return days;
}

function ensureCalendarMeta(bucket, iso) {
  if (!bucket[iso]) {
    bucket[iso] = {
      todoOpen: 0,
      todoDone: 0,
      habitDone: 0,
      habitFail: 0,
      expenses: 0
    };
  }
  return bucket[iso];
}

function buildCalendarMetaMap() {
  const metaMap = {};

  for (const it of (state.todos || [])) {
    if (!it?.dateISO) continue;
    const item = ensureCalendarMeta(metaMap, it.dateISO);
    if (it.done) item.todoDone += 1;
    else item.todoOpen += 1;
  }

  for (const it of (state.expenses || [])) {
    if (!it?.dateISO) continue;
    const item = ensureCalendarMeta(metaMap, it.dateISO);
    item.expenses += 1;
  }

  for (const [key, val] of Object.entries(state.entries || {})) {
    const split = key.split("|");
    if (split.length !== 2) continue;
    const iso = split[1];
    const item = ensureCalendarMeta(metaMap, iso);
    if (val === 1) item.habitDone += 1;
    else if (val === -1) item.habitFail += 1;
  }

  return metaMap;
}

function calendarActivityLevel(meta) {
  if (!meta) return 0;
  const score =
    (meta.todoOpen * 2) +
    meta.todoDone +
    meta.habitDone +
    (meta.habitFail * 0.8) +
    (meta.expenses * 0.6);

  if (score <= 0) return 0;
  if (score <= 2) return 1;
  if (score <= 4) return 2;
  if (score <= 7) return 3;
  return 4;
}

function makeCalBadge(type, count) {
  const badge = document.createElement("span");
  badge.className = `calBadge ${type}`;
  badge.textContent = count > 9 ? "9+" : String(count);
  return badge;
}

function renderCalendar() {
  if (calTitle) {
    calTitle.textContent = `${monthNamePL(state.viewMonth)} ${state.viewYear}`;
  }
  if (!calGrid) return;
  calGrid.innerHTML = "";

  const days = buildMonthGrid(state.viewYear, state.viewMonth);
  const metaMap = buildCalendarMetaMap();
  const selectedDate = fromISO(state.selectedDate);
  const weekStart = startOfWeekMonday(selectedDate);
  const weekEnd = addDays(weekStart, 6);

  for (const d of days) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calDay";

    const iso = toISO(d);
    const meta = metaMap[iso] || null;
    const activityLevel = calendarActivityLevel(meta);
    cell.classList.add(`calLevel${activityLevel}`);

    const inMonth = d.getMonth() === state.viewMonth;
    if (!inMonth) cell.classList.add("calMuted");
    if (sameDay(d, selectedDate)) cell.classList.add("calSelected");
    if (d >= weekStart && d <= weekEnd) cell.classList.add("calWeek");

    const dayNum = document.createElement("span");
    dayNum.className = "calDayNum";
    dayNum.textContent = String(d.getDate());

    const badges = document.createElement("span");
    badges.className = "calDayBadges";
    if (meta?.todoOpen) badges.appendChild(makeCalBadge("todo", meta.todoOpen));
    if (meta?.habitDone) badges.appendChild(makeCalBadge("done", meta.habitDone));
    if (meta?.habitFail) badges.appendChild(makeCalBadge("fail", meta.habitFail));
    if (meta?.expenses) badges.appendChild(makeCalBadge("money", meta.expenses));

    if (meta) {
      cell.title = `ToDo: ${meta.todoOpen}/${meta.todoDone} • Nawyki: ${meta.habitDone}/${meta.habitFail} • Koszty: ${meta.expenses}`;
    }

    cell.appendChild(dayNum);
    cell.appendChild(badges);
    cell.addEventListener("click", () => setSelectedDate(d));
    cell.addEventListener("dblclick", (e) => {
      e.preventDefault();
      setSelectedDate(d);
      if (typeof openTodoModal === "function") openTodoModal(d);
    });

    calGrid.appendChild(cell);
  }

  if (typeof renderOverviewPanels === "function") renderOverviewPanels();
}

function setSelectedDate(date) {
  const x = startOfDay(date);
  state.selectedDate = toISO(x);
  state.viewMonth = x.getMonth();
  state.viewYear = x.getFullYear();
  saveState();
  renderAll();
}

function setViewMonthYear(year, month) {
  state.viewYear = year;
  state.viewMonth = month;
  saveState();
  renderCalendar();
}

function initCalendar() {
  btnPrev?.addEventListener("click", () => {
    let y = state.viewYear;
    let m = state.viewMonth - 1;
    if (m < 0) { m = 11; y -= 1; }
    setViewMonthYear(y, m);
  });

  btnNext?.addEventListener("click", () => {
    let y = state.viewYear;
    let m = state.viewMonth + 1;
    if (m > 11) { m = 0; y += 1; }
    setViewMonthYear(y, m);
  });

  btnToday?.addEventListener("click", () => {
    setSelectedDate(new Date());
  });
}
