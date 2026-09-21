// Small helpers shared by the views. Rows keep the database's snake_case
// names; nothing is renamed on the way in or out.

export const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Days as "YYYY-MM-DD", the way Postgres date columns travel.
export function today() { return toDay(new Date()); }
export function toDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function fromDay(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
export function daysFromToday(s) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = fromDay(s); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86_400_000);
}
export function relativeDay(s, lower = false) {
  const n = daysFromToday(s);
  let out;
  if (n === 0) out = "Today";
  else if (n === 1) out = "Tomorrow";
  else if (n === -1) out = "Yesterday";
  else if (n > 1 && n <= 13) out = `In ${n} days`;
  else if (n < -1 && n >= -13) out = `${-n} days ago`;
  else return fromDay(s).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return lower ? out.toLowerCase() : out;
}
export function longDay(s) {
  return fromDay(s).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
export function addCadence(s, cadence) {
  const d = fromDay(s);
  if (cadence === "weekly") d.setDate(d.getDate() + 7);
  else if (cadence === "biweekly") d.setDate(d.getDate() + 14);
  else d.setMonth(d.getMonth() + 1);
  return toDay(d);
}
export function shortStamp(iso) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
export function ago(iso) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const STATUS = {
  pending:   { label: "Received",         next: "confirmed", tone: "amber",  open: true },
  confirmed: { label: "Confirmed",        next: "ready",     tone: "green",  open: true },
  ready:     { label: "Ready for pickup", next: "fulfilled", tone: "green",  open: true },
  fulfilled: { label: "Fulfilled",        next: null,        tone: "muted",  open: false },
  cancelled: { label: "Cancelled",        next: null,        tone: "danger", open: false },
};
export const CADENCE = { weekly: "Every week", biweekly: "Every 2 weeks", monthly: "Every month" };
export const FULFILLMENT = { pickup: "Pickup", delivery: "Delivery" };
export const UPDATE_KIND = { new_stock: "New stock", sale: "Sale", general: "Update" };

export function firstName(profile) {
  return String(profile?.full_name || "").trim().split(/\s+/)[0] || "";
}

/// Server errors arrive as JSON blobs and Postgres codes. People get a sentence.
export function readable(err) {
  const text = String(err?.message || err?.error_description || err || "");
  if (/Invalid login credentials/i.test(text)) return "That email and password do not match.";
  if (/already (been )?registered/i.test(text)) return "There is already an account for that email. Sign in instead.";
  if (/Password should be/i.test(text)) return "Use a password of at least 6 characters.";
  if (/cancelled while it is pending/i.test(text)) return "The store has already started on this order, so it cannot be cancelled here. Call the store.";
  if (/Failed to fetch|NetworkError|network/i.test(text)) return "No connection. Check the network and try again.";
  if (/Email not confirmed/i.test(text)) return "Confirm your email first, then sign in.";
  return text.length > 160 ? text.slice(0, 160) : text || "Something went wrong.";
}
