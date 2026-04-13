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

  if (!chartSvg) return;

  chartSvg.innerHTML = "";

  const cx = 110;
  const cy = 110;
  const r = 86;

  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", cx);
  ring.setAttribute("cy", cy);
  ring.setAttribute("r", r);
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke-width", "18");
  ring.setAttribute("shape-rendering", "geometricPrecision");
  ring.setAttribute("stroke-linecap", "butt");
  ring.classList.add("chart-part", "empty");
  chartSvg.appendChild(ring);

  if (total <= 0) {
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
    center.textContent = "0%";
    chartSvg.appendChild(center);

    return;
  }

  let angle = (empty / total) * 360;

  const parts = [
    { v: fail, cls: "fail" },
    { v: done, cls: "done" }
  ].filter(p => p.v > 0);

  for (const p of parts) {
    const span = (p.v / total) * 360;
    const startAngle = angle;
    const endAngle = angle + span;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", arcPath(cx, cy, r, startAngle, endAngle));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", "18");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("shape-rendering", "geometricPrecision");
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
