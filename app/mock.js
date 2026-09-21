// An in-browser twin of the backend with the pilot catalogue and the same
// rules the database enforces: prices come from the catalogue, points land on
// fulfilment, cancel only while pending. Used when config.js has no keys and
// for the public demo (?demo). Nothing leaves the browser.
import { pilotCatalogue } from "./pilot-catalogue.js";
import { today, addCadence, toDay } from "./util.js";

const CONSUMER = "11111111-1111-4111-8111-111111111111";
const RETAILER = "33333333-3333-4333-8333-333333333333";
const STORE = pilotCatalogue.stores[0].id;
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
}));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createMockApi() {
  let userId = null;
  const profiles = {
    [CONSUMER]: { id: CONSUMER, full_name: "Amaka Obi", email: "amaka@example.com", role: "consumer", store_id: null, favourite_store_id: STORE, points: 0 },
    [RETAILER]: { id: RETAILER, full_name: "Store Owner", email: "owner@example.com", role: "retailer", store_id: STORE, favourite_store_id: STORE, points: 0 },
  };
  const passwords = { "amaka@example.com": [CONSUMER, "password"], "owner@example.com": [RETAILER, "password"] };
  const products = pilotCatalogue.products.map((p) => ({ ...p }));
  const now = Date.now();
  const updates = pilotCatalogue.updates.map((u) => ({ ...u, created_at: new Date(now - u.hours_ago * 3600_000).toISOString() }));
  const schedules = [], scheduleItems = [], orders = [], orderItems = [], ledger = [];
  const stores = pilotCatalogue.stores.map((s, i) => ({ ...s, slug: s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), join_code: ["SUNR42", "ESQ7NA", "SAIG8N"][i] }));
  const followed = [{ user_id: CONSUMER, store_id: STORE, added_via: "picker" }, { user_id: RETAILER, store_id: STORE, added_via: "picker" }];
  const listeners = new Set();
  let nextNumber = 1001;

  // Seed: one schedule, one fulfilled order last month, one waiting now.
  const p = pilotCatalogue.products;
  const sched = { id: uuid(), user_id: CONSUMER, store_id: STORE, name: "Monthly staples", cadence: "monthly",
    next_run_date: toDay(new Date(now + 9 * 86_400_000)), fulfillment: "pickup", status: "active", reminder_days: 2 };
  schedules.push(sched);
  scheduleItems.push(
    { id: uuid(), schedule_id: sched.id, product_id: p[0].id, quantity: 1 },
    { id: uuid(), schedule_id: sched.id, product_id: p[13].id, quantity: 2 },
    { id: uuid(), schedule_id: sched.id, product_id: p[32].id, quantity: 6 },
  );
  const old = insertOrder(CONSUMER, STORE, sched.id, [{ product_id: p[0].id, quantity: 1 }, { product_id: p[13].id, quantity: 2 }],
    "pickup", toDay(new Date(now - 21 * 86_400_000)), null, new Date(now - 21 * 86_400_000).toISOString());
  applyStatus(old, "confirmed"); applyStatus(old, "ready"); applyStatus(old, "fulfilled");
  insertOrder(CONSUMER, STORE, null, [{ product_id: p[46].id, quantity: 2 }, { product_id: p[40].id, quantity: 1 }],
    "pickup", today(), "Friday afternoon please", new Date(now - 5 * 3600_000).toISOString());

  function insertOrder(user, store, scheduleId, lines, fulfillment, scheduledFor, note, createdAt) {
    const id = uuid();
    let subtotal = 0;
    for (const line of lines) {
      const prod = products.find((x) => x.id === line.product_id && x.store_id === store && x.is_active);
      if (!prod) throw new Error(`product ${line.product_id} is not in this store's catalogue`);
      const q = Math.max(1, line.quantity | 0);
      orderItems.push({ id: uuid(), order_id: id, product_id: prod.id, category_id: prod.category_id, name: prod.name, unit_price_cents: prod.price_cents, quantity: q });
      subtotal += prod.price_cents * q;
    }
    orders.push({ id, number: nextNumber++, user_id: user, store_id: store, schedule_id: scheduleId, status: "pending", fulfillment,
      scheduled_for: scheduledFor, subtotal_cents: subtotal, points_earned: 0, payment_status: "unpaid", payment_method: "pay_at_pickup",
      note, customer_name: profiles[user]?.full_name ?? null, created_at: createdAt, updated_at: createdAt });
    return id;
  }
  function applyStatus(id, status) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    if (status === "fulfilled" && o.status !== "fulfilled") {
      const earned = Math.floor(o.subtotal_cents / 100);
      o.points_earned = earned;
      if (o.payment_method === "pay_at_pickup" && o.payment_status === "unpaid") o.payment_status = "paid";
      if (earned > 0) {
        ledger.push({ id: uuid(), user_id: o.user_id, order_id: o.id, delta: earned, reason: `Order ${o.number} fulfilled`, created_at: new Date().toISOString() });
        profiles[o.user_id].points += earned;
      }
    }
    o.status = status;
    o.updated_at = new Date().toISOString();
  }
  const notify = () => listeners.forEach((cb) => cb());
  const requireUser = () => { if (!userId) throw new Error("Sign in first."); return userId; };
  const requireStaff = () => { const u = requireUser(); if (!["retailer", "admin"].includes(profiles[u]?.role)) throw new Error("not store staff"); return u; };
  const copy = (x) => JSON.parse(JSON.stringify(x));

  return {
    isMock: true,
    async restoreSession() { return userId; },
    async signIn(email, password) {
      await sleep(250);
      const e = passwords[email.trim().toLowerCase()];
      if (!e || e[1] !== password) throw new Error("Invalid login credentials");
      userId = e[0]; return userId;
    },
    async signUp(fullName, email, password) {
      await sleep(250);
      const key = email.trim().toLowerCase();
      if (passwords[key]) throw new Error("User already registered");
      const id = uuid();
      passwords[key] = [id, password];
      profiles[id] = { id, full_name: fullName, email: key, role: "consumer", store_id: null, favourite_store_id: null, points: 0 };
      userId = id; return id;
    },
    async signOut() { userId = null; },

    async myProfile() { await sleep(80); return copy(profiles[requireUser()]); },
    async updateProfile(patch) {
      await sleep(80); const u = requireUser(); Object.assign(profiles[u], patch);
      if (patch.favourite_store_id && !followed.some((f) => f.user_id === u && f.store_id === patch.favourite_store_id)) followed.push({ user_id: u, store_id: patch.favourite_store_id, added_via: "picker" });
    },

    async stores() { await sleep(80); return copy(stores.filter((s) => s.is_active)); },
    async myStores() { await sleep(40); const u = requireUser(); return copy(followed.filter((f) => f.user_id === u)); },
    async followStore(code, via) {
      await sleep(200);
      const u = requireUser(); const c = String(code).trim().toLowerCase();
      const st = stores.find((s) => s.is_active && (s.slug === c || s.join_code.toLowerCase() === c || s.id === c));
      if (!st) throw new Error("no store has that code");
      if (!followed.some((f) => f.user_id === u && f.store_id === st.id)) followed.push({ user_id: u, store_id: st.id, added_via: via ?? "qr" });
      profiles[u].favourite_store_id = st.id;
      return copy(st);
    },
    async unfollowStore(storeId) { await sleep(80); const u = requireUser(); const i = followed.findIndex((f) => f.user_id === u && f.store_id === storeId); if (i >= 0) followed.splice(i, 1); },
    async updateStore(storeId, patch) { await sleep(120); requireStaff(); Object.assign(stores.find((s) => s.id === storeId), patch); },
    async uploadLogo(storeId, file) { await sleep(300); requireStaff(); return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); }); },
    async categories() { await sleep(40); return copy(pilotCatalogue.categories); },
    async products(storeId) { await sleep(120); return copy(products.filter((x) => x.store_id === storeId && x.is_active).sort((a, b) => a.name.localeCompare(b.name))); },
    async storeUpdates(storeId) { await sleep(60); return copy(updates.filter((u) => u.store_id === storeId).sort((a, b) => b.created_at.localeCompare(a.created_at))); },

    async mySchedules() { await sleep(80); const u = requireUser(); return copy(schedules.filter((s) => s.user_id === u).sort((a, b) => a.next_run_date.localeCompare(b.next_run_date))); },
    async scheduleItems(id) { await sleep(40); return copy(scheduleItems.filter((i) => i.schedule_id === id)); },
    async createSchedule(d) {
      await sleep(150);
      const s = { id: uuid(), user_id: requireUser(), store_id: d.store_id, name: d.name, cadence: d.cadence, next_run_date: d.next_run_date,
        fulfillment: d.fulfillment, status: "active", reminder_days: d.reminder_days };
      schedules.push(s); replaceItems(s.id, d.lines); return s.id;
    },
    async updateSchedule(s, lines) {
      await sleep(150);
      const i = schedules.findIndex((x) => x.id === s.id && x.user_id === requireUser());
      if (i < 0) throw new Error("schedule not found");
      schedules[i] = { ...schedules[i], name: s.name, cadence: s.cadence, next_run_date: s.next_run_date, fulfillment: s.fulfillment, status: s.status, reminder_days: s.reminder_days };
      replaceItems(s.id, lines);
    },
    async deleteSchedule(id) {
      await sleep(100);
      const i = schedules.findIndex((x) => x.id === id); if (i >= 0) schedules.splice(i, 1);
      for (let k = scheduleItems.length - 1; k >= 0; k--) if (scheduleItems[k].schedule_id === id) scheduleItems.splice(k, 1);
    },
    async runScheduleNow(id) {
      await sleep(200);
      const u = requireUser();
      const s = schedules.find((x) => x.id === id && x.user_id === u);
      if (!s) throw new Error("schedule not found");
      const lines = scheduleItems.filter((i) => i.schedule_id === id).map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
      if (!lines.length) throw new Error("schedule has no items");
      const oid = insertOrder(u, s.store_id, id, lines, s.fulfillment, today(), null, new Date().toISOString());
      s.next_run_date = addCadence(today(), s.cadence);
      notify(); return oid;
    },

    async myOrders() { await sleep(80); const u = requireUser(); return copy(orders.filter((o) => o.user_id === u).sort((a, b) => b.created_at.localeCompare(a.created_at))); },
    async orderItems(id) { await sleep(40); return copy(orderItems.filter((i) => i.order_id === id).sort((a, b) => a.name.localeCompare(b.name))); },
    async placeOrder({ store_id, lines, fulfillment, scheduled_for, note }) {
      await sleep(250);
      if (!lines?.length) throw new Error("an order needs at least one item");
      const id = insertOrder(requireUser(), store_id, null, lines, fulfillment, scheduled_for, note ?? null, new Date().toISOString());
      notify(); return id;
    },
    async cancelOrder(id) {
      await sleep(120);
      const o = orders.find((x) => x.id === id && x.user_id === requireUser());
      if (!o) throw new Error("not found");
      if (o.status !== "pending") throw new Error("an order can only be cancelled while it is pending");
      applyStatus(id, "cancelled"); notify();
    },
    onOrderChanges(cb) { listeners.add(cb); return () => listeners.delete(cb); },

    async spendByCategory() {
      await sleep(60);
      const u = requireUser(); const totals = {};
      for (const o of orders) {
        if (o.user_id !== u || o.status === "cancelled") continue;
        const month = o.created_at.slice(0, 7) + "-01";
        for (const it of orderItems) {
          if (it.order_id !== o.id) continue;
          const cat = pilotCatalogue.categories.find((c) => c.id === it.category_id)?.name ?? "Other";
          totals[`${month}|${cat}`] = (totals[`${month}|${cat}`] ?? 0) + it.unit_price_cents * it.quantity;
        }
      }
      return Object.entries(totals).map(([k, cents]) => { const [month, category] = k.split("|"); return { month, category, cents }; }).sort((a, b) => b.cents - a.cents);
    },
    async pointsHistory() { await sleep(40); const u = requireUser(); return copy(ledger.filter((l) => l.user_id === u).sort((a, b) => b.created_at.localeCompare(a.created_at))); },

    async storeOrders(storeId) { await sleep(80); requireStaff(); return copy(orders.filter((o) => o.store_id === storeId).sort((a, b) => b.created_at.localeCompare(a.created_at))); },
    async setOrderStatus(id, status) { await sleep(120); requireStaff(); applyStatus(id, status); notify(); },
    async saveProduct(p) {
      await sleep(120); requireStaff();
      const i = products.findIndex((x) => x.id === p.id);
      if (i >= 0) products[i] = { ...products[i], ...p }; else products.push({ image_url: null, ...p });
    },
    async postStoreUpdate(row) { await sleep(120); requireStaff(); updates.unshift({ id: uuid(), body: null, product_id: null, ...row, created_at: new Date().toISOString() }); },
  };

  function replaceItems(scheduleId, lines) {
    for (let k = scheduleItems.length - 1; k >= 0; k--) if (scheduleItems[k].schedule_id === scheduleId) scheduleItems.splice(k, 1);
    for (const l of lines) if (l.quantity > 0) scheduleItems.push({ id: uuid(), schedule_id: scheduleId, product_id: l.product_id, quantity: l.quantity });
  }
}
