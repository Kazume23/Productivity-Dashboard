function getSelectedDateObj() {
  return fromISO(state.selectedDate);
}

const PAGE_HEADER_BY_NAV = {
  navDash: {
    title: "Panel główny",
    subtitle: "Centrum dnia i szybkie decyzje"
  },
  navTodo: {
    title: "ToDo",
    subtitle: "Pełny moduł zadań i priorytetów"
  },
  navHabits: {
    title: "Nawyki",
    subtitle: "Tracker, bilans i skuteczność"
  },
  navExpenses: {
    title: "Wydatki",
    subtitle: "Kontrola kosztów, filtry i priorytety"
  },
  navWishlist: {
    title: "Lista życzeń",
    subtitle: "Plan zakupów i budżet"
  }
};

const NAV_BY_VIEW = {
  dashboard: navDash,
  habits: navHabits,
  todo: navTodo,
  expenses: navExpenses,
  wishlist: navWishlist
};

const VALID_VIEWS = ["dashboard", "habits", "todo", "expenses", "wishlist"];
let ignoreNextHashChange = false;
let dashProductivityChart = null;
let dashSpendTrendChart = null;
let syncFeedbackBound = false;
let syncErrorToastText = "";
let syncErrorToastAt = 0;

function showToast(text, type = "info", ttlMs = 3600) {
  if (!toastStack) return;

  const msg = String(text || "").trim();
  if (!msg) return;

  const item = document.createElement("div");
  item.className = "toastItem";
  if (type === "error") item.classList.add("isError");
  if (type === "success") item.classList.add("isSuccess");
  item.textContent = msg;

  toastStack.appendChild(item);
  requestAnimationFrame(() => {
    item.classList.add("isVisible");
  });

  setTimeout(() => {
    item.classList.remove("isVisible");
    setTimeout(() => item.remove(), 220);
  }, Math.max(1200, Number(ttlMs) || 3600));
}

function setSyncBadge(status, detail = {}) {
  if (!syncBadge) return;

  syncBadge.classList.remove("isBusy", "isError", "isOffline");

  if (status === "queued" || status === "flushing" || status === "retrying") {
    syncBadge.classList.add("isBusy");
  }

  if (status === "error") {
    syncBadge.classList.add("isError");
  }

  if (status === "offline") {
    syncBadge.classList.add("isOffline");
  }

  if (status === "local") {
    syncBadge.textContent = "Tryb lokalny";
    return;
  }

  if (status === "queued" || status === "flushing") {
    syncBadge.textContent = "Synchronizacja...";
    return;
  }

  if (status === "retrying") {
    const sec = Math.max(1, Math.round((Number(detail.backoffMs) || 2000) / 1000));
    syncBadge.textContent = `Ponawiam za ${sec}s`;
    return;
  }

  if (status === "saved") {
    syncBadge.textContent = "Zapisano";
    return;
  }

  if (status === "conflict") {
    syncBadge.textContent = "Odświeżono z serwera";
    return;
  }

  if (status === "offline") {
    syncBadge.textContent = "Offline";
    return;
  }

  if (status === "error") {
    syncBadge.textContent = "Błąd synchronizacji";
    return;
  }

  syncBadge.textContent = "Synchronizacja";
}

function getSyncErrorToast(detail = {}) {
  const msg = String(detail.message || "");
  if (msg.includes("timeout")) {
    return "Synchronizacja trwa zbyt długo. Spróbuję ponownie automatycznie.";
  }
  if (msg.includes("unauthorized") || msg.includes("session_expired") || msg.includes("csrf")) {
    return "Sesja wygasła. Odśwież stronę i zaloguj się ponownie.";
  }
  if (msg.includes("offline_no_server")) {
    return "Brak połączenia z serwerem. Zmiany są zapisane lokalnie.";
  }
  return "Nie udało się zsynchronizować zmian. Trwa ponawianie zapisu.";
}

function maybeShowSyncErrorToast(detail = {}) {
  const text = getSyncErrorToast(detail);
  const now = Date.now();

  if (text === syncErrorToastText && (now - syncErrorToastAt) < 12000) {
    return;
  }

  syncErrorToastText = text;
  syncErrorToastAt = now;
  showToast(text, "error", 4600);
}

function initSyncFeedback() {
  if (syncFeedbackBound) return;
  syncFeedbackBound = true;

  if (!AUTH_USER) {
    setSyncBadge("local");
  } else {
    setSyncBadge("saved");
  }

  document.addEventListener("edward:sync", (event) => {
    const detail = event?.detail || {};
    const status = String(detail.status || "queued");

    setSyncBadge(status, detail);

    if (status === "error") {
      maybeShowSyncErrorToast(detail);
      return;
    }

    if (status === "conflict") {
      showToast("Wykryto konflikt wersji. Załadowano nowszy stan z serwera.", "info", 4000);
    }
  });

  window.addEventListener("offline", () => {
    setSyncBadge("offline");
    if (AUTH_USER) {
      showToast("Brak internetu. Zmiany będą tymczasowo zapisywane lokalnie.", "info", 4200);
    }
  });

  window.addEventListener("online", () => {
    if (AUTH_USER) {
      setSyncBadge("queued");
      showToast("Połączenie wróciło. Trwa synchronizacja.", "success", 2600);
    } else {
      setSyncBadge("local");
    }
  });
}

function syncPageHeader(navBtn) {
  const navId = navBtn?.id || "navDash";
  const conf = PAGE_HEADER_BY_NAV[navId] || PAGE_HEADER_BY_NAV.navDash;

  if (pageTitle) pageTitle.textContent = conf.title;
  if (pageSubtitle) pageSubtitle.textContent = conf.subtitle;
}

function setNavActive(btn) {
  document.querySelectorAll(".navItem").forEach(x => x.classList.remove("isActive"));
  btn?.classList.add("isActive");
  syncPageHeader(btn);
}

function normalizeViewName(viewName) {
  const v = String(viewName || "").trim().toLowerCase();
  return VALID_VIEWS.includes(v) ? v : "dashboard";
}

function getViewFromHash() {
  const raw = String(window.location.hash || "").replace(/^#/, "");
  return normalizeViewName(raw);
}

function setView(viewName, opts = {}) {
  const view = normalizeViewName(viewName);
  const updateHash = opts.updateHash !== false;
  const skipRender = opts.skipRender === true;

  document.body.dataset.view = view;

  document.querySelectorAll(".view").forEach((section) => {
    const isActive = section.dataset.view === view;
    section.classList.toggle("isActive", isActive);
    section.setAttribute("aria-hidden", isActive ? "false" : "true");
  });

  const navBtn = NAV_BY_VIEW[view] || navDash;
  setNavActive(navBtn);

  if (updateHash && window.location.hash !== `#${view}`) {
    ignoreNextHashChange = true;
    window.location.hash = view;
  }

  closeSidebarDrawer();

  if (skipRender) {
    return;
  }

  renderAll();
}

function weekDayNamePL(d) {
  const names = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
  return names[d.getDay()] || "Dzień";
}

function getTodoStats() {
  const selectedISO = state.selectedDate;
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  let today = 0;
  let upcoming = 0;
  let overdue = 0;
  let openCount = 0;
  let doneCount = 0;
  let highOpen = 0;

  const pending = [];

  for (const it of (state.todos || [])) {
    if (it.done) {
      doneCount += 1;
      continue;
    }

    openCount += 1;
    if ((it.priority || "medium") === "high") highOpen += 1;

    if (it.dateISO === selectedISO) today += 1;
    else if (it.dateISO > selectedISO) upcoming += 1;
    else overdue += 1;

    pending.push(it);
  }

  pending.sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
    const pa = priorityOrder[a.priority || "medium"] ?? 1;
    const pb = priorityOrder[b.priority || "medium"] ?? 1;
    if (pa !== pb) return pa - pb;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  return {
    today,
    upcoming,
    overdue,
    openCount,
    doneCount,
    highOpen,
    totalCount: openCount + doneCount,
    preview: pending.slice(0, 4),
    nextDeadlines: pending.slice(0, 3)
  };
}

function getHabitWeekStats() {
  const selected = getSelectedDateObj();
  const weekStart = startOfWeekMonday(selected);
  const habits = state.habits || [];

  let done = 0;
  let fail = 0;
  let empty = 0;

  for (let i = 0; i < 7; i++) {
    const iso = toISO(addDays(weekStart, i));
    for (const h of habits) {
      const v = state.entries?.[`${h.id}|${iso}`] ?? 0;
      if (v === 1) {
        done += 1;
      } else if (v === -1) {
        fail += 1;
      } else {
        empty += 1;
      }
    }
  }

  const decided = done + fail;
  const rate = decided > 0 ? Math.round((done / decided) * 100) : 0;

  return {
    done,
    fail,
    empty,
    rate
  };
}

function getBestCurrentHabitStreakInfo() {
  const selected = getSelectedDateObj();
  const habits = state.habits || [];
  let bestStreak = 0;
  let bestName = "-";

  for (const h of habits) {
    let streak = 0;
    let d = startOfDay(selected);

    for (let guard = 0; guard < 3650; guard++) {
      const key = `${h.id}|${toISO(d)}`;
      if ((state.entries?.[key] ?? 0) !== 1) break;
      streak += 1;
      d = addDays(d, -1);
    }

    if (streak > bestStreak) {
      bestStreak = streak;
      bestName = h.name || "Nawyk";
    }
  }

  return {
    streak: bestStreak,
    name: bestName
  };
}

function getExpenseStats() {
  const selected = getSelectedDateObj();
  const selectedISO = state.selectedDate;
  const month = selected.getMonth();
  const year = selected.getFullYear();
  const weekStart = startOfWeekMonday(selected);
  const weekStartISO = toISO(weekStart);
  const weekEndISO = toISO(addDays(weekStart, 6));

  let today = 0;
  let weekTotal = 0;
  let monthTotal = 0;
  const byCategory = {};

  for (const it of (state.expenses || [])) {
    const amount = Number(it.amount) || 0;

    if (it.dateISO === selectedISO) today += amount;
    if (it.dateISO >= weekStartISO && it.dateISO <= weekEndISO) weekTotal += amount;

    const d = fromISO(it.dateISO);
    if (d.getMonth() === month && d.getFullYear() === year) {
      monthTotal += amount;
      const category = it.category || "Inne";
      byCategory[category] = (byCategory[category] || 0) + amount;
    }
  }

  let topCategory = "-";
  let topValue = 0;
  for (const [name, value] of Object.entries(byCategory)) {
    if (value > topValue) {
      topValue = value;
      topCategory = name;
    }
  }

  const categories = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const recurringProjected =
    typeof getRecurringProjectedTotalForMonth === "function"
      ? Number(getRecurringProjectedTotalForMonth(year, month) || 0)
      : 0;

  return {
    today,
    weekTotal,
    monthTotal,
    recurringProjected,
    monthTotalWithRecurring: monthTotal + recurringProjected,
    topCategory,
    topCategoryValue: topValue,
    categories
  };
}

function getWishlistStats() {
  const items = state.wishlist || [];
  let pricedCount = 0;
  let total = 0;

  for (const it of items) {
    if (it.price === null || it.price === undefined) continue;
    const v = Number(it.price);
    if (!Number.isFinite(v)) continue;
    total += v;
    pricedCount += 1;
  }

  return {
    itemsCount: items.length,
    total,
    avg: pricedCount > 0 ? total / pricedCount : 0
  };
}

function dashboardCssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function destroyDashboardChart(instance) {
  if (!instance) return null;
  instance.destroy();
  return null;
}

function clearDashboardCanvas(canvas) {
  const ctx = canvas?.getContext?.("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function buildDashboardTrendSeries(days = 14) {
  const selected = getSelectedDateObj();
  const labels = [];
  const todoDoneSeries = [];
  const habitDoneSeries = [];
  const habitFailSeries = [];
  const expenseSeries = [];

  const todoDoneByDate = {};
  for (const it of (state.todos || [])) {
    if (!it.done) continue;
    const doneIso = it.doneAt > 0 ? toISO(new Date(it.doneAt)) : it.dateISO;
    if (!doneIso) continue;
    todoDoneByDate[doneIso] = (todoDoneByDate[doneIso] || 0) + 1;
  }

  const habitDoneByDate = {};
  const habitFailByDate = {};
  for (const [key, v] of Object.entries(state.entries || {})) {
    const parts = key.split("|");
    if (parts.length !== 2) continue;
    const iso = parts[1];
    if (v === 1) habitDoneByDate[iso] = (habitDoneByDate[iso] || 0) + 1;
    else if (v === -1) habitFailByDate[iso] = (habitFailByDate[iso] || 0) + 1;
  }

  const expenseByDate = {};
  for (const it of (state.expenses || [])) {
    if (!it?.dateISO) continue;
    expenseByDate[it.dateISO] = (expenseByDate[it.dateISO] || 0) + (Number(it.amount) || 0);
  }

  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(selected, -i);
    const iso = toISO(day);
    labels.push(`${pad2(day.getDate())}.${pad2(day.getMonth() + 1)}`);
    todoDoneSeries.push(todoDoneByDate[iso] || 0);
    habitDoneSeries.push(habitDoneByDate[iso] || 0);
    habitFailSeries.push(habitFailByDate[iso] || 0);
    expenseSeries.push(Number((expenseByDate[iso] || 0).toFixed(2)));
  }

  return {
    labels,
    todoDoneSeries,
    habitDoneSeries,
    habitFailSeries,
    expenseSeries,
    totalTodoDone: todoDoneSeries.reduce((a, b) => a + b, 0),
    totalHabitDone: habitDoneSeries.reduce((a, b) => a + b, 0),
    totalHabitFail: habitFailSeries.reduce((a, b) => a + b, 0)
  };
}

function pctDeltaText(delta) {
  const n = Number(delta) || 0;
  if (n > 0) return `+${n}%`;
  return `${n}%`;
}

function renderDashboardCharts(series) {
  const canChart = typeof Chart !== "undefined";

  if (!canChart) {
    dashProductivityChart = destroyDashboardChart(dashProductivityChart);
    dashSpendTrendChart = destroyDashboardChart(dashSpendTrendChart);
    clearDashboardCanvas(dashProductivityChartCanvas);
    clearDashboardCanvas(dashSpendTrendChartCanvas);
    return;
  }

  const expenseMax = Math.max(0, ...series.expenseSeries);
  const sparseExpense = series.expenseSeries.filter(v => v > 0).length <= 2;
  const sparseTodo = series.todoDoneSeries.filter(v => v > 0).length <= 2;

  if (dashProductivityChartCanvas) {
    dashProductivityChart = destroyDashboardChart(dashProductivityChart);
    dashProductivityChart = new Chart(dashProductivityChartCanvas, {
      type: "bar",
      data: {
        labels: series.labels,
        datasets: [
          {
            label: "Nawyki wykonane",
            data: series.habitDoneSeries,
            backgroundColor: dashboardCssVar("--habit-done", "#2ea84f"),
            borderRadius: 6,
            borderSkipped: false,
            stack: "habits"
          },
          {
            label: "Nawyki zawalone",
            data: series.habitFailSeries,
            backgroundColor: dashboardCssVar("--habit-fail", "#e5484d"),
            borderRadius: 6,
            borderSkipped: false,
            stack: "habits"
          },
          {
            label: "Domknięte ToDo",
            data: series.todoDoneSeries,
            type: "line",
            yAxisID: "yTodo",
            borderColor: "#33b59f",
            backgroundColor: "rgba(51, 181, 159, 0.16)",
            pointRadius: sparseTodo ? 2 : 0,
            pointHoverRadius: 4,
            tension: 0.35,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 520,
          easing: "easeOutQuart"
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 10 }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            stacked: true,
            grid: { color: dashboardCssVar("--glass-10", "rgba(0,0,0,0.08)") }
          },
          yTodo: {
            beginAtZero: true,
            position: "right",
            suggestedMax: Math.max(2, ...series.todoDoneSeries) + 1,
            ticks: {
              precision: 0
            },
            grid: { display: false }
          }
        }
      }
    });
  }

  if (dashSpendTrendChartCanvas) {
    dashSpendTrendChart = destroyDashboardChart(dashSpendTrendChart);
    dashSpendTrendChart = new Chart(dashSpendTrendChartCanvas, {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [{
          label: "Wydatki",
          data: series.expenseSeries,
          borderColor: "#f08b3e",
          backgroundColor: "rgba(240, 139, 62, 0.20)",
          fill: true,
          pointRadius: sparseExpense ? 2 : 0,
          pointHoverRadius: 3,
          borderDash: sparseExpense ? [6, 5] : [],
          tension: 0.34
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            beginAtZero: true,
            suggestedMax: expenseMax > 0 ? undefined : 100,
            ticks: {
              callback: (v) => `${v} zł`
            },
            grid: { color: dashboardCssVar("--glass-10", "rgba(0,0,0,0.08)") }
          }
        }
      }
    });
  }
}

function renderDashboardTodoPreview(items) {
  const listEl = $("dashboardTodoList");
  const emptyEl = $("dashboardTodoEmpty");
  const subEl = $("dashboardTodoSub");

  if (subEl) {
    subEl.textContent = `• ${monthNamePL(state.viewMonth)} ${state.viewYear}`;
  }

  if (!listEl || !emptyEl) return;

  listEl.innerHTML = "";

  if (!items.length) {
    toggleClass(emptyEl, "isHidden", false);
    return;
  }

  toggleClass(emptyEl, "isHidden", true);

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "todoPreviewItem";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "todoCheck";
    cb.checked = false;
    cb.addEventListener("change", (e) => {
      e.stopPropagation();
      if (typeof toggleTodo === "function") {
        toggleTodo(it.id);
      }
      renderOverviewPanels();
    });

    const main = document.createElement("div");
    main.className = "todoPreviewMain";

    const text = document.createElement("div");
    text.className = "todoPreviewText";
    text.textContent = it.text;

    const meta = document.createElement("div");
    meta.className = "todoPreviewMeta";
    meta.textContent = `${fmtPL(fromISO(it.dateISO))} • ${todoPriorityLabel(it.priority || "medium")}`;

    main.appendChild(text);
    main.appendChild(meta);

    const goBtn = document.createElement("button");
    goBtn.type = "button";
    goBtn.className = "calBtn";
    goBtn.textContent = "→";
    goBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setView("todo");
    });

    row.appendChild(cb);
    row.appendChild(main);
    row.appendChild(goBtn);

    listEl.appendChild(row);
  }
}

function buildRecentActivity() {
  const out = [];

  for (const it of (state.todos || [])) {
    out.push({
      at: Number(it.createdAt) || 0,
      text: `ToDo: ${it.text}`,
      meta: it.dateISO ? fmtPL(fromISO(it.dateISO)) : ""
    });
  }

  for (const it of (state.expenses || [])) {
    out.push({
      at: Number(it.createdAt) || 0,
      text: `Wydatek: ${it.what}`,
      meta: `${moneyPL(it.amount)} • ${it.category || "Inne"}`
    });
  }

  for (const it of (state.wishlist || [])) {
    out.push({
      at: Number(it.createdAt) || 0,
      text: `Lista życzeń: ${it.name}`,
      meta: it.price == null ? "Cena: brak" : `Cena: ${moneyPL(it.price)}`
    });
  }

  out.sort((a, b) => b.at - a.at);
  return out.slice(0, 3);
}

function renderActivityPreview() {
  const listEl = $("dashActivityList");
  if (!listEl) return;

  listEl.innerHTML = "";
  const rows = buildRecentActivity();

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "todoEmpty";
    empty.textContent = "Brak ostatniej aktywności.";
    listEl.appendChild(empty);
    return;
  }

  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "dashActivityItem";

    const text = document.createElement("div");
    text.className = "dashActivityText";
    text.textContent = row.text;

    const meta = document.createElement("div");
    meta.className = "dashActivityMeta";
    if (row.at > 0) {
      const d = new Date(row.at);
      meta.textContent = `${fmtPL(d)} • ${pad2(d.getHours())}:${pad2(d.getMinutes())} ${row.meta ? `• ${row.meta}` : ""}`;
    } else {
      meta.textContent = row.meta || "";
    }

    item.appendChild(text);
    item.appendChild(meta);
    listEl.appendChild(item);
  }

  const moreBtn = document.createElement("button");
  moreBtn.type = "button";
  moreBtn.className = "calBtn dashActivityMoreBtn";
  moreBtn.textContent = "Więcej w ToDo";
  moreBtn.addEventListener("click", () => setView("todo"));
  listEl.appendChild(moreBtn);
}

function renderOverviewPanels() {
  const selected = getSelectedDateObj();
  const todoStats = getTodoStats();
  const habitStats = getHabitWeekStats();
  const expenseStats = getExpenseStats();
  const wishStats = getWishlistStats();
  const bestStreak = getBestCurrentHabitStreakInfo();
  const chartStats = typeof computeChartStats === "function" ? computeChartStats() : null;
  const habitCoverage = chartStats
    ? chartStats.coverage
    : ((habitStats.done + habitStats.fail + habitStats.empty) > 0
      ? Math.round(((habitStats.done + habitStats.fail) / (habitStats.done + habitStats.fail + habitStats.empty)) * 100)
      : 0);

  const heroDateText = $("heroDateText");
  const heroStatusText = $("heroStatusText");
  const heroFocusValue = $("heroFocusValue");
  const heroTodoValue = $("heroTodoValue");
  const heroHabitValue = $("heroHabitValue");

  if (heroDateText) {
    heroDateText.textContent = `${weekDayNamePL(selected)}, ${fmtPL(selected)}`;
  }

  if (heroStatusText) {
    if (todoStats.overdue > 0) {
      heroStatusText.textContent = `Masz ${todoStats.overdue} zaległych zadań do domknięcia.`;
    } else if (todoStats.today > 0) {
      heroStatusText.textContent = `Na dziś zaplanowano ${todoStats.today} zadań.`;
    } else if (todoStats.openCount > 0) {
      heroStatusText.textContent = `Brak zadań na dziś, ale w kolejce czeka ${todoStats.openCount}.`;
    } else {
      heroStatusText.textContent = "Dzień jest czysty. Dodaj pierwsze zadanie.";
    }
  }

  if (heroFocusValue) {
    if (typeof fmtTime === "function" && state.pomodoro) {
      heroFocusValue.textContent = fmtTime(state.pomodoro.remainingSec || 0);
    } else {
      heroFocusValue.textContent = "00:00";
    }
  }
  if (heroTodoValue) heroTodoValue.textContent = String(todoStats.openCount);
  if (heroHabitValue) heroHabitValue.textContent = `${habitStats.rate}%`;

  const dashTaskToday = $("dashTaskToday");
  const dashTaskUpcoming = $("dashTaskUpcoming");
  const dashTaskOverdue = $("dashTaskOverdue");

  if (dashTaskToday) dashTaskToday.textContent = String(todoStats.today);
  if (dashTaskUpcoming) dashTaskUpcoming.textContent = String(todoStats.upcoming);
  if (dashTaskOverdue) dashTaskOverdue.textContent = String(todoStats.overdue);

  const dashHabitWeekRate = $("dashHabitWeekRate");
  const dashBestStreak = $("dashBestStreak");
  const dashHabitCoverage = $("dashHabitCoverage");

  if (dashHabitWeekRate) dashHabitWeekRate.textContent = `${habitStats.rate}%`;
  if (dashBestStreak) dashBestStreak.textContent = `${bestStreak.streak} dni`;
  if (dashHabitCoverage) dashHabitCoverage.textContent = `${habitCoverage}%`;

  const dashExpenseMonth = $("dashExpenseMonth");
  const dashExpenseWeek = $("dashExpenseWeek");
  const dashExpenseTopCategory = $("dashExpenseTopCategory");

  if (dashExpenseMonth) dashExpenseMonth.textContent = moneyPL(expenseStats.monthTotalWithRecurring);
  if (dashExpenseWeek) dashExpenseWeek.textContent = moneyPL(expenseStats.weekTotal);
  if (dashExpenseTopCategory) dashExpenseTopCategory.textContent = expenseStats.topCategory;

  const dashWishlistCount = $("dashWishlistCount");
  const dashWishlistBudget = $("dashWishlistBudget");
  if (dashWishlistCount) dashWishlistCount.textContent = String(wishStats.itemsCount);
  if (dashWishlistBudget) dashWishlistBudget.textContent = moneyPL(wishStats.total);

  const trendSeries = buildDashboardTrendSeries(14);
  const dashProductivityDone = $("dashProductivityDone");
  const dashProductivityHabits = $("dashProductivityHabits");
  const dashProductivityFail = $("dashProductivityFail");
  const dashCompareWeek = $("dashCompareWeek");
  const dashCompareMonth = $("dashCompareMonth");

  if (dashProductivityDone) dashProductivityDone.textContent = String(trendSeries.totalTodoDone);
  if (dashProductivityHabits) dashProductivityHabits.textContent = String(trendSeries.totalHabitDone);
  if (dashProductivityFail) dashProductivityFail.textContent = String(trendSeries.totalHabitFail);

  if (typeof getHabitPeriodComparisons === "function") {
    const cmp = getHabitPeriodComparisons();
    if (dashCompareWeek) dashCompareWeek.textContent = pctDeltaText(cmp.weekDelta);
    if (dashCompareMonth) dashCompareMonth.textContent = pctDeltaText(cmp.monthDelta);
  }

  const habitsKpiDone = $("habitsKpiDone");
  const habitsKpiFail = $("habitsKpiFail");
  const habitsKpiRate = $("habitsKpiRate");
  if (habitsKpiDone) habitsKpiDone.textContent = String(habitStats.done);
  if (habitsKpiFail) habitsKpiFail.textContent = String(habitStats.fail);
  if (habitsKpiRate) habitsKpiRate.textContent = `${habitStats.rate}%`;

  const todoKpiToday = $("todoKpiToday");
  const todoKpiUpcoming = $("todoKpiUpcoming");
  const todoKpiOverdue = $("todoKpiOverdue");
  if (todoKpiToday) todoKpiToday.textContent = String(todoStats.today);
  if (todoKpiUpcoming) todoKpiUpcoming.textContent = String(todoStats.upcoming);
  if (todoKpiOverdue) todoKpiOverdue.textContent = String(todoStats.overdue);

  const todoInsightOpen = $("todoInsightOpen");
  const todoInsightHigh = $("todoInsightHigh");
  const todoInsightDone = $("todoInsightDone");
  const todoInsightNext = $("todoInsightNext");

  if (todoInsightOpen) todoInsightOpen.textContent = String(todoStats.openCount);
  if (todoInsightHigh) todoInsightHigh.textContent = String(todoStats.highOpen);
  if (todoInsightDone) todoInsightDone.textContent = String(todoStats.doneCount);
  if (todoInsightNext) {
    todoInsightNext.innerHTML = "";
    if (!todoStats.nextDeadlines.length) {
      const empty = document.createElement("div");
      empty.className = "todoEmpty";
      empty.textContent = "Brak otwartych terminów.";
      todoInsightNext.appendChild(empty);
    } else {
      for (const it of todoStats.nextDeadlines) {
        const row = document.createElement("div");
        row.className = "todoInsightRow";
        row.textContent = `${fmtPL(fromISO(it.dateISO))} • ${it.text}`;
        todoInsightNext.appendChild(row);
      }
    }
  }

  const expKpiMonth = $("expKpiMonth");
  const expKpiWeek = $("expKpiWeek");
  const expKpiTopCategory = $("expKpiTopCategory");

  const expStatDay = $("expStatDay");
  const expStatWeek = $("expStatWeek");
  const expStatMonth = $("expStatMonth");
  const expCategoryList = $("expCategoryList");

  if (expKpiMonth) expKpiMonth.textContent = moneyPL(expenseStats.monthTotalWithRecurring);
  if (expKpiWeek) expKpiWeek.textContent = moneyPL(expenseStats.weekTotal);
  if (expKpiTopCategory) expKpiTopCategory.textContent = expenseStats.topCategory;
  if (expStatDay) expStatDay.textContent = moneyPL(expenseStats.today);
  if (expStatWeek) expStatWeek.textContent = moneyPL(expenseStats.weekTotal);
  if (expStatMonth) expStatMonth.textContent = moneyPL(expenseStats.monthTotalWithRecurring);
  if (expCategoryList) {
    expCategoryList.innerHTML = "";
    if (!expenseStats.categories.length) {
      const empty = document.createElement("div");
      empty.className = "todoEmpty";
      empty.textContent = "Brak danych kategorii.";
      expCategoryList.appendChild(empty);
    } else {
      const top = expenseStats.categories[0]?.value || 0;

      for (const cat of expenseStats.categories.slice(0, 6)) {
        const row = document.createElement("div");
        row.className = "expCategoryItem";

        const topRow = document.createElement("div");
        topRow.className = "expCategoryTop";

        const name = document.createElement("span");
        name.className = "expCategoryName";
        name.textContent = cat.name;

        const value = document.createElement("strong");
        value.className = "expCategoryValue";
        value.textContent = moneyPL(cat.value);

        topRow.appendChild(name);
        topRow.appendChild(value);

        const bar = document.createElement("div");
        bar.className = "expCategoryBar";

        const fill = document.createElement("div");
        fill.className = "expCategoryBarFill";
        const pct = top > 0 ? Math.max(8, Math.round((cat.value / top) * 100)) : 0;
        fill.style.width = `${pct}%`;

        bar.appendChild(fill);
        row.appendChild(topRow);
        row.appendChild(bar);
        expCategoryList.appendChild(row);
      }
    }
  }

  const wishKpiItems = $("wishKpiItems");
  const wishKpiBudget = $("wishKpiBudget");
  const wishKpiAvg = $("wishKpiAvg");

  if (wishKpiItems) wishKpiItems.textContent = String(wishStats.itemsCount);
  if (wishKpiBudget) wishKpiBudget.textContent = moneyPL(wishStats.total);
  if (wishKpiAvg) wishKpiAvg.textContent = moneyPL(wishStats.avg);

  renderDashboardCharts(trendSeries);
  renderDashboardTodoPreview(todoStats.preview);
  renderActivityPreview();
}

function focusWishlistQuickAdd() {
  setView("wishlist");
  setTimeout(() => { wishName?.focus(); }, 220);
}

function renderAll() {
  renderCalendar();
  renderHabits();
  renderTodos();
  renderExpenses();
  renderChart();
  renderWishlist();
  pomoSyncUI();
  renderOverviewPanels();

  if (typeof syncAllCustomSelects === "function") {
    syncAllCustomSelects();
  }
}

function isMobileDrawerMode() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function openSidebarDrawer() {
  if (!isMobileDrawerMode() || !sidebar) return;
  sidebar.classList.add("isOpen");
  document.body.classList.add("drawerOpen");
  mobileMenuBtn?.setAttribute("aria-expanded", "true");
}

function closeSidebarDrawer() {
  sidebar?.classList.remove("isOpen");
  document.body.classList.remove("drawerOpen");
  mobileMenuBtn?.setAttribute("aria-expanded", "false");
}

function toggleSidebarDrawer() {
  if (sidebar?.classList.contains("isOpen")) {
    closeSidebarDrawer();
    return;
  }
  openSidebarDrawer();
}

function initMobileDrawer() {
  mobileMenuBtn?.addEventListener("click", toggleSidebarDrawer);
  sidebarCloseBtn?.addEventListener("click", closeSidebarDrawer);
  sidebarOverlay?.addEventListener("click", closeSidebarDrawer);

  let touchStartX = 0;
  let touchStartY = 0;

  sidebar?.addEventListener("touchstart", (e) => {
    if (!sidebar.classList.contains("isOpen")) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  sidebar?.addEventListener("touchend", (e) => {
    if (!sidebar.classList.contains("isOpen")) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (dx < -56 && Math.abs(dy) < 48) {
      closeSidebarDrawer();
    }
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (!isMobileDrawerMode()) closeSidebarDrawer();
  });
}

function addDashboardQuickTodo() {
  const text = String(dashQuickTodoText?.value || "").trim();
  if (!text || typeof addTodo !== "function") {
    if (dashQuickHint) {
      dashQuickHint.textContent = "Wpisz treść zadania, aby dodać szybkie ToDo.";
      dashQuickHint.classList.add("isError");
    }
    return;
  }

  const priority = dashQuickTodoPriority?.value || "medium";
  addTodo(state.selectedDate, text, priority);

  if (dashQuickTodoText) dashQuickTodoText.value = "";
  if (dashQuickTodoPriority) {
    dashQuickTodoPriority.value = "medium";
    syncCustomSelect(dashQuickTodoPriority);
  }

  if (dashQuickHint) {
    dashQuickHint.textContent = "ToDo dodane do aktywnego dnia.";
    dashQuickHint.classList.remove("isError");
  }
}

function initOverviewActions() {
  $("heroOpenTodo")?.addEventListener("click", () => setView("todo"));
  $("heroOpenHabits")?.addEventListener("click", () => setView("habits"));
  $("heroAddExpense")?.addEventListener("click", () => {
    setView("expenses");
    openExpModal();
  });

  $("dashGoExpensesBtn")?.addEventListener("click", () => setView("expenses"));
  $("dashGoWishlistBtn")?.addEventListener("click", () => setView("wishlist"));
  $("dashAddTodoBtn")?.addEventListener("click", () => openTodoModal(getSelectedDateObj()));
  $("todoQuickAddBtn")?.addEventListener("click", () => openTodoModal(getSelectedDateObj()));
  dashQuickTodoAdd?.addEventListener("click", addDashboardQuickTodo);
  dashQuickTodoText?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDashboardQuickTodo();
  });
  dashQuickTodoText?.addEventListener("input", () => {
    dashQuickHint?.classList.remove("isError");
  });

  window.addEventListener("hashchange", () => {
    if (ignoreNextHashChange) {
      ignoreNextHashChange = false;
      return;
    }
    setView(getViewFromHash(), { updateHash: false });
  });
}

document.addEventListener("keydown", (e) => {
  if (todoOverlay?.classList.contains("isOpen") && e.key === "Escape") closeTodoModal();
  if (chartOverlay?.classList.contains("isOpen") && e.key === "Escape") closeChartModal();
  if (wishOverlay?.classList.contains("isOpen") && e.key === "Escape") closeWishModal();
  if (sidebar?.classList.contains("isOpen") && e.key === "Escape") closeSidebarDrawer();
});

if (navDash) navDash.addEventListener("click", () => setView("dashboard"));
if (navHabits) navHabits.addEventListener("click", () => setView("habits"));
if (navTodo) navTodo.addEventListener("click", () => setView("todo"));
if (navExpenses) navExpenses.addEventListener("click", () => setView("expenses"));
if (navWishlist) navWishlist.addEventListener("click", () => setView("wishlist"));

if (navAddWishlist) navAddWishlist.addEventListener("click", (e) => {
  e.stopPropagation();
  setView("wishlist");
  openWishModal();
});
if (navWishlist) navWishlist.addEventListener("dblclick", () => {
  setView("wishlist");
  openWishModal();
});

if (navAddHabits) navAddHabits.addEventListener("click", (e) => {
  e.stopPropagation();
  setView("habits");
  openHabitModal();
});
if (navHabits) navHabits.addEventListener("dblclick", () => {
  setView("habits");
  openHabitModal();
});

if (navAddTodo) navAddTodo.addEventListener("click", (e) => {
  e.stopPropagation();
  setView("todo");
  openTodoModal(getSelectedDateObj());
});
if (navTodo) navTodo.addEventListener("dblclick", () => {
  setView("todo");
  openTodoModal(getSelectedDateObj());
});

if (navAddExpenses) navAddExpenses.addEventListener("click", (e) => {
  e.stopPropagation();
  setView("expenses");
  openExpModal();
});
if (navExpenses) navExpenses.addEventListener("dblclick", (e) => {
  e.preventDefault();
  setView("expenses");
  openExpModal();
});

initMobileDrawer();
initOverviewActions();
initSyncFeedback();

initTheme();

const initialView = getViewFromHash();
setView(initialView, { updateHash: false, skipRender: true });

(async () => {
  try {
    if (AUTH_USER) {
      const hasUserState = !!readUserState(AUTH_USER);

      if (!hasUserState) {
        importAnonStateToUserStorage(AUTH_USER, { overwrite: false });
      }

      if (REGISTER_OK && window.history?.replaceState) {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }

    try {
      await bootstrapFromServer();
    } catch (error) {
      console.error("bootstrapFromServer failed:", error);
    }

    ensureWishlist();
    ensurePomodoro();
    pomoRestoreRunning();

    initAuth();
    initCalendar();
    initHabits();
    initTodo();
    initExpenses();
    initChart();
    initWishlist();
    initPomodoro();

    initCustomSelects();

    renderAll();
    flushServerSync("boot");
  } finally {
    document.body.classList.remove("isBooting");
  }
})();