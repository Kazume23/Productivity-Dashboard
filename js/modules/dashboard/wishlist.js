function ensureWishlist() {
  if (!state.wishlist) state.wishlist = [];
}

function openWishModal() {
  if (!wishOverlay) return;
  ensureWishlist();
  wishModalName.value = "";
  wishModalPrice.value = "";
  showOverlay(wishOverlay);
  setTimeout(() => wishModalName.focus(), 0);
}

function closeWishModal() {
  hideOverlay(wishOverlay);
}

function addWishFromModal() {
  ensureWishlist();

  const name = String(wishModalName.value || "").trim();
  const priceRaw = String(wishModalPrice.value || "").trim();
  if (!name) return;

  let price = null;
  if (priceRaw !== "") {
    const n = Number(String(priceRaw).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    price = n;
  }

  state.wishlist.push({
    id: crypto.randomUUID(),
    name,
    price,
    createdAt: Date.now()
  });

  saveState();
  renderWishlist();
  closeWishModal();
}

function addWish() {
  ensureWishlist();

  const name = String(wishName.value || "").trim();
  const priceRaw = String(wishPrice.value || "").trim();
  if (!name) return;

  let price = null;
  if (priceRaw !== "") {
    const n = Number(String(priceRaw).replace(",", "."));
    if (!Number.isFinite(n) || n < 0) return;
    price = n;
  }

  state.wishlist.push({
    id: crypto.randomUUID(),
    name,
    price,
    createdAt: Date.now()
  });

  wishName.value = "";
  wishPrice.value = "";
  saveState();
  renderWishlist();
}

function deleteWish(id) {
  ensureWishlist();
  state.wishlist = state.wishlist.filter(x => x.id !== id);
  saveState();
  renderWishlist();
}

function renderWishlist() {
  ensureWishlist();
  if (wishList) wishList.innerHTML = "";

  const sortMode = state.wishSortMode || "date-desc";
  if (wishSort) {
    wishSort.value = sortMode;
    syncCustomSelect(wishSort);
  }

  let items = [...state.wishlist];
  if (sortMode === "date-desc") {
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else if (sortMode === "date-asc") {
    items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } else if (sortMode === "price-asc") {
    items.sort((a, b) => {
      const aPrice = a.price === null || a.price === undefined ? Infinity : Number(a.price);
      const bPrice = b.price === null || b.price === undefined ? Infinity : Number(b.price);
      if (aPrice !== bPrice) return aPrice - bPrice;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  } else if (sortMode === "price-desc") {
    items.sort((a, b) => {
      const aPrice = a.price === null || a.price === undefined ? -1 : Number(a.price);
      const bPrice = b.price === null || b.price === undefined ? -1 : Number(b.price);
      if (aPrice !== bPrice) return bPrice - aPrice;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  } else if (sortMode === "name-asc") {
    items.sort((a, b) => {
      const aName = String(a.name || "").toLowerCase();
      const bName = String(b.name || "").toLowerCase();
      if (aName !== bName) return aName.localeCompare(bName);
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  } else if (sortMode === "name-desc") {
    items.sort((a, b) => {
      const aName = String(a.name || "").toLowerCase();
      const bName = String(b.name || "").toLowerCase();
      if (aName !== bName) return bName.localeCompare(aName);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "todoEmpty";
    empty.textContent = "Brak pozycji na liście życzeń.";
    wishList.appendChild(empty);
    if (typeof renderOverviewPanels === "function") renderOverviewPanels();
    return;
  }

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "wishItem";

    const left = document.createElement("div");
    left.className = "wishLeft";

    const nm = document.createElement("div");
    nm.className = "wishName";
    nm.textContent = it.name;

    const pr = document.createElement("div");
    pr.className = "wishPrice";
    pr.textContent = it.price === null ? "Cena: brak" : ("Cena: " + moneyPL(it.price));

    left.appendChild(nm);
    left.appendChild(pr);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "wishDel";
    del.textContent = "×";
    del.title = "Usuń";
    del.addEventListener("click", () => deleteWish(it.id));

    row.appendChild(left);
    row.appendChild(del);
    wishList.appendChild(row);
  }

  if (typeof renderOverviewPanels === "function") renderOverviewPanels();
}

function initWishlist() {
  if (wishAdd) wishAdd.addEventListener("click", addWish);
  if (wishPrice) wishPrice.addEventListener("keydown", (e) => { if (e.key === "Enter") addWish(); });
  if (wishName) wishName.addEventListener("keydown", (e) => { if (e.key === "Enter") addWish(); });
  if (wishSort) {
    wishSort.addEventListener("change", () => {
      state.wishSortMode = wishSort.value;
      saveState();
      renderWishlist();
    });
  }

  if (wishSaveBtn) wishSaveBtn.addEventListener("click", addWishFromModal);
  if (wishCloseBtn) wishCloseBtn.addEventListener("click", closeWishModal);
  if (wishCancelBtn) wishCancelBtn.addEventListener("click", closeWishModal);
  if (wishOverlay) {
    wishOverlay.addEventListener("click", (e) => {
      if (e.target === wishOverlay) closeWishModal();
    });
  }

  if (wishModalPrice) wishModalPrice.addEventListener("keydown", (e) => { if (e.key === "Enter") addWishFromModal(); });
  if (wishModalName) wishModalName.addEventListener("keydown", (e) => { if (e.key === "Enter") addWishFromModal(); });
}
