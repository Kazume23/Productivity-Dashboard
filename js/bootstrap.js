(function bootstrapEdward() {
  initTheme();
  initAuth();
  initCalendar();
  initHabits();

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