// The controller: state, routing, data loading and every action. Views are
// pure functions of state in views.js; the API is in api.js.
import { createApi } from "./api.js";
import { render, productList, pickerList } from "./views.js";
import { readable, today, addCadence, STATUS } from "./util.js";

const api = createApi(window.REFILL_CONFIG || {});
const root = document.getElementById("app");

const state = {
  api,
  phase: "loading",
  route: parseRoute(),
  profile: null, stores: [], myStores: [], categories: [], products: [],
  schedules: [], scheduleItems: {}, orders: [], orderItems: {},
  updates: [], spend: [], ledger: [], storeOrders: [],
  basket: {},
  ui: { authMode: "signin", busy: false, error: null, toast: null, basketOpen: false, placed: null,
        modal: null, shopSearch: "", shopCategory: null, storeTab: "orders", editor: null },
};

const isStaff = () => ["retailer", "admin"].includes(state.profile?.role);

// MARK: routing

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [a, b, c] = parts;
  if (!a || a === "home") return { name: "home", section: "home" };
  if (a === "shop") return { name: "shop", section: "shop" };
  if (a === "refills") {
    if (!b) return { name: "refills", section: "refills" };
    if (b === "new") return { name: "refill-new", section: "refills" };
    if (c === "edit") return { name: "refill-edit", section: "refills", id: b };
    return { name: "refill", section: "refills", id: b };
  }
  if (a === "orders") return b ? { name: "order", section: "orders", id: b } : { name: "orders", section: "orders" };
  if (a === "you") return { name: "you", section: "you" };
  if (a === "choose-store") return { name: "choose-store", section: "you" };
  if (a === "join") return { name: "join", section: "home", code: decodeURIComponent(b ?? "") };
  if (a === "store") {
    if (b === "orders" && c) return { name: "store-order", section: "store", id: c };
    if (b === "catalogue" && c) return { name: "product-edit", section: "store", id: c };
    if (b === "updates" && c === "new") return { name: "update-new", section: "store" };
    return { name: "store", section: "store" };
  }
  return { name: "home", section: "home" };
}

function go(hash) { if (location.hash !== hash) location.hash = hash; else onRoute(); }

async function onRoute() {
  state.route = parseRoute();
  state.ui.error = null;
  state.ui.placed = null;
  state.ui.modal = null;
  state.ui.basketOpen = false;
  const r = state.route;
  if (r.name === "join" && r.code) {
    sessionStorage.setItem("refill.pendingJoin", r.code);
    if (state.phase === "signedIn") await completeJoin();
    else if (state.phase === "signedOut") toast("Sign in and the store will be added to your stores.");
  }
  if (r.name === "refill-edit" || r.name === "refill-new") {
    const sc = r.id ? state.schedules.find((x) => x.id === r.id) : null;
    const quantities = {};
    for (const it of state.scheduleItems[r.id] ?? []) quantities[it.product_id] = it.quantity;
    if (r.name === "refill-new" && state.ui.editor?.seed) Object.assign(quantities, state.ui.editor.seed);
    state.ui.editor = { quantities, pickerSearch: "", name: sc?.name, cadence: sc?.cadence, next_run_date: sc?.next_run_date, fulfillment: sc?.fulfillment, reminder_days: sc?.reminder_days };
  } else {
    state.ui.editor = null;
  }
  if (r.name === "store-order" && isStaff() && !state.storeOrders.length) await refreshStoreOrders();
  if ((r.name === "order" || r.name === "store-order") && !state.orderItems[r.id]) {
    paint();
    try { state.orderItems[r.id] = await api.orderItems(r.id); } catch (e) { toast(readable(e)); }
  }
  paint();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", onRoute);

// MARK: rendering

function paint() {
  // Keep what the person is typing across a repaint.
  const active = document.activeElement;
  const focusId = active?.id && root.contains(active) ? active.id : null;
  const sel = focusId && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
  const kept = {};
  root.querySelectorAll("[data-keep]").forEach((el) => { if (el.id) kept[el.id] = el.type === "checkbox" ? el.checked : el.value; });
  root.innerHTML = render(state);
  for (const [id, v] of Object.entries(kept)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = v; else if (el.value !== v && el.dataset.keep !== "once") el.value = v;
  }
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus({ preventScroll: true }); if (sel && "setSelectionRange" in el) try { el.setSelectionRange(sel[0], sel[1]); } catch {} }
  }
  drawQR();
}

let toastTimer;
function toast(text) {
  state.ui.toast = text;
  paint();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { state.ui.toast = null; paint(); }, 3800);
}

async function drawQR() {
  const canvas = document.getElementById("store-qr");
  if (!canvas || canvas.dataset.drawn === canvas.dataset.qr) return;
  try {
    const { default: QRCode } = await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm");
    await QRCode.toCanvas(canvas, canvas.dataset.qr, { width: 180, margin: 1, color: { dark: "#0f5132", light: "#ffffff" } });
    canvas.dataset.drawn = canvas.dataset.qr;
  } catch (e) { console.warn("QR", e); }
}

// MARK: session and data

async function boot() {
  const uid = await api.restoreSession();
  if (uid) await enter(); else { state.phase = "signedOut"; paint(); }
  onRoute();
}

let unsubscribe = null;
async function enter() {
  try {
    const [profile, stores, myStores, categories] = await Promise.all([api.myProfile(), api.stores(), api.myStores(), api.categories()]);
    Object.assign(state, { profile, stores, myStores, categories, phase: "signedIn" });
    paint();
    listen();
    await refreshAll();
    await completeJoin();
  } catch (e) {
    toast(readable(e));
    await signOut();
  }
}

function listen() {
  unsubscribe?.();
  let timer;
  unsubscribe = api.onOrderChanges(() => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const before = Object.fromEntries(state.orders.map((o) => [o.id, o.status]));
      await refreshOrders();
      if (isStaff()) await refreshStoreOrders();
      await refreshProfile();
      // Tell the person what just changed at the counter.
      for (const o of state.orders) {
        if (before[o.id] && before[o.id] !== o.status && o.status !== "pending") toast(`Order ${o.number} is now ${STATUS[o.status].label.toLowerCase()}.`);
      }
    }, 250);
  });
}

async function refreshAll() {
  await Promise.all([refreshProfile(), refreshCatalogue(), refreshSchedules(), refreshOrders(), refreshInsights(), isStaff() ? refreshStoreOrders() : null]);
  paint();
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(readable(e)); } };
const refreshProfile = guard(async () => { state.profile = await api.myProfile(); state.myStores = await api.myStores(); });
const refreshCatalogue = guard(async () => {
  const storeId = state.profile?.favourite_store_id ?? state.profile?.store_id;
  if (!storeId) return;
  const [products, updates] = await Promise.all([api.products(storeId), api.storeUpdates(storeId)]);
  state.products = products; state.updates = updates;
});
const refreshSchedules = guard(async () => {
  const list = await api.mySchedules();
  const items = {};
  await Promise.all(list.map(async (s) => { items[s.id] = await api.scheduleItems(s.id); }));
  state.schedules = list; state.scheduleItems = items;
});
const refreshOrders = guard(async () => { state.orders = await api.myOrders(); });
const refreshInsights = guard(async () => { [state.spend, state.ledger] = await Promise.all([api.spendByCategory(), api.pointsHistory()]); });
const refreshStoreOrders = guard(async () => { if (state.profile?.store_id) state.storeOrders = await api.storeOrders(state.profile.store_id); });
const refreshStores = guard(async () => { state.stores = await api.stores(); });

async function completeJoin() {
  const code = sessionStorage.getItem("refill.pendingJoin");
  if (!code || state.phase !== "signedIn") return;
  sessionStorage.removeItem("refill.pendingJoin");
  try {
    const st = await api.followStore(code, "qr");
    await refreshProfile(); await refreshStores(); await refreshCatalogue();
    state.basket = {};
    toast(`${st.name} is now one of your stores.`);
    go("#/shop");
  } catch (e) { toast(readable(e)); go("#/choose-store"); }
}

async function signOut() {
  unsubscribe?.(); unsubscribe = null;
  try { await api.signOut(); } catch {}
  Object.assign(state, { phase: "signedOut", profile: null, myStores: [], schedules: [], scheduleItems: {}, orders: [], orderItems: {}, updates: [], spend: [], ledger: [], storeOrders: [], basket: {} });
  state.ui.modal = null; state.ui.basketOpen = false;
  paint();
}

// MARK: actions

async function busy(fn) {
  state.ui.busy = true; state.ui.error = null; paint();
  try { await fn(); }
  catch (e) { state.ui.error = readable(e); }
  finally { state.ui.busy = false; paint(); }
}

root.addEventListener("click", async (e) => {
  const link = e.target.closest("a[href^='#/']");
  if (link && !link.dataset.action) return; // hash navigation handles it
  const el = e.target.closest("[data-action]");
  if (!el) return;
  if (el.tagName === "BUTTON" && el.type !== "submit") e.preventDefault();
  const { action, id, qty, status, href, url } = el.dataset;
  const stopInside = e.target.closest("[data-stop]");
  if ((action === "modal-close" || action === "basket-close") && stopInside && el === e.target.closest(".modal-backdrop, .drawer-backdrop") && e.target !== el) return;

  switch (action) {
    case "go": go(href); break;
    case "basket-open": state.ui.basketOpen = true; state.ui.placed = null; paint(); break;
    case "basket-close": if (e.target === el || el.tagName === "BUTTON" || el.tagName === "A") { state.ui.basketOpen = false; state.ui.placed = null; paint(); } break;
    case "basket-add": state.basket[id] = (state.basket[id] ?? 0) + 1; paint(); break;
    case "basket-set": { const n = Number(qty); if (n <= 0) delete state.basket[id]; else state.basket[id] = n; paint(); break; }
    case "shop-category": state.ui.shopCategory = id || null; paint(); break;
    case "add-to-refill": state.ui.modal = { type: "add-to-refill", productId: id, quantity: 1 }; paint(); break;
    case "modal-qty": state.ui.modal.quantity = Math.max(1, Number(qty)); paint(); break;
    case "modal-close": if (e.target === el || el.tagName === "BUTTON") { state.ui.modal = null; paint(); } break;
    case "modal-confirm": { const m = state.ui.modal; state.ui.modal = null; paint(); await m?.onConfirm?.(); break; }
    case "add-to-schedule": {
      const m = state.ui.modal;
      const sc = state.schedules.find((x) => x.id === id);
      await busy(async () => {
        const lines = (state.scheduleItems[sc.id] ?? []).map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
        const hit = lines.find((l) => l.product_id === m.productId);
        if (hit) hit.quantity += m.quantity; else lines.push({ product_id: m.productId, quantity: m.quantity });
        await api.updateSchedule(sc, lines);
        await refreshSchedules();
        state.ui.modal = null;
        toast(`Added to ${sc.name}.`);
      });
      break;
    }
    case "new-refill-with": {
      const m = state.ui.modal; state.ui.modal = null;
      state.ui.editor = { seed: { [m.productId]: m.quantity } };
      go("#/refills/new"); break;
    }
    case "editor-set": { const n = Number(qty); if (n <= 0) delete state.ui.editor.quantities[id]; else state.ui.editor.quantities[id] = n; paint(); break; }
    case "run-now": await busy(async () => {
      const sc = state.schedules.find((x) => x.id === id);
      const oid = await api.runScheduleNow(id);
      await Promise.all([refreshSchedules(), refreshOrders(), refreshInsights()]);
      const o = state.orders.find((x) => x.id === oid);
      state.ui.placed = o?.number ?? null;
      toast(`Order ${o?.number ?? ""} placed for today from ${sc?.name ?? "your refill"}.`);
    }); break;
    case "toggle-pause": await busy(async () => {
      const sc = { ...state.schedules.find((x) => x.id === id) };
      sc.status = sc.status === "paused" ? "active" : "paused";
      await api.updateSchedule(sc, (state.scheduleItems[id] ?? []).map((i) => ({ product_id: i.product_id, quantity: i.quantity })));
      await refreshSchedules();
    }); break;
    case "delete-schedule": confirm("Delete this refill?", "Orders already placed are kept.", "Delete", true, async () => {
      await busy(async () => { await api.deleteSchedule(id); await refreshSchedules(); go("#/refills"); });
    }); break;
    case "cancel-order": {
      const o = state.orders.find((x) => x.id === id);
      confirm(`Cancel order ${o?.number}?`, "The store will be told. This cannot be undone.", "Cancel the order", true, async () => {
        await busy(async () => { await api.cancelOrder(id); await Promise.all([refreshOrders(), refreshInsights()]); });
      }); break;
    }
    case "set-status": await busy(async () => { await api.setOrderStatus(id, status); await refreshStoreOrders(); }); break;
    case "choose-store": await busy(async () => {
      await api.updateProfile({ favourite_store_id: id });
      await refreshProfile(); await refreshCatalogue(); await refreshSchedules();
      state.basket = {};
      const st = state.stores.find((x) => x.id === id);
      toast(`Shopping at ${st?.name ?? "your store"}.`);
      if (state.route.name === "choose-store") go("#/shop");
    }); break;
    case "unfollow-store": await busy(async () => { await api.unfollowStore(id); await refreshProfile(); }); break;
    case "sign-out": await signOut(); go("#/home"); break;
    case "edit-name": state.ui.modal = { type: "edit-name" }; paint(); break;
    case "remove-product": confirm("Remove this item from the catalogue?", "Customers will no longer see it. Refills that include it skip it.", "Remove", true, async () => {
      await busy(async () => {
        const p = state.products.find((x) => x.id === id);
        await api.saveProduct({ ...p, is_active: false });
        await refreshCatalogue(); state.ui.storeTab = "catalogue"; go("#/store");
      });
    }); break;
    case "store-tab-catalogue": state.ui.storeTab = "catalogue"; break;
    case "store-tab-updates": state.ui.storeTab = "updates"; break;
    case "copy-join": try { await navigator.clipboard.writeText(url); toast("Link copied."); } catch { toast(url); } break;
    case "print-qr": printQR(); break;
  }
});

function confirm(title, message, confirmLabel, danger, onConfirm) {
  state.ui.modal = { type: "confirm", title, message, confirmLabel, danger, onConfirm };
  paint();
}

root.addEventListener("change", async (e) => {
  const el = e.target.closest("[data-change]");
  if (!el) return;
  switch (el.dataset.change) {
    case "auth-mode": state.ui.authMode = el.value; state.ui.error = null; paint(); break;
    case "store-tab": state.ui.storeTab = el.value; paint(); break;
    case "upload-logo": {
      const file = el.files?.[0]; if (!file) return;
      await busy(async () => {
        const storeId = state.profile.store_id;
        const url = await api.uploadLogo(storeId, file);
        await api.updateStore(storeId, { logo_url: url });
        await refreshStores();
        toast("Logo updated.");
      });
      break;
    }
  }
});

root.addEventListener("input", (e) => {
  const el = e.target.closest("[data-input]");
  if (!el) return;
  if (el.dataset.input === "shop-search") {
    state.ui.shopSearch = el.value;
    const list = document.getElementById("product-list");
    if (list) list.innerHTML = productList(state);
  } else if (el.dataset.input === "picker-search") {
    state.ui.editor.pickerSearch = el.value;
    const list = document.getElementById("picker-list");
    if (list) list.innerHTML = pickerList(state);
  }
});

root.addEventListener("submit", async (e) => {
  const form = e.target.closest("form[data-form]");
  if (!form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  switch (form.dataset.form) {
    case "auth": await busy(async () => {
      const email = String(data.email ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("That email does not look right.");
      if (String(data.password ?? "").length < 6) throw new Error("Use a password of at least 6 characters.");
      if (state.ui.authMode === "signup") {
        if (String(data.full_name ?? "").trim().length < 2) throw new Error("Tell us your name.");
        await api.signUp(String(data.full_name).trim(), email, data.password);
      } else {
        await api.signIn(email, data.password);
      }
      await enter();
    }); break;
    case "checkout": await busy(async () => {
      const lines = Object.entries(state.basket).filter(([, q]) => q > 0).map(([product_id, quantity]) => ({ product_id, quantity }));
      const oid = await api.placeOrder({ store_id: state.profile.favourite_store_id, lines, fulfillment: data.fulfillment ?? "pickup",
        scheduled_for: data.scheduled_for || today(), note: String(data.note ?? "").trim() || null });
      state.basket = {};
      await Promise.all([refreshOrders(), refreshInsights()]);
      state.ui.placed = state.orders.find((o) => o.id === oid)?.number ?? "";
    }); break;
    case "schedule": await busy(async () => {
      const ed = state.ui.editor;
      const lines = Object.entries(ed.quantities).filter(([, q]) => q > 0).map(([product_id, quantity]) => ({ product_id, quantity }));
      if (!lines.length) throw new Error("Add at least one item.");
      const base = { name: String(data.name).trim() || "Regular staples", cadence: data.cadence, next_run_date: data.next_run_date || addCadence(today(), "weekly"),
        fulfillment: data.fulfillment, reminder_days: Math.min(14, Math.max(0, Number(data.reminder_days) || 0)) };
      if (form.dataset.id) {
        const sc = state.schedules.find((x) => x.id === form.dataset.id);
        await api.updateSchedule({ ...sc, ...base }, lines);
        await refreshSchedules(); go(`#/refills/${sc.id}`);
      } else {
        const id = await api.createSchedule({ ...base, store_id: state.profile.favourite_store_id, lines });
        await refreshSchedules(); go(`#/refills/${id}`);
        toast("Refill started. The store will have it ready on the day.");
      }
    }); break;
    case "product": await busy(async () => {
      const cents = Math.round(Number(data.price) * 100);
      if (!Number.isFinite(cents) || cents < 0) throw new Error("Enter a price.");
      const existing = state.products.find((x) => x.id === form.dataset.id);
      await api.saveProduct({ id: existing?.id ?? crypto.randomUUID(), store_id: state.profile.store_id, category_id: data.category_id || null,
        name: String(data.name).trim(), brand: String(data.brand ?? "").trim() || null, size: String(data.size ?? "").trim() || null,
        price_cents: cents, in_stock: form.querySelector("[name=in_stock]").checked, is_active: true });
      await refreshCatalogue(); state.ui.storeTab = "catalogue"; go("#/store");
    }); break;
    case "update": await busy(async () => {
      await api.postStoreUpdate({ store_id: state.profile.store_id, kind: data.kind, title: String(data.title).trim(), body: String(data.body ?? "").trim() || null, product_id: data.product_id || null });
      await refreshCatalogue(); state.ui.storeTab = "updates"; go("#/store");
    }); break;
    case "name": await busy(async () => {
      await api.updateProfile({ full_name: String(data.full_name).trim(), phone: String(data.phone ?? "").trim() || null });
      await refreshProfile(); state.ui.modal = null;
    }); break;
    case "join-code": await busy(async () => {
      const code = String(data.code ?? "").trim();
      if (!code) throw new Error("Type the code printed under the QR.");
      const st = await api.followStore(code, "code");
      await refreshProfile(); await refreshCatalogue(); await refreshSchedules();
      state.basket = {};
      toast(`${st.name} is now one of your stores.`);
      go("#/shop");
    }); break;
    case "store": await busy(async () => {
      await api.updateStore(state.profile.store_id, { name: String(data.name).trim(), tagline: String(data.tagline ?? "").trim() || null,
        address: String(data.address ?? "").trim() || null, phone: String(data.phone ?? "").trim() || null,
        city: String(data.city ?? "").trim() || null, state: String(data.state ?? "").trim() || null });
      await refreshStores(); toast("Saved.");
    }); break;
  }
});

function printQR() {
  const canvas = document.getElementById("store-qr");
  const st = state.stores.find((x) => x.id === state.profile?.store_id);
  if (!canvas || !st) return;
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return;
  w.document.write(`<!doctype html><title>Refill Me · ${st.name}</title><body style="font-family:-apple-system,Helvetica,Arial,sans-serif;text-align:center;padding:40px;color:#15201a">
    <div style="font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#1e8e4e;font-weight:700">Refill Me</div>
    <h1 style="margin:8px 0 4px;font-size:28px">${st.name}</h1>
    <p style="margin:0 0 24px;color:#5f6b64">Scan to add this store to your Refill Me and set up your regular groceries.</p>
    <img src="${canvas.toDataURL("image/png")}" style="width:280px;height:280px">
    <p style="margin:18px 0 0;font-size:14px;color:#5f6b64">Or type the code</p>
    <div style="font-family:ui-monospace,Menlo,monospace;font-size:34px;letter-spacing:.2em;font-weight:700">${st.join_code ?? ""}</div>
    <p style="margin-top:24px;font-size:13px;color:#5f6b64">refill4me.com</p>
    <script>window.onload=()=>{window.print();}</script></body>`);
  w.document.close();
}

boot();
