const API_TIMEOUT_MS = 7000;

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("timeout");
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function apiGetState() {
  if (!AUTH_USER) throw new Error("offline_no_server");

  const res = await fetchWithTimeout(API_STATE_URL, {
    method: "GET",
    credentials: "same-origin"
  });

  if (res.status === 401) throw new Error("unauthorized");

  let data = null;
  try {
    data = await res.json();
  } catch (e) {}

  if (!res.ok || !data || !data.ok) {
    const code = data?.error || `http_${res.status}`;
    throw new Error(`apiGetState_failed:${code}`);
  }

  return data;
}

function applyServerConflictState(data) {
  const serverState = data?.state;
  if (!serverState || typeof serverState !== "object") return false;

  state = sanitizeState(serverState);
  ensureMeta();

  const updatedAtMs = Number(data?.updatedAtMs) || Date.now();
  const version = Number(data?.version);

  state._meta.updatedAtMs = updatedAtMs;
  state._meta.version = Number.isFinite(version) && version >= 0 ? version : 0;

  persistLocal();

  if (typeof renderAll === "function") {
    renderAll();
  }

  return true;
}

async function apiPutState(reason) {
  if (!AUTH_USER) throw new Error("offline_no_server");
  if (!CSRF_TOKEN) throw new Error("missing_csrf");

  ensureMeta();

  const payload = {
    updatedAtMs: state._meta.updatedAtMs || Date.now(),
    version: state._meta.version || 0,
    state
  };

  const res = await fetchWithTimeout(API_STATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-TOKEN": CSRF_TOKEN
    },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {}

  if (!res.ok || !data || !data.ok) {
    const code = data?.error || `http_${res.status}`;

    if (code === "conflict") {
      applyServerConflictState(data);
    }

    throw new Error(`apiPutState_failed:${code}`);
  }

  const serverUpdatedAtMs = Number(data.updatedAtMs);
  const serverVersion = Number(data.version);

  if (Number.isFinite(serverUpdatedAtMs) && serverUpdatedAtMs > 0) {
    state._meta.updatedAtMs = serverUpdatedAtMs;
  }

  if (Number.isFinite(serverVersion) && serverVersion >= 0) {
    state._meta.version = serverVersion;
  }

  persistLocal();

  return { ok: true, data };
}

let syncTimer = null;
let syncFlushTimer = null;
let syncPending = false;
let syncBackoffMs = 2000;

function emitSyncStatus(status, detail = {}) {
  try {
    document.dispatchEvent(new CustomEvent("edward:sync", {
      detail: { status, ...detail }
    }));
  } catch (e) {}
}

function queueServerSync(reason) {
  if (!AUTH_USER) return;

  syncPending = true;
  emitSyncStatus("queued", { reason, backoffMs: syncBackoffMs });

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
  emitSyncStatus("flushing", { reason });

  try {
    await apiPutState(reason);
    syncBackoffMs = 2000;
    emitSyncStatus("saved", { reason });
  } catch (e) {
    const message = String(e?.message || "");
    if (message.includes("apiPutState_failed:conflict")) {
      syncPending = false;
      syncBackoffMs = 2000;
      emitSyncStatus("conflict", { reason, message });
      return;
    }

    console.warn("sync_failed", reason, e);
    emitSyncStatus("error", { reason, message });
    syncPending = true;

    if (document.hidden) {
      emitSyncStatus("queued", { reason, hidden: true });
      return;
    }

    syncBackoffMs = Math.min(30000, syncBackoffMs * 2);
    emitSyncStatus("retrying", { reason, backoffMs: syncBackoffMs, message });

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
  const serverVersion = Number(server.version);
  const normalizedServerVersion = Number.isFinite(serverVersion) && serverVersion >= 0
    ? serverVersion
    : 0;

  const localObj = readLocalState();
  const localMs = localObj?._meta?.updatedAtMs || 0;
  const localVersion = Number(localObj?._meta?.version);
  const normalizedLocalVersion = Number.isFinite(localVersion) && localVersion >= 0
    ? localVersion
    : 0;

  if (!serverState) {
    if (localObj) {
      state = sanitizeState(localObj);
      ensureMeta();
      state._meta.version = normalizedServerVersion;

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
    normalizedServerVersion > normalizedLocalVersion ||
    (normalizedServerVersion === normalizedLocalVersion && serverMs > localMs) ||
    isSeededDefaultStateCandidate(localObj);

  if (shouldPreferServer) {
    state = sanitizeState(serverState);
    ensureMeta();
    state._meta.updatedAtMs = serverMs || Date.now();
    state._meta.version = normalizedServerVersion;
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
      version: state._meta.version || 0,
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