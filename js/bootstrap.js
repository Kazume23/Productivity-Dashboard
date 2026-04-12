(function bootstrapEdward() {
  initTheme();
  initAuth();
  initCalendar();
  initHabits();

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

  Promise.resolve()
    .then(() => bootstrapFromServer())
    .catch((error) => {
      console.error("bootstrapFromServer failed:", error);
    })
    .finally(() => {
      renderAll();
      pomoRestoreRunning();
    });
})();