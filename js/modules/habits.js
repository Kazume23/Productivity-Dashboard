function renderHabits() {
  const selected = fromISO(state.selectedDate);
  const weekStart = startOfWeekMonday(selected);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  if (habRange) {
    habRange.textContent = `${fmtPL(weekStart)} do ${fmtPL(addDays(weekStart, 6))}`;
  }

  const trHead = document.createElement("tr");
  const thHabit = document.createElement("th");
  thHabit.textContent = "Nawyk";
  thHabit.className = "thHabit";
  trHead.appendChild(thHabit);

  const thDel = document.createElement("th");
  thDel.className = "thDel";
  thDel.textContent = "";
  trHead.appendChild(thDel);

  for (const d of weekDates) {
    const th = document.createElement("th");
    th.className = "thDay";
    th.textContent = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
    if (sameDay(d, selected)) th.classList.add("thToday");
    trHead.appendChild(th);
  }

  if (habThead) {
    habThead.innerHTML = "";
    habThead.appendChild(trHead);
  }

  if (habTbody) habTbody.innerHTML = "";

  for (const h of state.habits) {
    const tr = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.className = "tdHabit";
    const nameDiv = document.createElement("div");
    nameDiv.className = "habitName";
    nameDiv.contentEditable = "true";
    nameDiv.spellcheck = false;
    nameDiv.textContent = h.name;
    nameDiv.addEventListener("blur", () => {
      const v = nameDiv.textContent.trim();
      h.name = v.length ? v : "Nawyk";
      saveState();
    });
    nameDiv.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); nameDiv.blur(); }
    });
    tdName.appendChild(nameDiv);
    tr.appendChild(tdName);

    const tdDel = document.createElement("td");
    tdDel.className = "tdCell";
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "habitDel";
    delBtn.textContent = "×";
    delBtn.title = "Usuń nawyk";
    delBtn.addEventListener("click", () => deleteHabit(h.id));
    tdDel.appendChild(delBtn);
    tr.appendChild(tdDel);

    for (const d of weekDates) {
      const dateISO = toISO(d);
      const key = `${h.id}|${dateISO}`;
      const val = state.entries[key] ?? 0;
      const td = document.createElement("td");
      td.className = "tdCell";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cellBtn";
      if (val === 1) btn.classList.add("cellDone");
      if (val === -1) btn.classList.add("cellFail");
      btn.addEventListener("click", () => cycleEntry(h.id, dateISO));
      td.appendChild(btn);
      tr.appendChild(td);
    }

    habTbody?.appendChild(tr);
  }

  if (typeof renderOverviewPanels === "function") renderOverviewPanels();
}

function cycleEntry(habitId, dateISO) {
  const key = `${habitId}|${dateISO}`;
  const current = state.entries[key] ?? 0;
  let next;
  if (current === 0) next = 1;
  else if (current === 1) next = -1;
  else next = 0;

  if (next === 0) {
    delete state.entries[key];
  } else {
    state.entries[key] = next;
  }

  saveState();
  renderHabits();
  renderChart();
}

function deleteHabit(habitId) {
  state.habits = state.habits.filter(h => h.id !== habitId);
  for (const entryKey of Object.keys(state.entries)) {
    if (entryKey.startsWith(habitId + "|")) {
      delete state.entries[entryKey];
    }
  }
  saveState();
  renderHabits();
  renderChart();
}

function addHabit() {
  const name = habitName?.value.trim();
  if (!name) return;
  state.habits.push({ id: crypto.randomUUID(), name });
  habitName.value = "";
  saveState();
  renderHabits();
  renderChart();
}

function openHabitModal() {
  if (!habitOverlay) return;
  if (habitModalName) habitModalName.value = "";
  showOverlay(habitOverlay);
  setTimeout(() => habitModalName?.focus(), 0);
}

function closeHabitModal() {
  if (!habitOverlay) return;
  hideOverlay(habitOverlay);
}

function addHabitFromModal() {
  const name = habitModalName?.value.trim();
  if (!name) return;
  state.habits.push({ id: crypto.randomUUID(), name });
  saveState();
  renderHabits();
  renderChart();
  closeHabitModal();
}

function initHabits() {
  addHabitBtn?.addEventListener("click", addHabit);
  habitName?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addHabit();
  });

  habitSave?.addEventListener("click", addHabitFromModal);
  habitClose?.addEventListener("click", closeHabitModal);
  habitCancel?.addEventListener("click", closeHabitModal);
  habitOverlay?.addEventListener("click", (e) => {
    if (e.target === habitOverlay) closeHabitModal();
  });
  document.addEventListener("keydown", (e) => {
    if (habitOverlay?.classList.contains("isOpen") && e.key === "Escape") closeHabitModal();
  });
}
