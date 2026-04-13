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

function renderDonut(done, fail, empty) {
  const total = done + fail + empty;

  if (!chartSvg) return;

  chartSvg.innerHTML = "";

  const ns = "http://www.w3.org/2000/svg";

  const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;
  const pctFail = total > 0 ? Math.round((fail / total) * 100) : 0;
  const pctEmpty = Math.max(0, 100 - pctDone - pctFail);
  const decided = done + fail;
  const decidedRate = decided > 0 ? Math.round((done / decided) * 100) : 0;

  const header = document.createElementNS(ns, "text");
  header.setAttribute("x", "110");
  header.setAttribute("y", "36");
  header.setAttribute("text-anchor", "middle");
  header.classList.add("chart-headline");
  header.textContent = `${decidedRate}%`;
  chartSvg.appendChild(header);

  const sub = document.createElementNS(ns, "text");
  sub.setAttribute("x", "110");
  sub.setAttribute("y", "52");
  sub.setAttribute("text-anchor", "middle");
  sub.classList.add("chart-subline");
  sub.textContent = decided > 0 ? `wykonane z ${decided} decyzji` : "brak decyzji w zakresie";
  chartSvg.appendChild(sub);

  const trackX = 18;
  const trackY = 72;
  const trackW = 184;
  const trackH = 18;

  const track = document.createElementNS(ns, "rect");
  track.setAttribute("x", String(trackX));
  track.setAttribute("y", String(trackY));
  track.setAttribute("width", String(trackW));
  track.setAttribute("height", String(trackH));
  track.setAttribute("rx", "9");
  track.classList.add("chart-stack-track");
  chartSvg.appendChild(track);

  let start = trackX;
  const segs = [
    { pct: pctDone, cls: "done" },
    { pct: pctFail, cls: "fail" },
    { pct: pctEmpty, cls: "empty" }
  ];

  for (const seg of segs) {
    const rawW = total > 0 ? Math.round((seg.pct / 100) * trackW) : 0;
    if (rawW <= 0) continue;

    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", String(start));
    rect.setAttribute("y", String(trackY));
    rect.setAttribute("width", String(rawW));
    rect.setAttribute("height", String(trackH));
    rect.classList.add("chart-stack-seg", seg.cls);
    chartSvg.appendChild(rect);

    start += rawW;
  }

  const rows = [
    { label: "Wykonane", value: done, pct: pctDone, cls: "done" },
    { label: "Zawalone", value: fail, pct: pctFail, cls: "fail" },
    { label: "Puste", value: empty, pct: pctEmpty, cls: "empty" }
  ];

  rows.forEach((row, i) => {
    const y = 118 + i * 30;

    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", "24");
    dot.setAttribute("cy", String(y - 5));
    dot.setAttribute("r", "4");
    dot.classList.add("chart-legend-dot", row.cls);
    chartSvg.appendChild(dot);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", "34");
    label.setAttribute("y", String(y - 1));
    label.classList.add("chart-legend-label");
    label.textContent = row.label;
    chartSvg.appendChild(label);

    const value = document.createElementNS(ns, "text");
    value.setAttribute("x", "204");
    value.setAttribute("y", String(y - 1));
    value.setAttribute("text-anchor", "end");
    value.classList.add("chart-legend-value");
    value.textContent = `${row.value} (${row.pct}%)`;
    chartSvg.appendChild(value);
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
