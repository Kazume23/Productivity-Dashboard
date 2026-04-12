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

function initExpenses() {
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
}
