function getSelectedDateObj() {
  return fromISO(state.selectedDate);
}

function openTodoModal(dateObj) {
  if (!todoOverlay) return;
  todoDateInput.value = toISO(dateObj);
  todoText.value = "";
  todoPriority.value = "medium";
  showOverlay(todoOverlay);
  setTimeout(() => todoText.focus(), 0);
}

function closeTodoModal() {
  hideOverlay(todoOverlay);
}

function todoPriorityLabel(v) {
  if (v === "high") return "Wysoki";
  if (v === "low") return "Niski";
  return "Średni";
}

function addTodo(dateISO, text, priority) {
  const t = String(text || "").trim();
  if (!t) return;

  state.todos.push({
    id: crypto.randomUUID(),
    dateISO,
    text: t,
    priority: priority || "medium",
    done: false,
    createdAt: Date.now()
  });

  saveState();
  renderTodos();
}

function toggleTodo(id) {
  const it = state.todos.find(x => x.id === id);
  if (!it) return;
  it.done = !it.done;
  saveState();
  renderTodos();
}

function deleteTodo(id) {
  state.todos = state.todos.filter(x => x.id !== id);
  saveState();
  renderTodos();
}

function renderTodos() {
  if (todoTitleSub) {
    todoTitleSub.textContent = `• ${monthNamePL(state.viewMonth)} ${state.viewYear}`;
  }

  if (todoList) todoList.innerHTML = "";

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const items = [...state.todos].sort((a, b) => {
    if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);
    const aPriority = priorityOrder[a.priority || "medium"] ?? 1;
    const bPriority = priorityOrder[b.priority || "medium"] ?? 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  if (!items.length) {
    if (todoEmpty) todoEmpty.style.display = "block";
    return;
  }

  if (todoEmpty) todoEmpty.style.display = "none";

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "todoItem";
    if (it.done) row.classList.add("todoDone");

    const left = document.createElement("div");
    left.className = "todoLeft";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "todoCheck";
    cb.checked = !!it.done;
    cb.addEventListener("change", () => toggleTodo(it.id));

    const textBox = document.createElement("div");

    const txt = document.createElement("div");
    txt.className = "todoText";
    txt.textContent = it.text;

    const meta = document.createElement("div");
    meta.className = "todoMeta";
    meta.textContent = fmtPL(fromISO(it.dateISO));

    const priorityTag = document.createElement("div");
    priorityTag.className = "expTag";
    priorityTag.textContent = todoPriorityLabel(it.priority || "medium");

    textBox.appendChild(txt);
    textBox.appendChild(meta);

    const tagsBox = document.createElement("div");
    tagsBox.style.display = "flex";
    tagsBox.style.gap = "6px";
    tagsBox.style.marginTop = "4px";
    tagsBox.appendChild(priorityTag);
    textBox.appendChild(tagsBox);

    left.appendChild(cb);
    left.appendChild(textBox);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "todoDel";
    del.textContent = "×";
    del.title = "Usuń";
    del.addEventListener("click", () => deleteTodo(it.id));

    row.appendChild(left);
    row.appendChild(del);

    todoList.appendChild(row);
  }
}

function ensureExpenses() {
  if (!state.expenses) state.expenses = [];
}

function getExpenseFilterISO() {
  return state.selectedDate;
}

function addExpense() {
  ensureExpenses();

  const amt = Number(String(expAmount.value || "").replace(",", "."));
  const what = String(expWhat.value || "").trim();
  const dateISO = expDate.value || getExpenseFilterISO();

  if (!Number.isFinite(amt) || amt <= 0) return;
  if (String(Math.floor(amt)).length > 10) return;
  if (!what) return;

  state.expenses.push({
    id: crypto.randomUUID(),
    dateISO,
    amount: amt,
    what,
    category: expCategory.value,
    score: expScore.value,
    period: expPeriod.value,
    createdAt: Date.now()
  });

  expAmount.value = "";
  expWhat.value = "";
  expPeriod.value = "once";

  saveState();
  renderExpenses();
  renderCalendar();
}

function deleteExpense(id) {
  ensureExpenses();
  state.expenses = state.expenses.filter(x => x.id !== id);
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
  showOverlay(expOverlay);
  setTimeout(() => expModalAmount.focus(), 0);
}

function closeExpModal() {
  hideOverlay(expOverlay);
}

function addExpenseFromModal() {
  ensureExpenses();

  const amt = Number(String(expModalAmount.value || "").replace(",", "."));
  const what = String(expModalWhat.value || "").trim();
  const dateISO = expModalDate.value || state.selectedDate;

  if (!Number.isFinite(amt) || amt <= 0) return;
  if (String(Math.floor(amt)).length > 10) return;
  if (!what) return;

  state.expenses.push({
    id: crypto.randomUUID(),
    dateISO,
    amount: amt,
    what,
    category: expModalCategory.value,
    score: expModalScore.value,
    period: expModalPeriod.value,
    createdAt: Date.now()
  });

  saveState();
  renderExpenses();
  renderCalendar();
  closeExpModal();
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

function itemsSliceSum(items) {
  let sum = 0;
  for (const it of items) sum += Number(it.amount) || 0;
  return sum;
}

function renderExpenses() {
  ensureExpenses();

  const filterISO = getExpenseFilterISO();
  if (expDate) expDate.value = filterISO;

  const filterCategory = state.expFilterCategory || "";
  if (expFilterCategory) expFilterCategory.value = filterCategory;

  let items = [...state.expenses];
  if (filterCategory) {
    items = items.filter(item => item.category === filterCategory);
  }

  items.sort((a, b) => {
    if (a.dateISO !== b.dateISO) return b.dateISO.localeCompare(a.dateISO);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const sum = itemsSliceSum(items);
  if (expSummary) expSummary.textContent = "Suma: " + moneyPL(sum);
  if (expList) expList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "todoEmpty";
    empty.textContent = "Brak wpisów.";
    expList.appendChild(empty);
    return;
  }

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "expItem";

    const amt = document.createElement("div");
    amt.className = "expAmt";
    amt.textContent = moneyPL(it.amount);

    const whatBox = document.createElement("div");
    const what = document.createElement("div");
    what.textContent = it.what;
    const meta = document.createElement("div");
    meta.className = "expMeta";
    meta.textContent = fmtPL(fromISO(it.dateISO));
    whatBox.appendChild(what);
    whatBox.appendChild(meta);

    const cat = document.createElement("div");
    cat.className = "expTag";
    cat.textContent = it.category;

    const score = document.createElement("div");
    score.className = "expTag";
    score.textContent = scoreLabel(it.score);

    const per = document.createElement("div");
    per.className = "expTag";
    per.textContent = periodLabel(it.period);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "expDel";
    del.textContent = "×";
    del.title = "Usuń";
    del.addEventListener("click", () => deleteExpense(it.id));

    row.appendChild(amt);
    row.appendChild(whatBox);
    row.appendChild(cat);
    row.appendChild(score);
    row.appendChild(per);
    row.appendChild(del);

    expList.appendChild(row);
  }
}

function makeChartRow(idx, name, donePct, failPct) {
  const row = document.createElement("div");
  row.className = "chartRow";

  const n = document.createElement("div");
  n.className = "chartRowIdx";
  n.textContent = String(idx);

  const nm = document.createElement("div");
  nm.className = "chartRowName";
  nm.textContent = name || "Nawyk";

  const badges = document.createElement("div");
  badges.className = "chartRowBadges";

  const bDone = document.createElement("div");
  bDone.className = "chartBadge done";
  bDone.innerHTML = `<span class="dot"></span><span>${donePct}%</span>`;

  const bFail = document.createElement("div");
  bFail.className = "chartBadge fail";
  bFail.innerHTML = `<span class="dot"></span><span>${failPct}%</span>`;

  badges.appendChild(bDone);
  badges.appendChild(bFail);
  row.appendChild(n);
  row.appendChild(nm);
  row.appendChild(badges);

  return row;
}

function renderChartModal(stats) {
  if (!chartModalList) return;
  chartModalList.innerHTML = "";
  if (chartModalRange) chartModalRange.textContent = chartRangeTxt?.textContent || "";

  const list = stats.perHabit || [];
  list.forEach((h, i) => {
    chartModalList.appendChild(makeChartRow(i + 1, h.name, h.donePct, h.failPct));
  });

  if (chartModalSummary) {
    chartModalSummary.innerHTML = `Aktywność: ${stats.coverage}% komórek<br>Średnio na dzień: ✔ ${stats.donePerDay}, ✖ ${stats.failPerDay}`;
  }
}

function getEntryValue(habitId, dateISO) {
  const key = `${habitId}|${dateISO}`;
  return state.entries[key] ?? 0;
}

function rangeForChart() {
  const selected = getSelectedDateObj();
  if (state.chartMode === "month") {
    const y = selected.getFullYear();
    const m = selected.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return { start: startOfDay(start), end: startOfDay(end), daysCount: end.getDate() };
  }

  const weekStart = startOfWeekMonday(selected);
  return { start: startOfDay(weekStart), end: startOfDay(addDays(weekStart, 6)), daysCount: 7 };
}

function computeChartStats() {
  const { start, end, daysCount } = rangeForChart();
  const totalCells = (state.habits?.length || 0) * daysCount;

  let done = 0;
  let fail = 0;

  const perHabit = state.habits.map(h => ({
    id: h.id,
    name: h.name,
    done: 0,
    fail: 0,
    donePct: 0,
    failPct: 0
  }));

  const perMap = Object.fromEntries(perHabit.map(x => [x.id, x]));

  for (let i = 0; i < daysCount; i++) {
    const d = addDays(start, i);
    const iso = toISO(d);

    for (const h of state.habits) {
      const v = getEntryValue(h.id, iso);
      if (v === 1) {
        done += 1;
        perMap[h.id].done += 1;
      } else if (v === -1) {
        fail += 1;
        perMap[h.id].fail += 1;
      }
    }
  }

  for (const x of perHabit) {
    x.donePct = daysCount > 0 ? Math.round((x.done / daysCount) * 100) : 0;
    x.failPct = daysCount > 0 ? Math.round((x.fail / daysCount) * 100) : 0;
  }

  const empty = Math.max(0, totalCells - done - fail);
  const coverage = totalCells > 0 ? Math.round(((done + fail) / totalCells) * 100) : 0;
  const donePerDay = daysCount > 0 ? (done / daysCount).toFixed(2) : "0.00";
  const failPerDay = daysCount > 0 ? (fail / daysCount).toFixed(2) : "0.00";

  return { start, end, daysCount, totalCells, done, fail, empty, coverage, donePerDay, failPerDay, perHabit };
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const a = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = (endAngle - startAngle) <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

function renderDonut(done, fail, empty) {
  const total = done + fail + empty;
  const parts = [
    { v: empty, cls: "empty" },
    { v: fail, cls: "fail" },
    { v: done, cls: "done" }
  ].filter(p => p.v > 0);

  if (!chartSvg) return;

  chartSvg.innerHTML = "";

  const cx = 110;
  const cy = 110;
  const r = 86;

  const strokeMap = {
    empty: "#9ca3af",
    fail: "#ef4444",
    done: "#22c55e"
  };

  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", cx);
  ring.setAttribute("cy", cy);
  ring.setAttribute("r", r);
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "#d1d5db");
  ring.setAttribute("stroke-width", "18");
  chartSvg.appendChild(ring);

  if (total <= 0) {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.setAttribute("x", cx);
    t.setAttribute("y", cy + 6);
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-size", "14");
    t.classList.add("chart-text");
    t.textContent = "Brak danych";
    chartSvg.appendChild(t);
    return;
  }

  let angle = 0;

  for (const p of parts) {
    const span = (p.v / total) * 360;
    const startAngle = angle;
    const endAngle = angle + span;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", arcPath(cx, cy, r, startAngle, endAngle));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", strokeMap[p.cls] || "#9ca3af");
    path.setAttribute("stroke-width", "18");
    path.setAttribute("stroke-linecap", "round");
    path.classList.add("chart-part", p.cls);
    chartSvg.appendChild(path);

    angle = endAngle;
  }

  const inner = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  inner.setAttribute("cx", cx);
  inner.setAttribute("cy", cy);
  inner.setAttribute("r", 58);
  inner.classList.add("chart-inner");
  chartSvg.appendChild(inner);

  const center = document.createElementNS("http://www.w3.org/2000/svg", "text");
  center.setAttribute("x", cx);
  center.setAttribute("y", cy + 6);
  center.setAttribute("text-anchor", "middle");
  center.setAttribute("font-size", "16");
  center.classList.add("chart-text");
  center.textContent = `${Math.round((done / total) * 100)}%`;
  chartSvg.appendChild(center);
}

function syncChartTabs() {
  const isWeek = state.chartMode === "week";
  chartWeekBtn?.classList.toggle("isActive", isWeek);
  chartMonthBtn?.classList.toggle("isActive", !isWeek);
}

function renderChart() {
  const s = computeChartStats();
  if (chartDoneTxt) chartDoneTxt.textContent = String(s.done);
  if (chartFailTxt) chartFailTxt.textContent = String(s.fail);
  if (chartEmptyTxt) chartEmptyTxt.textContent = String(s.empty);

  if (chartRangeTxt) {
    if (state.chartMode === "month") {
      chartRangeTxt.textContent = `${monthNamePL(getSelectedDateObj().getMonth())} ${getSelectedDateObj().getFullYear()}`;
    } else {
      chartRangeTxt.textContent = `${fmtPL(s.start)} - ${fmtPL(s.end)}`;
    }
  }

  syncChartTabs();
  renderDonut(s.done, s.fail, s.empty);
}

function openChartModal() {
  showOverlay(chartOverlay);
}

function closeChartModal() {
  hideOverlay(chartOverlay);
}

function ensureWishlist() {
  if (!state.wishlist) state.wishlist = [];
}

function openWishModal() {
  if (!wishOverlay) return;
  ensureWishlist();
  wishModalName.value = "";
  wishModalPrice.value = "";
  showOverlay(wishOverlay);
  setTimeout(() => wishModalName.focus(), 0);
}

function closeWishModal() {
  hideOverlay(wishOverlay);
}

function addWishFromModal() {
  ensureWishlist();

  const name = String(wishModalName.value || "").trim();
  const priceRaw = String(wishModalPrice.value || "").trim();
  if (!name) return;

  let price = null;
  if (priceRaw !== "") {
    const n = Number(String(priceRaw).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    price = n;
  }

  state.wishlist.push({
    id: crypto.randomUUID(),
    name,
    price,
    createdAt: Date.now()
  });

  saveState();
  renderWishlist();
  closeWishModal();
}

function addWish() {
  ensureWishlist();

  const name = String(wishName.value || "").trim();
  const priceRaw = String(wishPrice.value || "").trim();
  if (!name) return;

  let price = null;
  if (priceRaw !== "") {
    const n = Number(String(priceRaw).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    price = n;
  }

  state.wishlist.push({
    id: crypto.randomUUID(),
    name,
    price,
    createdAt: Date.now()
  });

  wishName.value = "";
  wishPrice.value = "";
  saveState();
  renderWishlist();
}

function deleteWish(id) {
  ensureWishlist();
  state.wishlist = state.wishlist.filter(x => x.id !== id);
  saveState();
  renderWishlist();
}

function renderWishlist() {
  ensureWishlist();
  if (wishList) wishList.innerHTML = "";

  const sortMode = state.wishSortMode || "date-desc";
  if (wishSort) wishSort.value = sortMode;

  let items = [...state.wishlist];
  if (sortMode === "date-desc") {
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else if (sortMode === "date-asc") {
    items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } else if (sortMode === "price-asc") {
    items.sort((a, b) => {
      const aPrice = a.price === null || a.price === undefined ? Infinity : Number(a.price);
      const bPrice = b.price === null || b.price === undefined ? Infinity : Number(b.price);
      if (aPrice !== bPrice) return aPrice - bPrice;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  } else if (sortMode === "price-desc") {
    items.sort((a, b) => {
      const aPrice = a.price === null || a.price === undefined ? -1 : Number(a.price);
      const bPrice = b.price === null || b.price === undefined ? -1 : Number(b.price);
      if (aPrice !== bPrice) return bPrice - aPrice;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  } else if (sortMode === "name-asc") {
    items.sort((a, b) => {
      const aName = String(a.name || "").toLowerCase();
      const bName = String(b.name || "").toLowerCase();
      if (aName !== bName) return aName.localeCompare(bName);
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  } else if (sortMode === "name-desc") {
    items.sort((a, b) => {
      const aName = String(a.name || "").toLowerCase();
      const bName = String(b.name || "").toLowerCase();
      if (aName !== bName) return bName.localeCompare(aName);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "todoEmpty";
    empty.textContent = "Brak wishlisty.";
    wishList.appendChild(empty);
    return;
  }

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "wishItem";

    const left = document.createElement("div");
    left.className = "wishLeft";

    const nm = document.createElement("div");
    nm.className = "wishName";
    nm.textContent = it.name;

    const pr = document.createElement("div");
    pr.className = "wishPrice";
    pr.textContent = it.price === null ? "Cena: brak" : ("Cena: " + moneyPL(it.price));

    left.appendChild(nm);
    left.appendChild(pr);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "wishDel";
    del.textContent = "×";
    del.title = "Usuń";
    del.addEventListener("click", () => deleteWish(it.id));

    row.appendChild(left);
    row.appendChild(del);
    wishList.appendChild(row);
  }
}

let pomoTimerId = null;
let pomoEditInput = null;

function ensurePomodoro() {
  if (!state.pomodoro) {
    state.pomodoro = {
      mode: "focus",
      durationsMin: { focus: 25, break: 5, long: 15 },
      remainingByMode: { focus: 25 * 60, break: 5 * 60, long: 15 * 60 },
      remainingSec: 25 * 60,
      isRunning: false,
      lastTick: 0,
      session: 0
    };
    return;
  }

  const p = state.pomodoro;
  if (!p.durationsMin) p.durationsMin = { focus: 25, break: 5, long: 15 };
  if (!p.remainingByMode) {
    p.remainingByMode = {
      focus: (Number(p.durationsMin.focus) || 25) * 60,
      break: (Number(p.durationsMin.break) || 5) * 60,
      long: (Number(p.durationsMin.long) || 15) * 60
    };
  }
  if (!p.mode) p.mode = "focus";
  if (typeof p.remainingSec !== "number") {
    p.remainingSec = p.remainingByMode[p.mode] ?? ((Number(p.durationsMin[p.mode]) || 25) * 60);
  }
  if (typeof p.isRunning !== "boolean") p.isRunning = false;
  if (typeof p.lastTick !== "number") p.lastTick = 0;
  if (typeof p.session !== "number") p.session = 0;

  if (typeof p.remainingByMode.focus !== "number") p.remainingByMode.focus = (Number(p.durationsMin.focus) || 25) * 60;
  if (typeof p.remainingByMode.break !== "number") p.remainingByMode.break = (Number(p.durationsMin.break) || 5) * 60;
  if (typeof p.remainingByMode.long !== "number") p.remainingByMode.long = (Number(p.durationsMin.long) || 15) * 60;
}

function pad2p(n) {
  return String(n).padStart(2, "0");
}

function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${pad2p(mm)}:${pad2p(ss)}`;
}

function pomoStopInterval() {
  if (pomoTimerId) {
    clearInterval(pomoTimerId);
    pomoTimerId = null;
  }
}

function pomoStartInterval() {
  pomoStopInterval();
  pomoTimerId = setInterval(pomoTick, 250);
}

function pomoSyncUI() {
  ensurePomodoro();
  const p = state.pomodoro;
  if (pomoTimeEl) pomoTimeEl.textContent = fmtTime(p.remainingSec);
  if (pomoSessionEl) pomoSessionEl.textContent = String(p.session);
  if (pomoFocusBtn) pomoFocusBtn.classList.toggle("isActive", p.mode === "focus");
  if (pomoBreakBtn) pomoBreakBtn.classList.toggle("isActive", p.mode === "break");
  if (pomoLongBtn) pomoLongBtn.classList.toggle("isActive", p.mode === "long");
  if (pomoStartBtn) pomoStartBtn.textContent = p.isRunning ? "Pause" : "Start";
}

function pomoSaveRemaining() {
  ensurePomodoro();
  const p = state.pomodoro;
  p.remainingByMode[p.mode] = p.remainingSec;
}

function pomoSwitchMode(nextMode) {
  ensurePomodoro();
  const p = state.pomodoro;
  if (pomoEditInput) return;

  pomoSaveRemaining();
  p.mode = nextMode;
  p.remainingSec = p.remainingByMode[nextMode] ?? ((Number(p.durationsMin[nextMode]) || 25) * 60);
  p.isRunning = false;
  p.lastTick = 0;

  saveState();
  pomoStopInterval();
  pomoSyncUI();
}

function pomoCompleteCycle() {
  ensurePomodoro();
  const p = state.pomodoro;

  if (p.mode === "focus") {
    p.session += 1;
    const isLong = (p.session % 4 === 0);
    p.mode = isLong ? "long" : "break";
  } else {
    p.mode = "focus";
  }

  const mins = Number(p.durationsMin[p.mode]) || 1;
  p.remainingSec = Math.max(1, Math.round(mins * 60));
  p.remainingByMode[p.mode] = p.remainingSec;
  p.isRunning = false;
  p.lastTick = 0;

  saveState();
  pomoStopInterval();
  pomoSyncUI();
}

function pomoTick() {
  ensurePomodoro();
  const p = state.pomodoro;
  if (!p.isRunning) return;

  const now = Date.now();
  if (!p.lastTick) p.lastTick = now;

  const deltaMs = now - p.lastTick;
  if (deltaMs < 200) return;

  const deltaSec = Math.floor(deltaMs / 1000);
  if (deltaSec <= 0) return;

  p.lastTick += deltaSec * 1000;
  p.remainingSec -= deltaSec;

  if (p.remainingSec <= 0) {
    p.remainingSec = 0;
    p.remainingByMode[p.mode] = 0;
    pomoSyncUI();
    pomoCompleteCycle();
    return;
  }

  p.remainingByMode[p.mode] = p.remainingSec;
  saveState({ sync: false });
  pomoSyncUI();
}

function pomoToggleStart() {
  ensurePomodoro();
  const p = state.pomodoro;
  if (pomoEditInput) return;

  if (p.remainingSec <= 0) {
    const mins = Number(p.durationsMin[p.mode]) || 1;
    p.remainingSec = Math.max(1, Math.round(mins * 60));
    p.remainingByMode[p.mode] = p.remainingSec;
  }

  p.isRunning = !p.isRunning;
  p.lastTick = Date.now();

  saveState({ sync: !p.isRunning });
  pomoSyncUI();

  if (p.isRunning) pomoStartInterval();
  else pomoStopInterval();
}

function pomoReset() {
  ensurePomodoro();
  const p = state.pomodoro;
  if (pomoEditInput) return;

  const mins = Number(p.durationsMin[p.mode]) || 1;
  p.isRunning = false;
  p.lastTick = 0;
  p.remainingSec = Math.max(1, Math.round(mins * 60));
  p.remainingByMode[p.mode] = p.remainingSec;

  saveState();
  pomoStopInterval();
  pomoSyncUI();
}

function pomoCanInlineEdit() {
  ensurePomodoro();
  const p = state.pomodoro;
  return !p.isRunning && p.lastTick === 0;
}

function pomoParseInline(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;

  if (/^\d+$/.test(t)) {
    const mins = Math.max(1, Math.min(240, Math.round(Number(t))));
    return { remainingSec: mins * 60, mins };
  }

  const m = t.match(/^(\d{1,3})\s*:\s*(\d{1,2})$/);
  if (m) {
    const mm = Math.max(0, Math.min(240, Number(m[1])));
    const ss = Math.max(0, Math.min(59, Number(m[2])));
    const total = Math.max(1, (mm * 60) + ss);
    const mins = Math.max(1, Math.min(240, Math.round(total / 60)));
    return { remainingSec: total, mins };
  }

  return null;
}

function pomoBeginInlineEdit() {
  if (!pomoTimeEl) return;
  if (!pomoCanInlineEdit()) return;
  if (pomoEditInput) return;

  ensurePomodoro();
  const p = state.pomodoro;

  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.className = "pomoEdit";
  input.value = String(Math.max(1, Math.round((p.remainingSec || 60) / 60)));

  pomoTimeEl.replaceWith(input);
  pomoEditInput = input;

  input.focus();
  input.select();

  const cancel = () => {
    if (!pomoEditInput) return;
    pomoEditInput.replaceWith(pomoTimeEl);
    pomoEditInput = null;
    pomoSyncUI();
  };

  const commit = () => {
    if (!pomoEditInput) return;
    const parsed = pomoParseInline(pomoEditInput.value);
    if (parsed) {
      p.durationsMin[p.mode] = parsed.mins;
      p.remainingSec = parsed.remainingSec;
      p.remainingByMode[p.mode] = parsed.remainingSec;
      p.isRunning = false;
      p.lastTick = 0;
      saveState();
    }
    pomoEditInput.replaceWith(pomoTimeEl);
    pomoEditInput = null;
    pomoSyncUI();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  });
  input.addEventListener("blur", commit);
}

function setNavActive(btn) {
  document.querySelectorAll(".navItem").forEach(x => x.classList.remove("isActive"));
  btn?.classList.add("isActive");
}

function focusWishlistQuickAdd() {
  if (!bottomBox) return;
  bottomBox.scrollIntoView({ behavior: "smooth", block: "start" });
  setTimeout(() => { wishName?.focus(); }, 250);
}

function renderAll() {
  renderCalendar();
  renderHabits();
  renderTodos();
  renderExpenses();
  renderChart();
  renderWishlist();
  pomoSyncUI();
}

function pomoRestoreRunning() {
  ensurePomodoro();
  const p = state.pomodoro;
  if (!p.isRunning) {
    pomoSyncUI();
    return;
  }

  const now = Date.now();
  const last = p.lastTick || now;
  const deltaSec = Math.floor((now - last) / 1000);
  p.lastTick = now;
  if (deltaSec > 0) p.remainingSec -= deltaSec;

  if (p.remainingSec <= 0) {
    p.remainingSec = 0;
    p.remainingByMode[p.mode] = 0;
    p.isRunning = false;
    saveState();
    pomoSyncUI();
    pomoCompleteCycle();
    return;
  }

  p.remainingByMode[p.mode] = p.remainingSec;
  saveState();
  pomoSyncUI();
  pomoStartInterval();
}

if (todoAddBtn) {
  todoAddBtn.addEventListener("click", () => openTodoModal(getSelectedDateObj()));
}

if (todoClose) todoClose.addEventListener("click", closeTodoModal);
if (todoCancel) todoCancel.addEventListener("click", closeTodoModal);
if (todoOverlay) {
  todoOverlay.addEventListener("click", (e) => {
    if (e.target === todoOverlay) closeTodoModal();
  });
}

document.addEventListener("keydown", (e) => {
  if (todoOverlay?.classList.contains("isOpen") && e.key === "Escape") closeTodoModal();
  if (chartOverlay?.classList.contains("isOpen") && e.key === "Escape") closeChartModal();
  if (wishOverlay?.classList.contains("isOpen") && e.key === "Escape") closeWishModal();
});

if (todoSave) todoSave.addEventListener("click", () => { addTodo(todoDateInput.value, todoText.value, todoPriority.value); closeTodoModal(); });
if (chartDetailsBtn) chartDetailsBtn.addEventListener("click", () => { renderChartModal(computeChartStats()); openChartModal(); });
if (chartClose) chartClose.addEventListener("click", closeChartModal);
if (chartOverlay) {
  chartOverlay.addEventListener("click", (e) => {
    if (e.target === chartOverlay) closeChartModal();
  });
}

if (expAmount) {
  expAmount.addEventListener("input", () => {
    let v = expAmount.value;
    v = v.replace(/[^0-9.,]/g, "");
    const parts = v.split(/[.,]/);
    if (parts[0].length > 9) parts[0] = parts[0].slice(0, 9);
    expAmount.value = parts.length > 1 ? parts[0] + "," + parts[1].slice(0, 2) : parts[0];
  });
}

if (expAdd) expAdd.addEventListener("click", addExpense);
if (expWhat) expWhat.addEventListener("keydown", (e) => { if (e.key === "Enter") addExpense(); });
if (expFilterCategory) {
  expFilterCategory.addEventListener("change", () => {
    state.expFilterCategory = expFilterCategory.value;
    saveState();
    renderExpenses();
  });
}

if (expModalAmount) {
  expModalAmount.addEventListener("input", () => {
    let v = expModalAmount.value;
    v = v.replace(/[^0-9.,]/g, "");
    const parts = v.split(/[.,]/);
    if (parts[0].length > 9) parts[0] = parts[0].slice(0, 9);
    expModalAmount.value = parts.length > 1 ? parts[0] + "," + parts[1].slice(0, 2) : parts[0];
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

if (wishAdd) wishAdd.addEventListener("click", addWish);
if (wishPrice) wishPrice.addEventListener("keydown", (e) => { if (e.key === "Enter") addWish(); });
if (wishName) wishName.addEventListener("keydown", (e) => { if (e.key === "Enter") addWish(); });
if (wishSort) {
  wishSort.addEventListener("change", () => {
    state.wishSortMode = wishSort.value;
    saveState();
    renderWishlist();
  });
}

if (wishSaveBtn) wishSaveBtn.addEventListener("click", addWishFromModal);
if (wishCloseBtn) wishCloseBtn.addEventListener("click", closeWishModal);
if (wishCancelBtn) wishCancelBtn.addEventListener("click", closeWishModal);
if (wishOverlay) {
  wishOverlay.addEventListener("click", (e) => {
    if (e.target === wishOverlay) closeWishModal();
  });
}

if (wishModalPrice) wishModalPrice.addEventListener("keydown", (e) => { if (e.key === "Enter") addWishFromModal(); });
if (wishModalName) wishModalName.addEventListener("keydown", (e) => { if (e.key === "Enter") addWishFromModal(); });

if (pomoFocusBtn) pomoFocusBtn.addEventListener("click", () => pomoSwitchMode("focus"));
if (pomoBreakBtn) pomoBreakBtn.addEventListener("click", () => pomoSwitchMode("break"));
if (pomoLongBtn) pomoLongBtn.addEventListener("click", () => pomoSwitchMode("long"));
if (pomoStartBtn) pomoStartBtn.addEventListener("click", pomoToggleStart);
if (pomoResetBtn) pomoResetBtn.addEventListener("click", pomoReset);
if (pomoTimeEl) pomoTimeEl.addEventListener("click", pomoBeginInlineEdit);

if (todoPanel) {
  todoPanel.addEventListener("dblclick", (e) => {
    if (e.target.closest("button, input, textarea, select, .todoItem, .todoDel, .todoCheck")) return;
    openTodoModal(getSelectedDateObj());
  });
}

if (navDash) navDash.addEventListener("click", () => { setNavActive(navDash); scrollToEl(boxTopA); });
if (navHabits) navHabits.addEventListener("click", () => { setNavActive(navHabits); scrollToEl(tableBox); });
if (navTodo) navTodo.addEventListener("click", () => { setNavActive(navTodo); scrollToEl(todoBox); });
if (navExpenses) navExpenses.addEventListener("click", () => { setNavActive(navExpenses); scrollToEl(bottomBox); });
if (navWishlist) navWishlist.addEventListener("click", () => { setNavActive(navWishlist); scrollToEl(wishWrap || bottomBox); });
if (navAddWishlist) navAddWishlist.addEventListener("click", (e) => { e.stopPropagation(); setNavActive(navWishlist); openWishModal(); });
if (navWishlist) navWishlist.addEventListener("dblclick", () => { setNavActive(navWishlist); openWishModal(); });
if (navAddHabits) navAddHabits.addEventListener("click", (e) => { e.stopPropagation(); setNavActive(navHabits); openHabitModal(); });
if (navAddTodo) navAddTodo.addEventListener("click", (e) => { e.stopPropagation(); setNavActive(navTodo); openTodoModal(getSelectedDateObj()); });
if (navAddExpenses) navAddExpenses.addEventListener("click", (e) => { e.stopPropagation(); setNavActive(navExpenses); openExpModal(); });
if (navTodo) navTodo.addEventListener("dblclick", () => { setNavActive(navTodo); openTodoModal(getSelectedDateObj()); });
if (navHabits) navHabits.addEventListener("dblclick", () => { setNavActive(navHabits); openHabitModal(); });
if (navExpenses) navExpenses.addEventListener("dblclick", (e) => { e.preventDefault(); setNavActive(navExpenses); focusWishlistQuickAdd(); });

(async () => {
  if (AUTH_USER && REGISTER_OK) {
    importAnonStateToUserStorage(AUTH_USER, { overwrite: false });

    if (window.history?.replaceState) {
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
  initTheme();
  initAuth();
  initCalendar();
  initHabits();
  setNavActive(navDash);
  renderAll();
  flushServerSync("boot");
})();
