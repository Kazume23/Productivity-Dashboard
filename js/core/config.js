const API_STATE_URL = document.body?.dataset.apiStateUrl || "./api/state.php";
const authAttr = document.body?.dataset.authUser || null;
const AUTH_USER = authAttr && authAttr.trim() ? authAttr.trim() : null;
