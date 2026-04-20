const TODO_RENDER_STEP = 60;
const TODO_PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const TODO_RECURRENCE_ALLOWED = ["none", "daily", "weekly", "monthly"];
const TODO_LANE_ALLOWED = ["backlog", "progress", "blocked", "done"];
const TODO_LANES = [
  { id: "backlog", label: "Backlog" },
  { id: "progress", label: "W toku" },
  { id: "blocked", label: "Blokada" },
  { id: "done", label: "Zrobione" }
];

let todoVisibleCount = TODO_RENDER_STEP;
let todoDragId = "";
const todoChecklistExpanded = {};

function ensureTodos() {
  if (!Array.isArray(state.todos)) state.todos = [];
}

function isTodoISO(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""));
}

function normalizeTodoRecurrence(raw) {
  const v = String(raw || "none").trim();
  return TODO_RECURRENCE_ALLOWED.includes(v) ? v : "none";
}

function normalizeTodoLane(raw) {
  const v = String(raw || "backlog").trim();
  return TODO_LANE_ALLOWED.includes(v) ? v : "backlog";
}

function todoPriorityLabel(v) {
  if (v === "high") return "Wysoki";
  if (v === "low") return "Niski";
  return "Średni";
}

function todoRecurrenceLabel(v) {
  if (v === "daily") return "Codziennie";
  if (v === "weekly") return "Co tydzień";
  if (v === "monthly") return "Co miesiąc";
  return "Jednorazowe";
}

function todoLaneLabel(v) {
  if (v === "progress") return "W toku";
  if (v === "blocked") return "Blokada";
  if (v === "done") return "Zrobione";
  return "Backlog";
}

function getTodoLaneId(todo) {
  if (todo?.done) return "done";
  return normalizeTodoLane(todo?.lane || "backlog");
}

function addMonthsKeepingDay(dateObj, amount = 1) {
  const base = startOfDay(dateObj);
  const wantedDay = base.getDate();
  const temp = new Date(base.getFullYear(), base.getMonth() + amount, 1);
  const lastDay = new Date(temp.getFullYear(), temp.getMonth() + 1, 0).getDate();
  temp.setDate(Math.min(wantedDay, lastDay));
  return startOfDay(temp);
}

function nextRecurringISO(dateISO, recurrence) {
  const d = isTodoISO(dateISO)
    ? fromISO(dateISO)
    : startOfDay(new Date());

  const rule = normalizeTodoRecurrence(recurrence);
  if (rule === "daily") return toISO(addDays(d, 1));
  if (rule === "weekly") return toISO(addDays(d, 7));
  if (rule === "monthly") return toISO(addMonthsKeepingDay(d, 1));
  return toISO(d);
}

function parseChecklistText(raw) {
  const rows = String(raw || "")
    .split(/\r?\n/g)
    .map((line) => String(line || "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 25);

  return rows.map((text) => ({
    id: crypto.randomUUID(),
    text,
    done: false,
    createdAt: Date.now()
  }));
}

function getTodoSubtaskProgress(todo) {
  const subtasks = Array.isArray(todo?.subtasks) ? todo.subtasks : [];
  const total = subtasks.length;
  let done = 0;

  for (const sub of subtasks) {
    if (sub?.done) done += 1;
  }

  return { done, total };
}

function openTodoModal(dateObj) {
  if (!todoOverlay) return;

  todoDateInput.value = toISO(dateObj);
  todoText.value = "";
  todoPriority.value = "medium";
  if (todoRecurrence) todoRecurrence.value = "none";
  if (todoChecklist) todoChecklist.value = "";

  syncCustomSelect(todoPriority);
  if (todoRecurrence) syncCustomSelect(todoRecurrence);

  showOverlay(todoOverlay);
  setTimeout(() => todoText.focus(), 0);
}

function closeTodoModal() {
  hideOverlay(todoOverlay);
}

function createTodoEntry(dateISO, text, priority, opts = {}) {
  const t = String(text || "").trim();
  if (!t) return null;

  const safeDateISO = isTodoISO(dateISO)
    ? dateISO
    : toISO(getSelectedDateObj());

  const p = String(priority || "medium").trim();
  const safePriority = p === "high" || p === "low" ? p : "medium";

  const recurrence = normalizeTodoRecurrence(opts.recurrence || "none");
  const lane = normalizeTodoLane(opts.lane || "backlog");

  const subtasks = Array.isArray(opts.subtasks)
    ? opts.subtasks
      .filter((sub) => sub && typeof sub === "object")
      .map((sub) => ({
        id: String(sub.id || crypto.randomUUID()),
        text: String(sub.text || "").trim(),
        done: !!sub.done,
        createdAt: Number(sub.createdAt) || Date.now()
      }))
      .filter((sub) => sub.text.length > 0)
    : parseChecklistText(opts.checklistText || "");

  const recurrenceSeriesId = recurrence === "none"
    ? ""
    : String(opts.recurrenceSeriesId || opts.seriesId || crypto.randomUUID());

  return {
    id: String(opts.id || crypto.randomUUID()),
    dateISO: safeDateISO,
    text: t,
    priority: safePriority,
    done: !!opts.done,
    doneAt: Number(opts.doneAt) > 0 ? Number(opts.doneAt) : 0,
    createdAt: Number(opts.createdAt) || Date.now(),
    recurrence,
    recurrenceSeriesId,
    lane: opts.done ? "done" : lane,
    lastLaneBeforeDone: normalizeTodoLane(opts.lastLaneBeforeDone || lane),
    subtasks
  };
}

function addTodo(dateISO, text, priority, opts = {}) {
  ensureTodos();

  const entry = createTodoEntry(dateISO, text, priority, opts);
  if (!entry) return false;

  state.todos.push(entry);
  todoVisibleCount = Math.max(TODO_RENDER_STEP, todoVisibleCount + 1);

  saveState();
  renderTodos();
  return true;
}

function spawnRecurringFollowUp(todo) {
  const recurrence = normalizeTodoRecurrence(todo?.recurrence || "none");
  if (recurrence === "none") return;

  const seriesId = String(todo?.recurrenceSeriesId || todo?.id || "").trim();
  if (!seriesId) return;
  todo.recurrenceSeriesId = seriesId;

  const nextISO = nextRecurringISO(todo.dateISO, recurrence);
  const alreadyExists = state.todos.some((it) => {
    if (!it || typeof it !== "object") return false;
    if (String(it.id || "") === String(todo.id || "")) return false;
    return String(it.recurrenceSeriesId || "") === seriesId &&
      String(it.dateISO || "") === nextISO &&
      !it.done;
  });

  if (alreadyExists) return;

  const subtasks = Array.isArray(todo.subtasks)
    ? todo.subtasks
      .map((sub) => ({
        id: crypto.randomUUID(),
        text: String(sub?.text || "").trim(),
        done: false,
        createdAt: Date.now()
      }))
      .filter((sub) => sub.text.length > 0)
    : [];

  state.todos.push({
    id: crypto.randomUUID(),
    dateISO: nextISO,
    text: String(todo.text || "").trim(),
    priority: String(todo.priority || "medium"),
    done: false,
    doneAt: 0,
    createdAt: Date.now(),
    recurrence,
    recurrenceSeriesId: seriesId,
    lane: "backlog",
    lastLaneBeforeDone: "backlog",
    subtasks
  });

  todoVisibleCount = Math.max(TODO_RENDER_STEP, todoVisibleCount + 1);
}

function removeRecurringFollowUp(todo) {
  const recurrence = normalizeTodoRecurrence(todo?.recurrence || "none");
  if (recurrence === "none") return;

  const seriesId = String(todo?.recurrenceSeriesId || "").trim();
  if (!seriesId) return;

  const nextISO = nextRecurringISO(todo.dateISO, recurrence);
  const doneAt = Number(todo.doneAt || 0);

  const idx = state.todos.findIndex((it) => {
    if (!it || typeof it !== "object") return false;
    if (String(it.id || "") === String(todo.id || "")) return false;
    return String(it.recurrenceSeriesId || "") === seriesId &&
      String(it.dateISO || "") === nextISO &&
      !it.done &&
      Number(it.createdAt || 0) >= doneAt;
  });

  if (idx >= 0) {
    state.todos.splice(idx, 1);
  }
}

function markTodoDoneState(todo, nextDone, opts = {}) {
  if (!todo) return;

  if (nextDone) {
    if (todo.done) return;

    todo.lastLaneBeforeDone = normalizeTodoLane(todo.lane || todo.lastLaneBeforeDone || "backlog");
    todo.done = true;
    todo.doneAt = Date.now();
    todo.lane = "done";

    if (Array.isArray(todo.subtasks) && todo.subtasks.length > 0) {
      for (const sub of todo.subtasks) {
        sub.done = true;
      }
    }

    if (!opts.skipRecurringSpawn) {
      spawnRecurringFollowUp(todo);
    }
    return;
  }

  if (!todo.done && normalizeTodoLane(todo.lane) !== "done") return;

  if (!opts.keepFollowUp && Number(todo.doneAt || 0) > 0) {
    removeRecurringFollowUp(todo);
  }

  todo.done = false;
  todo.doneAt = 0;
  todo.lane = normalizeTodoLane(todo.lastLaneBeforeDone || "backlog");

  if (opts.resetSubtasks && Array.isArray(todo.subtasks)) {
    for (const sub of todo.subtasks) {
      sub.done = false;
    }
  }
}

function toggleTodo(id) {
  ensureTodos();

  const it = state.todos.find((x) => x.id === id);
  if (!it) return;

  if (it.done) {
    markTodoDoneState(it, false, { resetSubtasks: true });
  } else {
    markTodoDoneState(it, true);
  }

  saveState();
  renderTodos();
}

function deleteTodo(id) {
  ensureTodos();
  state.todos = state.todos.filter((x) => x.id !== id);
  delete todoChecklistExpanded[id];
  saveState();
  renderTodos();
}

function getTodoSlaInfo(todo) {
  if (!todo || todo.done) {
    return { status: "resolved", label: "SLA: Zamknięte" };
  }

  if (!isTodoISO(todo.dateISO)) {
    return { status: "ok", label: "SLA: OK" };
  }

  const due = fromISO(todo.dateISO);
  due.setHours(23, 59, 59, 999);
  const diff = due.getTime() - Date.now();

  if (diff < 0) return { status: "overdue", label: "SLA: Po terminie" };
  if (diff <= 24 * 60 * 60 * 1000) return { status: "risk", label: "SLA: Ryzyko" };
  return { status: "ok", label: "SLA: OK" };
}

function toggleTodoSubtask(todoId, subtaskId) {
  ensureTodos();

  const todo = state.todos.find((it) => it.id === todoId);
  if (!todo || !Array.isArray(todo.subtasks)) return;

  const sub = todo.subtasks.find((it) => it.id === subtaskId);
  if (!sub) return;

  sub.done = !sub.done;

  const progress = getTodoSubtaskProgress(todo);
  if (progress.total > 0) {
    if (progress.done === progress.total) {
      markTodoDoneState(todo, true);
    } else if (todo.done) {
      markTodoDoneState(todo, false, { keepFollowUp: false });
      todo.lane = "progress";
    }
  }

  saveState();
  renderTodos();
}

function toggleTodoChecklist(todoId) {
  todoChecklistExpanded[todoId] = !todoChecklistExpanded[todoId];
  renderTodos();
}

function sortTodos(items) {
  return [...items].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (a.dateISO !== b.dateISO) return a.dateISO.localeCompare(b.dateISO);

    const aPriority = TODO_PRIORITY_ORDER[a.priority || "medium"] ?? 1;
    const bPriority = TODO_PRIORITY_ORDER[b.priority || "medium"] ?? 1;
    if (aPriority !== bPriority) return aPriority - bPriority;

    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function appendTodoTags(tagsBox, todo) {
  const priorityTag = document.createElement("div");
  priorityTag.className = "expTag";
  priorityTag.textContent = todoPriorityLabel(todo.priority || "medium");
  tagsBox.appendChild(priorityTag);

  const recurrence = normalizeTodoRecurrence(todo.recurrence || "none");
  if (recurrence !== "none") {
    const recurrenceTag = document.createElement("div");
    recurrenceTag.className = "expTag todoRecurrenceTag";
    recurrenceTag.textContent = todoRecurrenceLabel(recurrence);
    tagsBox.appendChild(recurrenceTag);
  }

  const laneTag = document.createElement("div");
  laneTag.className = "expTag todoLaneTag";
  laneTag.textContent = todoLaneLabel(getTodoLaneId(todo));
  tagsBox.appendChild(laneTag);

  const sla = getTodoSlaInfo(todo);
  const slaTag = document.createElement("div");
  slaTag.className = "expTag todoSlaTag";
  if (sla.status === "risk") slaTag.classList.add("isRisk");
  if (sla.status === "overdue") slaTag.classList.add("isOverdue");
  if (sla.status === "ok") slaTag.classList.add("isOk");
  slaTag.textContent = sla.label;
  tagsBox.appendChild(slaTag);

  const subtaskProgress = getTodoSubtaskProgress(todo);
  if (subtaskProgress.total > 0) {
    const checklistTag = document.createElement("div");
    checklistTag.className = "expTag todoChecklistTag";
    checklistTag.textContent = `Checklista ${subtaskProgress.done}/${subtaskProgress.total}`;
    tagsBox.appendChild(checklistTag);
  }
}

function appendTodoChecklist(textBox, todo) {
  const subtasks = Array.isArray(todo.subtasks) ? todo.subtasks : [];
  if (!subtasks.length) return;

  const progress = getTodoSubtaskProgress(todo);

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "todoChecklistToggle";
  if (progress.total > 0 && progress.done === progress.total) {
    toggleBtn.classList.add("isComplete");
  }
  toggleBtn.textContent = todoChecklistExpanded[todo.id]
    ? `Ukryj checklistę (${progress.done}/${progress.total})`
    : `Pokaż checklistę (${progress.done}/${progress.total})`;
  toggleBtn.addEventListener("click", () => toggleTodoChecklist(todo.id));

  textBox.appendChild(toggleBtn);

  if (!todoChecklistExpanded[todo.id]) return;

  const list = document.createElement("div");
  list.className = "todoChecklistList";

  for (const sub of subtasks) {
    const row = document.createElement("label");
    row.className = "todoChecklistItem";
    if (sub.done) row.classList.add("isDone");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "todoChecklistCheck";
    cb.checked = !!sub.done;
    cb.addEventListener("change", () => toggleTodoSubtask(todo.id, sub.id));

    const txt = document.createElement("span");
    txt.textContent = sub.text;

    row.appendChild(cb);
    row.appendChild(txt);
    list.appendChild(row);
  }

  textBox.appendChild(list);
}

function renderTodoList(items) {
  if (todoList) todoList.innerHTML = "";
  if (!todoList) return;

  if (!items.length) {
    todoVisibleCount = TODO_RENDER_STEP;
    toggleClass(todoEmpty, "isHidden", false);
    return;
  }

  toggleClass(todoEmpty, "isHidden", true);

  if (todoVisibleCount < TODO_RENDER_STEP) {
    todoVisibleCount = TODO_RENDER_STEP;
  }
  if (items.length < todoVisibleCount) {
    todoVisibleCount = Math.max(TODO_RENDER_STEP, items.length);
  }

  const visibleItems = items.slice(0, todoVisibleCount);
  const frag = document.createDocumentFragment();

  for (const it of visibleItems) {
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

    const tagsBox = document.createElement("div");
    tagsBox.className = "todoTags";
    appendTodoTags(tagsBox, it);

    textBox.appendChild(txt);
    textBox.appendChild(meta);
    textBox.appendChild(tagsBox);
    appendTodoChecklist(textBox, it);

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
    frag.appendChild(row);
  }

  todoList.appendChild(frag);

  if (items.length > visibleItems.length) {
    const moreBtn = document.createElement("button");
    moreBtn.type = "button";
    moreBtn.className = "calBtn todoLoadMore";
    moreBtn.textContent = `Pokaż więcej (${items.length - visibleItems.length})`;
    moreBtn.addEventListener("click", () => {
      todoVisibleCount = Math.min(items.length, todoVisibleCount + TODO_RENDER_STEP);
      renderTodos();
    });
    todoList.appendChild(moreBtn);
  }
}

function setTodoLane(id, lane) {
  ensureTodos();

  const todo = state.todos.find((it) => it.id === id);
  if (!todo) return;

  const nextLane = normalizeTodoLane(lane);
  if (nextLane === "done") {
    markTodoDoneState(todo, true);
  } else {
    if (todo.done) {
      markTodoDoneState(todo, false, { resetSubtasks: false });
    }
    todo.lane = nextLane;
  }

  saveState();
  renderTodos();
}

function nextTodoLane(lane) {
  const current = normalizeTodoLane(lane);
  if (current === "backlog") return "progress";
  if (current === "progress") return "blocked";
  if (current === "blocked") return "done";
  return "backlog";
}

function createKanbanCard(todo) {
  const card = document.createElement("article");
  card.className = "todoKanbanItem";
  if (todo.done) card.classList.add("isDone");

  const sla = getTodoSlaInfo(todo);
  if (sla.status === "risk") card.classList.add("isRisk");
  if (sla.status === "overdue") card.classList.add("isOverdue");

  card.draggable = true;
  card.addEventListener("dragstart", () => {
    todoDragId = todo.id;
    card.classList.add("isDragging");
  });
  card.addEventListener("dragend", () => {
    todoDragId = "";
    card.classList.remove("isDragging");
  });

  const title = document.createElement("div");
  title.className = "todoKanbanText";
  title.textContent = todo.text;

  const meta = document.createElement("div");
  meta.className = "todoKanbanMeta";
  meta.textContent = `${fmtPL(fromISO(todo.dateISO))} • ${todoPriorityLabel(todo.priority || "medium")}`;

  const tags = document.createElement("div");
  tags.className = "todoKanbanTags";

  const slaTag = document.createElement("span");
  slaTag.className = "todoKanbanTag";
  if (sla.status === "risk") slaTag.classList.add("isRisk");
  if (sla.status === "overdue") slaTag.classList.add("isOverdue");
  if (sla.status === "ok") slaTag.classList.add("isOk");
  slaTag.textContent = sla.label;

  tags.appendChild(slaTag);

  const progress = getTodoSubtaskProgress(todo);
  if (progress.total > 0) {
    const checklistTag = document.createElement("span");
    checklistTag.className = "todoKanbanTag";
    checklistTag.textContent = `${progress.done}/${progress.total}`;
    tags.appendChild(checklistTag);
  }

  const actions = document.createElement("div");
  actions.className = "todoKanbanActions";

  const moveBtn = document.createElement("button");
  moveBtn.type = "button";
  moveBtn.className = "calBtn todoKanbanMoveBtn";
  moveBtn.textContent = getTodoLaneId(todo) === "done" ? "Cofnij" : "Następny etap";
  moveBtn.addEventListener("click", () => {
    const nextLane = nextTodoLane(getTodoLaneId(todo));
    setTodoLane(todo.id, nextLane);
  });

  actions.appendChild(moveBtn);

  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(tags);
  card.appendChild(actions);
  return card;
}

function renderTodoKanban(items) {
  if (!todoKanbanBoard) return;

  todoKanbanBoard.innerHTML = "";

  const laneBuckets = {
    backlog: [],
    progress: [],
    blocked: [],
    done: []
  };

  for (const it of items) {
    const lane = getTodoLaneId(it);
    laneBuckets[lane].push(it);
  }

  for (const lane of TODO_LANES) {
    const col = document.createElement("section");
    col.className = "todoKanbanCol";
    col.dataset.lane = lane.id;

    const header = document.createElement("div");
    header.className = "todoKanbanColHead";

    const title = document.createElement("strong");
    title.textContent = lane.label;

    const count = document.createElement("span");
    count.textContent = String(laneBuckets[lane.id].length);

    header.appendChild(title);
    header.appendChild(count);

    const list = document.createElement("div");
    list.className = "todoKanbanColBody";

    col.addEventListener("dragover", (e) => {
      e.preventDefault();
      col.classList.add("isDropZone");
    });

    col.addEventListener("dragleave", () => {
      col.classList.remove("isDropZone");
    });

    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("isDropZone");
      if (!todoDragId) return;
      setTodoLane(todoDragId, lane.id);
    });

    if (!laneBuckets[lane.id].length) {
      const empty = document.createElement("div");
      empty.className = "todoKanbanEmpty";
      empty.textContent = "Brak kart";
      list.appendChild(empty);
    } else {
      for (const it of laneBuckets[lane.id]) {
        list.appendChild(createKanbanCard(it));
      }
    }

    col.appendChild(header);
    col.appendChild(list);
    todoKanbanBoard.appendChild(col);
  }

  if (todoKanbanSummary) {
    todoKanbanSummary.textContent =
      `Backlog: ${laneBuckets.backlog.length} • W toku: ${laneBuckets.progress.length} • Blokada: ${laneBuckets.blocked.length} • Zrobione: ${laneBuckets.done.length}`;
  }
}

function renderTodos() {
  ensureTodos();

  if (todoTitleSub) {
    todoTitleSub.textContent = `• ${monthNamePL(state.viewMonth)} ${state.viewYear}`;
  }

  const sorted = sortTodos(state.todos || []);
  renderTodoList(sorted);
  renderTodoKanban(sorted);

  if (typeof renderOverviewPanels === "function") renderOverviewPanels();
}

function initTodo() {
  ensureTodos();

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

  if (todoSave) {
    todoSave.addEventListener("click", () => {
      const added = addTodo(todoDateInput.value, todoText.value, todoPriority.value, {
        recurrence: todoRecurrence?.value || "none",
        checklistText: todoChecklist?.value || ""
      });

      if (added) closeTodoModal();
    });
  }

  const todoTargetPanel = todoBox || todoPanel;
  if (todoTargetPanel) {
    todoTargetPanel.addEventListener("dblclick", (e) => {
      if (e.target.closest("button, input, textarea, select, .todoItem, .todoDel, .todoCheck")) return;
      openTodoModal(getSelectedDateObj());
    });
  }
}
