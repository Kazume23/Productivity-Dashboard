const EXPENSE_ALLOWED_SCORE = ["A", "B", "C", "D"];
const EXPENSE_ALLOWED_PERIOD = ["once", "weekly", "monthly", "yearly"];
const RECURRING_ALLOWED_PERIOD = ["weekly", "monthly", "yearly"];

let expCategoryChart = null;
let expTrendChart = null;
const expBudgetAlertMemo = {};

function ensureExpenses() {
  if (!Array.isArray(state.expenses)) state.expenses = [];
  if (!Array.isArray(state.expBudgets)) state.expBudgets = [];
  if (!Array.isArray(state.expRecurring)) state.expRecurring = [];
  if (!Array.isArray(state.expSavingsGoals)) state.expSavingsGoals = [];
}

function destroyExpChart(instance) {
  if (!instance) return null;
  instance.destroy();
  return null;
}

function clearExpCanvas(canvas) {
  const ctx = canvas?.getContext?.("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function expenseCssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function getExpenseFilterISO() {
  return state.selectedDate;
}

function normalizeAmountInput(inputEl) {
  if (!inputEl) return;
  let v = String(inputEl.value || "");
  v = v.replace(/[^0-9.,]/g, "");
  const parts = v.split(/[.,]/);
  if (parts[0].length > 9) parts[0] = parts[0].slice(0, 9);
  inputEl.value = parts.length > 1 ? parts[0] + "," + parts[1].slice(0, 2) : parts[0];
}

function parseAmount(raw) {
  return Number(String(raw || "").replace(",", "."));
}

function isValidISODate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return false;
  return toISO(fromISO(String(iso))) === String(iso);
}

function normalizeExpensePeriod(raw) {
  const v = String(raw || "").trim();
  return EXPENSE_ALLOWED_PERIOD.includes(v) ? v : "once";
}

function normalizeRecurringPeriod(raw) {
  const v = String(raw || "").trim();
  return RECURRING_ALLOWED_PERIOD.includes(v) ? v : "monthly";
}

function monthBounds(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: startOfDay(start), end: startOfDay(end) };
}

function monthKey(year, month) {
  return `${year}-${pad2(month + 1)}`;
}

function addMonthsKeepingDay(d, amount = 1) {
  const base = startOfDay(d);
  const wantedDay = base.getDate();
  const tmp = new Date(base.getFullYear(), base.getMonth() + amount, 1);
  const lastDay = new Date(tmp.getFullYear(), tmp.getMonth() + 1, 0).getDate();
  tmp.setDate(Math.min(wantedDay, lastDay));
  return startOfDay(tmp);
}

function advanceRecurringDate(dateObj, period) {
  const p = normalizeRecurringPeriod(period);
  const d = startOfDay(dateObj);

  if (p === "weekly") return addDays(d, 7);
  if (p === "yearly") {
    const next = new Date(d);
    next.setFullYear(next.getFullYear() + 1);
    return startOfDay(next);
  }

  return addMonthsKeepingDay(d, 1);
}

function monthCategoryTotals(year, month) {
  const out = {};
  for (const it of (state.expenses || [])) {
    if (!isValidISODate(it.dateISO)) continue;
    const d = fromISO(it.dateISO);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const category = String(it.category || "Inne").trim() || "Inne";
    out[category] = (out[category] || 0) + (Number(it.amount) || 0);
  }
  return out;
}

function totalExpensesForMonth(year, month) {
  let total = 0;
  for (const it of (state.expenses || [])) {
    if (!isValidISODate(it.dateISO)) continue;
    const d = fromISO(it.dateISO);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    total += Number(it.amount) || 0;
  }
  return total;
}

function getRecurringProjectedTotalForMonth(year, month) {
  ensureExpenses();

  const { start, end } = monthBounds(year, month);
  let total = 0;

  for (const rec of (state.expRecurring || [])) {
    if (!rec?.active) continue;
    if (!isValidISODate(rec.nextDate)) continue;

    let cursor = fromISO(rec.nextDate);
    for (let guard = 0; guard < 2000; guard++) {
      if (cursor > end) break;
      if (cursor >= start) total += Number(rec.amount) || 0;
      cursor = advanceRecurringDate(cursor, rec.period);
    }
  }

  return Number(total.toFixed(2));
}

function getUpcomingRecurringRows(fromDateISO, days = 30) {
  ensureExpenses();

  const fromDate = isValidISODate(fromDateISO)
    ? fromISO(fromDateISO)
    : startOfDay(new Date());
  const horizon = addDays(fromDate, Math.max(1, days));
  const rows = [];

  for (const rec of (state.expRecurring || [])) {
    if (!rec?.active) continue;
    if (!isValidISODate(rec.nextDate)) continue;

    let cursor = fromISO(rec.nextDate);
    for (let guard = 0; guard < 300; guard++) {
      if (cursor > horizon) break;
      if (cursor >= fromDate) {
        rows.push({
          id: rec.id,
          name: rec.name,
          amount: Number(rec.amount) || 0,
          category: rec.category || "Subskrypcje",
          period: normalizeRecurringPeriod(rec.period),
          dateISO: toISO(cursor)
        });
      }
      cursor = advanceRecurringDate(cursor, rec.period);
    }
  }

  rows.sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
    return (a.amount || 0) - (b.amount || 0);
  });

  return rows;
}

function createExpenseFromInput(amountRaw, whatRaw, category, score, period, dateISO) {
  const amount = parseAmount(amountRaw);
  const what = String(whatRaw || "").trim();

  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (String(Math.floor(amount)).length > 10) return null;
  if (!what) return null;

  const iso = String(dateISO || getExpenseFilterISO()).trim();
  if (!isValidISODate(iso)) return null;

  const normalizedScore = String(score || "B").trim();

  return {
    id: crypto.randomUUID(),
    dateISO: iso,
    amount: Number(amount.toFixed(2)),
    what,
    category: String(category || "Inne").trim() || "Inne",
    score: EXPENSE_ALLOWED_SCORE.includes(normalizedScore) ? normalizedScore : "B",
    period: normalizeExpensePeriod(period),
    createdAt: Date.now()
  };
}

function appendExpense(entry) {
  ensureExpenses();
  if (!entry) return false;
  state.expenses.push(entry);
  saveState();
  return true;
}

function setQuickExpenseHint(msg, isError = false) {
  if (!dashQuickHint) return;
  dashQuickHint.textContent = msg;
  dashQuickHint.classList.toggle("isError", !!isError);
}

function clearQuickExpenseHintError() {
  if (!dashQuickHint) return;
  dashQuickHint.classList.remove("isError");
}

function scoreLabel(v) {
  if (v === "A") return "A — Wysoki priorytet";
  if (v === "B") return "B — Konieczny";
  if (v === "C") return "C — Opcjonalny";
  return "D — Zbędny";
}

function periodLabel(v) {
  if (v === "weekly") return "Tygodniowe";
  if (v === "monthly") return "Miesięczne";
  if (v === "yearly") return "Roczne";
  return "Jednorazowe";
}

function recurringPeriodLabel(v) {
  if (v === "weekly") return "co tydzień";
  if (v === "yearly") return "co rok";
  return "co miesiąc";
}

function itemsSliceSum(items) {
  let sum = 0;
  for (const it of items) sum += Number(it.amount) || 0;
  return sum;
}

function createBudgetFromInput(categoryRaw, limitRaw, alertPctRaw) {
  const category = String(categoryRaw || "").trim() || "Inne";
  const limit = parseAmount(limitRaw);
  const alertPct = Math.min(100, Math.max(1, Math.round(Number(alertPctRaw) || 80)));

  if (!Number.isFinite(limit) || limit <= 0) return null;

  return {
    id: crypto.randomUUID(),
    category,
    limit: Number(limit.toFixed(2)),
    alertPct,
    createdAt: Date.now()
  };
}

function upsertBudget(entry) {
  if (!entry) return false;
  ensureExpenses();

  const existingIdx = state.expBudgets.findIndex(
    (b) => String(b.category || "").toLowerCase() === entry.category.toLowerCase()
  );

  if (existingIdx >= 0) {
    state.expBudgets[existingIdx] = {
      ...state.expBudgets[existingIdx],
      limit: entry.limit,
      alertPct: entry.alertPct,
      category: entry.category
    };
  } else {
    state.expBudgets.push(entry);
  }

  saveState();
  return true;
}

function deleteBudget(id) {
  ensureExpenses();
  state.expBudgets = state.expBudgets.filter((b) => b.id !== id);
  saveState();
  renderExpenses();
}

function budgetStatus(pct, alertPct) {
  if (pct >= 100) return "over";
  if (pct >= alertPct) return "near";
  return "ok";
}

function getBudgetRowsForSelectedMonth() {
  ensureExpenses();

  const selected = fromISO(state.selectedDate);
  const year = selected.getFullYear();
  const month = selected.getMonth();
  const totals = monthCategoryTotals(year, month);

  return (state.expBudgets || [])
    .map((b) => {
      const spent = Number(totals[b.category] || 0);
      const limit = Number(b.limit) || 0;
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const status = budgetStatus(pct, Number(b.alertPct) || 80);
      const left = limit - spent;
      return {
        ...b,
        spent,
        pct,
        status,
        left
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) {
        const order = { over: 0, near: 1, ok: 2 };
        return (order[a.status] || 9) - (order[b.status] || 9);
      }
      return String(a.category).localeCompare(String(b.category));
    });
}

function emitBudgetAlertsForSelectedMonth() {
  if (typeof showToast !== "function") return;

  const selected = fromISO(state.selectedDate);
  const keyPrefix = monthKey(selected.getFullYear(), selected.getMonth());
  const rows = getBudgetRowsForSelectedMonth();
  const activeKeys = {};

  for (const row of rows) {
    if (row.status !== "near" && row.status !== "over") continue;
    const key = `${keyPrefix}|${row.category}|${row.status}`;
    activeKeys[key] = true;

    if (expBudgetAlertMemo[key]) continue;

    if (row.status === "over") {
      showToast(`Budżet "${row.category}" został przekroczony (${row.pct}%).`, "error", 5200);
    } else {
      showToast(`Budżet "${row.category}" zbliża się do limitu (${row.pct}%).`, "info", 4200);
    }

    expBudgetAlertMemo[key] = true;
  }

  for (const key of Object.keys(expBudgetAlertMemo)) {
    if (!key.startsWith(keyPrefix + "|")) continue;
    if (activeKeys[key]) continue;
    delete expBudgetAlertMemo[key];
  }
}

function renderBudgets() {
  if (!expBudgetList || !expBudgetSummary) return;

  const rows = getBudgetRowsForSelectedMonth();
  expBudgetList.innerHTML = "";

  if (!rows.length) {
    expBudgetSummary.textContent = "Dodaj pierwszy budżet kategorii.";
    return;
  }

  const nearCount = rows.filter((r) => r.status === "near").length;
  const overCount = rows.filter((r) => r.status === "over").length;
  expBudgetSummary.textContent = `Aktywne: ${rows.length} • Blisko limitu: ${nearCount} • Przekroczone: ${overCount}`;

  const frag = document.createDocumentFragment();

  for (const row of rows) {
    const item = document.createElement("div");
    item.className = "expBudgetItem";
    if (row.status === "near") item.classList.add("isNear");
    if (row.status === "over") item.classList.add("isOver");

    const top = document.createElement("div");
    top.className = "expBudgetTop";

    const title = document.createElement("strong");
    title.textContent = row.category;

    const value = document.createElement("span");
    value.textContent = `${moneyPL(row.spent)} / ${moneyPL(row.limit)}`;

    top.appendChild(title);
    top.appendChild(value);

    const bar = document.createElement("div");
    bar.className = "expBudgetBar";

    const fill = document.createElement("div");
    fill.className = "expBudgetFill";
    if (row.status === "near") fill.classList.add("isNear");
    if (row.status === "over") fill.classList.add("isOver");
    fill.style.width = `${Math.max(4, Math.min(100, row.pct))}%`;

    bar.appendChild(fill);

    const meta = document.createElement("div");
    meta.className = "expBudgetMeta";
    meta.textContent = row.left >= 0
      ? `Pozostało ${moneyPL(row.left)} • Alert ${row.alertPct}%`
      : `Przekroczenie ${moneyPL(Math.abs(row.left))} • Alert ${row.alertPct}%`;

    const actions = document.createElement("div");
    actions.className = "expBudgetActions";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "expMiniBtn";
    del.textContent = "Usuń";
    del.addEventListener("click", () => deleteBudget(row.id));

    actions.appendChild(del);

    item.appendChild(top);
    item.appendChild(bar);
    item.appendChild(meta);
    item.appendChild(actions);

    frag.appendChild(item);
  }

  expBudgetList.appendChild(frag);
}

function createRecurringFromInput(nameRaw, amountRaw, categoryRaw, periodRaw, nextDateRaw, active) {
  const name = String(nameRaw || "").trim();
  const amount = parseAmount(amountRaw);
  const category = String(categoryRaw || "Subskrypcje").trim() || "Subskrypcje";
  const period = normalizeRecurringPeriod(periodRaw);
  const nextDate = String(nextDateRaw || "").trim();

  if (!name) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!isValidISODate(nextDate)) return null;

  return {
    id: crypto.randomUUID(),
    name,
    amount: Number(amount.toFixed(2)),
    category,
    period,
    nextDate,
    active: active !== false,
    createdAt: Date.now()
  };
}

function addRecurringCost() {
  ensureExpenses();

  const entry = createRecurringFromInput(
    expRecurringName?.value,
    expRecurringAmount?.value,
    expRecurringCategory?.value,
    expRecurringPeriod?.value,
    expRecurringNextDate?.value,
    expRecurringActive?.checked
  );

  if (!entry) {
    if (typeof showToast === "function") {
      showToast("Uzupełnij poprawnie nazwę, kwotę i datę kosztu cyklicznego.", "error", 4200);
    }
    return;
  }

  state.expRecurring.push(entry);
  saveState();

  if (expRecurringName) expRecurringName.value = "";
  if (expRecurringAmount) expRecurringAmount.value = "";
  if (expRecurringCategory) {
    expRecurringCategory.value = "Subskrypcje";
    syncCustomSelect(expRecurringCategory);
  }
  if (expRecurringPeriod) {
    expRecurringPeriod.value = "monthly";
    syncCustomSelect(expRecurringPeriod);
  }
  if (expRecurringNextDate) expRecurringNextDate.value = state.selectedDate;
  if (expRecurringActive) expRecurringActive.checked = true;

  renderExpenses();
}

function toggleRecurringActive(id) {
  ensureExpenses();
  const item = state.expRecurring.find((x) => x.id === id);
  if (!item) return;

  item.active = !item.active;
  saveState();
  renderExpenses();
}

function deleteRecurringCost(id) {
  ensureExpenses();
  state.expRecurring = state.expRecurring.filter((x) => x.id !== id);
  saveState();
  renderExpenses();
}

function renderRecurringCosts() {
  if (!expRecurringList || !expRecurringSummary) return;

  expRecurringList.innerHTML = "";
  const items = [...(state.expRecurring || [])].sort((a, b) => {
    if (a.nextDate !== b.nextDate) return a.nextDate.localeCompare(b.nextDate);
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  if (!items.length) {
    expRecurringSummary.textContent = "Brak kosztów cyklicznych.";
    return;
  }

  const selected = fromISO(state.selectedDate);
  const projected = getRecurringProjectedTotalForMonth(selected.getFullYear(), selected.getMonth());
  const activeCount = items.filter((x) => x.active).length;
  expRecurringSummary.textContent = `Aktywne: ${activeCount}/${items.length} • Projekcja miesiąca: ${moneyPL(projected)}`;

  const frag = document.createDocumentFragment();

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "expRecurringItem";
    if (!it.active) row.classList.add("isInactive");

    const main = document.createElement("div");
    main.className = "expRecurringMain";

    const name = document.createElement("div");
    name.className = "expRecurringName";
    name.textContent = it.name;

    const meta = document.createElement("div");
    meta.className = "expRecurringMeta";
    meta.textContent = `${moneyPL(it.amount)} • ${it.category || "Subskrypcje"} • ${recurringPeriodLabel(it.period)} • start: ${fmtPL(fromISO(it.nextDate))}`;

    main.appendChild(name);
    main.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "expRecurringActions";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "expMiniBtn";
    toggle.textContent = it.active ? "Wyłącz" : "Włącz";
    toggle.addEventListener("click", () => toggleRecurringActive(it.id));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "expMiniBtn danger";
    del.textContent = "Usuń";
    del.addEventListener("click", () => deleteRecurringCost(it.id));

    actions.appendChild(toggle);
    actions.appendChild(del);

    row.appendChild(main);
    row.appendChild(actions);
    frag.appendChild(row);
  }

  expRecurringList.appendChild(frag);
}

function createSavingsGoalFromInput(nameRaw, targetRaw, currentRaw, deadlineRaw) {
  const name = String(nameRaw || "").trim();
  const target = parseAmount(targetRaw);
  const currentParsed = parseAmount(currentRaw);
  const current = Number.isFinite(currentParsed) ? Math.max(0, currentParsed) : 0;
  const deadlineISO = String(deadlineRaw || "").trim();

  if (!name) return null;
  if (!Number.isFinite(target) || target <= 0) return null;
  if (deadlineISO && !isValidISODate(deadlineISO)) return null;

  return {
    id: crypto.randomUUID(),
    name,
    target: Number(target.toFixed(2)),
    current: Number(current.toFixed(2)),
    deadlineISO: deadlineISO || "",
    createdAt: Date.now()
  };
}

function addSavingsGoal() {
  ensureExpenses();

  const entry = createSavingsGoalFromInput(
    expGoalName?.value,
    expGoalTarget?.value,
    expGoalCurrent?.value,
    expGoalDeadline?.value
  );

  if (!entry) {
    if (typeof showToast === "function") {
      showToast("Uzupełnij poprawnie nazwę i kwotę celu oszczędnościowego.", "error", 4200);
    }
    return;
  }

  state.expSavingsGoals.push(entry);
  saveState();

  if (expGoalName) expGoalName.value = "";
  if (expGoalTarget) expGoalTarget.value = "";
  if (expGoalCurrent) expGoalCurrent.value = "";
  if (expGoalDeadline) expGoalDeadline.value = "";

  renderExpenses();
}

function deleteSavingsGoal(id) {
  ensureExpenses();
  state.expSavingsGoals = state.expSavingsGoals.filter((x) => x.id !== id);
  saveState();
  renderExpenses();
}

function addSavingsContribution(goalId) {
  ensureExpenses();
  const goal = state.expSavingsGoals.find((x) => x.id === goalId);
  if (!goal) return;

  const raw = window.prompt(`Dopisz wpłatę do celu "${goal.name}"`, "100");
  if (raw === null) return;

  const amount = parseAmount(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    if (typeof showToast === "function") {
      showToast("Wpłata musi być dodatnią liczbą.", "error", 3000);
    }
    return;
  }

  goal.current = Number((Number(goal.current || 0) + amount).toFixed(2));
  saveState();
  renderExpenses();
}

function renderSavingsGoals() {
  if (!expGoalList || !expGoalSummary) return;

  expGoalList.innerHTML = "";
  const goals = [...(state.expSavingsGoals || [])].sort((a, b) => {
    const aPct = (Number(a.current) || 0) / Math.max(1, Number(a.target) || 1);
    const bPct = (Number(b.current) || 0) / Math.max(1, Number(b.target) || 1);
    return bPct - aPct;
  });

  if (!goals.length) {
    expGoalSummary.textContent = "Dodaj pierwszy cel oszczędnościowy.";
    return;
  }

  let targetSum = 0;
  let currentSum = 0;
  for (const g of goals) {
    targetSum += Number(g.target) || 0;
    currentSum += Number(g.current) || 0;
  }
  const totalPct = targetSum > 0 ? Math.round((currentSum / targetSum) * 100) : 0;
  expGoalSummary.textContent = `Cele: ${goals.length} • Zebrane: ${moneyPL(currentSum)} / ${moneyPL(targetSum)} (${totalPct}%)`;

  const frag = document.createDocumentFragment();

  for (const goal of goals) {
    const target = Number(goal.target) || 0;
    const current = Number(goal.current) || 0;
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

    const item = document.createElement("div");
    item.className = "expGoalItem";

    const top = document.createElement("div");
    top.className = "expGoalTop";

    const title = document.createElement("strong");
    title.textContent = goal.name;

    const value = document.createElement("span");
    value.textContent = `${moneyPL(current)} / ${moneyPL(target)}`;

    top.appendChild(title);
    top.appendChild(value);

    const bar = document.createElement("div");
    bar.className = "expGoalBar";

    const fill = document.createElement("div");
    fill.className = "expGoalFill";
    fill.style.width = `${Math.max(4, pct)}%`;

    bar.appendChild(fill);

    const meta = document.createElement("div");
    meta.className = "expGoalMeta";
    const deadlineText = goal.deadlineISO ? ` • Deadline: ${fmtPL(fromISO(goal.deadlineISO))}` : "";
    meta.textContent = `Postęp: ${pct}%${deadlineText}`;

    const actions = document.createElement("div");
    actions.className = "expGoalActions";

    const addMoney = document.createElement("button");
    addMoney.type = "button";
    addMoney.className = "expMiniBtn";
    addMoney.textContent = "Dopisz wpłatę";
    addMoney.addEventListener("click", () => addSavingsContribution(goal.id));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "expMiniBtn danger";
    del.textContent = "Usuń";
    del.addEventListener("click", () => deleteSavingsGoal(goal.id));

    actions.appendChild(addMoney);
    actions.appendChild(del);

    item.appendChild(top);
    item.appendChild(bar);
    item.appendChild(meta);
    item.appendChild(actions);

    frag.appendChild(item);
  }

  expGoalList.appendChild(frag);
}

function topCategoryForMonth(year, month) {
  const rows = Object.entries(monthCategoryTotals(year, month));
  if (!rows.length) return { name: "-", value: 0 };

  rows.sort((a, b) => b[1] - a[1]);
  return {
    name: rows[0][0],
    value: Number(rows[0][1]) || 0
  };
}

function computeMonthComparison() {
  const selected = fromISO(state.selectedDate);
  const cy = selected.getFullYear();
  const cm = selected.getMonth();

  const prevDate = new Date(cy, cm - 1, 1);
  const py = prevDate.getFullYear();
  const pm = prevDate.getMonth();

  const currentActual = totalExpensesForMonth(cy, cm);
  const prevActual = totalExpensesForMonth(py, pm);
  const currentRecurring = getRecurringProjectedTotalForMonth(cy, cm);
  const prevRecurring = getRecurringProjectedTotalForMonth(py, pm);

  const currentTotal = Number((currentActual + currentRecurring).toFixed(2));
  const prevTotal = Number((prevActual + prevRecurring).toFixed(2));
  const delta = Number((currentTotal - prevTotal).toFixed(2));
  const deltaPct = prevTotal > 0 ? Math.round((delta / prevTotal) * 100) : (currentTotal > 0 ? 100 : 0);

  const topCat = topCategoryForMonth(cy, cm);
  const budgetRows = getBudgetRowsForSelectedMonth();
  const overCount = budgetRows.filter((r) => r.status === "over").length;
  const nearCount = budgetRows.filter((r) => r.status === "near").length;

  let insight = "Brak wystarczających danych do pełnego insightu.";
  if (currentTotal === 0 && prevTotal === 0) {
    insight = "Brak danych miesięcznych. Dodaj pierwszy koszt lub subskrypcję.";
  } else if (delta > 0) {
    insight = `Koszty rosną o ${moneyPL(delta)} (${deltaPct}%). Największa kategoria: ${topCat.name}.`;
  } else if (delta < 0) {
    insight = `Koszty spadły o ${moneyPL(Math.abs(delta))} (${Math.abs(deltaPct)}%). Dobra kontrola wydatków.`;
  } else {
    insight = `Koszty bez zmian m/m. Największa kategoria: ${topCat.name}.`;
  }

  if (overCount > 0) {
    insight += ` Przekroczone budżety: ${overCount}.`;
  } else if (nearCount > 0) {
    insight += ` Budżety blisko limitu: ${nearCount}.`;
  }

  return {
    currentTotal,
    prevTotal,
    delta,
    deltaPct,
    insight
  };
}

function renderMonthComparison() {
  if (!expCompareCurrent || !expComparePrev || !expCompareDelta || !expCompareInsight) return;

  const cmp = computeMonthComparison();
  expCompareCurrent.textContent = moneyPL(cmp.currentTotal);
  expComparePrev.textContent = moneyPL(cmp.prevTotal);

  const deltaText = cmp.delta >= 0
    ? `+${moneyPL(cmp.delta)}`
    : `-${moneyPL(Math.abs(cmp.delta))}`;
  const pctText = cmp.deltaPct >= 0
    ? `+${cmp.deltaPct}%`
    : `${cmp.deltaPct}%`;

  expCompareDelta.textContent = `${deltaText} (${pctText})`;
  expCompareDelta.classList.toggle("isPositive", cmp.delta > 0);
  expCompareDelta.classList.toggle("isNegative", cmp.delta < 0);
  expCompareInsight.textContent = cmp.insight;
}

function renderUpcomingCosts() {
  if (!expUpcomingList) return;

  expUpcomingList.innerHTML = "";
  const rows = getUpcomingRecurringRows(state.selectedDate, 30);

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "todoEmpty";
    empty.textContent = "Brak zaplanowanych kosztów w najbliższych 30 dniach.";
    expUpcomingList.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  for (const row of rows.slice(0, 30)) {
    const item = document.createElement("div");
    item.className = "expUpcomingItem";

    const left = document.createElement("div");
    left.className = "expUpcomingMain";

    const name = document.createElement("div");
    name.className = "expUpcomingName";
    name.textContent = row.name;

    const meta = document.createElement("div");
    meta.className = "expUpcomingMeta";
    meta.textContent = `${fmtPL(fromISO(row.dateISO))} • ${row.category} • ${recurringPeriodLabel(row.period)}`;

    left.appendChild(name);
    left.appendChild(meta);

    const amount = document.createElement("strong");
    amount.className = "expUpcomingAmount";
    amount.textContent = moneyPL(row.amount);

    item.appendChild(left);
    item.appendChild(amount);

    frag.appendChild(item);
  }

  expUpcomingList.appendChild(frag);
}

function setImportReport(text, isError = false, isSuccess = false) {
  if (!expImportReport) return;
  expImportReport.textContent = String(text || "").trim() || "Brak raportu importu.";
  expImportReport.classList.toggle("isError", !!isError);
  expImportReport.classList.toggle("isSuccess", !!isSuccess);
}

function csvEscape(value) {
  const raw = String(value ?? "");
  if (!/[";,\n\r]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

function parseCsvText(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const delimiter = firstLine.split(";").length >= firstLine.split(",").length ? ";" : ",";

  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      row.push(current);
      current = "";
      if (row.some((x) => String(x).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    current += ch;
  }

  row.push(current);
  if (row.some((x) => String(x).trim() !== "")) rows.push(row);

  if (!rows.length) return [];

  const headers = rows[0].map((h) => normalizeImportHeader(h));
  const out = [];

  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    const r = rows[i];
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col${c}`;
      obj[key] = r[c] === undefined ? "" : String(r[c]).trim();
    }
    out.push({ rowIndex: i + 1, data: obj });
  }

  return out;
}

function normalizeImportHeader(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pickImportField(obj, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(obj, alias)) return obj[alias];
  }
  return "";
}

function normalizeImportDate(raw, fallbackISO) {
  const v = String(raw || "").trim();
  if (!v) return fallbackISO;

  if (isValidISODate(v)) return v;

  const normalized = v.replace(/\./g, "-").replace(/\//g, "-");
  const parts = normalized.split("-").map((x) => String(x).trim());

  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const iso = `${parts[0]}-${pad2(Number(parts[1]))}-${pad2(Number(parts[2]))}`;
      if (isValidISODate(iso)) return iso;
    }

    if (parts[2].length === 4) {
      const iso = `${parts[2]}-${pad2(Number(parts[1]))}-${pad2(Number(parts[0]))}`;
      if (isValidISODate(iso)) return iso;
    }
  }

  return "";
}

function normalizeImportedExpense(rowData, rowIndex, fallbackDateISO) {
  const dateRaw = pickImportField(rowData, ["date", "dateiso", "data"]);
  const amountRaw = pickImportField(rowData, ["amount", "kwota", "value", "cost"]);
  const whatRaw = pickImportField(rowData, ["what", "opis", "description", "nazwa", "title"]);
  const categoryRaw = pickImportField(rowData, ["category", "kategoria"]);
  const scoreRaw = pickImportField(rowData, ["score", "ocena"]);
  const periodRaw = pickImportField(rowData, ["period", "okres"]);

  const dateISO = normalizeImportDate(dateRaw, fallbackDateISO);
  if (!dateISO) {
    return { ok: false, error: `Wiersz ${rowIndex}: niepoprawna data.` };
  }

  const amount = parseAmount(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: `Wiersz ${rowIndex}: niepoprawna kwota.` };
  }

  const what = String(whatRaw || "").trim();
  if (!what) {
    return { ok: false, error: `Wiersz ${rowIndex}: brak opisu wydatku.` };
  }

  const score = String(scoreRaw || "B").trim().toUpperCase();
  const period = normalizeExpensePeriod(String(periodRaw || "once").trim().toLowerCase());

  return {
    ok: true,
    entry: {
      id: crypto.randomUUID(),
      dateISO,
      amount: Number(amount.toFixed(2)),
      what,
      category: String(categoryRaw || "Inne").trim() || "Inne",
      score: EXPENSE_ALLOWED_SCORE.includes(score) ? score : "B",
      period,
      createdAt: Date.now()
    }
  };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsArrayBuffer(file);
  });
}

async function parseExpenseImportFile(file) {
  if (!file) return [];

  const name = String(file.name || "").toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await readFileAsText(file);
    return parseCsvText(text);
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    if (typeof XLSX === "undefined") {
      throw new Error("xlsx_lib_missing");
    }

    const buffer = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });

    return jsonRows.map((raw, idx) => {
      const normalized = {};
      for (const [key, val] of Object.entries(raw || {})) {
        normalized[normalizeImportHeader(key)] = String(val || "").trim();
      }
      return {
        rowIndex: idx + 2,
        data: normalized
      };
    });
  }

  throw new Error("unsupported_format");
}

function applyImportedExpenses(parsedRows) {
  ensureExpenses();

  const accepted = [];
  const rejected = [];
  const fallbackDateISO = state.selectedDate;

  for (const row of parsedRows) {
    const out = normalizeImportedExpense(row.data || {}, row.rowIndex || 0, fallbackDateISO);
    if (!out.ok) {
      rejected.push(out.error);
      continue;
    }
    accepted.push(out.entry);
  }

  if (accepted.length) {
    state.expenses.push(...accepted);
    saveState();
  }

  return { accepted, rejected };
}

function formatImportReport(result, fileName) {
  const ok = result.accepted.length;
  const bad = result.rejected.length;

  if (!ok && !bad) {
    return {
      text: `Plik "${fileName}" nie zawiera danych do importu.`,
      isError: true,
      isSuccess: false
    };
  }

  if (!ok && bad) {
    const preview = result.rejected.slice(0, 3).join(" ");
    return {
      text: `Import odrzucony. Błędne rekordy: ${bad}. ${preview}`,
      isError: true,
      isSuccess: false
    };
  }

  if (bad > 0) {
    const preview = result.rejected.slice(0, 2).join(" ");
    return {
      text: `Zaimportowano ${ok} rekordów, odrzucono ${bad}. ${preview}`,
      isError: false,
      isSuccess: true
    };
  }

  return {
    text: `Import zakończony sukcesem. Dodano ${ok} rekordów z pliku "${fileName}".`,
    isError: false,
    isSuccess: true
  };
}

function financeIntegrityIssues() {
  const issues = [];

  for (const it of (state.expenses || [])) {
    if (!isValidISODate(it.dateISO)) issues.push("Wykryto wydatek z niepoprawną datą.");
    if (!Number.isFinite(Number(it.amount)) || Number(it.amount) <= 0) {
      issues.push("Wykryto wydatek z niepoprawną kwotą.");
    }
  }

  for (const b of (state.expBudgets || [])) {
    if (!Number.isFinite(Number(b.limit)) || Number(b.limit) <= 0) {
      issues.push("Wykryto budżet z niepoprawnym limitem.");
    }
  }

  for (const r of (state.expRecurring || [])) {
    if (!isValidISODate(r.nextDate)) issues.push("Wykryto koszt cykliczny z niepoprawną datą.");
    if (!Number.isFinite(Number(r.amount)) || Number(r.amount) <= 0) {
      issues.push("Wykryto koszt cykliczny z niepoprawną kwotą.");
    }
  }

  for (const g of (state.expSavingsGoals || [])) {
    if (!Number.isFinite(Number(g.target)) || Number(g.target) <= 0) {
      issues.push("Wykryto cel oszczędnościowy z niepoprawnym targetem.");
    }
  }

  return [...new Set(issues)];
}

function downloadTextFile(fileName, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function exportFinanceJson() {
  ensureExpenses();

  const payload = {
    exportedAtISO: new Date().toISOString(),
    selectedDate: state.selectedDate,
    expenses: state.expenses || [],
    expBudgets: state.expBudgets || [],
    expRecurring: state.expRecurring || [],
    expSavingsGoals: state.expSavingsGoals || []
  };

  downloadTextFile(
    `edward-finance-${state.selectedDate}.json`,
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8"
  );

  if (typeof showToast === "function") {
    showToast("Wyeksportowano dane finansowe do JSON.", "success", 2800);
  }
}

function exportExpensesCsv() {
  ensureExpenses();

  const rows = [];
  rows.push([
    "dateISO",
    "amount",
    "what",
    "category",
    "score",
    "period",
    "createdAt"
  ].join(";"));

  for (const it of (state.expenses || [])) {
    rows.push([
      csvEscape(it.dateISO),
      csvEscape(Number(it.amount || 0).toFixed(2)),
      csvEscape(it.what || ""),
      csvEscape(it.category || "Inne"),
      csvEscape(it.score || "B"),
      csvEscape(it.period || "once"),
      csvEscape(String(it.createdAt || ""))
    ].join(";"));
  }

  downloadTextFile(
    `edward-expenses-${state.selectedDate}.csv`,
    rows.join("\n"),
    "text/csv;charset=utf-8"
  );

  if (typeof showToast === "function") {
    showToast("Wyeksportowano wydatki do CSV.", "success", 2800);
  }
}

function exportFullBackupJson() {
  ensureExpenses();

  downloadTextFile(
    `edward-backup-${state.selectedDate}.json`,
    JSON.stringify(state, null, 2),
    "application/json;charset=utf-8"
  );

  if (typeof showToast === "function") {
    showToast("Wyeksportowano pełny backup stanu aplikacji.", "success", 3200);
  }
}

async function importExpensesFile(file) {
  if (!file) return;

  try {
    const parsedRows = await parseExpenseImportFile(file);
    const result = applyImportedExpenses(parsedRows);
    const report = formatImportReport(result, file.name || "plik");

    const issues = financeIntegrityIssues();
    if (issues.length) {
      report.text += ` Wykryte ostrzeżenia integralności: ${issues.slice(0, 2).join(" ")}`;
    }

    setImportReport(report.text, report.isError, report.isSuccess);

    if (result.accepted.length) {
      renderExpenses();
      renderCalendar();
      emitBudgetAlertsForSelectedMonth();
    }

    if (typeof showToast === "function") {
      if (report.isError) showToast(report.text, "error", 5000);
      else showToast(report.text, "success", 3600);
    }
  } catch (error) {
    const msg = String(error?.message || "");
    let text = "Import nie powiódł się.";

    if (msg.includes("xlsx_lib_missing")) {
      text = "Brak biblioteki XLSX. Odśwież stronę i spróbuj ponownie.";
    } else if (msg.includes("unsupported_format")) {
      text = "Nieobsługiwany format pliku. Użyj CSV lub XLSX/XLS.";
    }

    setImportReport(text, true, false);
    if (typeof showToast === "function") {
      showToast(text, "error", 4600);
    }
  }
}

async function importFullBackupFile(file) {
  if (!file) return;

  try {
    const text = await readFileAsText(file);
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("bad_backup");
    }

    const looksLikeFullState =
      Array.isArray(parsed.habits) &&
      parsed.entries && typeof parsed.entries === "object" && !Array.isArray(parsed.entries) &&
      Array.isArray(parsed.todos) &&
      Array.isArray(parsed.expenses) &&
      Array.isArray(parsed.wishlist);

    if (!looksLikeFullState) {
      throw new Error("bad_backup_shape");
    }

    if (typeof sanitizeState !== "function") {
      throw new Error("sanitize_missing");
    }

    state = sanitizeState(parsed);
    ensureExpenses();
    if (typeof ensureMeta === "function") ensureMeta();

    saveState();

    if (typeof renderAll === "function") renderAll();
    else renderExpenses();

    setImportReport("Backup przywrócony poprawnie.", false, true);
    if (typeof showToast === "function") {
      showToast("Przywrócono backup całości danych.", "success", 3600);
    }
  } catch (error) {
    const msg = String(error?.message || "");
    const text = msg.includes("bad_backup_shape")
      ? "Plik nie wygląda na pełny backup aplikacji."
      : "Nie udało się przywrócić backupu JSON.";

    setImportReport(text, true, false);
    if (typeof showToast === "function") {
      showToast(text, "error", 4600);
    }
  }
}

function addExpense() {
  const entry = createExpenseFromInput(
    expAmount?.value,
    expWhat?.value,
    expCategory?.value,
    expScore?.value,
    expPeriod?.value,
    expDate?.value || getExpenseFilterISO()
  );
  if (!appendExpense(entry)) return;

  if (expAmount) expAmount.value = "";
  if (expWhat) expWhat.value = "";
  if (expPeriod) {
    expPeriod.value = "once";
    syncCustomSelect(expPeriod);
  }

  renderExpenses();
  renderCalendar();
  emitBudgetAlertsForSelectedMonth();
}

function deleteExpense(id) {
  ensureExpenses();
  state.expenses = state.expenses.filter((x) => x.id !== id);
  saveState();
  renderExpenses();
  renderCalendar();
}

function openExpModal() {
  if (!expOverlay) return;

  expModalAmount.value = "";
  expModalWhat.value = "";
  expModalCategory.value = "Jedzenie";
  expModalScore.value = "B";
  expModalPeriod.value = "once";
  expModalDate.value = state.selectedDate;

  syncCustomSelect(expModalCategory);
  syncCustomSelect(expModalScore);
  syncCustomSelect(expModalPeriod);

  showOverlay(expOverlay);
  setTimeout(() => expModalAmount.focus(), 0);
}

function closeExpModal() {
  hideOverlay(expOverlay);
}

function addExpenseFromModal() {
  const entry = createExpenseFromInput(
    expModalAmount?.value,
    expModalWhat?.value,
    expModalCategory?.value,
    expModalScore?.value,
    expModalPeriod?.value,
    expModalDate?.value || state.selectedDate
  );
  if (!appendExpense(entry)) return;

  renderExpenses();
  renderCalendar();
  emitBudgetAlertsForSelectedMonth();
  closeExpModal();
}

function addExpenseQuick() {
  const entry = createExpenseFromInput(
    dashQuickExpenseAmount?.value,
    dashQuickExpenseWhat?.value,
    dashQuickExpenseCategory?.value,
    "B",
    "once",
    state.selectedDate
  );

  if (!appendExpense(entry)) {
    setQuickExpenseHint("Uzupełnij poprawnie kwotę i opis kosztu.", true);
    return;
  }

  if (dashQuickExpenseAmount) dashQuickExpenseAmount.value = "";
  if (dashQuickExpenseWhat) dashQuickExpenseWhat.value = "";
  if (dashQuickExpenseCategory) {
    dashQuickExpenseCategory.value = "Jedzenie";
    syncCustomSelect(dashQuickExpenseCategory);
  }

  setQuickExpenseHint("Koszt zapisany w dzienniku wydatków.", false);

  renderExpenses();
  renderCalendar();
  emitBudgetAlertsForSelectedMonth();
}

function renderExpenseList(items) {
  if (!expList) return;

  expList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "todoEmpty";
    empty.textContent = "Brak wpisów.";
    expList.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "expItem";

    const amt = document.createElement("div");
    amt.className = "expAmt";
    amt.textContent = moneyPL(it.amount);

    const main = document.createElement("div");
    main.className = "expMain";

    const what = document.createElement("div");
    what.className = "expWhat";
    what.textContent = it.what;

    const meta = document.createElement("div");
    meta.className = "expMeta";
    meta.textContent = fmtPL(fromISO(it.dateISO));

    const cat = document.createElement("div");
    cat.className = "expTag";
    cat.textContent = it.category || "Inne";

    const score = document.createElement("div");
    score.className = "expTag";
    score.textContent = scoreLabel(it.score);

    const per = document.createElement("div");
    per.className = "expTag";
    per.textContent = periodLabel(it.period);

    const tags = document.createElement("div");
    tags.className = "expTags";
    tags.appendChild(cat);
    tags.appendChild(score);
    tags.appendChild(per);

    main.appendChild(what);
    main.appendChild(meta);
    main.appendChild(tags);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "expDel";
    del.textContent = "×";
    del.title = "Usuń";
    del.addEventListener("click", () => deleteExpense(it.id));

    row.appendChild(amt);
    row.appendChild(main);
    row.appendChild(del);

    frag.appendChild(row);
  }

  expList.appendChild(frag);
}

function renderExpenseSummary(items) {
  if (!expSummary) return;

  const filteredSum = itemsSliceSum(items);
  const selected = fromISO(state.selectedDate);
  const projectedRecurring = getRecurringProjectedTotalForMonth(selected.getFullYear(), selected.getMonth());
  const monthActual = totalExpensesForMonth(selected.getFullYear(), selected.getMonth());
  const monthWithRecurring = monthActual + projectedRecurring;

  expSummary.textContent = `Suma (filtrowana): ${moneyPL(filteredSum)} • Miesiąc (z cyklicznymi): ${moneyPL(monthWithRecurring)}`;
}

function renderExpenseCharts() {
  const selected = fromISO(state.selectedDate);
  const selectedMonth = selected.getMonth();
  const selectedYear = selected.getFullYear();

  const byCategory = monthCategoryTotals(selectedYear, selectedMonth);

  const categoryRows = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const canChart = typeof Chart !== "undefined";

  if (!canChart) {
    expCategoryChart = destroyExpChart(expCategoryChart);
    expTrendChart = destroyExpChart(expTrendChart);
    clearExpCanvas(expCategoryChartCanvas);
    clearExpCanvas(expTrendChartCanvas);
    return;
  }

  if (expCategoryChartCanvas) {
    if (!categoryRows.length) {
      expCategoryChart = destroyExpChart(expCategoryChart);
      clearExpCanvas(expCategoryChartCanvas);
    } else {
      expCategoryChart = destroyExpChart(expCategoryChart);
      expCategoryChart = new Chart(expCategoryChartCanvas, {
        type: "doughnut",
        data: {
          labels: categoryRows.map((x) => x.name),
          datasets: [{
            label: "Kategorie",
            data: categoryRows.map((x) => Number(x.value.toFixed(2))),
            backgroundColor: [
              expenseCssVar("--accent", "#2f9dff"),
              "#ffb36f",
              "#ffd18f",
              "#46b6a8",
              "#7aa8d9",
              "#9fa9ba"
            ],
            borderColor: expenseCssVar("--bg-panel", "#ffffff"),
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          resizeDelay: 120,
          cutout: "72%",
          animation: {
            duration: 480,
            easing: "easeOutQuart"
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: { boxWidth: 10 }
            }
          }
        }
      });
    }
  }

  if (expTrendChartCanvas) {
    const labels = [];
    const values = [];

    for (let i = 13; i >= 0; i--) {
      const day = addDays(selected, -i);
      const iso = toISO(day);
      labels.push(`${pad2(day.getDate())}.${pad2(day.getMonth() + 1)}`);

      let sum = 0;
      for (const it of (state.expenses || [])) {
        if (it.dateISO === iso) sum += Number(it.amount) || 0;
      }
      values.push(Number(sum.toFixed(2)));
    }

    const trendMax = Math.max(0, ...values);
    const sparseTrend = values.filter((v) => v > 0).length <= 2;

    expTrendChart = destroyExpChart(expTrendChart);
    expTrendChart = new Chart(expTrendChartCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Wydatki",
          data: values,
          borderColor: expenseCssVar("--accent", "#2f9dff"),
          backgroundColor: "rgba(255, 138, 61, 0.18)",
          fill: true,
          pointRadius: sparseTrend ? 2 : 0,
          pointHoverRadius: 4,
          borderDash: sparseTrend ? [6, 5] : [],
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 120,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false }
          },
          y: {
            beginAtZero: true,
            suggestedMax: trendMax > 0 ? undefined : 100,
            ticks: {
              callback: (v) => `${v} zł`
            },
            grid: { color: expenseCssVar("--glass-10", "rgba(0,0,0,0.08)") }
          }
        }
      }
    });
  }
}

function renderExpenses() {
  ensureExpenses();

  const filterISO = getExpenseFilterISO();
  if (expDate) expDate.value = filterISO;

  if (expRecurringNextDate && !expRecurringNextDate.value) {
    expRecurringNextDate.value = filterISO;
  }

  const filterCategory = state.expFilterCategory || "";
  if (expFilterCategory) {
    expFilterCategory.value = filterCategory;
    syncCustomSelect(expFilterCategory);
  }

  let items = [...state.expenses];
  if (filterCategory) {
    items = items.filter((item) => item.category === filterCategory);
  }

  items.sort((a, b) => {
    if (a.dateISO !== b.dateISO) return b.dateISO.localeCompare(a.dateISO);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  renderExpenseSummary(items);
  renderExpenseList(items);
  renderExpenseCharts();
  renderBudgets();
  renderRecurringCosts();
  renderSavingsGoals();
  renderMonthComparison();
  renderUpcomingCosts();
  emitBudgetAlertsForSelectedMonth();

  if (typeof renderOverviewPanels === "function") renderOverviewPanels();
}

function saveBudgetFromInputs() {
  const entry = createBudgetFromInput(
    expBudgetCategory?.value,
    expBudgetLimit?.value,
    expBudgetAlertPct?.value
  );

  if (!entry) {
    if (typeof showToast === "function") {
      showToast("Uzupełnij poprawnie limit i kategorię budżetu.", "error", 3800);
    }
    return;
  }

  upsertBudget(entry);

  if (expBudgetLimit) expBudgetLimit.value = "";
  if (expBudgetAlertPct) expBudgetAlertPct.value = "80";
  if (expBudgetCategory) {
    expBudgetCategory.value = "Jedzenie";
    syncCustomSelect(expBudgetCategory);
  }

  renderExpenses();
}

function handleImportInputChange(input) {
  const file = input?.files?.[0] || null;
  if (!file) return;

  importExpensesFile(file)
    .finally(() => {
      if (input) input.value = "";
    });
}

function handleBackupImportInputChange(input) {
  const file = input?.files?.[0] || null;
  if (!file) return;

  importFullBackupFile(file)
    .finally(() => {
      if (input) input.value = "";
    });
}

function initExpenses() {
  ensureExpenses();

  if (expAmount) expAmount.addEventListener("input", () => normalizeAmountInput(expAmount));

  if (expAdd) expAdd.addEventListener("click", addExpense);
  if (expWhat) expWhat.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addExpense();
  });

  if (expFilterCategory) {
    expFilterCategory.addEventListener("change", () => {
      state.expFilterCategory = expFilterCategory.value;
      saveState();
      renderExpenses();
    });
  }

  if (expModalAmount) expModalAmount.addEventListener("input", () => normalizeAmountInput(expModalAmount));

  if (dashQuickExpenseAmount) {
    dashQuickExpenseAmount.addEventListener("input", () => {
      normalizeAmountInput(dashQuickExpenseAmount);
      clearQuickExpenseHintError();
    });
  }

  if (dashQuickExpenseAdd) dashQuickExpenseAdd.addEventListener("click", addExpenseQuick);
  if (dashQuickExpenseWhat) {
    dashQuickExpenseWhat.addEventListener("input", clearQuickExpenseHintError);
    dashQuickExpenseWhat.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addExpenseQuick();
    });
  }

  if (expSaveBtn) expSaveBtn.addEventListener("click", addExpenseFromModal);
  if (expCloseBtn) expCloseBtn.addEventListener("click", closeExpModal);
  if (expCancelBtn) expCancelBtn.addEventListener("click", closeExpModal);
  if (expOverlay) {
    expOverlay.addEventListener("click", (e) => {
      if (e.target === expOverlay) closeExpModal();
    });
  }

  if (expBudgetLimit) expBudgetLimit.addEventListener("input", () => normalizeAmountInput(expBudgetLimit));
  if (expBudgetSave) expBudgetSave.addEventListener("click", saveBudgetFromInputs);

  if (expRecurringAmount) expRecurringAmount.addEventListener("input", () => normalizeAmountInput(expRecurringAmount));
  if (expRecurringAdd) expRecurringAdd.addEventListener("click", addRecurringCost);
  if (expRecurringName) {
    expRecurringName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addRecurringCost();
    });
  }

  if (expGoalTarget) expGoalTarget.addEventListener("input", () => normalizeAmountInput(expGoalTarget));
  if (expGoalCurrent) expGoalCurrent.addEventListener("input", () => normalizeAmountInput(expGoalCurrent));
  if (expGoalAdd) expGoalAdd.addEventListener("click", addSavingsGoal);
  if (expGoalName) {
    expGoalName.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addSavingsGoal();
    });
  }

  if (expImportFile) {
    expImportFile.addEventListener("change", () => {
      handleImportInputChange(expImportFile);
    });
  }

  if (expBackupImportFile) {
    expBackupImportFile.addEventListener("change", () => {
      handleBackupImportInputChange(expBackupImportFile);
    });
  }

  if (expExportFinanceJson) expExportFinanceJson.addEventListener("click", exportFinanceJson);
  if (expExportExpensesCsv) expExportExpensesCsv.addEventListener("click", exportExpensesCsv);
  if (expExportFullBackup) expExportFullBackup.addEventListener("click", exportFullBackupJson);

  if (expBudgetCategory) syncCustomSelect(expBudgetCategory);
  if (expRecurringCategory) syncCustomSelect(expRecurringCategory);
  if (expRecurringPeriod) syncCustomSelect(expRecurringPeriod);
}
