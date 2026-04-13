function getSelectedDateObj() {
  return fromISO(state.selectedDate);
}

const PAGE_HEADER_BY_NAV = {
  navDash: {
    title: "Dashboard",
    subtitle: "Przegląd dnia i postępów"
  },
  navTodo: {
    title: "ToDo",
    subtitle: "Plan zadań i priorytetów"
  },
  navHabits: {
    title: "Nawyki",
    subtitle: "Codzienna regularność i bilans"
  },
  navExpenses: {
    title: "Wydatki",
    subtitle: "Kontrola kosztów i kategorii"
  },
  navWishlist: {
    title: "Wishlist",
    subtitle: "Lista rzeczy do zaplanowania"
  }
};

function syncPageHeader(navBtn) {
  if (!pageTitle || !pageSubtitle) return;

  const navId = navBtn?.id || "navDash";
  const conf = PAGE_HEADER_BY_NAV[navId] || PAGE_HEADER_BY_NAV.navDash;

  pageTitle.textContent = conf.title;
  pageSubtitle.textContent = conf.subtitle;
}

function setNavActive(btn) {
  document.querySelectorAll(".navItem").forEach(x => x.classList.remove("isActive"));
  btn?.classList.add("isActive");
  syncPageHeader(btn);
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

function isMobileDrawerMode() {
  return window.matchMedia("(max-width: 980px)").matches;
}

function openSidebarDrawer() {
  if (!isMobileDrawerMode() || !sidebar) return;
  sidebar.classList.add("isOpen");
  document.body.classList.add("drawerOpen");
  mobileMenuBtn?.setAttribute("aria-expanded", "true");
}

function closeSidebarDrawer() {
  sidebar?.classList.remove("isOpen");
  document.body.classList.remove("drawerOpen");
  mobileMenuBtn?.setAttribute("aria-expanded", "false");
}

function toggleSidebarDrawer() {
  if (sidebar?.classList.contains("isOpen")) {
    closeSidebarDrawer();
    return;
  }
  openSidebarDrawer();
}

function initMobileDrawer() {
  mobileMenuBtn?.addEventListener("click", toggleSidebarDrawer);
  sidebarCloseBtn?.addEventListener("click", closeSidebarDrawer);
  sidebarOverlay?.addEventListener("click", closeSidebarDrawer);

  let touchStartX = 0;
  let touchStartY = 0;

  sidebar?.addEventListener("touchstart", (e) => {
    if (!sidebar.classList.contains("isOpen")) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  sidebar?.addEventListener("touchend", (e) => {
    if (!sidebar.classList.contains("isOpen")) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;

    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (dx < -56 && Math.abs(dy) < 48) {
      closeSidebarDrawer();
    }
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (!isMobileDrawerMode()) closeSidebarDrawer();
  });
}

document.addEventListener("keydown", (e) => {
  if (todoOverlay?.classList.contains("isOpen") && e.key === "Escape") closeTodoModal();
  if (chartOverlay?.classList.contains("isOpen") && e.key === "Escape") closeChartModal();
  if (wishOverlay?.classList.contains("isOpen") && e.key === "Escape") closeWishModal();
  if (sidebar?.classList.contains("isOpen") && e.key === "Escape") closeSidebarDrawer();
});

if (navDash) navDash.addEventListener("click", () => { setNavActive(navDash); scrollToEl(boxTopA); closeSidebarDrawer(); });
if (navHabits) navHabits.addEventListener("click", () => { setNavActive(navHabits); scrollToEl(tableBox); closeSidebarDrawer(); });
if (navTodo) navTodo.addEventListener("click", () => { setNavActive(navTodo); scrollToEl(todoBox); closeSidebarDrawer(); });
if (navExpenses) navExpenses.addEventListener("click", () => { setNavActive(navExpenses); scrollToEl(bottomBox); closeSidebarDrawer(); });
if (navWishlist) navWishlist.addEventListener("click", () => { setNavActive(navWishlist); scrollToEl(wishWrap || bottomBox); closeSidebarDrawer(); });
if (navAddWishlist) navAddWishlist.addEventListener("click", (e) => { e.stopPropagation(); setNavActive(navWishlist); closeSidebarDrawer(); openWishModal(); });
if (navWishlist) navWishlist.addEventListener("dblclick", () => { setNavActive(navWishlist); closeSidebarDrawer(); openWishModal(); });
if (navAddHabits) navAddHabits.addEventListener("click", (e) => { e.stopPropagation(); setNavActive(navHabits); closeSidebarDrawer(); openHabitModal(); });
if (navAddTodo) navAddTodo.addEventListener("click", (e) => { e.stopPropagation(); setNavActive(navTodo); closeSidebarDrawer(); openTodoModal(getSelectedDateObj()); });
if (navAddExpenses) navAddExpenses.addEventListener("click", (e) => { e.stopPropagation(); setNavActive(navExpenses); closeSidebarDrawer(); openExpModal(); });
if (navTodo) navTodo.addEventListener("dblclick", () => { setNavActive(navTodo); closeSidebarDrawer(); openTodoModal(getSelectedDateObj()); });
if (navHabits) navHabits.addEventListener("dblclick", () => { setNavActive(navHabits); closeSidebarDrawer(); openHabitModal(); });
if (navExpenses) navExpenses.addEventListener("dblclick", (e) => { e.preventDefault(); setNavActive(navExpenses); closeSidebarDrawer(); focusWishlistQuickAdd(); });

initMobileDrawer();

initTheme();

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