const THEME_KEY = "edward_theme_v1";
const baseId = "baseStyles";
const themeIds = ["themeStyles", "themelight", "themepink"];

function applyTheme(themeId) {
  const base = document.getElementById(baseId);
  if (base) {
    base.disabled = false;
    base.media = "all";
  }

  themeIds.forEach(id => {
    const link = document.getElementById(id);
    if (!link) return;
    link.disabled = false;
    link.media = (id === themeId) ? "all" : "not all";
  });
}

function getSavedTheme() {
  const v = localStorage.getItem(THEME_KEY) || "base";
  if (v === "base") return "base";
  if (themeIds.includes(v)) return v;
  return "base";
}

function saveTheme(v) {
  localStorage.setItem(THEME_KEY, v);
}

function cycleTheme() {
  const order = ["base", ...themeIds];
  const cur = getSavedTheme();
  const idx = order.indexOf(cur);
  const next = order[(idx + 1) % order.length];

  saveTheme(next);
  applyTheme(next === "base" ? null : next);
}

function initTheme() {
  const saved = getSavedTheme();
  applyTheme(saved === "base" ? null : saved);

  const themeBtn = $("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", cycleTheme);
  }
}
