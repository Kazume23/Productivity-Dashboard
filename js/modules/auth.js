function initAuth() {
  const registerOverlay = $("registerOverlay");
  const openRegisterBtn = $("openRegisterBtn");
  const closeRegisterBtn = $("closeRegisterBtn");
  const cancelRegister = $("cancelRegister");

  if (registerOverlay) {
    const openRegister = () => {
      showOverlay(registerOverlay);
      const u = $("regUsername");
      if (u) setTimeout(() => u.focus(), 0);
    };

    const closeRegister = () => {
      hideOverlay(registerOverlay);
    };

    if (openRegisterBtn) openRegisterBtn.addEventListener("click", openRegister);
    if (closeRegisterBtn) closeRegisterBtn.addEventListener("click", closeRegister);
    if (cancelRegister) cancelRegister.addEventListener("click", closeRegister);

    registerOverlay.addEventListener("click", (e) => {
      if (e.target === registerOverlay) closeRegister();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && registerOverlay.getAttribute("aria-hidden") === "false") {
        closeRegister();
      }
    });

    if (registerOverlay.getAttribute("aria-hidden") === "false") {
      showOverlay(registerOverlay);
    }
  }

  const loginOverlay = $("loginOverlay");
  const openLoginBtn = $("openLoginBtn");
  const closeLoginBtn = $("loginClose");
  const cancelLogin = $("loginCancel");

  if (loginOverlay) {
    const openLogin = () => {
      showOverlay(loginOverlay);
      const u = $("loginUser");
      if (u) setTimeout(() => u.focus(), 0);
    };

    const closeLogin = () => {
      hideOverlay(loginOverlay);
    };

    if (openLoginBtn) openLoginBtn.addEventListener("click", openLogin);
    if (closeLoginBtn) closeLoginBtn.addEventListener("click", closeLogin);
    if (cancelLogin) cancelLogin.addEventListener("click", closeLogin);

    loginOverlay.addEventListener("click", (e) => {
      if (e.target === loginOverlay) closeLogin();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeLogin();
    });

    if (loginOverlay.getAttribute("aria-hidden") === "false") {
      showOverlay(loginOverlay);
    }
  }
}
