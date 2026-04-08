/** Shortcut for getElementById */
const $ = (id) => document.getElementById(id);

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
