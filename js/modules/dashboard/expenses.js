function ensureExpenses() {
  if (!state.expenses) state.expenses = [];
}

let expCategoryChart = null;
let expTrendChart = null;

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
  let v = inputEl.value;
  v = v.replace(/[^0-9.,]/g, "");
  const parts = v.split(/[.,]/);
  if (parts[0].length > 9) parts[0] = parts[0].slice(0, 9);
  inputEl.value = parts.length > 1 ? parts[0] + "," + parts[1].slice(0, 2) : parts[0];
}

function createExpenseFromInput(amountRaw, whatRaw, category, score, period, dateISO) {
  const amount = Number(String(amountRaw || "").replace(",", "."));
  const what = String(whatRaw || "").trim();

  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (String(Math.floor(amount)).length > 10) return null;
  if (!what) return null;

  return {
    id: crypto.randomUUID(),
    dateISO: dateISO || getExpenseFilterISO(),
    amount,
    what,
    category: category || "Inne",
    score: score || "B",
    period: period || "once",
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
  closeExpModal();
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
  if (expFilterCategory) {
    expFilterCategory.value = filterCategory;
    syncCustomSelect(expFilterCategory);
  }

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
  if (!expList) return;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "todoEmpty";
    empty.textContent = "Brak wpisów.";
    expList.appendChild(empty);
    renderExpenseCharts();
    if (typeof renderOverviewPanels === "function") renderOverviewPanels();
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

  renderExpenseCharts();

  if (typeof renderOverviewPanels === "function") renderOverviewPanels();
}

function renderExpenseCharts() {
  const canChart = typeof Chart !== "undefined";

  if (!canChart) {
    expCategoryChart = destroyExpChart(expCategoryChart);
    expTrendChart = destroyExpChart(expTrendChart);
    clearExpCanvas(expCategoryChartCanvas);
    clearExpCanvas(expTrendChartCanvas);
    return;
  }

  const selected = fromISO(state.selectedDate);
  const selectedMonth = selected.getMonth();
  const selectedYear = selected.getFullYear();

  const byCategory = {};
  for (const it of (state.expenses || [])) {
    const d = fromISO(it.dateISO);
    if (d.getMonth() !== selectedMonth || d.getFullYear() !== selectedYear) continue;
    const name = it.category || "Inne";
    byCategory[name] = (byCategory[name] || 0) + (Number(it.amount) || 0);
  }

  const categoryRows = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (expCategoryChartCanvas) {
    if (!categoryRows.length) {
      expCategoryChart = destroyExpChart(expCategoryChart);
      clearExpCanvas(expCategoryChartCanvas);
    } else {
      expCategoryChart = destroyExpChart(expCategoryChart);
      expCategoryChart = new Chart(expCategoryChartCanvas, {
        type: "doughnut",
        data: {
          labels: categoryRows.map(x => x.name),
          datasets: [{
            label: "Kategorie",
            data: categoryRows.map(x => Number(x.value.toFixed(2))),
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
    const sparseTrend = values.filter(v => v > 0).length <= 2;

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

function initExpenses() {
  if (expAmount) expAmount.addEventListener("input", () => normalizeAmountInput(expAmount));

  if (expAdd) expAdd.addEventListener("click", addExpense);
  if (expWhat) expWhat.addEventListener("keydown", (e) => { if (e.key === "Enter") addExpense(); });
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
}
