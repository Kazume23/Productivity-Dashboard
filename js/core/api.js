async function apiGetState() {
  if (!AUTH_USER) throw new Error("offline_no_server");

  const res = await fetch(API_STATE_URL, {
    method: "GET",
    credentials: "same-origin"
  });

  if (res.status === 401) throw new Error("unauthorized");

  const data = await res.json();

  if (!res.ok || !data || !data.ok) {
    const code = data?.error || `http_${res.status}`;
    throw new Error(`apiGetState_failed:${code}`);
  }

  return data;
}

async function apiPutState(reason) {
  if (!AUTH_USER) throw new Error("offline_no_server");
  if (!CSRF_TOKEN) throw new Error("missing_csrf");

  ensureMeta();

  const payload = {
    updatedAtMs: state._meta.updatedAtMs || Date.now(),
    state
  };

  const res = await fetch(API_STATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": CSRF_TOKEN
    },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok || !data || !data.ok) {
    const code = data?.error || `http_${res.status}`;
    throw new Error(`apiPutState_failed:${code}`);
  }

  return { ok: true, data };
}

let syncTimer = null;
let syncFlushTimer = null;
let syncPending = false;
let syncBackoffMs = 2000;

function queueServerSync(reason) {
  if (!AUTH_USER) return;

  syncPending = true;

  if (syncTimer) clearTimeout(syncTimer);

  syncTimer = setTimeout(() => {
    flushServerSync(reason);
  }, syncBackoffMs);
}

async function flushServerSync(reason) {
  if (!AUTH_USER) return;
  if (!syncPending) return;

  if (syncFlushTimer) {
    clearTimeout(syncFlushTimer);
    syncFlushTimer = null;
  }

  syncPending = false;

  try {
    await apiPutState(reason);
    syncBackoffMs = 2000;
  } catch (e) {
    console.warn("sync_failed", reason, e);
    syncPending = true;

    if (document.hidden) return;

    syncBackoffMs = Math.min(30000, syncBackoffMs * 2);

    syncFlushTimer = setTimeout(() => {
      flushServerSync("retry");
    }, syncBackoffMs);
  }
}

function isSeededDefaultStateCandidate(obj) {
  if (!obj || typeof obj !== "object") return false;

  const habits = Array.isArray(obj.habits) ? obj.habits : [];
  const habitNames = habits.map(h => String(h?.name ?? "").trim());

  const hasDefaultHabits =
    habitNames.length === 3 &&
    habitNames[0] === "Wstać o 6:00" &&
    habitNames[1] === "Trening" &&
    habitNames[2] === "Czytanie";

  const hasNoEntries =
    !obj.entries ||
    Object.keys(obj.entries).length === 0;

  const hasNoTodos =
    !Array.isArray(obj.todos) ||
    obj.todos.length === 0;

  const hasNoExpenses =
    !Array.isArray(obj.expenses) ||
    obj.expenses.length === 0;

  const hasNoWishlist =
    !Array.isArray(obj.wishlist) ||
    obj.wishlist.length === 0;

  return (
    hasDefaultHabits &&
    hasNoEntries &&
    hasNoTodos &&
    hasNoExpenses &&
    hasNoWishlist
  );
}

async function bootstrapFromServer() {
  if (!AUTH_USER) return;

  const server = await apiGetState();
  const serverState = server.state;
  const serverMs = server.updatedAtMs || 0;

  const localObj = readLocalState();
  const localMs = localObj?._meta?.updatedAtMs || 0;

  if (!serverState) {
    if (localObj) {
      state = sanitizeState(localObj);
      ensureMeta();

      if (!state._meta.updatedAtMs) {
        state._meta.updatedAtMs = Date.now();
      }

      persistLocal();
      await apiPutState("bootstrap_no_server_state");
    }

    return;
  }

  const shouldPreferServer =
    !localObj ||
    serverMs > localMs ||
    isSeededDefaultStateCandidate(localObj);

  if (shouldPreferServer) {
    state = sanitizeState(serverState);
    ensureMeta();
    state._meta.updatedAtMs = serverMs || Date.now();
    persistLocal();
    return;
  }

  state = sanitizeState(localObj);
  ensureMeta();
  persistLocal();
  await apiPutState("bootstrap_local_newer");
}

window.addEventListener("online", () => flushServerSync("online"));

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    flushServerSync("hidden");
  }
});

window.addEventListener("beforeunload", () => {
  try {
    if (!syncPending) return;

    ensureMeta();

    const payload = {
      updatedAtMs: state._meta.updatedAtMs || Date.now(),
      state
    };

    fetch(API_STATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": CSRF_TOKEN
      },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify(payload)
    });
  } catch (e) {}
});