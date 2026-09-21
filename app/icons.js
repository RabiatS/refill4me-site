// Inline SVG icons, stroke based, sized by CSS.
const w = (paths, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${paths}</svg>`;
export const I = {
  home: w('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>'),
  shop: w('<path d="M5 8h14l-1 12H6z"/><path d="M9 8a3 3 0 0 1 6 0"/>'),
  refill: w('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>'),
  orders: w('<path d="m3 7 9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>'),
  you: w('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  store: w('<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 11v10h14V11"/><path d="M10 21v-6h4v6"/>'),
  plus: w('<path d="M12 5v14M5 12h14"/>'),
  minus: w('<path d="M5 12h14"/>'),
  trash: w('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  check: w('<path d="m5 12 4 4L19 6"/>', 'stroke-width="3"'),
  close: w('<path d="M6 6l12 12M18 6 6 18"/>'),
  search: w('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  star: w('<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'),
  clock: w('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  bag: w('<path d="M6 8h12l1 13H5z"/><path d="M9 8a3 3 0 0 1 6 0"/>'),
  seal: w('<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>'),
  x: w('<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>'),
  tag: w('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>'),
  spark: w('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>'),
  megaphone: w('<path d="M3 11v2a2 2 0 0 0 2 2h1l4 4V5L6 9H5a2 2 0 0 0-2 2z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>'),
  chevron: w('<path d="m9 6 6 6-6 6"/>'),
  down: w('<path d="m6 9 6 6 6-6"/>'),
  basket: w('<path d="M4 10h16l-1.5 9h-13z"/><path d="m8 10 3-6M16 10l-3-6"/>'),
  alert: w('<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>'),
  pencil: w('<path d="M4 20h4l10-10-4-4L4 16z"/><path d="m13 7 4 4"/>'),
  pause: w('<path d="M8 5v14M16 5v14"/>'),
  play: w('<path d="m7 5 12 7-12 7z"/>'),
  back: w('<path d="m15 6-6 6 6 6"/>'),
  leaf: w('<path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z"/><path d="M5 19c4-4 6-6 10-8"/>'),
  card: w('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>'),
  calendar: w('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
};
// Category symbols from the database are SF Symbol names; map the ones the
// pilot uses to an icon here and fall back to a basket.
export function categoryIcon(symbol) {
  const map = { "shippingbox.fill": I.orders, "bag.fill": I.bag, "drop.fill": w('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
    "flame.fill": w('<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-3-9-2 1-3 3-3 5-1-2-3-3-3-6-3 2-5 6-5 10a7 7 0 0 0 7 7z"/>'),
    "fish.fill": w('<path d="M2 12s4-6 10-6 8 6 8 6-2 6-8 6-10-6-10-6z"/><path d="m20 12 3-3v6z"/><circle cx="8" cy="11" r="1"/>'),
    "carrot.fill": w('<path d="m3 21 9-9"/><path d="M12 12c2-2 6-2 8 0-2 4-6 8-11 9 1-5 5-9 9-11"/><path d="M15 6c1-2 3-3 5-3"/>'),
    "snowflake": w('<path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/>'),
    "cup.and.saucer.fill": w('<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9h2a2 2 0 0 1 0 4h-2M3 21h16"/>'),
    "birthday.cake.fill": w('<path d="M4 20h16v-7H4z"/><path d="M4 16c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2"/><path d="M12 9V6M9 13V9M15 13V9"/>'),
    "house.fill": I.home };
  return map[symbol] ?? I.basket;
}
