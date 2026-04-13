/** Shortcut for getElementById */
const $ = (id) => document.getElementById(id);

const customSelectMap = new WeakMap();
let customSelectGlobalBound = false;

/** Show an overlay/modal element */
function showOverlay(element) {
  if (!element) return;
  element.classList.add("isOpen");
  element.setAttribute("aria-hidden", "false");
}

/** Hide an overlay/modal element */
function hideOverlay(element) {
  if (!element) return;
  element.classList.remove("isOpen");
  element.setAttribute("aria-hidden", "true");
}

/** Toggle a class on an element */
function toggleClass(element, className, condition) {
  if (!element) return;
  element.classList.toggle(className, condition);
}

/** Smooth scroll to an element's top */
function scrollToEl(element) {
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeCustomSelect(instance) {
  if (!instance) return;
  instance.wrap.classList.remove("isOpen");
  instance.trigger.setAttribute("aria-expanded", "false");
}

function closeAllCustomSelects(exceptWrap = null) {
  document.querySelectorAll(".customSelect.isOpen").forEach((wrap) => {
    if (exceptWrap && wrap === exceptWrap) return;
    wrap.classList.remove("isOpen");

    const trigger = wrap.querySelector(".customSelectTrigger");
    if (trigger) trigger.setAttribute("aria-expanded", "false");
  });
}

function updateCustomSelectUI(instance) {
  if (!instance) return;

  const selectEl = instance.select;
  const selectedOpt = selectEl.options[selectEl.selectedIndex] || null;

  instance.trigger.textContent = selectedOpt ? selectedOpt.textContent : "Wybierz";
  instance.trigger.disabled = !!selectEl.disabled;
  instance.trigger.setAttribute("aria-expanded", instance.wrap.classList.contains("isOpen") ? "true" : "false");

  for (const btn of instance.optionButtons) {
    const isSelected = btn.dataset.value === selectEl.value;
    btn.classList.toggle("isSelected", isSelected);
    btn.setAttribute("aria-selected", isSelected ? "true" : "false");
  }
}

function focusCustomOption(instance, mode = "selected") {
  if (!instance) return;

  const enabled = instance.optionButtons.filter((btn) => !btn.disabled);
  if (!enabled.length) return;

  if (mode === "first") {
    enabled[0].focus();
    return;
  }

  if (mode === "last") {
    enabled[enabled.length - 1].focus();
    return;
  }

  const selected = enabled.find((btn) => btn.dataset.value === instance.select.value);
  (selected || enabled[0]).focus();
}

function moveCustomOptionFocus(instance, step) {
  const enabled = instance.optionButtons.filter((btn) => !btn.disabled);
  if (!enabled.length) return;

  const active = document.activeElement;
  const currentIdx = enabled.indexOf(active);
  const baseIdx = currentIdx === -1 ? 0 : currentIdx;
  const nextIdx = (baseIdx + step + enabled.length) % enabled.length;

  enabled[nextIdx].focus();
}

function openCustomSelect(instance, focusMode = "selected") {
  if (!instance || instance.trigger.disabled) return;
  closeAllCustomSelects(instance.wrap);

  instance.wrap.classList.add("isOpen");
  instance.trigger.setAttribute("aria-expanded", "true");

  requestAnimationFrame(() => {
    focusCustomOption(instance, focusMode);
  });
}

function setCustomSelectValue(instance, value, emitChange = true) {
  if (!instance) return;

  const selectEl = instance.select;
  if (!Array.from(selectEl.options).some((opt) => opt.value === value)) return;
  if (selectEl.value === value) {
    updateCustomSelectUI(instance);
    return;
  }

  selectEl.value = value;
  updateCustomSelectUI(instance);

  if (emitChange) {
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function buildCustomSelectOptions(instance) {
  if (!instance) return;

  instance.menu.innerHTML = "";
  instance.optionButtons = [];

  for (const opt of instance.select.options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "customSelectOption";
    btn.dataset.value = opt.value;
    btn.textContent = opt.textContent;
    btn.setAttribute("role", "option");
    btn.disabled = !!opt.disabled;

    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      setCustomSelectValue(instance, opt.value, true);
      closeCustomSelect(instance);
      instance.trigger.focus();
    });

    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveCustomOptionFocus(instance, 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveCustomOptionFocus(instance, -1);
      } else if (e.key === "Home") {
        e.preventDefault();
        focusCustomOption(instance, "first");
      } else if (e.key === "End") {
        e.preventDefault();
        focusCustomOption(instance, "last");
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeCustomSelect(instance);
        instance.trigger.focus();
      }
    });

    instance.menu.appendChild(btn);
    instance.optionButtons.push(btn);
  }

  updateCustomSelectUI(instance);
}

function ensureCustomSelect(selectEl) {
  if (!selectEl || customSelectMap.has(selectEl)) return;

  const wrap = document.createElement("div");
  wrap.className = "customSelect";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "customSelectTrigger modalInput";

  for (const cls of selectEl.classList) {
    if (cls === "modalInput") continue;
    trigger.classList.add(cls);
  }

  const menu = document.createElement("div");
  menu.className = "customSelectMenu";
  menu.setAttribute("role", "listbox");

  selectEl.parentNode?.insertBefore(wrap, selectEl);
  wrap.appendChild(selectEl);
  wrap.appendChild(trigger);
  wrap.appendChild(menu);

  selectEl.classList.add("customSelectNative");

  const instance = {
    select: selectEl,
    wrap,
    trigger,
    menu,
    optionButtons: []
  };

  customSelectMap.set(selectEl, instance);

  trigger.addEventListener("click", () => {
    if (wrap.classList.contains("isOpen")) {
      closeCustomSelect(instance);
      return;
    }
    openCustomSelect(instance, "selected");
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openCustomSelect(instance, "selected");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openCustomSelect(instance, "selected");
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (wrap.classList.contains("isOpen")) closeCustomSelect(instance);
      else openCustomSelect(instance, "selected");
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeCustomSelect(instance);
    }
  });

  selectEl.addEventListener("change", () => updateCustomSelectUI(instance));

  buildCustomSelectOptions(instance);
  updateCustomSelectUI(instance);

  if (!customSelectGlobalBound) {
    customSelectGlobalBound = true;

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!(target instanceof Element)) {
        closeAllCustomSelects();
        return;
      }
      if (target.closest(".customSelect")) return;
      closeAllCustomSelects();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllCustomSelects();
    });

    window.addEventListener("resize", () => closeAllCustomSelects());
  }
}

function initCustomSelects(root = document) {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;
  const selects = scope.querySelectorAll("select.modalInput");
  selects.forEach((selectEl) => ensureCustomSelect(selectEl));
  syncAllCustomSelects(scope);
}

function syncCustomSelect(selectEl) {
  const instance = customSelectMap.get(selectEl);
  if (!instance) return;
  updateCustomSelectUI(instance);
}

function syncAllCustomSelects(root = document) {
  const scope = root && typeof root.querySelectorAll === "function" ? root : document;
  scope.querySelectorAll("select.customSelectNative").forEach((selectEl) => syncCustomSelect(selectEl));
}
