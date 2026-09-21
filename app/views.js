// Every screen as a function of state returning HTML. Actions are wired by
// data-action attributes that main.js handles.
import { I, categoryIcon } from "./icons.js";
import { esc, money, relativeDay, longDay, daysFromToday, shortStamp, ago, STATUS, CADENCE, FULFILLMENT, UPDATE_KIND, firstName, today, addCadence } from "./util.js";

const CADENCE_DAYS = { weekly: 7, biweekly: 14, monthly: 30 };

// MARK: shell

export function render(s) {
  const modal = s.ui.modal ? renderModal(s) : "";
  const toast = s.ui.toast ? `<div class="toast" role="status">${esc(s.ui.toast)}</div>` : "";
  if (s.phase === "loading") return `<div class="boot"><div class="spinner"></div></div>`;
  if (s.phase === "signedOut") return auth(s) + toast;
  if (!s.profile?.favourite_store_id && !isStaff(s)) return shell(s, chooseStore(s, true), "Choose your store") + modal + toast;
  const r = s.route;
  let page, title;
  if (r.name === "choose-store") { page = chooseStore(s, false); title = "Your store"; }
  else if (r.name === "shop") { page = shop(s); title = storeName(s); }
  else if (r.name === "refills") { page = refills(s); title = "Refills"; }
  else if (r.name === "refill") { page = refillDetail(s, r.id); title = "Refill"; }
  else if (r.name === "refill-new") { page = refillEditor(s, null); title = "New refill"; }
  else if (r.name === "refill-edit") { page = refillEditor(s, r.id); title = "Adjust refill"; }
  else if (r.name === "orders") { page = orders(s); title = "Orders"; }
  else if (r.name === "order") { page = orderDetail(s, r.id, false); title = "Order"; }
  else if (r.name === "you") { page = you(s); title = "You"; }
  else if (r.name === "store") { page = store(s); title = staffStoreName(s); }
  else if (r.name === "store-order") { page = orderDetail(s, r.id, true); title = "Order"; }
  else if (r.name === "product-edit") { page = productEditor(s, r.id); title = r.id === "new" ? "New item" : "Edit item"; }
  else if (r.name === "update-new") { page = updateEditor(s); title = "Post an update"; }
  else { page = home(s); title = ""; }
  return shell(s, page, title) + basketDrawer(s) + modal + toast;
}

const isStaff = (s) => ["retailer", "admin"].includes(s.profile?.role);
const storeName = (s) => s.stores.find((x) => x.id === s.profile?.favourite_store_id)?.name ?? "Shop";
const staffStoreName = (s) => s.stores.find((x) => x.id === s.profile?.store_id)?.name ?? "Store";
const product = (s, id) => s.products.find((p) => p.id === id);
const category = (s, id) => s.categories.find((c) => c.id === id);
const basketCount = (s) => Object.values(s.basket).reduce((a, b) => a + b, 0);
const basketCents = (s) => Object.entries(s.basket).reduce((sum, [id, q]) => sum + (product(s, id)?.price_cents ?? 0) * q, 0);

function shell(s, content, title) {
  const links = [
    ["#/home", "home", "Home", I.home],
    ["#/shop", "shop", "Shop", I.shop],
    ["#/refills", "refills", "Refills", I.refill],
    isStaff(s) ? ["#/store", "store", "Store", I.store] : ["#/orders", "orders", "Orders", I.orders],
    ["#/you", "you", "You", I.you],
  ];
  const active = (key) => (s.route.section === key ? " is-active" : "");
  const count = basketCount(s);
  const badge = (key) => (key === "shop" && count ? `<span class="count">${count}</span>` : "");
  const side = links.map(([href, key, label, icon]) => `<a class="navlink${active(key)}" href="${href}">${icon}${label}${badge(key)}</a>`).join("");
  const tabs = links.map(([href, key, label, icon]) => `<a class="${active(key).trim()}" href="${href}">${icon}${label}${badge(key)}</a>`).join("");
  return `
  <div class="shell">
    <aside class="side">
      <a class="brand" href="../">${`<img src="../assets/img/icon-512.png" alt="">`}Refill Me</a>
      ${side}
      <div class="spacer"></div>
      ${s.api.isMock ? `<div class="demo-note">Demo mode: nothing leaves this browser. Sign in as amaka@example.com or owner@example.com, password "password".</div>` : ""}
    </aside>
    <div class="main">
      <div class="topbar">
        <h1>${esc(title || "Refill Me")}</h1>
        <div class="actions">
          ${s.route.section === "shop" && count ? `<button class="btn btn-primary" data-action="basket-open">${I.basket} ${count} · ${money(basketCents(s))}</button>` : ""}
        </div>
      </div>
      <main class="content">${content}</main>
    </div>
    <nav class="tabbar">${tabs}</nav>
  </div>`;
}

// MARK: auth

function auth(s) {
  const mode = s.ui.authMode;
  return `
  <div class="auth">
    <div class="side-art">
      <a class="brand" href="../" style="color:#fff;display:inline-flex;align-items:center;gap:10px;font-weight:700"><img src="../assets/img/icon-512.png" alt="" style="width:32px;height:32px;border-radius:9px">Refill Me</a>
      <div class="spacer-art">
        <h2>Your regular groceries, ready when you are.</h2>
        <p>Pick your store, set a refill, and it is waiting for you on the day. Points on every order.</p>
      </div>
      <p style="font-size:13.5px;opacity:.8">Also on iPhone. Android on the web for now.</p>
    </div>
    <div class="form-col">
      <form data-form="auth" novalidate>
        <div class="seg">
          <label><input type="radio" name="mode" value="signin" ${mode === "signin" ? "checked" : ""} data-change="auth-mode"><span>Sign in</span></label>
          <label><input type="radio" name="mode" value="signup" ${mode === "signup" ? "checked" : ""} data-change="auth-mode"><span>Create account</span></label>
        </div>
        <h1>${mode === "signin" ? "Welcome back" : "Let's get you set up"}</h1>
        ${mode === "signup" ? `<div class="field"><label for="a-name">Full name</label><input id="a-name" name="full_name" autocomplete="name" data-keep required></div>` : ""}
        <div class="field"><label for="a-email">Email</label><input id="a-email" name="email" type="email" autocomplete="email" inputmode="email" data-keep required></div>
        <div class="field"><label for="a-pass">Password</label><input id="a-pass" name="password" type="password" autocomplete="${mode === "signin" ? "current-password" : "new-password"}" minlength="6" placeholder="6 or more characters" required></div>
        ${s.ui.error ? `<p class="error">${esc(s.ui.error)}</p>` : ""}
        <button class="btn btn-primary btn-block" type="submit" ${s.ui.busy ? "disabled" : ""}>${s.ui.busy ? "One moment" : mode === "signin" ? "Sign in" : "Create account"}</button>
        ${s.api.isMock ? `<p class="muted small">Demo mode. Sign in as <b>amaka@example.com</b> (shopper) or <b>owner@example.com</b> (store) with the password <b>password</b>, or create any account. Nothing leaves this browser.</p>` : ""}
        <p class="muted small">By continuing you agree to the <a href="../terms.html">terms</a> and <a href="../privacy.html">privacy policy</a>.</p>
      </form>
    </div>
  </div>`;
}

// MARK: store picker

function chooseStore(s, onboarding) {
  const current = s.profile?.favourite_store_id;
  const followedIds = new Set(s.myStores.map((f) => f.store_id));
  const mine = s.stores.filter((st) => followedIds.has(st.id));
  const others = s.stores.filter((st) => !followedIds.has(st.id));
  const storeRow = (st, following) => `
    <div class="card row" style="border-color:${current === st.id ? "var(--green)" : "var(--line)"}">
      ${storeMark(st, 48)}
      <span class="grow">
        <span class="title">${esc(st.name)}</span><br>
        <span class="sub">${esc(st.tagline ?? "")}</span><br>
        <span class="sub">${esc(cap(st.kind))} grocery, ${esc([st.city, st.state].filter(Boolean).join(", "))}</span>
      </span>
      ${current === st.id
        ? `<span class="status green">${I.check} Shopping here</span>`
        : following
          ? `<span class="inline-actions"><button class="btn btn-secondary" style="min-height:40px" data-action="choose-store" data-id="${st.id}" ${s.ui.busy ? "disabled" : ""}>Shop here</button><button class="close" data-action="unfollow-store" data-id="${st.id}" aria-label="Remove">${I.close}</button></span>`
          : `<button class="btn btn-secondary" style="min-height:40px" data-action="choose-store" data-id="${st.id}" ${s.ui.busy ? "disabled" : ""}>Add</button>`}
    </div>`;
  return `
  ${onboarding ? `<div><h2 class="greeting">Which store do you shop at?</h2><p class="muted">Add the stores you shop at. Refill Me shops one at a time, and you can switch any time.</p></div>` : ""}
  ${mine.length ? `<div class="section-title"><h2>Your stores</h2></div><div class="stack">${mine.map((st) => storeRow(st, true)).join("")}</div>` : ""}
  <div class="section-title"><h2>Add a store</h2></div>
  <form class="card stack" data-form="join-code">
    <div class="muted small">In the shop? Scan the store's Refill Me QR code with your camera, or type the code printed under it.</div>
    <div style="display:flex;gap:8px"><input name="code" class="field" style="flex:1;min-height:46px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--bg);text-transform:uppercase;letter-spacing:.08em;font-weight:600" placeholder="Store code" data-keep id="join-code" maxlength="40" autocomplete="off"><button class="btn btn-primary" type="submit" ${s.ui.busy ? "disabled" : ""}>Add</button></div>
    ${s.ui.error ? `<p class="error" style="margin:0">${esc(s.ui.error)}</p>` : ""}
  </form>
  ${others.length ? `<div class="stack">${others.map((st) => storeRow(st, false)).join("")}</div>` : ""}
  ${s.stores.length ? "" : emptyState(I.store, "No stores yet", "Stores appear here once they have onboarded their catalogue.")}`;
}

// The store's logo, or its initials in the brand green until it has one.
export function storeMark(st, size = 44) {
  if (st?.logo_url) return `<img src="${esc(st.logo_url)}" alt="" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * .28)}px;object-fit:cover;flex:none;background:#fff;border:1px solid var(--line)">`;
  return `<span class="initials" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px;border-radius:${Math.round(size * .28)}px">${esc(initials(st?.name ?? "?"))}</span>`;
}

function storeHeader(s, st) {
  if (!st) return "";
  return `<div class="card row" style="padding:14px 16px">
    ${storeMark(st, 56)}
    <span class="grow"><span class="title" style="font-size:18px">${esc(st.name)}</span><br><span class="sub">${esc(st.tagline ?? "")}</span><br><span class="sub">${esc([st.address, st.city, st.state].filter(Boolean).join(", "))}${st.phone ? ` · ${esc(st.phone)}` : ""}</span></span>
    <a class="btn btn-ghost" style="min-height:40px" href="#/choose-store">Switch</a>
  </div>`;
}
const initials = (name) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
// A product's photo when the catalogue has one, else its category icon.
const productTile = (s, p, extra = "") => p?.image_url
  ? `<span class="icon-tile photo ${extra}"><img src="${esc(p.image_url)}" alt="" loading="lazy" onerror="this.parentNode.classList.remove('photo');this.remove()"></span>`
  : `<span class="icon-tile ${extra}">${categoryIcon(category(s, p?.category_id)?.symbol)}</span>`;
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : "");

// MARK: home

function home(s) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const name = firstName(s.profile);
  const next = s.schedules.filter((x) => x.status === "active").sort((a, b) => a.next_run_date.localeCompare(b.next_run_date))[0];
  const open = s.orders.filter((o) => STATUS[o.status].open);
  const month = today().slice(0, 7);
  const spend = s.spend.filter((r) => String(r.month).slice(0, 7) === month).sort((a, b) => b.cents - a.cents);
  const total = spend.reduce((a, r) => a + r.cents, 0);
  const max = spend[0]?.cents || 1;
  const st = s.stores.find((x) => x.id === s.profile?.favourite_store_id);
  return `
  <div>
    <h2 class="greeting">${esc(name ? `${part}, ${name}` : part)}</h2>
    ${st ? `<button class="store-switch" data-action="go" data-href="#/choose-store">${storeMark(st, 22)} ${esc(st.name)} ${I.down}</button>` : ""}
  </div>
  <div class="points"><span class="icon-tile amber">${I.star}</span><div><strong>${s.profile?.points ?? 0} points</strong><span class="small">1 point for every dollar on fulfilled orders</span></div></div>
  ${next ? nextRefillCard(s, next) : `<div class="card"><div class="title" style="font-weight:600">Set up your first refill</div><p class="muted small" style="margin:6px 0 12px">Pick the things you buy every week or month and the store will have them ready on the day.</p><a class="btn btn-secondary" href="#/refills/new">Start a refill</a></div>`}
  ${runningLow(s)}
  ${open.length ? `<div class="section-title"><h2>Orders in progress</h2><a href="${isStaff(s) ? "#/store" : "#/orders"}">See all</a></div><div class="card tight">${open.map((o) => orderRow(s, o, false)).join("")}</div>` : ""}
  ${s.updates.length ? `<div class="section-title"><h2>From ${esc(st?.name ?? "your store")}</h2></div><div class="stack">${s.updates.slice(0, 3).map(updateCard).join("")}</div>` : ""}
  <div class="section-title"><h2>Spend this month</h2></div>
  <div class="card">
    ${spend.length ? `<strong style="font-size:22px">${money(total)}</strong><div class="bars" style="margin-top:12px">${spend.slice(0, 6).map((r) => `<div class="bar"><span class="muted">${esc(r.category)}</span><span class="track"><i style="width:${Math.max(4, Math.round((r.cents / max) * 100))}%"></i></span><span class="amt">${money(r.cents)}</span></div>`).join("")}</div>`
      : `<p class="muted small" style="margin:0">Nothing yet this month. Your spend by category shows up here as orders come in.</p>`}
  </div>`;
}

function nextRefillCard(s, sc) {
  const items = s.scheduleItems[sc.id] ?? [];
  const count = items.reduce((a, i) => a + i.quantity, 0);
  const soon = daysFromToday(sc.next_run_date) <= sc.reminder_days;
  return `
  <div class="card" style="border-color:${soon ? "var(--amber)" : "var(--line)"}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
      <span class="pill">${I.refill} Next refill</span>
      <span class="pill ${soon ? "pill-amber" : ""}">${esc(relativeDay(sc.next_run_date))}</span>
    </div>
    <div style="font-size:20px;font-weight:700;margin:10px 0 4px">${esc(sc.name)}</div>
    <p class="muted small" style="margin:0 0 12px">${count} items, ${CADENCE[sc.cadence].toLowerCase()}, ${FULFILLMENT[sc.fulfillment].toLowerCase()} on ${esc(longDay(sc.next_run_date))}.${soon ? " Adjust anything before it runs." : ""}</p>
    <div class="inline-actions"><a class="btn btn-secondary" href="#/refills/${sc.id}">Review and adjust</a><button class="btn btn-ghost" data-action="run-now" data-id="${sc.id}">Order now</button></div>
  </div>`;
}

// Each scheduled item as a bar draining toward its refill date, with the
// store's stock flagged. This is the "what is running out" view.
function runningLow(s) {
  const rows = [];
  for (const sc of s.schedules) {
    if (sc.status !== "active") continue;
    const days = daysFromToday(sc.next_run_date);
    const span = CADENCE_DAYS[sc.cadence];
    const left = Math.max(0, Math.min(1, days / span));
    for (const it of s.scheduleItems[sc.id] ?? []) {
      const p = product(s, it.product_id);
      if (!p) continue;
      rows.push({ p, it, sc, days, left });
    }
  }
  if (!rows.length) return "";
  rows.sort((a, b) => (a.p.in_stock === b.p.in_stock ? a.left - b.left : a.p.in_stock ? 1 : -1));
  // Green while there is plenty left, amber once under 30%, red under 10%
  // or when the store has run out.
  const tone = (r) => (!r.p.in_stock || r.left < 0.10 ? "danger" : r.left < 0.30 ? "amber" : "green");
  return `
  <div class="section-title"><h2>Running low</h2><a href="#/refills">Refills</a></div>
  <div class="card tight">
    ${rows.slice(0, 8).map((r) => `
      <div class="row">
        ${productTile(s, r.p, tone(r))}
        <div class="grow">
          <div style="display:flex;justify-content:space-between;gap:8px"><span class="title">${esc(r.p.name)}</span><span class="small ${tone(r) === "green" ? "muted" : ""}" style="color:var(--${tone(r) === "green" ? "muted" : tone(r)});font-weight:600">${!r.p.in_stock ? "Store is out" : r.days <= 0 ? "Refill today" : `${r.days} day${r.days === 1 ? "" : "s"} left`}</span></div>
          <div class="track" style="height:8px;background:var(--green-soft);border-radius:6px;overflow:hidden;margin-top:6px"><i style="display:block;height:100%;width:${Math.round(r.left * 100)}%;background:var(--${tone(r)});border-radius:6px"></i></div>
          <div class="sub" style="margin-top:4px">${r.it.quantity} × in ${esc(r.sc.name)}${!r.p.in_stock ? ", the store will include it when it is back" : ""}</div>
        </div>
      </div>`).join("")}
  </div>`;
}

function updateCard(u) {
  const icon = u.kind === "sale" ? I.tag : u.kind === "new_stock" ? I.spark : I.megaphone;
  return `<div class="card" style="padding:14px 16px">
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="pill ${u.kind === "sale" ? "pill-amber" : ""}">${icon} ${UPDATE_KIND[u.kind] ?? "Update"}</span><span class="muted small">${esc(ago(u.created_at))}</span></div>
    <div style="font-weight:600;margin-top:8px">${esc(u.title)}</div>
    ${u.body ? `<div class="muted small">${esc(u.body)}</div>` : ""}
  </div>`;
}

function orderRow(s, o, staff) {
  const st = STATUS[o.status];
  const href = staff ? `#/store/orders/${o.id}` : `#/orders/${o.id}`;
  const icon = { pending: I.clock, confirmed: I.seal, ready: I.bag, fulfilled: I.seal, cancelled: I.x }[o.status];
  return `<a class="row" href="${href}">
    <span class="icon-tile ${st.tone}">${icon}</span>
    <span class="grow"><span class="title">${esc(staff ? o.customer_name ?? "Customer" : `Order ${o.number}`)}</span><br><span class="sub">${FULFILLMENT[o.fulfillment]} ${esc(relativeDay(o.scheduled_for, true))}, ${money(o.subtotal_cents)}${staff && o.note ? `, "${esc(o.note)}"` : ""}</span></span>
    <span class="status ${st.tone}">${esc(st.label)}</span>
  </a>`;
}

// MARK: shop

function shop(s) {
  const q = s.ui.shopSearch.trim().toLowerCase();
  const used = new Set(s.products.map((p) => p.category_id));
  const cats = s.categories.filter((c) => used.has(c.id));
  const st = s.stores.find((x) => x.id === s.profile?.favourite_store_id);
  return `
  ${storeHeader(s, st)}
  <div class="search">${I.search}<input type="search" placeholder="Search the shelves" value="${esc(s.ui.shopSearch)}" data-input="shop-search" id="shop-search" data-keep aria-label="Search"></div>
  <div class="chips">
    <button class="chip ${!s.ui.shopCategory ? "is-active" : ""}" data-action="shop-category" data-id="">All</button>
    ${cats.map((c) => `<button class="chip ${s.ui.shopCategory === c.id ? "is-active" : ""}" data-action="shop-category" data-id="${c.id}">${categoryIcon(c.symbol)} ${esc(c.name)}</button>`).join("")}
  </div>
  <div class="products" id="product-list">${productList(s)}</div>
  ${basketCount(s) ? `<button class="btn btn-primary basket-fab" data-action="basket-open">${I.basket} ${basketCount(s)} in basket · ${money(basketCents(s))}</button>` : ""}`;
}

export function productList(s) {
  const q = s.ui.shopSearch.trim().toLowerCase();
  const list = s.products.filter((p) => p.is_active && (!s.ui.shopCategory || p.category_id === s.ui.shopCategory)
    && (!q || p.name.toLowerCase().includes(q) || (p.brand ?? "").toLowerCase().includes(q)));
  if (!list.length) return emptyState(I.search, "Nothing matches", "Try another word or clear the category.");
  return list.map((p) => {
    const qty = s.basket[p.id] ?? 0;
    const detail = [p.brand, p.size].filter(Boolean).join(", ");
    return `<div class="card product">
      ${productTile(s, p)}
      <div>
        <div class="name">${esc(p.name)}</div>
        <div class="meta">${esc(detail)}${!p.in_stock ? ` <span class="pill pill-danger">Out of stock</span>` : ""}</div>
        <div class="price">${money(p.price_cents)}</div>
        <button class="linkish" data-action="add-to-refill" data-id="${p.id}">Add to a refill</button>
      </div>
      <div class="controls">
        ${qty ? stepper(p.id, qty, "basket-set") : `<button class="plus" data-action="basket-add" data-id="${p.id}" ${p.in_stock ? "" : "disabled"} aria-label="Add">${I.plus}</button>`}
      </div>
    </div>`;
  }).join("");
}

function stepper(id, qty, action, min = 0) {
  return `<span class="stepper">
    <button data-action="${action}" data-id="${id}" data-qty="${qty - 1}" aria-label="Less" ${qty <= min ? "disabled" : ""}>${qty <= 1 && min === 0 ? I.trash : I.minus}</button>
    <span>${qty}</span>
    <button data-action="${action}" data-id="${id}" data-qty="${qty + 1}" aria-label="More">${I.plus}</button>
  </span>`;
}

function basketDrawer(s) {
  if (!s.ui.basketOpen) return "";
  const lines = Object.entries(s.basket).map(([id, q]) => ({ p: product(s, id), q })).filter((l) => l.p && l.q > 0).sort((a, b) => a.p.name.localeCompare(b.p.name));
  const cents = basketCents(s);
  const placed = s.ui.placed;
  return `
  <div class="drawer-backdrop" data-action="basket-close"></div>
  <aside class="drawer" role="dialog" aria-label="Basket">
    <header><h2>Basket</h2><button class="close" data-action="basket-close" aria-label="Close">${I.close}</button></header>
    ${placed ? `
      <div class="body" style="place-items:center;text-align:center;align-content:center">
        <span class="icon-tile" style="width:64px;height:64px">${I.check}</span>
        <h3 style="margin:0">Order ${placed} is in</h3>
        <p class="muted" style="margin:0">${esc(storeName(s))} will confirm it shortly. Follow it under Orders.</p>
        <a class="btn btn-primary" href="${isStaff(s) ? "#/home" : "#/orders"}" data-action="basket-close">Done</a>
      </div>` : `
      <form class="body" data-form="checkout" id="checkout">
        ${lines.length ? `<div class="card tight">${lines.map((l) => `<div class="row"><span class="grow"><span class="title">${esc(l.p.name)}</span><br><span class="sub">${money(l.p.price_cents)}</span></span>${stepper(l.p.id, l.q, "basket-set")}</div>`).join("")}</div>`
          : emptyState(I.basket, "Your basket is empty", "Add things from the shop to order them once.")}
        ${lines.length ? `
        <div class="field"><label>How would you like it?</label>
          <div class="seg"><label><input type="radio" name="fulfillment" value="pickup" checked><span>Pickup</span></label><label><input type="radio" name="fulfillment" value="delivery"><span>Delivery</span></label></div>
          <p class="muted small" style="margin:4px 0 0">Delivery is arranged by the store by phone during the pilot.</p></div>
        <div class="field"><label for="co-date">On</label><input id="co-date" name="scheduled_for" type="date" value="${today()}" min="${today()}" data-keep></div>
        <div class="field"><label for="co-note">Note for the store (optional)</label><textarea id="co-note" name="note" data-keep placeholder="Friday afternoon please"></textarea></div>
        <div class="card summary"><div><span class="muted">Subtotal</span><b>${money(cents)}</b></div><div><span class="muted">Payment</span><b>At pickup</b></div><div><span class="muted">Points you will earn</span><b>${Math.floor(cents / 100)}</b></div></div>
        ${s.ui.error ? `<p class="error">${esc(s.ui.error)}</p>` : ""}` : ""}
      </form>
      ${lines.length ? `<footer><button class="btn btn-primary btn-block" type="submit" form="checkout" ${s.ui.busy ? "disabled" : ""}>${s.ui.busy ? "Placing" : `Place order, ${money(cents)}`}</button></footer>` : ""}`}
  </aside>`;
}

// MARK: refills

function refills(s) {
  return `
  <div class="section-title"><h2>Your refills</h2><a href="#/refills/new">${I.plus} New refill</a></div>
  ${s.schedules.length ? `<div class="stack">${s.schedules.map((sc) => scheduleCard(s, sc)).join("")}</div>`
    : `${emptyState(I.refill, "No refills yet", "A refill is a list of things you buy on a rhythm. The store gets it ready on the day, every time.")}<a class="btn btn-primary" href="#/refills/new">Set up a refill</a>`}`;
}

function scheduleCard(s, sc) {
  const items = s.scheduleItems[sc.id] ?? [];
  const cents = items.reduce((a, i) => a + (product(s, i.product_id)?.price_cents ?? 0) * i.quantity, 0);
  const soon = daysFromToday(sc.next_run_date) <= sc.reminder_days;
  const names = items.slice(0, 4).map((i) => product(s, i.product_id)?.name).filter(Boolean).join(", ") + (items.length > 4 ? ` and ${items.length - 4} more` : "");
  return `<a class="card" href="#/refills/${sc.id}" style="display:block;color:inherit">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b style="font-size:17px">${esc(sc.name)}</b>${sc.status === "paused" ? `<span class="pill pill-muted">Paused</span>` : `<span class="pill ${soon ? "pill-amber" : ""}">${esc(relativeDay(sc.next_run_date))}</span>`}</div>
    <div class="muted small" style="margin-top:4px">${CADENCE[sc.cadence]}, ${FULFILLMENT[sc.fulfillment].toLowerCase()}</div>
    <div class="muted small" style="margin-top:6px">${esc(names)}</div>
    <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:13.5px;font-weight:600"><span>${items.reduce((a, i) => a + i.quantity, 0)} items</span><span>about ${money(cents)}</span></div>
  </a>`;
}

function refillDetail(s, id) {
  const sc = s.schedules.find((x) => x.id === id);
  if (!sc) return emptyState(I.refill, "That refill is gone", "It may have been deleted on another device.");
  const items = s.scheduleItems[sc.id] ?? [];
  return `
  <a href="#/refills" class="muted small" style="display:inline-flex;align-items:center;gap:4px">${I.back} Refills</a>
  <div class="card">
    <div style="font-size:22px;font-weight:700">${sc.status === "paused" ? "Paused" : `Next order ${esc(relativeDay(sc.next_run_date, true))}`}</div>
    <p class="muted" style="margin:6px 0 0">${esc(longDay(sc.next_run_date))}. ${CADENCE[sc.cadence]}, ${FULFILLMENT[sc.fulfillment].toLowerCase()}. We remind you ${sc.reminder_days} days before.</p>
  </div>
  <div class="section-title"><h2>What's in it</h2></div>
  <div class="card tight">
    ${items.length ? items.map((i) => { const p = product(s, i.product_id); return `<div class="row"><span class="muted" style="width:36px">${i.quantity} ×</span><span class="grow"><span class="title" style="font-weight:500">${esc(p?.name ?? "Item")}</span>${p && !p.in_stock ? ` <span class="pill pill-danger">Store is out</span>` : ""}</span><span class="amount muted">${money((p?.price_cents ?? 0) * i.quantity)}</span></div>`; }).join("")
      : `<div class="row muted">Nothing in this refill yet.</div>`}
  </div>
  ${s.ui.placed ? `<p class="ok">${I.check} Order ${s.ui.placed} placed for today. The store will confirm it.</p>` : ""}
  <div class="actions-col">
    <button class="btn btn-primary" data-action="run-now" data-id="${sc.id}" ${s.ui.busy || !items.length ? "disabled" : ""}>Order now</button>
    <a class="btn btn-secondary" href="#/refills/${sc.id}/edit">Adjust items or timing</a>
    <button class="btn btn-ghost" data-action="toggle-pause" data-id="${sc.id}">${sc.status === "paused" ? `${I.play} Resume this refill` : `${I.pause} Pause this refill`}</button>
    <button class="btn btn-danger" data-action="delete-schedule" data-id="${sc.id}">Delete</button>
  </div>`;
}

function refillEditor(s, id) {
  const sc = id ? s.schedules.find((x) => x.id === id) : null;
  const ed = s.ui.editor ?? {};
  const quantities = ed.quantities ?? {};
  const chosen = s.products.filter((p) => (quantities[p.id] ?? 0) > 0).sort((a, b) => a.name.localeCompare(b.name));
  const estimate = chosen.reduce((a, p) => a + p.price_cents * quantities[p.id], 0);
  const count = chosen.reduce((a, p) => a + quantities[p.id], 0);
  const q = (ed.pickerSearch ?? "").toLowerCase();
  const catalogue = s.products.filter((p) => p.is_active && (!q || p.name.toLowerCase().includes(q)));
  return `
  <a href="${sc ? `#/refills/${sc.id}` : "#/refills"}" class="muted small" style="display:inline-flex;align-items:center;gap:4px">${I.back} Back</a>
  <form data-form="schedule" data-id="${sc?.id ?? ""}" class="stack">
    <div class="field"><label for="sc-name">Name</label><input id="sc-name" name="name" data-keep value="${esc(ed.name ?? sc?.name ?? "Regular staples")}" required></div>
    <div class="field"><label>How often</label><div class="seg">${["weekly", "biweekly", "monthly"].map((c) => `<label><input type="radio" name="cadence" value="${c}" ${(ed.cadence ?? sc?.cadence ?? "biweekly") === c ? "checked" : ""}><span>${CADENCE[c]}</span></label>`).join("")}</div></div>
    <div class="grid-2">
      <div class="field"><label for="sc-date">Next order on</label><input id="sc-date" name="next_run_date" type="date" data-keep value="${esc(ed.next_run_date ?? sc?.next_run_date ?? addCadence(today(), "weekly"))}" min="${today()}" required></div>
      <div class="field"><label for="sc-remind">Remind me (days before)</label><input id="sc-remind" name="reminder_days" type="number" min="0" max="14" data-keep value="${ed.reminder_days ?? sc?.reminder_days ?? 2}"></div>
    </div>
    <div class="field"><label>Collect by</label><div class="seg">${["pickup", "delivery"].map((f) => `<label><input type="radio" name="fulfillment" value="${f}" ${(ed.fulfillment ?? sc?.fulfillment ?? "pickup") === f ? "checked" : ""}><span>${FULFILLMENT[f]}</span></label>`).join("")}</div></div>

    <div class="section-title"><h2>Items</h2><span class="muted small">${count} each time, about ${money(estimate)}</span></div>
    ${chosen.length ? `<div class="card tight">${chosen.map((p) => `<div class="row"><span class="grow"><span class="title" style="font-weight:500">${esc(p.name)}</span><br><span class="sub">${money(p.price_cents)}</span></span>${stepper(p.id, quantities[p.id], "editor-set")}</div>`).join("")}</div>`
      : `<div class="card muted small">No items yet. Add the things you buy on this rhythm from the list below.</div>`}

    <div class="section-title"><h2>Add from the shelves</h2></div>
    <div class="search">${I.search}<input type="search" id="picker-search" data-keep data-input="picker-search" placeholder="Search" value="${esc(ed.pickerSearch ?? "")}"></div>
    <div class="card tight" style="max-height:380px;overflow:auto" id="picker-list">${pickerList(s)}</div>

    ${s.ui.error ? `<p class="error">${esc(s.ui.error)}</p>` : ""}
    <button class="btn btn-primary" type="submit" ${s.ui.busy || !chosen.length ? "disabled" : ""}>${sc ? "Save changes" : "Start this refill"}</button>
  </form>`;
}

export function pickerList(s) {
  const ed = s.ui.editor ?? {};
  const quantities = ed.quantities ?? {};
  const q = (ed.pickerSearch ?? "").toLowerCase();
  const cats = [...s.categories].sort((a, b) => a.sort_order - b.sort_order);
  const out = [];
  for (const c of cats) {
    const ps = s.products.filter((p) => p.is_active && p.category_id === c.id && (!q || p.name.toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));
    if (!ps.length) continue;
    out.push(`<div class="row" style="background:var(--bg);font-weight:600;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:8px 16px">${esc(c.name)}</div>`);
    for (const p of ps) {
      const qty = quantities[p.id] ?? 0;
      out.push(`<div class="row"><span class="grow"><span class="title" style="font-weight:500">${esc(p.name)}</span><br><span class="sub">${esc([p.brand, p.size, money(p.price_cents)].filter(Boolean).join(", "))}</span></span>${qty ? stepper(p.id, qty, "editor-set") : `<button class="plus" type="button" data-action="editor-set" data-id="${p.id}" data-qty="1" aria-label="Add">${I.plus}</button>`}</div>`);
    }
  }
  return out.join("") || `<div class="row muted">Nothing matches.</div>`;
}

// MARK: orders

function orders(s) {
  const open = s.orders.filter((o) => STATUS[o.status].open);
  const past = s.orders.filter((o) => !STATUS[o.status].open);
  if (!s.orders.length) return emptyState(I.orders, "No orders yet", "Orders from your refills and your basket show up here, with live status from the store.");
  return `
  ${open.length ? `<div class="section-title"><h2>In progress</h2></div><div class="card tight">${open.map((o) => orderRow(s, o, false)).join("")}</div>` : ""}
  ${past.length ? `<div class="section-title"><h2>Past</h2></div><div class="card tight">${past.map((o) => orderRow(s, o, false)).join("")}</div>` : ""}`;
}

function orderDetail(s, id, staff) {
  const o = (staff ? s.storeOrders : s.orders).find((x) => x.id === id) ?? s.orders.find((x) => x.id === id);
  if (!o) return emptyState(I.orders, "Order not found", "It may have moved. Go back and try again.");
  const items = s.orderItems[o.id];
  const st = STATUS[o.status];
  const steps = ["pending", "confirmed", "ready", "fulfilled"];
  const idx = steps.indexOf(o.status);
  const storeNm = s.stores.find((x) => x.id === o.store_id)?.name ?? "Store";
  return `
  <a href="${staff ? "#/store" : "#/orders"}" class="muted small" style="display:inline-flex;align-items:center;gap:4px">${I.back} ${staff ? "Store" : "Orders"}</a>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="status ${st.tone}">${esc(st.label)}</span><span class="muted small">${esc(shortStamp(o.created_at))}</span></div>
    <div style="font-size:22px;font-weight:700;margin-top:10px">${esc(staff ? o.customer_name ?? "Customer" : storeNm)}</div>
    <div class="muted" style="margin-top:4px">Order ${o.number}. ${FULFILLMENT[o.fulfillment]} on ${esc(longDay(o.scheduled_for))}.</div>
    ${o.note ? `<div style="margin-top:8px">${I.megaphone} <i>${esc(o.note)}</i></div>` : ""}
    ${o.schedule_id ? `<div class="muted small" style="margin-top:6px">${I.refill} From a refill schedule</div>` : ""}
  </div>
  ${o.status !== "cancelled" ? `<div class="card"><div class="timeline"><span class="fill" style="width:${(idx / 3) * 75}%"></span>${steps.map((k, i) => `<div class="step ${i <= idx ? "done" : ""}"><span class="dot">${i <= idx ? I.check : ""}</span><span>${esc(STATUS[k].label.replace(" for pickup", ""))}</span></div>`).join("")}</div></div>` : ""}
  <div class="section-title"><h2>Items</h2></div>
  <div class="card tight">
    ${items ? items.map((i) => `<div class="row"><span class="muted" style="width:36px">${i.quantity} ×</span><span class="grow" style="font-weight:500">${esc(i.name)}</span><span class="amount muted">${money(i.unit_price_cents * i.quantity)}</span></div>`).join("") : `<div class="row muted">Loading</div>`}
    <div class="row" style="font-weight:700"><span class="grow">Total</span><span>${money(o.subtotal_cents)}</span></div>
    <div class="row small" style="padding-top:0;border-top:0"><span class="grow muted">${o.payment_status === "paid" ? "Paid" : "Pay at pickup"}</span>${o.points_earned ? `<span style="color:var(--amber);font-weight:600">${I.star} ${o.points_earned} points earned</span>` : ""}</div>
  </div>
  <div class="actions-col">
    ${staff ? `${st.next ? `<button class="btn btn-primary" data-action="set-status" data-id="${o.id}" data-status="${st.next}" ${s.ui.busy ? "disabled" : ""}>Mark ${STATUS[st.next].label.toLowerCase()}</button>` : ""}${st.open ? `<button class="btn btn-danger" data-action="set-status" data-id="${o.id}" data-status="cancelled">Cancel this order</button>` : ""}`
      : o.status === "pending" ? `<button class="btn btn-danger" data-action="cancel-order" data-id="${o.id}">Cancel order</button>` : ""}
  </div>`;
}

// MARK: you

function you(s) {
  const p = s.profile;
  const st = s.stores.find((x) => x.id === p?.favourite_store_id);
  return `
  <div class="card row">
    <span class="initials" style="width:56px;height:56px;font-size:22px">${esc((firstName(p)[0] ?? "?").toUpperCase())}</span>
    <span class="grow"><span class="title" style="font-size:17px">${esc(p?.full_name ?? "")}</span><br><span class="sub">${esc(p?.email ?? "")}</span>${isStaff(s) ? `<br><span class="pill pill-amber">${p.role === "admin" ? "Admin" : "Store staff"}</span>` : ""}</span>
    <button class="close" data-action="edit-name" aria-label="Edit name">${I.pencil}</button>
  </div>
  <div class="points"><span class="icon-tile amber">${I.star}</span><div><strong>${p?.points ?? 0} points</strong><span class="small">1 point for every dollar on fulfilled orders</span></div></div>
  <div class="section-title"><h2>Your stores</h2></div>
  <a class="card row" href="#/choose-store">${st ? `${storeMark(st, 44)}<span class="grow"><span class="title">${esc(st.name)}</span><br><span class="sub">Shopping here now${s.myStores.length > 1 ? `, and ${s.myStores.length - 1} more store${s.myStores.length > 2 ? "s" : ""}` : ""}</span></span>` : `<span class="grow title">Add a store</span>`}<span style="color:var(--green);font-weight:600">Manage</span></a>
  ${p?.phone ? `<div class="card row"><span class="grow muted">Phone</span><span>${esc(p.phone)}</span></div>` : ""}
  ${s.ledger.length ? `<div class="section-title"><h2>Points history</h2></div><div class="card tight">${s.ledger.slice(0, 10).map((e) => `<div class="row"><span class="grow"><span class="title" style="font-weight:500">${esc(e.reason)}</span><br><span class="sub">${esc(shortStamp(e.created_at))}</span></span><span class="amount" style="color:var(--amber)">+${e.delta}</span></div>`).join("")}</div>` : ""}
  <div class="section-title"><h2>About</h2></div>
  <div class="card tight">
    <div class="row"><span class="grow muted">Backend</span><span>${s.api.isMock ? "Demo data in this browser" : "Live"}</span></div>
    <div class="row"><span class="grow muted">Payments</span><span>At pickup during the pilot</span></div>
    <div class="row"><span class="grow muted">iPhone app</span><a href="../#pilot">Join the pilot for TestFlight</a></div>
    <div class="row"><span class="grow muted">Legal</span><span><a href="../privacy.html">Privacy</a> · <a href="../terms.html">Terms</a> · <a href="../support.html">Support</a></span></div>
  </div>
  <button class="btn btn-secondary" data-action="sign-out">Sign out</button>`;
}

// MARK: store (staff)

function store(s) {
  const tab = s.ui.storeTab;
  const open = s.storeOrders.filter((o) => STATUS[o.status].open);
  const done = s.storeOrders.filter((o) => !STATUS[o.status].open);
  const seg = `<div class="seg">${[["orders", "Orders"], ["catalogue", "Catalogue"], ["updates", "Updates"], ["settings", "Your store"]].map(([k, l]) => `<label><input type="radio" name="storeTab" value="${k}" ${tab === k ? "checked" : ""} data-change="store-tab"><span>${l}</span></label>`).join("")}</div>`;
  if (tab === "settings") {
    const st = s.stores.find((x) => x.id === s.profile?.store_id);
    if (!st) return `${seg}${emptyState(I.store, "No store on this account", "")}`;
    const joinUrl = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}#/join/${st.slug ?? st.id}`;
    return `${seg}
    <div class="card row">${storeMark(st, 64)}<span class="grow"><span class="title" style="font-size:18px">${esc(st.name)}</span><br><span class="sub">${esc(st.tagline ?? "")}</span></span>
      <label class="btn btn-secondary" style="min-height:40px">Change logo<input type="file" accept="image/png,image/jpeg,image/webp" data-change="upload-logo" class="visually-hidden"></label></div>
    <form data-form="store" class="card stack">
      <div class="field"><label for="s-name">Store name</label><input id="s-name" name="name" data-keep value="${esc(st.name)}" required></div>
      <div class="field"><label for="s-tag">Tagline</label><input id="s-tag" name="tagline" data-keep value="${esc(st.tagline ?? "")}" placeholder="What you are known for"></div>
      <div class="grid-2">
        <div class="field"><label for="s-addr">Address</label><input id="s-addr" name="address" data-keep value="${esc(st.address ?? "")}"></div>
        <div class="field"><label for="s-phone">Phone</label><input id="s-phone" name="phone" data-keep value="${esc(st.phone ?? "")}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label for="s-city">City</label><input id="s-city" name="city" data-keep value="${esc(st.city ?? "")}"></div>
        <div class="field"><label for="s-state">State</label><input id="s-state" name="state" data-keep value="${esc(st.state ?? "")}"></div>
      </div>
      ${s.ui.error ? `<p class="error">${esc(s.ui.error)}</p>` : ""}
      <button class="btn btn-primary" type="submit" ${s.ui.busy ? "disabled" : ""}>Save</button>
    </form>
    <div class="section-title"><h2>Your QR code</h2></div>
    <div class="card" style="display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center">
      <canvas id="store-qr" data-qr="${esc(joinUrl)}" width="180" height="180" style="width:180px;height:180px;border-radius:12px;background:#fff"></canvas>
      <div>
        <p style="margin:0 0 6px">Print this and put it by the till. A customer scans it with their phone camera and your store joins their Refill Me.</p>
        <p class="muted small" style="margin:0 0 10px">Or they type the code: <b style="font-family:var(--mono);letter-spacing:.1em;color:var(--ink)">${esc(st.join_code ?? "")}</b></p>
        <div class="inline-actions"><button class="btn btn-ghost" style="min-height:40px" data-action="print-qr">Print</button><button class="btn btn-ghost" style="min-height:40px" data-action="copy-join" data-url="${esc(joinUrl)}">Copy link</button></div>
      </div>
    </div>`;
  }
  if (tab === "catalogue") {
    const list = s.products.filter((p) => p.is_active).sort((a, b) => a.name.localeCompare(b.name));
    return `${seg}<div class="section-title"><h2>${list.length} items</h2><a href="#/store/catalogue/new">${I.plus} New item</a></div>
    <div class="card tight">${list.map((p) => `<a class="row" href="#/store/catalogue/${p.id}">${productTile(s, p)}<span class="grow"><span class="title" style="font-weight:500">${esc(p.name)}</span><br><span class="sub">${esc([p.brand, p.size, money(p.price_cents)].filter(Boolean).join(", "))}</span></span><span class="pill ${p.in_stock ? "" : "pill-danger"}">${p.in_stock ? "In stock" : "Out"}</span></a>`).join("")}</div>`;
  }
  if (tab === "updates") {
    return `${seg}<div class="section-title"><h2>Posted to customers</h2><a href="#/store/updates/new">${I.plus} Post an update</a></div>
    ${s.updates.length ? `<div class="stack">${s.updates.map(updateCard).join("")}</div>` : emptyState(I.megaphone, "Nothing posted", "Tell customers about new stock or a sale.")}`;
  }
  return `${seg}
  ${!s.storeOrders.length ? emptyState(I.orders, "No orders yet", "Orders from customers' refills and baskets appear here the moment they are placed.") : ""}
  ${open.length ? `<div class="section-title"><h2>To do (${open.length})</h2></div><div class="stack">${open.map((o) => `<div class="card" style="padding:14px 16px">
      <a href="#/store/orders/${o.id}" style="color:inherit;display:flex;justify-content:space-between;gap:10px;align-items:center"><span><b>${esc(o.customer_name ?? "Customer")}</b><br><span class="muted small">Order ${o.number}, ${FULFILLMENT[o.fulfillment].toLowerCase()} ${esc(relativeDay(o.scheduled_for, true))}, ${money(o.subtotal_cents)}</span>${o.note ? `<br><i class="small">${esc(o.note)}</i>` : ""}</span><span class="status ${STATUS[o.status].tone}">${STATUS[o.status].label}</span></a>
      ${STATUS[o.status].next ? `<button class="btn btn-secondary btn-block" style="margin-top:10px" data-action="set-status" data-id="${o.id}" data-status="${STATUS[o.status].next}" ${s.ui.busy ? "disabled" : ""}>Mark ${STATUS[STATUS[o.status].next].label.toLowerCase()}</button>` : ""}
    </div>`).join("")}</div>` : ""}
  ${done.length ? `<div class="section-title"><h2>Done</h2></div><div class="card tight">${done.slice(0, 30).map((o) => orderRow(s, o, true)).join("")}</div>` : ""}`;
}

function productEditor(s, id) {
  const p = id === "new" ? null : s.products.find((x) => x.id === id);
  if (id !== "new" && !p) return emptyState(I.shop, "Item not found", "");
  return `
  <a href="#/store" class="muted small" style="display:inline-flex;align-items:center;gap:4px" data-action="store-tab-catalogue">${I.back} Catalogue</a>
  <form data-form="product" data-id="${p?.id ?? ""}" class="stack">
    <div class="field"><label for="p-name">Name</label><input id="p-name" name="name" data-keep value="${esc(p?.name ?? "")}" required></div>
    <div class="grid-2">
      <div class="field"><label for="p-brand">Brand (optional)</label><input id="p-brand" name="brand" data-keep value="${esc(p?.brand ?? "")}"></div>
      <div class="field"><label for="p-size">Size, like 5 lb (optional)</label><input id="p-size" name="size" data-keep value="${esc(p?.size ?? "")}"></div>
    </div>
    <div class="grid-2">
      <div class="field"><label for="p-price">Price in dollars</label><input id="p-price" name="price" type="number" step="0.01" min="0" inputmode="decimal" data-keep value="${p ? (p.price_cents / 100).toFixed(2) : ""}" required></div>
      <div class="field"><label for="p-cat">Category</label><select id="p-cat" name="category_id"><option value="">None</option>${[...s.categories].sort((a, b) => a.sort_order - b.sort_order).map((c) => `<option value="${c.id}" ${p?.category_id === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
    </div>
    <label class="check"><input type="checkbox" name="in_stock" ${p?.in_stock ?? true ? "checked" : ""}> In stock</label>
    ${s.ui.error ? `<p class="error">${esc(s.ui.error)}</p>` : ""}
    <button class="btn btn-primary" type="submit" ${s.ui.busy ? "disabled" : ""}>Save</button>
    ${p ? `<button class="btn btn-danger" type="button" data-action="remove-product" data-id="${p.id}">Remove from catalogue</button>` : ""}
  </form>`;
}

function updateEditor(s) {
  return `
  <a href="#/store" class="muted small" style="display:inline-flex;align-items:center;gap:4px" data-action="store-tab-updates">${I.back} Updates</a>
  <form data-form="update" class="stack">
    <div class="field"><label>Kind</label><div class="seg">${Object.entries(UPDATE_KIND).map(([k, l], i) => `<label><input type="radio" name="kind" value="${k}" ${i === 0 ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>
    <div class="field"><label for="u-title">Title</label><input id="u-title" name="title" data-keep required placeholder="Fresh ugu just arrived"></div>
    <div class="field"><label for="u-body">Details (optional)</label><textarea id="u-body" name="body" data-keep></textarea></div>
    <div class="field"><label for="u-prod">About an item (optional)</label><select id="u-prod" name="product_id"><option value="">None</option>${s.products.filter((p) => p.is_active).sort((a, b) => a.name.localeCompare(b.name)).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>
    ${s.ui.error ? `<p class="error">${esc(s.ui.error)}</p>` : ""}
    <button class="btn btn-primary" type="submit" ${s.ui.busy ? "disabled" : ""}>Post</button>
  </form>`;
}

// MARK: modals

function renderModal(s) {
  const m = s.ui.modal;
  let body = "";
  if (m.type === "add-to-refill") {
    const p = product(s, m.productId);
    const mine = s.schedules.filter((sc) => sc.store_id === p?.store_id);
    body = `<header><h2>Add ${esc(p?.name ?? "")} to</h2><button class="close" data-action="modal-close" aria-label="Close">${I.close}</button></header>
      <div class="row" style="padding:0 0 4px"><span class="grow muted">Quantity each time</span>${stepper("q", m.quantity, "modal-qty", 1)}</div>
      <div class="stack">${mine.map((sc) => `<button class="card row" style="width:100%;text-align:left" data-action="add-to-schedule" data-id="${sc.id}" ${s.ui.busy ? "disabled" : ""}><span class="grow"><span class="title">${esc(sc.name)}</span><br><span class="sub">${CADENCE[sc.cadence]}, next ${esc(relativeDay(sc.next_run_date, true))}</span></span>${I.plus}</button>`).join("")}
      <button class="btn btn-secondary" data-action="new-refill-with">Start a new refill with it</button></div>`;
  } else if (m.type === "confirm") {
    body = `<header><h2>${esc(m.title)}</h2><button class="close" data-action="modal-close" aria-label="Close">${I.close}</button></header>
      ${m.message ? `<p class="muted" style="margin:0">${esc(m.message)}</p>` : ""}
      <div class="inline-actions"><button class="btn ${m.danger ? "btn-danger" : "btn-primary"}" style="${m.danger ? "border:1px solid var(--danger)" : ""}" data-action="modal-confirm">${esc(m.confirmLabel ?? "Confirm")}</button><button class="btn btn-ghost" data-action="modal-close">Keep it</button></div>`;
  } else if (m.type === "edit-name") {
    body = `<header><h2>Your profile</h2><button class="close" data-action="modal-close" aria-label="Close">${I.close}</button></header>
      <form data-form="name" class="stack"><div class="field"><label for="n-name">Full name</label><input id="n-name" name="full_name" data-keep value="${esc(s.profile?.full_name ?? "")}" required></div>
      <div class="field"><label for="n-phone">Phone (optional, for the store to reach you about an order)</label><input id="n-phone" name="phone" type="tel" data-keep value="${esc(s.profile?.phone ?? "")}"></div>
      <button class="btn btn-primary" type="submit">Save</button></form>`;
  }
  return `<div class="modal-backdrop" data-action="modal-close"><div class="modal" role="dialog" data-stop>${body}</div></div>`;
}

function emptyState(icon, title, message) {
  return `<div class="empty">${icon}<h3>${esc(title)}</h3><p style="margin:0">${esc(message)}</p></div>`;
}
