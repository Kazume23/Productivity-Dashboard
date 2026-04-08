let authInitialized = false;

function initAuth() {
  if (authInitialized) return;
  authInitialized = true;

  const registerOverlay = $("registerOverlay");
  const openRegisterBtn = $("openRegisterBtn");
  const closeRegisterBtn = $("closeRegisterBtn");
  const cancelRegister = $("cancelRegister");

  const loginOverlay = $("loginOverlay");
  const openLoginBtn = $("openLoginBtn");
  const closeLoginBtn = $("loginClose");
  const cancelLogin = $("loginCancel");

  const isOpen = (overlay) =>
    !!overlay && overlay.getAttribute("aria-hidden") === "false";

  const openRegister = () => {
    if (!registerOverlay) return;
    showOverlay(registerOverlay);
    const u = $("regUsername");
    if (u) setTimeout(() => u.focus(), 0);
  };

  const closeRegister = () => {
    if (!registerOverlay) return;
    hideOverlay(registerOverlay);
  };

  const openLogin = () => {
    if (!loginOverlay) return;
    showOverlay(loginOverlay);
    const u = $("loginUser");
    if (u) setTimeout(() => u.focus(), 0);
  };

  const closeLogin = () => {
    if (!loginOverlay) return;
    hideOverlay(loginOverlay);
  };

  if (registerOverlay) {
    if (openRegisterBtn) openRegisterBtn.addEventListener("click", openRegister);
    if (closeRegisterBtn) closeRegisterBtn.addEventListener("click", closeRegister);
    if (cancelRegister) cancelRegister.addEventListener("click", closeRegister);

    registerOverlay.addEventListener("click", (e) => {
      if (e.target === registerOverlay) closeRegister();
    });

    if (isOpen(registerOverlay)) {
      showOverlay(registerOverlay);
    }
  }

  if (loginOverlay) {
    if (openLoginBtn) openLoginBtn.addEventListener("click", openLogin);
    if (closeLoginBtn) closeLoginBtn.addEventListener("click", closeLogin);
    if (cancelLogin) cancelLogin.addEventListener("click", closeLogin);

    loginOverlay.addEventListener("click", (e) => {
      if (e.target === loginOverlay) closeLogin();
    });

    if (isOpen(loginOverlay)) {
      showOverlay(loginOverlay);
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    if (isOpen(registerOverlay)) {
      closeRegister();
      return;
    }

    if (isOpen(loginOverlay)) {
      closeLogin();
    }
  });
}