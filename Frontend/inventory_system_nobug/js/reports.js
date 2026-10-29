// ===== Reports: tabs, summary cards, charts, movement pills, table =====
// All eight report tabs are built: Daily, Weekly, Monthly, Sales by Product, Sales by Category,
// Top-Selling, Sales Revenue and Inventory Movement.

let reportKind = "daily";
let reportPage = 1;
let moveFilter = "all";          // the pill picked on the Inventory Movement tab

/* ------------------------------------------------------------------
   DATA LAYER: the ONLY place the backend needs to connect.
   getReport(kind) must return:
   {
     stats:  { revenue, orders, items, avg,
               changes: { revenue, orders, items, avg } },   // changes = % vs the previous period, or null
     rows:   [ ... ],
     charts: { monthly:    [ { label: "Mar", value: 4200 }, ... 8 months, oldest first ],
               categories: [ { name: "Accessories", value: 9360, percent: 38 }, ... up to 4 ] }
               // "charts" is only needed for the "revenue" report
     totalRows: number   // only for "movement": how many movements exist before the pill filter
   }
   What a row holds depends on the report:
     daily / weekly / monthly : { first: "Oct 28, 2026" (or "Week of ..." / "October 2026"), second: number of orders,
                                  items, revenue, status }
     product                  : { first: product name, second: category, items, revenue, status }
     category                 : { first: category name, second: number of products in it, items, revenue, status }
     top                      : { first: product name, second: category, items, revenue }
                                (already sorted, most items sold first; the page numbers them 1, 2, 3 ...)
     revenue                  : same as daily (one row per day), status = "Received"
     movement                 : { first: "Oct 28", second: product name, movement, change, user }
                                movement = "Stock In" | "Stock Out" | "Sale" | "Purchase" | "Return" | "Adjustment" | "Damaged/Lost"
                                change   = how much the stock went up (+) or down (-), e.g. 20 or -5
                                (newest first; the page filters by the pill that is clicked)
   For now it is worked out in the browser from the Transactions page's saved list
   and the Inventory page's saved list:
   every "Out" transaction counts as a sale (orders = how many, items = quantity, revenue = price x quantity).
   When the backend is ready, replace getReport() with a call to the server
   (GET /reports/daily, /weekly, /monthly, /product, /category, /top, /revenue, /movement) that sends the same shape.
------------------------------------------------------------------ */
function readList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return [];
  }
}

function parseISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function toISO(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const KINDS = {
  daily: {
    type: "period",
    title: "Daily Sales Report",
    cols: ["Date", "Orders", "Items Sold", "Revenue", "Status"],
    key: function (d) { return toISO(d); },
    label: function (d) { return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }
  },
  weekly: {
    type: "period",
    title: "Weekly Sales Report",
    cols: ["Week", "Orders", "Items Sold", "Revenue", "Status"],
    key: function (d) {
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));     // weeks start on Monday
      return toISO(monday);
    },
    label: function (d) { return "Week of " + MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }
  },
  monthly: {
    type: "period",
    title: "Monthly Sales Report",
    cols: ["Month", "Orders", "Items Sold", "Revenue", "Status"],
    key: function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01"; },
    label: function (d) { return MONTHS_LONG[d.getMonth()] + " " + d.getFullYear(); }
  },
  product: {
    type: "product",
    title: "Sales by Product Report",
    cols: ["Product", "Category", "Items Sold", "Revenue", "Status"]
  },
  category: {
    type: "category",
    title: "Sales by Category Report",
    cols: ["Category", "#Products", "Items Sold", "Revenue", "Status"]
  },
  top: {
    type: "top",
    title: "Top-Selling Report",
    cols: ["Rank", "Products", "Category", "Items Sold", "Revenue"]
  },
  revenue: {
    type: "revenue",
    title: "Sales Revenue Report",
    cols: ["Date", "Orders", "Items Sold", "Revenue", "Status"],
    charts: true,          // shows the two chart cards instead of the summary cards
    pageSize: 7            // 7 rows per page, like your design
  },
  movement: {
    type: "movement",
    title: "Inventory Movement Report",
    cols: ["Date", "Product", "Movement", "Quantity", "User"],
    pills: true            // shows the row of movement pills above the table
  }
};

// every "Out" transaction that wasn't cancelled counts as a sale
function readSales() {
  return readList("inventory_transactions").filter(function (t) {
    return t.type === "Out" && String(t.status || "").toLowerCase() !== "cancelled" && parseISO(t.date);
  });
}

// same stock rule as the Inventory page
function stockStatusOf(stock) {
  if (stock <= 0) return "Out of Stock";
  if (stock <= 5) return "Low Stock";
  return "In Stock";
}

function capitalize(text) {
  const s = String(text || "").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Daily / Weekly / Monthly: one row per period, newest first
function groupPeriods(sales, cfg) {
  const groups = {};
  sales.forEach(function (t) {
    const k = cfg.key(parseISO(t.date));
    if (!groups[k]) groups[k] = { key: k, first: cfg.label(parseISO(k)), orders: 0, items: 0, revenue: 0, status: "Completed" };
    const qty = Number(t.quantity) || 0;
    groups[k].orders += 1;
    groups[k].items += qty;
    groups[k].revenue += (Number(t.price) || 0) * qty;
  });

  return Object.values(groups)
    .sort(function (a, b) { return a.key < b.key ? 1 : -1; })
    .map(function (g) {
      return { key: g.key, first: g.first, second: g.orders, orders: g.orders, items: g.items, revenue: g.revenue, status: g.status };
    });
}

// Sales by Product: one row per product, best revenue first
function groupProducts(sales) {
  const stockByName = {};
  readList("inventory_products").forEach(function (p) {
    stockByName[String(p.name).trim().toLowerCase()] = Number(p.stock) || 0;
  });

  const groups = {};
  sales.forEach(function (t) {
    const k = String(t.product || "").trim().toLowerCase();
    if (!groups[k]) groups[k] = { first: t.product, second: t.category, orders: 0, items: 0, revenue: 0, key: k };
    const qty = Number(t.quantity) || 0;
    groups[k].orders += 1;
    groups[k].items += qty;
    groups[k].revenue += (Number(t.price) || 0) * qty;
  });

  return Object.values(groups)
    .sort(function (a, b) { return b.revenue - a.revenue; })
    .map(function (g) {
      // Status = how that product's stock is doing right now
      const status = g.key in stockByName ? stockStatusOf(stockByName[g.key]) : "";
      return { key: g.key, first: g.first, second: g.second, orders: g.orders, items: g.items, revenue: g.revenue, status: status };
    });
}

// Sales by Category: one row per category, best revenue first.
// A category shows up as soon as it has a product in Inventory, even with no sales yet.
function groupCategories(sales) {
  const groups = {};

  function slot(name) {
    const k = String(name || "").trim().toLowerCase();
    if (!k) return null;
    if (!groups[k]) groups[k] = { key: k, first: capitalize(name), second: 0, orders: 0, items: 0, revenue: 0 };
    return groups[k];
  }

  readList("inventory_products").forEach(function (p) {
    const g = slot(p.category);
    if (g) g.second += 1;                         // number of products in the category
  });

  sales.forEach(function (t) {
    const g = slot(t.category);
    if (!g) return;
    const qty = Number(t.quantity) || 0;
    g.orders += 1;
    g.items += qty;
    g.revenue += (Number(t.price) || 0) * qty;
  });

  return Object.values(groups)
    .sort(function (a, b) { return (b.revenue - a.revenue) || a.first.localeCompare(b.first); })
    .map(function (g) {
      return {
        key: g.key, first: g.first, second: g.second, orders: g.orders, items: g.items, revenue: g.revenue,
        status: g.second > 0 ? "Active" : "Inactive"
      };
    });
}

// Top-Selling: the same products as "Sales by Product", ranked by items sold
// (ties go to the higher revenue)
function groupTop(sales) {
  return groupProducts(sales)
    .sort(function (a, b) { return (b.items - a.items) || (b.revenue - a.revenue); })
    .map(function (g) {
      return { key: g.key, first: g.first, second: capitalize(g.second), items: g.items, revenue: g.revenue, status: "" };
    });
}

// Inventory Movement: every stock change, newest first.
// A transaction can carry its own "movement" (Sale, Purchase, Return, Damaged/Lost ...).
// Without one, the Transactions page's three types are used:
//   In -> Stock In, Out -> Stock Out, Adjustment -> Adjustment.
const MOVES = ["Stock In", "Stock Out", "Sale", "Purchase", "Return", "Adjustment", "Damaged/Lost"];

function movementOf(t) {
  if (MOVES.indexOf(t.movement) !== -1) return t.movement;
  if (t.type === "In") return "Stock In";
  if (t.type === "Out") return "Stock Out";
  return "Adjustment";
}

function buildMovements() {
  const list = readList("inventory_transactions").filter(function (t) {
    return String(t.status || "").toLowerCase() !== "cancelled" && parseISO(t.date);
  });

  // Replay oldest -> newest so an Adjustment can show how much it changed the stock
  // (new products start at stock 0, and every stock change goes through a transaction).
  // A real backend just sends "change" with each transaction.
  const running = {};
  const rows = list.slice().reverse().map(function (t) {
    const name = String(t.product || "").trim().toLowerCase();
    const before = running[name] || 0;
    const qty = Number(t.quantity) || 0;
    const move = movementOf(t);

    let change;
    if (typeof t.change === "number") change = t.change;
    else if (t.type === "In") change = qty;
    else if (t.type === "Out") change = -qty;
    else if (t.type === "Adjustment") change = qty - before;
    else change = (move === "Stock In" || move === "Purchase" || move === "Return") ? qty : -qty;
    running[name] = before + change;

    const d = parseISO(t.date);
    return {
      first: MONTHS[d.getMonth()] + " " + d.getDate(),
      second: t.product,
      movement: move,
      change: change,
      user: t.user || (typeof USER !== "undefined" ? USER.firstName : "")   // USER comes from layout.js
    };
  });

  return rows.reverse();                  // newest first
}

// Sales Revenue chart 1: revenue of the last 8 months, oldest first
function buildMonthly(sales) {
  const now = new Date();
  const list = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), label: MONTHS[d.getMonth()], value: 0 });
  }
  sales.forEach(function (t) {
    const key = String(t.date).slice(0, 7);
    const slot = list.find(function (m) { return m.key === key; });
    if (slot) slot.value += (Number(t.price) || 0) * (Number(t.quantity) || 0);
  });
  return list.map(function (m) { return { label: m.label, value: m.value }; });
}

// Sales Revenue chart 2: share of revenue per category (top 3 + "Other" when there are more than 4)
function buildCategoryShare(sales) {
  const groups = {};
  sales.forEach(function (t) {
    const k = String(t.category || "").trim().toLowerCase();
    if (!k) return;
    groups[k] = groups[k] || { name: capitalize(t.category), value: 0 };
    groups[k].value += (Number(t.price) || 0) * (Number(t.quantity) || 0);
  });

  let list = Object.values(groups).sort(function (a, b) { return b.value - a.value; });
  if (list.length > 4) {
    const rest = list.slice(3).reduce(function (s, c) { return s + c.value; }, 0);
    list = list.slice(0, 3).concat([{ name: "Other", value: rest }]);
  }

  const total = list.reduce(function (s, c) { return s + c.value; }, 0);
  return total > 0
    ? list.map(function (c) { return { name: c.name, value: c.value, percent: (c.value / total) * 100 }; })
    : [];
}

function percentChange(now, before) {
  if (before == null || before === 0) return null;
  return ((now - before) / before) * 100;
}

// The four summary cards are the same on every report tab that shows them.
// Totals come from every sale; the change compares the newest day/week/month with the one before it.
function buildStats(periodRows) {
  const total = periodRows.reduce(function (s, r) {
    s.revenue += r.revenue; s.orders += r.orders; s.items += r.items;
    return s;
  }, { revenue: 0, orders: 0, items: 0 });

  const a = periodRows[0], b = periodRows[1];
  const changes = { revenue: null, orders: null, items: null, avg: null };
  if (a && b) {
    changes.revenue = percentChange(a.revenue, b.revenue);
    changes.orders = percentChange(a.orders, b.orders);
    changes.items = percentChange(a.items, b.items);
    changes.avg = percentChange(a.orders ? a.revenue / a.orders : 0, b.orders ? b.revenue / b.orders : 0);
  }

  return {
    revenue: total.revenue,
    orders: total.orders,
    items: total.items,
    avg: total.orders ? total.revenue / total.orders : 0,
    changes: changes
  };
}

function getReport(kind) {
  const cfg = KINDS[kind];
  const sales = readSales();

  if (cfg.type === "period") {
    const rows = groupPeriods(sales, cfg);
    return { stats: buildStats(rows), rows: rows };
  }

  // the other reports: the cards compare days, like the Daily Sales tab
  const days = groupPeriods(sales, KINDS.daily);
  const stats = buildStats(days);

  if (cfg.type === "revenue") {
    return {
      stats: stats,
      rows: days.map(function (r) { return Object.assign({}, r, { status: "Received" }); }),
      charts: { monthly: buildMonthly(sales), categories: buildCategoryShare(sales) }
    };
  }

  if (cfg.type === "movement") {
    const all = buildMovements();
    const rows = moveFilter === "all" ? all : all.filter(function (m) { return m.movement === moveFilter; });
    return { stats: stats, rows: rows, totalRows: all.length };
  }

  const rows = cfg.type === "product" ? groupProducts(sales)
             : cfg.type === "category" ? groupCategories(sales)
             : groupTop(sales);
  return { stats: stats, rows: rows };
}

/* ------------------------------ Display ------------------------------ */
function money(v) {
  return "$" + Math.round(v).toLocaleString("en-US");
}

function moneyShort(v) {
  if (v >= 1000000) return "$" + (v / 1000000).toFixed(2) + "M";
  if (v >= 1000) return "$" + (v / 1000).toFixed(2) + "K";
  return money(v);
}

function barLabel(v) {
  return v >= 1000 ? "$" + (v / 1000).toFixed(1) + "K" : "$" + Math.round(v);
}

function showChange(id, value) {
  const el = document.getElementById(id);
  el.className = "chg";
  if (value == null || !isFinite(value)) { el.textContent = ""; return; }
  const up = value >= 0;
  el.classList.add(up ? "up" : "down");
  el.textContent = (up ? "↑ " : "↓ ") + Math.abs(value).toFixed(1) + "%";
}

const PENCIL = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 000-1.4l-2.35-2.35a1 1 0 00-1.4 0l-1.85 1.85 3.75 3.75 1.85-1.85z"/></svg>';

// "Active" and "Received" have no color on purpose: your Figma shows them in plain dark text
const STATUS_CLASS = {
  "completed": "st-done",
  "in stock": "st-done",
  "pending": "st-pending",
  "low stock": "st-pending",
  "cancelled": "st-cancel",
  "canceled": "st-cancel",
  "out of stock": "st-cancel"
};

// badge colour for each movement type
const BADGE_CLASS = {
  "Stock In": "mv-in",
  "Purchase": "mv-in",
  "Return": "mv-in",
  "Stock Out": "mv-out",
  "Damaged/Lost": "mv-out",
  "Sale": "mv-sale",
  "Adjustment": "mv-adj"
};

function cell(text, className) {
  const s = document.createElement("span");
  if (className) s.className = className;
  s.textContent = text == null ? "" : text;
  return s;
}

function badgeCell(move) {
  const s = document.createElement("span");
  const b = document.createElement("span");
  b.className = "badge " + (BADGE_CLASS[move] || "");
  b.textContent = move;
  s.appendChild(b);
  return s;
}

function quantityCell(change, move) {
  const sign = change > 0 ? "+" : change < 0 ? "\u2212" : "";
  const cls = move === "Adjustment" ? "q-adj" : change > 0 ? "q-up" : change < 0 ? "q-down" : "";
  return cell(sign + Math.abs(change).toLocaleString("en-US"), cls);
}

function pencilCell() {
  const s = document.createElement("span");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "edit-btn";
  b.setAttribute("aria-label", "Edit row");
  b.innerHTML = PENCIL;
  s.appendChild(b);
  return s;
}

// the five cells before the pencil, for one row of data
function dataCells(cfg, r, rank) {
  const num = function (v) { return typeof v === "number" ? v.toLocaleString("en-US") : v; };

  if (cfg.type === "top") {
    // Rank, Products, Category, Items Sold, Revenue (no Status column on this report)
    return [cell(rank), cell(r.first), cell(r.second), cell(num(r.items)), cell(money(r.revenue))];
  }

  if (cfg.type === "movement") {
    // Date, Product, Movement (badge), Quantity (+ / -), User
    return [cell(r.first), cell(r.second), badgeCell(r.movement), quantityCell(r.change, r.movement), cell(r.user)];
  }

  // First, Second, Items Sold, Revenue, Status
  return [
    cell(r.first),
    cell(num(r.second)),
    cell(num(r.items)),
    cell(money(r.revenue)),
    cell(r.status, STATUS_CLASS[String(r.status || "").toLowerCase()])
  ];
}

/* ------------------------------ Charts ------------------------------ */
const DONUT_COLORS = ["#1b3f31", "#2d6a4f", "#74b99b", "#b5d8c5"];
const DONUT_START = "from 97deg";                   // where the first slice starts, like your design

function renderCharts(charts) {
  // --- Monthly Revenue: 8 columns, month names always shown, bars only when there is data ---
  const months = (charts && charts.monthly) || [];
  const max = months.reduce(function (m, x) { return Math.max(m, x.value); }, 0);
  const wrap = document.getElementById("monthBars");
  wrap.innerHTML = "";

  months.forEach(function (m) {
    const col = document.createElement("div");
    col.className = "bcol";

    const track = document.createElement("div");
    track.className = "bar-track";

    if (max > 0) {
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = (m.value / max) * 82 + "%";          // the tallest bar leaves room for its label
      const label = document.createElement("em");
      label.textContent = barLabel(m.value);
      bar.appendChild(label);
      track.appendChild(bar);
    }

    const name = document.createElement("span");
    name.textContent = m.label;

    col.append(track, name);
    wrap.appendChild(col);
  });

  // --- Revenue by Category: donut + legend ---
  const cats = (charts && charts.categories) || [];
  const donut = document.getElementById("revDonut");
  const legend = document.getElementById("revLegend");
  legend.innerHTML = "";

  const slots = cats.length ? cats : [{}, {}, {}, {}];       // no data yet: coloured ring + empty legend, like your design
  let stops;

  if (cats.length) {
    let from = 0;
    stops = cats.map(function (c, i) {
      const part = DONUT_COLORS[i] + " " + from + "% " + (from + c.percent) + "%";
      from += c.percent;
      return part;
    });
  } else {
    stops = [DONUT_COLORS[0] + " 0% 38%", DONUT_COLORS[1] + " 38% 66%", DONUT_COLORS[2] + " 66% 86%", DONUT_COLORS[3] + " 86% 100%"];
  }
  donut.style.background = "conic-gradient(" + DONUT_START + ", " + stops.join(", ") + ")";

  slots.forEach(function (c, i) {
    const li = document.createElement("li");
    const dot = document.createElement("i");
    dot.style.background = DONUT_COLORS[i];

    const box = document.createElement("div");
    const name = document.createElement("span");
    name.textContent = c.name || "";
    const pct = document.createElement("small");
    pct.textContent = c.name ? Math.round(c.percent) + "%" : "";

    box.append(name, pct);
    li.append(dot, box);
    legend.appendChild(li);
  });
}

function renderReport() {
  const cfg = KINDS[reportKind];
  const report = getReport(reportKind);
  const size = cfg.pageSize || 10;

  // Sales Revenue shows chart cards, Inventory Movement shows the pill row
  const content = document.getElementById("content");
  content.classList.toggle("mode-charts", !!cfg.charts);
  content.classList.toggle("mode-movement", !!cfg.pills);
  if (cfg.charts) renderCharts(report.charts);

  // title + column headings
  document.getElementById("reportTitle").textContent = cfg.title;
  const head = document.querySelector(".t-cols");
  head.innerHTML = "";
  cfg.cols.forEach(function (name) { head.appendChild(cell(name)); });
  head.appendChild(cell(""));                       // the pencil column

  // summary cards
  const s = report.stats;
  document.getElementById("sRevenue").textContent = moneyShort(s.revenue);
  document.getElementById("sOrders").textContent = s.orders.toLocaleString("en-US");
  document.getElementById("sItems").textContent = s.items.toLocaleString("en-US");
  document.getElementById("sAvg").textContent = money(s.avg);
  showChange("cRevenue", s.changes.revenue);
  showChange("cOrders", s.changes.orders);
  showChange("cItems", s.changes.items);
  showChange("cAvg", s.changes.avg);

  // table
  const rowsData = report.rows;
  const pages = Math.max(1, Math.ceil(rowsData.length / size));
  reportPage = Math.min(Math.max(reportPage, 1), pages);

  const start = (reportPage - 1) * size;
  const slice = rowsData.slice(start, start + size);

  // blank rows only get pencils when there is no data at all, like your design
  // (a pill with no matches is not "no data")
  const total = report.totalRows != null ? report.totalRows : rowsData.length;
  const placeholders = total === 0;

  const rows = document.getElementById("rows");
  rows.style.setProperty("--n", size);
  rows.innerHTML = "";

  for (let i = 0; i < size; i++) {
    const r = slice[i];
    const row = document.createElement("div");
    row.className = "cols";

    if (r) {
      dataCells(cfg, r, start + i + 1).forEach(function (c) { row.appendChild(c); });
      row.appendChild(pencilCell());
    } else {
      row.append(cell(""), cell(""), cell(""), cell(""), cell(""), placeholders ? pencilCell() : cell(""));
    }
    rows.appendChild(row);
  }

  document.getElementById("pageInfo").innerHTML = "Page <b>" + reportPage + "</b> of <b>" + pages + "</b>";
  document.getElementById("prevBtn").disabled = reportPage <= 1;
  document.getElementById("nextBtn").disabled = reportPage >= pages;
}

/* ------------------------------ Start ------------------------------ */
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("rpTabs").addEventListener("click", function (e) {
    const tab = e.target.closest(".rtab");
    if (!tab) return;

    const kind = tab.dataset.report;
    if (!KINDS[kind]) return;

    document.querySelectorAll(".rtab").forEach(function (t) { t.classList.toggle("active", t === tab); });
    reportKind = kind;
    reportPage = 1;
    renderReport();
  });

  // Inventory Movement pills: All, Stock In, Stock Out, Sale, Purchase, Return, Adjustment, Damaged/Lost
  document.getElementById("rpPills").addEventListener("click", function (e) {
    const pill = e.target.closest(".mpill");
    if (!pill) return;

    document.querySelectorAll(".mpill").forEach(function (p) {
      const on = p === pill;
      p.classList.toggle("active", on);
      p.setAttribute("aria-pressed", on ? "true" : "false");
    });
    moveFilter = pill.dataset.move;
    reportPage = 1;
    renderReport();
  });

  document.getElementById("prevBtn").addEventListener("click", function () { reportPage--; renderReport(); });
  document.getElementById("nextBtn").addEventListener("click", function () { reportPage++; renderReport(); });

  // Filters and the row pencils get wired in a later step.
  renderReport();
});