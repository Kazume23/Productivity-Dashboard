async function apiGetState() {
  if (!AUTH_USER) throw new Error("offline_no_server");
  const res = await fetch(API_STATE_URL, { method: "GET", credentials: "same-origin" });
  if (res.status === 401) throw new Error("unauthorized");
  const data = await res.json();
  if (!data || !data.ok) throw new Error("apiGetState_failed");
  return data;
}

async function apiPutState(reason) {
  if (!AUTH_USER) throw new Error("offline_no_server");
  ensureMeta();

  const payload = {
    updatedAtMs: state._meta.updatedAtMs || Date.now(),
    state
  };

  const res = await fetch(API_STATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data || !data.ok) throw new Error("apiPutState_failed");
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
    syncPending = true;
    if (document.hidden) return;

    syncBackoffMs = Math.min(30000, syncBackoffMs * 2);
    syncFlushTimer = setTimeout(() => {
      flushServerSync("retry");
    }, syncBackoffMs);
  }
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

  if (!localObj || serverMs > localMs) {
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
    if (!navigator.sendBeacon) return;

    ensureMeta();
    const payload = JSON.stringify({
      updatedAtMs: state._meta.updatedAtMs || Date.now(),
      state
    });

    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon(API_STATE_URL, blob);
  } catch (e) {}
});
