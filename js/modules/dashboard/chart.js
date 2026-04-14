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

let habitsBalanceChart = null;
let habitsBarChart = null;
let habitsCompareChart = null;

function chartCssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function clearCanvas(canvas) {
  const ctx = canvas?.getContext?.("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function destroyChartInstance(instance) {
  if (!instance) return null;
  instance.destroy();
  return null;
}

function chartTooltipLabel(context) {
  const value = Number(context.raw) || 0;
  return `${context.dataset.label}: ${value}`;
}

function statsForRange(start, end) {
  const habits = state.habits || [];
  const totalDays = Math.max(1, Math.floor((startOfDay(end) - startOfDay(start)) / 86400000) + 1);
  const totalCells = habits.length * totalDays;

  let done = 0;
  let fail = 0;

  for (let i = 0; i < totalDays; i++) {
    const iso = toISO(addDays(start, i));
    for (const h of habits) {
      const v = getEntryValue(h.id, iso);
      if (v === 1) done += 1;
      else if (v === -1) fail += 1;
    }
  }

  const empty = Math.max(0, totalCells - done - fail);
  const decided = done + fail;
  const rate = decided > 0 ? Math.round((done / decided) * 100) : 0;

  return { done, fail, empty, totalCells, decided, rate };
}

function getHabitPeriodComparisons() {
  const selected = getSelectedDateObj();

  const weekStart = startOfWeekMonday(selected);
  const weekEnd = addDays(weekStart, 6);
  const prevWeekStart = addDays(weekStart, -7);
  const prevWeekEnd = addDays(weekStart, -1);

  const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthEnd = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  const prevMonthStart = new Date(selected.getFullYear(), selected.getMonth() - 1, 1);
  const prevMonthEnd = new Date(selected.getFullYear(), selected.getMonth(), 0);

  const weekCurrent = statsForRange(weekStart, weekEnd);
  const weekPrevious = statsForRange(prevWeekStart, prevWeekEnd);
  const monthCurrent = statsForRange(monthStart, monthEnd);
  const monthPrevious = statsForRange(prevMonthStart, prevMonthEnd);

  const weekDelta = weekCurrent.rate - weekPrevious.rate;
  const monthDelta = monthCurrent.rate - monthPrevious.rate;

  return {
    weekCurrent,
    weekPrevious,
    monthCurrent,
    monthPrevious,
    weekDelta,
    monthDelta
  };
}

function renderBalanceChart(done, fail, empty) {
  if (!chartCanvas || typeof Chart === "undefined") {
    habitsBalanceChart = destroyChartInstance(habitsBalanceChart);
    clearCanvas(chartCanvas);
    return;
  }

  const doneColor = chartCssVar("--habit-done", "#24b36b");
  const failColor = chartCssVar("--habit-fail", "#ef3d63");
  const emptyColor = chartCssVar("--chart-empty", "#c2c7d2");

  habitsBalanceChart = destroyChartInstance(habitsBalanceChart);
  habitsBalanceChart = new Chart(chartCanvas, {
    type: "doughnut",
    data: {
      labels: ["Wykonane", "Zawalone", "Puste"],
      datasets: [{
        label: "Bilans",
        data: [done, fail, empty],
        backgroundColor: [doneColor, failColor, emptyColor],
        borderColor: chartCssVar("--bg-panel", "#ffffff"),
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      cutout: "70%",
      animation: {
        duration: 560,
        easing: "easeOutQuart"
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: chartTooltipLabel }
        }
      }
    }
  });
}

function renderHabitBars(stats) {
  if (!habitsBarChartCanvas || typeof Chart === "undefined") {
    habitsBarChart = destroyChartInstance(habitsBarChart);
    clearCanvas(habitsBarChartCanvas);
    return;
  }

  const labels = (stats.perHabit || []).map(h => h.name || "Nawyk");
  if (!labels.length) {
    habitsBarChart = destroyChartInstance(habitsBarChart);
    clearCanvas(habitsBarChartCanvas);
    return;
  }

  const doneSeries = stats.perHabit.map(h => h.donePct);
  const failSeries = stats.perHabit.map(h => h.failPct);
  const emptySeries = stats.perHabit.map(h => Math.max(0, 100 - h.donePct - h.failPct));

  habitsBarChart = destroyChartInstance(habitsBarChart);
  habitsBarChart = new Chart(habitsBarChartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Wykonane %",
          data: doneSeries,
          backgroundColor: chartCssVar("--habit-done", "#24b36b"),
          borderRadius: 6,
          borderSkipped: false,
          stack: "habitPct"
        },
        {
          label: "Zawalone %",
          data: failSeries,
          backgroundColor: chartCssVar("--habit-fail", "#ef3d63"),
          borderRadius: 6,
          borderSkipped: false,
          stack: "habitPct"
        },
        {
          label: "Puste %",
          data: emptySeries,
          backgroundColor: chartCssVar("--chart-empty", "#c2c7d2"),
          borderRadius: 6,
          borderSkipped: false,
          stack: "habitPct"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      indexAxis: "y",
      animation: {
        duration: 420,
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
          max: 100,
          ticks: {
            callback: (v) => `${v}%`
          },
          grid: { color: chartCssVar("--glass-10", "rgba(0,0,0,0.08)") }
        },
        y: {
          stacked: true,
          grid: { display: false }
        }
      }
    }
  });
}

function renderHabitCompareChart() {
  if (!habitsCompareChartCanvas || typeof Chart === "undefined") {
    habitsCompareChart = destroyChartInstance(habitsCompareChart);
    clearCanvas(habitsCompareChartCanvas);
    return;
  }

  const cmp = getHabitPeriodComparisons();
  const current = [cmp.weekCurrent.rate, cmp.monthCurrent.rate];
  const previous = [cmp.weekPrevious.rate, cmp.monthPrevious.rate];

  habitsCompareChart = destroyChartInstance(habitsCompareChart);
  habitsCompareChart = new Chart(habitsCompareChartCanvas, {
    type: "bar",
    data: {
      labels: ["Tydzień", "Miesiąc"],
      datasets: [
        {
          label: "Aktualny zakres",
          data: current,
          backgroundColor: chartCssVar("--accent", "#2f9dff"),
          borderRadius: 8,
          borderSkipped: false
        },
        {
          label: "Poprzedni zakres",
          data: previous,
          backgroundColor: chartCssVar("--glass-10", "rgba(0,0,0,0.18)"),
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      animation: {
        duration: 420,
        easing: "easeOutQuart"
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 10 }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: (v) => `${v}%`
          },
          grid: { color: chartCssVar("--glass-10", "rgba(0,0,0,0.08)") }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
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
  renderBalanceChart(s.done, s.fail, s.empty);
  renderHabitBars(s);
  renderHabitCompareChart();

  if (typeof renderOverviewPanels === "function") renderOverviewPanels();
}

function openChartModal() {
  showOverlay(chartOverlay);
}

function closeChartModal() {
  hideOverlay(chartOverlay);
}

function initChart() {
  if (chartWeekBtn) {
    chartWeekBtn.addEventListener("click", () => {
      if (state.chartMode !== "week") {
        state.chartMode = "week";
        saveState();
      }
      renderChart();
    });
  }

  if (chartMonthBtn) {
    chartMonthBtn.addEventListener("click", () => {
      if (state.chartMode !== "month") {
        state.chartMode = "month";
        saveState();
      }
      renderChart();
    });
  }

  if (chartDetailsBtn) {
    chartDetailsBtn.addEventListener("click", () => {
      renderChartModal(computeChartStats());
      openChartModal();
    });
  }

  if (chartClose) chartClose.addEventListener("click", closeChartModal);
  if (chartOverlay) {
    chartOverlay.addEventListener("click", (e) => {
      if (e.target === chartOverlay) closeChartModal();
    });
  }
}
