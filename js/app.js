function getSelectedDateObj() {
  return fromISO(state.selectedDate);
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

document.addEventListener("keydown", (e) => {
  if (todoOverlay?.classList.contains("isOpen") && e.key === "Escape") closeTodoModal();
  if (chartOverlay?.classList.contains("isOpen") && e.key === "Escape") closeChartModal();
  if (wishOverlay?.classList.contains("isOpen") && e.key === "Escape") closeWishModal();
});

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
  if (AUTH_USER) {
    const hasUserState = !!readUserState(AUTH_USER);

    if (!hasUserState) {
      importAnonStateToUserStorage(AUTH_USER, { overwrite: false });
    }

    if (REGISTER_OK && window.history?.replaceState) {
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
  initTodo();
  initExpenses();
  initChart();
  initWishlist();
  initPomodoro();

  setNavActive(navDash);
  renderAll();
  flushServerSync("boot");
})();