const TODO_RENDER_STEP = 60;
let todoVisibleCount = TODO_RENDER_STEP;

function openTodoModal(dateObj) {
  if (!todoOverlay) return;
  todoDateInput.value = toISO(dateObj);
  todoText.value = "";
  todoPriority.value = "medium";
  syncCustomSelect(todoPriority);
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
    doneAt: 0,
    createdAt: Date.now()
  });

  todoVisibleCount = Math.max(TODO_RENDER_STEP, todoVisibleCount + 1);

  saveState();
  renderTodos();
}

function toggleTodo(id) {
  const it = state.todos.find(x => x.id === id);
  if (!it) return;
  if (it.done) {
    it.done = false;
    it.doneAt = 0;
  } else {
    it.done = true;
    it.doneAt = Date.now();
  }
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
    todoVisibleCount = TODO_RENDER_STEP;
    toggleClass(todoEmpty, "isHidden", false);
    if (typeof renderOverviewPanels === "function") renderOverviewPanels();
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

    const priorityTag = document.createElement("div");
    priorityTag.className = "expTag";
    priorityTag.textContent = todoPriorityLabel(it.priority || "medium");

    textBox.appendChild(txt);
    textBox.appendChild(meta);

    const tagsBox = document.createElement("div");
    tagsBox.className = "todoTags";
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

  if (typeof renderOverviewPanels === "function") renderOverviewPanels();
}

function initTodo() {
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
      addTodo(todoDateInput.value, todoText.value, todoPriority.value);
      closeTodoModal();
    });
  }

  if (todoPanel) {
    todoPanel.addEventListener("dblclick", (e) => {
      if (e.target.closest("button, input, textarea, select, .todoItem, .todoDel, .todoCheck")) return;
      openTodoModal(getSelectedDateObj());
    });
  }
}
