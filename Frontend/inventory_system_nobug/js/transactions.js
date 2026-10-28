// ===== Transactions: table, tabs, pagination, Add Transaction pop-up =====
// Each transaction looks like:
//   { id: "TX-482913", date: "2026-10-28", product: "Samsung S26", category: "phone",
//     price: 799, quantity: 5, type: "In", status: "Completed", stockStatus: "In Stock" }
// "stockStatus" is the product's stock level right after the transaction
// (used by the In Stock / Low Stock / Out of Stock tabs).

const TX_PAGE_SIZE = 13;
let txFilter = "all";
let txPage = 1;

/* ------------------------------------------------------------------
   DATA LAYER: the ONLY place the backend needs to connect.
   For now everything is kept in this browser's localStorage:
     "inventory_transactions"  -> this page's list
     "inventory_products"      -> the Inventory page's list (a transaction changes its stock)
   When the backend is ready, replace these functions with calls to the server:
     getTransactions()      -> GET all transactions
     getProducts()          -> GET all products
     addTransaction(data)   -> POST a transaction. The SERVER should save it AND change the
                               product's stock in one step, and send back the new transaction
                               (or an error message like the ones below).
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

// data: { type: "In" | "Out" | "Adjustment", name, category, price, quantity }
// returns { transaction } on success, or { error, field } when something is wrong
function addTransaction(data) {
  const products = getProducts();
  const wanted = data.name.trim().toLowerCase();
  const product = products.find(function (p) { return String(p.name).trim().toLowerCase() === wanted; });

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
    status: "Completed",
    stockStatus: stockStatusOf(newStock)
  };

  all.unshift(transaction);            // newest first
  writeList(TX_STORE_KEY, all);
  return { transaction: transaction };
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
  const filtered = txFilter === "all" ? all : all.filter(function (t) { return t.stockStatus === txFilter; });
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

/* ------------------------- Add Transaction pop-up ------------------------- */

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

function setupAddModal() {
  const form = document.getElementById("addForm");
  const openBtn = document.getElementById("addTransactionBtn");
  const nameInput = document.getElementById("tName");
  const categoryInput = document.getElementById("tCategory");
  const priceInput = document.getElementById("tPrice");
  const qtyInput = document.getElementById("tQty");
  const errorBox = document.getElementById("addError");
  const nameList = document.getElementById("productList");

  const inputs = [nameInput, categoryInput, priceInput, qtyInput];

  function clearErrors() {
    errorBox.textContent = "";
    inputs.forEach(function (el) { el.classList.remove("has-error"); });
  }

  function fail(message, field) {
    errorBox.textContent = message;
    field.classList.add("has-error");
    field.focus();
  }

  // picks a category in the dropdown (adds it to the list if it isn't there yet)
  function setCategory(value) {
    const wanted = String(value || "");
    const match = Array.from(categoryInput.options).find(function (o) {
      return o.value.toLowerCase() === wanted.toLowerCase();
    });
    if (match) {
      categoryInput.value = match.value;
    } else if (wanted) {
      const extra = document.createElement("option");
      extra.value = wanted;
      extra.textContent = wanted;
      categoryInput.appendChild(extra);
      categoryInput.value = wanted;
    }
  }

  // suggestions in the Product Name box come from the Inventory page
  function fillSuggestions() {
    nameList.innerHTML = "";
    getProducts().forEach(function (p) {
      const o = document.createElement("option");
      o.value = p.name;
      nameList.appendChild(o);
    });
  }

  // when the typed name matches an Inventory product, fill in its category and price
  nameInput.addEventListener("input", function () {
    const wanted = nameInput.value.trim().toLowerCase();
    if (!wanted) return;
    const product = getProducts().find(function (p) { return String(p.name).trim().toLowerCase() === wanted; });
    if (!product) return;
    setCategory(product.category);
    if (product.price != null) priceInput.value = String(product.price);
  });

  const modal = createModal(document.getElementById("addModal"), nameInput, function () {
    form.reset();                // also puts Type back to "In"
    clearErrors();
    openBtn.focus();
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();

    const type = form.querySelector('input[name="type"]:checked').value;
    const name = nameInput.value.trim();
    const category = categoryInput.value;
    const priceText = priceInput.value.trim().replace(/,/g, "");
    const price = Number(priceText);
    const qtyText = qtyInput.value.trim();
    const qty = Number(qtyText);

    if (!name) return fail("Please enter the product name.", nameInput);
    if (!category) return fail("Please select a category.", categoryInput);
    if (priceText === "" || !isFinite(price) || price < 0) {
      return fail("Please enter a valid price, like 799 or 49.99.", priceInput);
    }

    const minQty = type === "Adjustment" ? 0 : 1;
    if (qtyText === "" || !Number.isInteger(qty) || qty < minQty) {
      return fail(
        type === "Adjustment" ? "Please enter the new stock level (0 or more)." : "Please enter a quantity of 1 or more.",
        qtyInput
      );
    }

    const result = addTransaction({ type: type, name: name, category: category, price: price, quantity: qty });

    if (result.error) {
      const target = { name: nameInput, category: categoryInput, quantity: qtyInput }[result.field] || nameInput;
      return fail(result.error, target);
    }

    // show the newest transaction: it is at the top of the "All" tab
    showTxTab("all");
    txPage = 1;
    renderTransactions();
    modal.close();
  });

  openBtn.addEventListener("click", function () {
    clearErrors();
    fillSuggestions();
    modal.open();
  });
  document.getElementById("discardBtn").addEventListener("click", modal.close);
}

/* ------------------------------ Start ------------------------------ */
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("tabs").addEventListener("click", function (e) {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    showTxTab(tab.dataset.filter);
    txPage = 1;
    renderTransactions();
  });

  document.getElementById("prevBtn").addEventListener("click", function () { txPage--; renderTransactions(); });
  document.getElementById("nextBtn").addEventListener("click", function () { txPage++; renderTransactions(); });

  setupAddModal();

  // The edit pencils and Filters get their pop-ups in the next steps.
  renderTransactions();
});