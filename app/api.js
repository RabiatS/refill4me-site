// The one file that talks to the server. Everything returns rows exactly as
// the database names them. `createApi` picks Supabase when config.js has
// keys, or the in-browser demo otherwise (and always with ?demo in the URL).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { createMockApi } from "./mock.js";

export function createApi(cfg) {
  const demo = new URLSearchParams(location.search).has("demo");
  if (!demo && cfg?.supabaseUrl && cfg?.supabaseAnonKey) return createSupabaseApi(cfg);
  return createMockApi();
}

function createSupabaseApi(cfg) {
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const uid = async () => {
    const { data } = await sb.auth.getUser();
    if (!data?.user) throw new Error("Sign in first.");
    return data.user.id;
  };
  const one = ({ data, error }) => { if (error) throw error; return data; };

  return {
    isMock: false,

    async restoreSession() {
      const { data } = await sb.auth.getSession();
      return data?.session?.user?.id ?? null;
    },
    async signIn(email, password) {
      return one(await sb.auth.signInWithPassword({ email, password })).user.id;
    },
    async signUp(fullName, email, password) {
      const data = one(await sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } }));
      if (!data.session) throw new Error("Check your email to confirm the account, then sign in.");
      return data.user.id;
    },
    async signOut() { one(await sb.auth.signOut()); },

    async myProfile() {
      return one(await sb.from("profiles").select().eq("id", await uid()).single());
    },
    async updateProfile(patch) {
      one(await sb.from("profiles").update(patch).eq("id", await uid()));
    },

    async stores() { return one(await sb.from("stores").select().eq("is_active", true).order("name")); },
    async myStores() { return one(await sb.from("user_stores").select().eq("user_id", await uid())); },
    async followStore(code, via) { return one(await sb.rpc("follow_store", { p_code: code, p_via: via ?? "qr" })); },
    async unfollowStore(storeId) { one(await sb.from("user_stores").delete().eq("user_id", await uid()).eq("store_id", storeId)); },
    async updateStore(storeId, patch) { one(await sb.from("stores").update(patch).eq("id", storeId)); },
    async uploadLogo(storeId, file) {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${storeId}/logo-${Date.now()}.${ext}`;
      one(await sb.storage.from("store-logos").upload(path, file, { upsert: true, contentType: file.type }));
      return sb.storage.from("store-logos").getPublicUrl(path).data.publicUrl;
    },
    async categories() { return one(await sb.from("product_categories").select().order("sort_order")); },
    async products(storeId) { return one(await sb.from("products").select().eq("store_id", storeId).order("name")); },
    async storeUpdates(storeId) {
      return one(await sb.from("store_updates").select().eq("store_id", storeId).order("created_at", { ascending: false }).limit(20));
    },

    async mySchedules() { return one(await sb.from("refill_schedules").select().eq("user_id", await uid()).order("next_run_date")); },
    async scheduleItems(scheduleId) { return one(await sb.from("refill_schedule_items").select().eq("schedule_id", scheduleId)); },
    async createSchedule(draft) {
      const row = one(await sb.from("refill_schedules").insert({
        user_id: await uid(), store_id: draft.store_id, name: draft.name, cadence: draft.cadence,
        next_run_date: draft.next_run_date, fulfillment: draft.fulfillment, reminder_days: draft.reminder_days,
      }).select("id").single());
      await replaceItems(row.id, draft.lines);
      return row.id;
    },
    async updateSchedule(s, lines) {
      one(await sb.from("refill_schedules").update({
        name: s.name, cadence: s.cadence, next_run_date: s.next_run_date, fulfillment: s.fulfillment,
        status: s.status, reminder_days: s.reminder_days,
      }).eq("id", s.id));
      await replaceItems(s.id, lines);
    },
    async deleteSchedule(id) { one(await sb.from("refill_schedules").delete().eq("id", id)); },
    async runScheduleNow(id) { return one(await sb.rpc("run_schedule", { p_schedule_id: id })); },

    async myOrders() { return one(await sb.from("orders").select().eq("user_id", await uid()).order("created_at", { ascending: false })); },
    async orderItems(orderId) { return one(await sb.from("order_items").select().eq("order_id", orderId).order("name")); },
    async placeOrder({ store_id, lines, fulfillment, scheduled_for, note }) {
      return one(await sb.rpc("place_order", {
        p_store_id: store_id, p_items: lines, p_fulfillment: fulfillment, p_scheduled_for: scheduled_for, p_note: note ?? null,
      }));
    },
    async cancelOrder(id) { one(await sb.from("orders").update({ status: "cancelled" }).eq("id", id)); },
    onOrderChanges(cb) {
      // No filter: the server only sends rows this person may select.
      const channel = sb.channel("orders-" + Math.random().toString(36).slice(2))
        .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => cb())
        .subscribe();
      return () => sb.removeChannel(channel);
    },

    async spendByCategory() {
      return one(await sb.from("my_spend_by_category").select("month, category, cents").eq("user_id", await uid()).order("cents", { ascending: false }));
    },
    async pointsHistory() {
      return one(await sb.from("points_ledger").select().eq("user_id", await uid()).order("created_at", { ascending: false }).limit(50));
    },

    async storeOrders(storeId) {
      return one(await sb.from("orders").select().eq("store_id", storeId).order("created_at", { ascending: false }).limit(200));
    },
    async setOrderStatus(id, status) { one(await sb.from("orders").update({ status }).eq("id", id)); },
    async saveProduct(p) {
      one(await sb.from("products").upsert({
        id: p.id, store_id: p.store_id, category_id: p.category_id, name: p.name, brand: p.brand, size: p.size,
        price_cents: p.price_cents, in_stock: p.in_stock, is_active: p.is_active,
      }));
    },
    async postStoreUpdate(row) { one(await sb.from("store_updates").insert(row)); },
  };

  async function replaceItems(scheduleId, lines) {
    one(await sb.from("refill_schedule_items").delete().eq("schedule_id", scheduleId));
    const rows = lines.filter((l) => l.quantity > 0).map((l) => ({ schedule_id: scheduleId, product_id: l.product_id, quantity: l.quantity }));
    if (rows.length) one(await sb.from("refill_schedule_items").insert(rows));
  }
}
