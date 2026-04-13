function getSelectedDateObj() {
  return fromISO(state.selectedDate);
}

const PAGE_HEADER_BY_NAV = {
  navDash: {
    title: "Dashboard",
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
    title: "Wishlist",
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

function syncPageHeader(navBtn) {
  if (!pageTitle || !pageSubtitle) return;

  const navId = navBtn?.id || "navDash";
  const conf = PAGE_HEADER_BY_NAV[navId] || PAGE_HEADER_BY_NAV.navDash;

  pageTitle.textContent = conf.title;
  pageSubtitle.textContent = conf.subtitle;
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
    renderOverviewPanels();
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

  const pending = [];

  for (const it of (state.todos || [])) {
    if (it.done) continue;

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
    preview: pending.slice(0, 6)
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
      if (v === 1) done += 1;
      else if (v === -1) fail += 1;
      else empty += 1;
    }
  }

  const decided = done + fail;
  const rate = decided > 0 ? Math.round((done / decided) * 100) : 0;

  return { done, fail, empty, rate };
}

function getBestCurrentHabitStreak() {
  const selected = getSelectedDateObj();
  const habits = state.habits || [];
  let best = 0;

  for (const h of habits) {
    let streak = 0;
    let d = startOfDay(selected);

    for (let guard = 0; guard < 3650; guard++) {
      const key = `${h.id}|${toISO(d)}`;
      if ((state.entries?.[key] ?? 0) !== 1) break;
      streak += 1;
      d = addDays(d, -1);
    }

    if (streak > best) best = streak;
  }

  return best;
}

function getExpenseStats() {
  const selected = getSelectedDateObj();
  const selectedISO = state.selectedDate;
  const month = selected.getMonth();
  const year = selected.getFullYear();

  let today = 0;
  let monthTotal = 0;
  let count = 0;
  const byCategory = {};

  for (const it of (state.expenses || [])) {
    const amount = Number(it.amount) || 0;
    if (it.dateISO === selectedISO) today += amount;

    const d = fromISO(it.dateISO);
    if (d.getMonth() === month && d.getFullYear() === year) {
      monthTotal += amount;
      count += 1;
      byCategory[it.category] = (byCategory[it.category] || 0) + amount;
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

  return {
    today,
    monthTotal,
    count,
    topCategory
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
      text: `Wishlist: ${it.name}`,
      meta: it.price == null ? "Cena: brak" : `Cena: ${moneyPL(it.price)}`
    });
  }

  out.sort((a, b) => b.at - a.at);
  return out.slice(0, 8);
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
}

function renderOverviewPanels() {
  const selected = getSelectedDateObj();
  const todoStats = getTodoStats();
  const habitStats = getHabitWeekStats();
  const expenseStats = getExpenseStats();
  const wishStats = getWishlistStats();
  const bestStreak = getBestCurrentHabitStreak();

  const heroDateText = $("heroDateText");
  const heroStatusText = $("heroStatusText");
  const heroFocusValue = $("heroFocusValue");
  const heroTodoValue = $("heroTodoValue");
  const heroSpendValue = $("heroSpendValue");

  if (heroDateText) {
    heroDateText.textContent = `${weekDayNamePL(selected)}, ${fmtPL(selected)}`;
  }

  if (heroStatusText) {
    if (todoStats.overdue > 0) {
      heroStatusText.textContent = `Masz ${todoStats.overdue} zaległych zadań. Zacznij od domknięcia backlogu.`;
    } else if (todoStats.today > 0) {
      heroStatusText.textContent = `Na dziś zaplanowano ${todoStats.today} zadań. Utrzymaj tempo i pilnuj priorytetów.`;
    } else {
      heroStatusText.textContent = "Dzień jest czysty. Dodaj kluczowy cel i wejdź w flow.";
    }
  }

  if (heroFocusValue) {
    if (typeof fmtTime === "function" && state.pomodoro) {
      heroFocusValue.textContent = fmtTime(state.pomodoro.remainingSec || 0);
    } else {
      heroFocusValue.textContent = "00:00";
    }
  }
  if (heroTodoValue) heroTodoValue.textContent = String(todoStats.today);
  if (heroSpendValue) heroSpendValue.textContent = moneyPL(expenseStats.today);

  const dashTodayTodos = $("dashTodayTodos");
  const dashBestStreak = $("dashBestStreak");
  const dashMonthSpend = $("dashMonthSpend");
  const dashWishlistValue = $("dashWishlistValue");

  if (dashTodayTodos) dashTodayTodos.textContent = String(todoStats.today);
  if (dashBestStreak) dashBestStreak.textContent = `${bestStreak} dni`;
  if (dashMonthSpend) dashMonthSpend.textContent = moneyPL(expenseStats.monthTotal);
  if (dashWishlistValue) dashWishlistValue.textContent = moneyPL(wishStats.total);

  const dashHabitDone = $("dashHabitDone");
  const dashHabitFail = $("dashHabitFail");
  const dashHabitEmpty = $("dashHabitEmpty");
  const dashHabitRate = $("dashHabitRate");

  if (dashHabitDone) dashHabitDone.textContent = String(habitStats.done);
  if (dashHabitFail) dashHabitFail.textContent = String(habitStats.fail);
  if (dashHabitEmpty) dashHabitEmpty.textContent = String(habitStats.empty);
  if (dashHabitRate) dashHabitRate.textContent = `${habitStats.rate}%`;

  const dashExpenseMonth = $("dashExpenseMonth");
  const dashExpenseCount = $("dashExpenseCount");
  const dashWishlistCount = $("dashWishlistCount");
  const dashWishlistBudget = $("dashWishlistBudget");

  if (dashExpenseMonth) dashExpenseMonth.textContent = moneyPL(expenseStats.monthTotal);
  if (dashExpenseCount) dashExpenseCount.textContent = String(expenseStats.count);
  if (dashWishlistCount) dashWishlistCount.textContent = String(wishStats.itemsCount);
  if (dashWishlistBudget) dashWishlistBudget.textContent = moneyPL(wishStats.total);

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

  const expKpiMonth = $("expKpiMonth");
  const expKpiTopCategory = $("expKpiTopCategory");
  const expKpiCount = $("expKpiCount");
  if (expKpiMonth) expKpiMonth.textContent = moneyPL(expenseStats.monthTotal);
  if (expKpiTopCategory) expKpiTopCategory.textContent = expenseStats.topCategory;
  if (expKpiCount) expKpiCount.textContent = String(expenseStats.count);

  const wishKpiItems = $("wishKpiItems");
  const wishKpiBudget = $("wishKpiBudget");
  const wishKpiAvg = $("wishKpiAvg");
  if (wishKpiItems) wishKpiItems.textContent = String(wishStats.itemsCount);
  if (wishKpiBudget) wishKpiBudget.textContent = moneyPL(wishStats.total);
  if (wishKpiAvg) wishKpiAvg.textContent = moneyPL(wishStats.avg);

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

function initOverviewActions() {
  $("heroOpenTodo")?.addEventListener("click", () => setView("todo"));
  $("heroOpenHabits")?.addEventListener("click", () => setView("habits"));
  $("heroAddExpense")?.addEventListener("click", () => {
    setView("expenses");
    openExpModal();
  });

  $("dashGoTodoBtn")?.addEventListener("click", () => setView("todo"));
  $("dashGoHabitsBtn")?.addEventListener("click", () => setView("habits"));
  $("dashGoExpensesBtn")?.addEventListener("click", () => setView("expenses"));
  $("dashGoWishlistBtn")?.addEventListener("click", () => setView("wishlist"));
  $("dashAddTodoBtn")?.addEventListener("click", () => openTodoModal(getSelectedDateObj()));

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

initTheme();

(async () => {
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

  const initialView = getViewFromHash();
  setView(initialView, { updateHash: false, skipRender: true });
  renderAll();
  flushServerSync("boot");
})();