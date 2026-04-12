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

function initPomodoro() {
  if (pomoFocusBtn) pomoFocusBtn.addEventListener("click", () => pomoSwitchMode("focus"));
  if (pomoBreakBtn) pomoBreakBtn.addEventListener("click", () => pomoSwitchMode("break"));
  if (pomoLongBtn) pomoLongBtn.addEventListener("click", () => pomoSwitchMode("long"));
  if (pomoStartBtn) pomoStartBtn.addEventListener("click", pomoToggleStart);
  if (pomoResetBtn) pomoResetBtn.addEventListener("click", pomoReset);
  if (pomoTimeEl) pomoTimeEl.addEventListener("click", pomoBeginInlineEdit);
}
