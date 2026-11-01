// ===== Transactions: table, tabs, pagination, Filters, Add + Edit Transaction pop-ups =====
// Each transaction looks like:
//   { id: "TX-482913", date: "2026-10-28", product: "Samsung S26", category: "phone",
//     price: 799, quantity: 5, type: "In", change: 5, status: "Completed", stockStatus: "In Stock" }
// "change" is how much the product's stock went up (+) or down (-) because of this transaction.
// "stockStatus" is the product's stock level right after the transaction
// (used by the In Stock / Low Stock / Out of Stock tabs).

const TX_PAGE_SIZE = 13;
let txFilter = "all";            // the tab: all / In Stock / Low Stock / Out of Stock
let txPage = 1;
let txFilters = {};              // what was chosen in the Filters pop-up: { from, to, type, status, category }

/* ------------------------------------------------------------------
   DATA LAYER: the ONLY place the backend needs to connect.
   For now everything is kept in this browser's localStorage:
     "inventory_transactions"  -> this page's list
     "inventory_products"      -> the Inventory page's list (a transaction changes its stock)
   When the backend is ready, replace these functions with calls to the server:
     getTransactions()            -> GET all transactions (the Filters can be sent as ?from=&to=&type=&status=&category=)
     getProducts()                -> GET all products
     addTransaction(data)         -> POST a transaction
     updateTransaction(id, data)  -> PUT/PATCH a transaction
   For both add and update, the SERVER should save the transaction AND fix the product's stock
   in one step, then send back the transaction (or an error message like the ones below).
   Updating = undo the old transaction's effect on stock, then apply the corrected one.
------------------------------------------------------------------ */
const TX_STORE_KEY = "inventory_transactions";
const PRODUCTS_KEY = "inventory_products";

function readList(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return [];
  }
}

function writeList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
}

function getTransactions() { return readList(TX_STORE_KEY); }
function getProducts() { return readList(PRODUCTS_KEY); }

function productByName(products, name) {
  const wanted = String(name || "").trim().toLowerCase();
  return products.find(function (p) { return String(p.name).trim().toLowerCase() === wanted; });
}

function capitalize(text) {
  const s = String(text || "").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// same rule as the Inventory page
function stockStatusOf(stock) {
  if (stock <= 0) return "Out of Stock";
  if (stock <= 5) return "Low Stock";
  return "In Stock";
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// how much one transaction changed its product's stock.
// Newer transactions store it; for older ones it is worked out by replaying the history
// (list is newest first; new products start at stock 0 and only transactions change stock).
function changeFor(list, id) {
  const running = {};
  for (let i = list.length - 1; i >= 0; i--) {
    const t = list[i];
    const key = String(t.product || "").trim().toLowerCase();
    const before = running[key] || 0;
    const qty = Number(t.quantity) || 0;

    let change;
    if (typeof t.change === "number") change = t.change;
    else if (t.type === "In") change = qty;
    else if (t.type === "Out") change = -qty;
    else change = qty - before;                 // Adjustment: the quantity is the corrected stock level
    running[key] = before + change;

    if (t.id === id) return change;
  }
  return 0;
}

// data: { type: "In" | "Out" | "Adjustment", name, category, price, quantity }
// returns { transaction } on success, or { error, field } when something is wrong
function addTransaction(data) {
  const products = getProducts();
  const product = productByName(products, data.name);

  if (!product) {
    return { error: "That product isn't in Inventory yet. Add it there first.", field: "name" };
  }
  if (String(product.category).toLowerCase() !== String(data.category).toLowerCase()) {
    return { error: product.name + " is in the " + product.category + " category.", field: "category" };
  }

  const current = Number(product.stock) || 0;
  let newStock;

  if (data.type === "In") {
    newStock = current + data.quantity;
  } else if (data.type === "Out") {
    if (data.quantity > current) {
      return { error: "Only " + current + " in stock, so you can't take out " + data.quantity + ".", field: "quantity" };
    }
    newStock = current - data.quantity;
  } else {
    newStock = data.quantity;          // Adjustment: the quantity is the corrected stock level
  }

  product.stock = newStock;
  writeList(PRODUCTS_KEY, products);

  // the backend will generate the real ID; this makes a unique one for now
  const all = getTransactions();
  let id;
  do {
    id = "TX-" + String(Math.floor(100000 + Math.random() * 900000));
  } while (all.some(function (t) { return t.id === id; }));

  const transaction = {
    id: id,
    date: todayISO(),
    product: product.name,
    category: product.category,
    price: data.price,
    quantity: data.quantity,
    type: data.type,
    change: newStock - current,
    status: "Completed",
    stockStatus: stockStatusOf(newStock)
  };

  all.unshift(transaction);            // newest first
  writeList(TX_STORE_KEY, all);
  return { transaction: transaction };
}

// Edit a transaction: undo its old effect on stock, then apply the corrected one.
// Nothing is saved unless every product ends up with 0 or more in stock.
// The ID, date and status stay as they were.
function updateTransaction(id, data) {
  const all = getTransactions();
  const index = all.findIndex(function (t) { return t.id === id; });
  if (index === -1) return { error: "That transaction could not be found.", field: "name" };
  const old = all[index];

  const products = getProducts();
  const target = productByName(products, data.name);

  if (!target) {
    return { error: "That product isn't in Inventory yet. Add it there first.", field: "name" };
  }
  if (String(target.category).toLowerCase() !== String(data.category).toLowerCase()) {
    return { error: target.name + " is in the " + target.category + " category.", field: "category" };
  }

  // 1) undo the old transaction
  const oldProduct = productByName(products, old.product);
  if (oldProduct) oldProduct.stock = (Number(oldProduct.stock) || 0) - changeFor(all, id);

  // 2) apply the corrected one
  const current = Number(target.stock) || 0;       // already undone when it is the same product
  let newStock;
  if (data.type === "In") newStock = current + data.quantity;
  else if (data.type === "Out") newStock = current - data.quantity;
  else newStock = data.quantity;

  // 3) nothing may end up below zero
  if (newStock < 0) {
    return { error: "That would leave " + target.name + " with " + newStock + " in stock, which isn't possible.", field: "quantity" };
  }
  if (oldProduct && oldProduct !== target && oldProduct.stock < 0) {
    return { error: "Undoing the old transaction would leave " + oldProduct.name + " below zero stock.", field: "name" };
  }

  target.stock = newStock;

  all[index] = Object.assign({}, old, {
    product: target.name,
    category: target.category,
    price: data.price,
    quantity: data.quantity,
    type: data.type,
    change: newStock - current,
    stockStatus: stockStatusOf(newStock)
  });

  writeList(PRODUCTS_KEY, products);
  writeList(TX_STORE_KEY, all);
  return { transaction: all[index] };
}

/* ------------------------------ Filters ------------------------------ */
// narrows the list by what was chosen in the Filters pop-up
function applyTxFilters(list) {
  const f = txFilters;
  return list.filter(function (t) {
    if (f.from && String(t.date) < f.from) return false;
    if (f.to && String(t.date) > f.to) return false;
    if (f.type && t.type !== f.type) return false;
    if (f.status && String(t.status || "").toLowerCase() !== f.status.toLowerCase()) return false;
    if (f.category && String(t.category || "").trim().toLowerCase() !== f.category) return false;
    return true;
  });
}

// the Filters button shows how many filters are on
function updateFiltersButton() {
  const count = Object.keys(txFilters).length;
  const btn = document.getElementById("filtersBtn");
  const badge = document.getElementById("fCount");
  btn.classList.toggle("on", count > 0);
  badge.hidden = count === 0;
  badge.textContent = count;
}

/* ------------------------------ Table ------------------------------ */
const TX_STATUS_CLASS = {
  "completed": "st-done",
  "pending": "st-pending",
  "cancelled": "st-cancel",
  "canceled": "st-cancel"
};

const TX_PENCIL = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 000-1.4l-2.35-2.35a1 1 0 00-1.4 0l-1.85 1.85 3.75 3.75 1.85-1.85z"/></svg>';

function formatDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return value;
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function txCell(text, className) {
  const s = document.createElement("span");
  if (className) s.className = className;
  s.textContent = text == null ? "" : text;
  return s;
}

function txEditCell(id) {
  const s = document.createElement("span");
  const b = document.createElement("button");
  b.type = "button";
  b.className = "edit-btn";
  b.setAttribute("aria-label", "Edit transaction");
  if (id != null) b.dataset.id = id;
  b.innerHTML = TX_PENCIL;
  s.appendChild(b);
  return s;
}

function renderTransactions() {
  const all = getTransactions();
  const narrowed = applyTxFilters(all);
  const filtered = txFilter === "all" ? narrowed : narrowed.filter(function (t) { return t.stockStatus === txFilter; });
  updateFiltersButton();

  const pages = Math.max(1, Math.ceil(filtered.length / TX_PAGE_SIZE));
  txPage = Math.min(Math.max(txPage, 1), pages);

  const slice = filtered.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE);
  const placeholders = all.length === 0;          // no data yet: show your design's empty rows

  const rows = document.getElementById("rows");
  rows.innerHTML = "";

  for (let i = 0; i < TX_PAGE_SIZE; i++) {
    const t = slice[i];
    const row = document.createElement("div");
    row.className = "cols";

    if (t) {
      const cls = TX_STATUS_CLASS[String(t.status || "").toLowerCase()];
      row.append(
        txCell(t.id),
        txCell(formatDate(t.date)),
        txCell(t.product),
        txCell(t.category),
        txCell(t.quantity),
        txCell(t.type),
        txCell(t.status, cls),
        txEditCell(t.id)
      );
    } else {
      row.append(txCell(""), txCell(""), txCell(""), txCell(""), txCell(""), txCell(""), txCell(""),
                 placeholders ? txEditCell(null) : txCell(""));
    }
    rows.appendChild(row);
  }

  document.getElementById("pageInfo").innerHTML = "Page <b>" + txPage + "</b> of <b>" + pages + "</b>";
  document.getElementById("prevBtn").disabled = txPage <= 1;
  document.getElementById("nextBtn").disabled = txPage >= pages;
}

function showTxTab(filter) {
  txFilter = filter;
  document.querySelectorAll(".tab").forEach(function (t) {
    t.classList.toggle("active", t.dataset.filter === filter);
  });
}

/* ---------------- Shared helpers for the pop-ups ---------------- */
function byId(id) { return document.getElementById(id); }

// Opens/closes a pop-up with the fade + slide animation.
// Discard is the ONLY way to leave without saving (like the other pop-ups).
function createModal(modal, firstField, onClosed) {
  const CLOSE_MS = 200;          // must match the closing animation time in components.css
  let timer = null;

  function open() {
    clearTimeout(timer);
    modal.classList.remove("is-closing");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");

    // restart the opening animation every time
    modal.classList.remove("is-opening");
    void modal.offsetWidth;
    modal.classList.add("is-opening");

    firstField.focus();
  }

  function close() {
    if (modal.hidden || modal.classList.contains("is-closing")) return;

    modal.classList.remove("is-opening");
    modal.classList.add("is-closing");

    timer = setTimeout(function () {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-closing");
      if (onClosed) onClosed();
    }, CLOSE_MS);
  }

  return { open: open, close: close };
}

// suggestions in the Product Name boxes come from the Inventory page
function fillSuggestions() {
  const list = byId("productList");
  list.innerHTML = "";
  getProducts().forEach(function (p) {
    const o = document.createElement("option");
    o.value = p.name;
    list.appendChild(o);
  });
}

// Reads + checks the Type / Product / Category / Price / Quantity fields of the Add or Edit form.
// read() returns { type, name, category, price, quantity } or null (after showing the red message).
function setupFields(els) {
  const inputs = [els.name, els.category, els.price, els.qty];

  function clearErrors() {
    els.error.textContent = "";
    inputs.forEach(function (el) { el.classList.remove("has-error"); });
  }

  function fail(message, field) {
    els.error.textContent = message;
    field.classList.add("has-error");
    field.focus();
    return null;
  }

  // picks a category in the dropdown (adds it to the list if it isn't there yet)
  function setCategory(value) {
    const wanted = String(value || "");
    const match = Array.from(els.category.options).find(function (o) {
      return o.value.toLowerCase() === wanted.toLowerCase();
    });
    if (match) {
      els.category.value = match.value;
    } else if (wanted) {
      const extra = document.createElement("option");
      extra.value = wanted;
      extra.textContent = wanted;
      els.category.appendChild(extra);
      els.category.value = wanted;
    }
  }

  // when the typed name matches an Inventory product, fill in its category and price
  els.name.addEventListener("input", function () {
    const product = productByName(getProducts(), els.name.value);
    if (!product) return;
    setCategory(product.category);
    if (product.price != null) els.price.value = String(product.price);
  });

  function read() {
    clearErrors();

    const typeEl = els.form.querySelector('input[type="radio"]:checked');
    const type = typeEl ? typeEl.value : "In";
    const name = els.name.value.trim();
    const category = els.category.value;
    const priceText = els.price.value.trim().replace(/,/g, "");
    const price = Number(priceText);
    const qtyText = els.qty.value.trim();
    const qty = Number(qtyText);

    if (!name) return fail("Please enter the product name.", els.name);
    if (!category) return fail("Please select a category.", els.category);
    if (priceText === "" || !isFinite(price) || price < 0) {
      return fail("Please enter a valid price, like 799 or 49.99.", els.price);
    }

    const minQty = type === "Adjustment" ? 0 : 1;
    if (qtyText === "" || !Number.isInteger(qty) || qty < minQty) {
      return fail(
        type === "Adjustment" ? "Please enter the new stock level (0 or more)." : "Please enter a quantity of 1 or more.",
        els.qty
      );
    }

    return { type: type, name: name, category: category, price: price, quantity: qty };
  }

  // shows a message the data layer sent back, on the field it belongs to
  function showResultError(result) {
    const target = { name: els.name, category: els.category, quantity: els.qty }[result.field] || els.name;
    return fail(result.error, target);
  }

  return { clearErrors: clearErrors, read: read, setCategory: setCategory, showResultError: showResultError };
}

/* ------------------------- Add Transaction pop-up ------------------------- */
function setupAddModal() {
  const form = byId("addForm");
  const openBtn = byId("addTransactionBtn");
  const nameInput = byId("tName");

  const fields = setupFields({
    form: form,
    name: nameInput,
    category: byId("tCategory"),
    price: byId("tPrice"),
    qty: byId("tQty"),
    error: byId("addError")
  });

  const modal = createModal(byId("addModal"), nameInput, function () {
    form.reset();                // also puts Type back to "In"
    fields.clearErrors();
    openBtn.focus();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const data = fields.read();
    if (!data) return;

    const result = addTransaction(data);
    if (result.error) return fields.showResultError(result);

    // show the newest transaction: it is at the top of the "All" tab
    showTxTab("all");
    txPage = 1;
    renderTransactions();
    modal.close();
  });

  openBtn.addEventListener("click", function () {
    fields.clearErrors();
    fillSuggestions();
    modal.open();
  });
  byId("discardBtn").addEventListener("click", modal.close);
}

/* ------------------------- Edit Transaction pop-up ------------------------- */
function setupEditModal() {
  const form = byId("editForm");
  const nameInput = byId("eName");
  const priceInput = byId("ePrice");
  const qtyInput = byId("eQty");
  let editingId = null;

  const fields = setupFields({
    form: form,
    name: nameInput,
    category: byId("eCategory"),
    price: priceInput,
    qty: qtyInput,
    error: byId("editError")
  });

  const modal = createModal(byId("editModal"), nameInput, function () {
    form.reset();
    fields.clearErrors();

    // hand focus back to the pencil that opened it
    const pencil = document.querySelector('.edit-btn[data-id="' + editingId + '"]');
    if (pencil) pencil.focus();
    editingId = null;
  });

  function openFor(id) {
    const t = getTransactions().find(function (x) { return x.id === id; });
    if (!t) return;

    editingId = id;
    fields.clearErrors();
    fillSuggestions();

    const radio = form.querySelector('input[name="etype"][value="' + t.type + '"]') ||
                  form.querySelector('input[name="etype"][value="In"]');
    radio.checked = true;

    nameInput.value = t.product || "";
    fields.setCategory(t.category);
    priceInput.value = t.price != null ? String(t.price) : "";
    qtyInput.value = t.quantity != null ? String(t.quantity) : "";

    modal.open();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const data = fields.read();
    if (!data) return;

    const result = updateTransaction(editingId, data);
    if (result.error) return fields.showResultError(result);

    renderTransactions();        // stays on the same page and tab, the row updates in place
    modal.close();
  });

  byId("editDiscardBtn").addEventListener("click", modal.close);

  // one listener for every pencil (rows are rebuilt on each render)
  byId("rows").addEventListener("click", function (e) {
    const btn = e.target.closest(".edit-btn");
    if (!btn || !btn.dataset.id) return;     // empty placeholder rows have no transaction
    openFor(btn.dataset.id);
  });
}

/* ------------------------------ Filters pop-up ------------------------------ */
function setupFilterModal() {
  const openBtn = byId("filtersBtn");
  const form = byId("filterForm");
  const from = byId("fFrom");
  const to = byId("fTo");
  const type = byId("fType");
  const status = byId("fStatus");
  const category = byId("fCategory");
  const error = byId("filterError");
  const all = [from, to, type, status, category];

  // an empty dropdown / date looks like a placeholder
  function syncEmpty(el) { el.classList.toggle("is-empty", !el.value); }
  all.forEach(function (el) {
    el.addEventListener("input", function () { syncEmpty(el); });
    el.addEventListener("change", function () { syncEmpty(el); });
  });

  function clearErrors() {
    error.textContent = "";
    all.forEach(function (el) { el.classList.remove("has-error"); });
  }

  function fail(message, field) {
    error.textContent = message;
    field.classList.add("has-error");
    field.focus();
  }

  // category choices come from what exists on your Inventory and Transactions pages
  function fillCategories() {
    const seen = {};
    getProducts().concat(getTransactions()).forEach(function (p) {
      const k = String(p.category || "").trim().toLowerCase();
      if (k && !seen[k]) seen[k] = capitalize(p.category);
    });

    category.innerHTML = "";
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "All categories";
    category.appendChild(first);

    Object.keys(seen).sort().forEach(function (k) {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = seen[k];
      category.appendChild(o);
    });
  }

  const modal = createModal(byId("filterModal"), from, function () {
    openBtn.focus();
  });

  openBtn.addEventListener("click", function () {
    fillCategories();
    from.value = txFilters.from || "";
    to.value = txFilters.to || "";
    type.value = txFilters.type || "";
    status.value = txFilters.status || "";
    category.value = txFilters.category || "";
    all.forEach(syncEmpty);
    clearErrors();
    modal.open();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();

    if (from.value && to.value && from.value > to.value) {
      return fail("The start date must be before the end date.", to);
    }

    const chosen = {};
    if (from.value) chosen.from = from.value;
    if (to.value) chosen.to = to.value;
    if (type.value) chosen.type = type.value;
    if (status.value) chosen.status = status.value;
    if (category.value) chosen.category = category.value;

    txFilters = chosen;
    txPage = 1;
    renderTransactions();
    modal.close();
  });

  byId("fClear").addEventListener("click", function () {
    all.forEach(function (el) { el.value = ""; syncEmpty(el); });
    clearErrors();
  });
  byId("filterDiscardBtn").addEventListener("click", modal.close);
}

/* ------------------------------ Start ------------------------------ */
document.addEventListener("DOMContentLoaded", function () {
  byId("tabs").addEventListener("click", function (e) {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    showTxTab(tab.dataset.filter);
    txPage = 1;
    renderTransactions();
  });

  byId("prevBtn").addEventListener("click", function () { txPage--; renderTransactions(); });
  byId("nextBtn").addEventListener("click", function () { txPage++; renderTransactions(); });

  setupAddModal();
  setupEditModal();
  setupFilterModal();

  renderTransactions();
});