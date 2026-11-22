// ===== Inventory: table, tabs, pagination, Add + Edit Product pop-ups =====
// Each product looks like:
//   { id: "123456", name: "Samsung S26", image: "https://.../s26.jpg", price: 799, stock: 12, category: "phone", status: "In Stock" }
// "image" and "status" are optional. Status is worked out from stock if it's missing.

const PAGE_SIZE = 13;
let currentFilter = "all";
let currentPage = 1;

/* ------------------------------ API data layer ------------------------------ */
function getProducts() { return InventoryAPI.products(); }
async function addProduct(data) { return InventoryAPI.createProduct(data); }
async function updateProduct(id, data) { return InventoryAPI.updateProduct(id, data); }

/* ------------------------------ Table ------------------------------ */
function statusOf(p) {
  if (p.status) return p.status;
  if (p.stock <= 0) return "Out of Stock";
  if (p.stock <= 5) return "Low Stock";
  return "In Stock";
}

const STATUS_CLASS = { "In Stock": "st-in", "Low Stock": "st-low", "Out of Stock": "st-out" };

const PENCIL = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25zm17.7-10.2a1 1 0 000-1.4l-2.35-2.35a1 1 0 00-1.4 0l-1.85 1.85 3.75 3.75 1.85-1.85z"/></svg>';

function cell(text, className) {
  const s = document.createElement("span");
  if (className) s.className = className;
  s.textContent = text == null ? "" : text;
  return s;
}

function nameCell(p) {
  const s = document.createElement("span");
  s.className = "p-name";
  if (p.image) {
    const thumb = document.createElement("span");
    thumb.className = "p-thumb";
    const img = document.createElement("img");
    img.src = p.image;
    img.alt = p.name || "";
    img.loading = "lazy";
    img.addEventListener("error", function () { img.remove(); });   // broken link: grey box stays
    thumb.appendChild(img);
    s.appendChild(thumb);
  }
  s.appendChild(document.createTextNode(p.name || ""));
  return s;
}

function editCell(id) {
  const s = document.createElement("span");
  const edit = document.createElement("button");
  edit.type = "button"; edit.className = "edit-btn";
  edit.setAttribute("aria-label", "Edit product");
  if (id != null) edit.dataset.id = id;
  edit.innerHTML = PENCIL;
  s.appendChild(edit);
  if (id != null) {
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "edit-btn delete-btn";
    remove.setAttribute("aria-label", "Delete product");
    remove.dataset.id = id;
    remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>';
    remove.style.marginLeft = "0.35rem";
    remove.style.color = "#b42318";
    s.appendChild(remove);
  }
  return s;
}

function render() {
  const all = getProducts();
  const filtered = currentFilter === "all" ? all : all.filter(function (p) { return statusOf(p) === currentFilter; });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(Math.max(currentPage, 1), pages);

  const slice = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const placeholders = all.length === 0;          // no data yet: show your design's empty rows

  const rows = document.getElementById("rows");
  rows.innerHTML = "";

  for (let i = 0; i < PAGE_SIZE; i++) {
    const p = slice[i];
    const row = document.createElement("div");
    row.className = "cols";

    if (p) {
      const st = statusOf(p);
      row.append(
        nameCell(p),
        cell(p.id),
        cell(p.price != null ? "$" + Number(p.price).toLocaleString() : ""),
        cell(p.stock),
        cell(p.category),
        cell(st, STATUS_CLASS[st]),
        editCell(p.id)
      );
    } else {
      row.append(cell(""), cell(""), cell(""), cell(""), cell(""), cell(""),
                 placeholders ? editCell(null) : cell(""));
    }
    rows.appendChild(row);
  }

  document.getElementById("pageInfo").innerHTML = "Page <b>" + currentPage + "</b> of <b>" + pages + "</b>";
  document.getElementById("prevBtn").disabled = currentPage <= 1;
  document.getElementById("nextBtn").disabled = currentPage >= pages;
}

function showTab(filter) {
  currentFilter = filter;
  document.querySelectorAll(".tab").forEach(function (t) {
    t.classList.toggle("active", t.dataset.filter === filter);
  });
}

/* ---------------- Shared helpers for both pop-ups ---------------- */

// Opens/closes a pop-up with the fade + slide animation.
// Discard is the ONLY way to leave without saving (like the dashboard pop-up).
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

// Reads + checks the Name / Category / Price fields of a form.
// Returns { name, category, price } or null (after showing the red message).
function createProductForm(els) {
  function clearErrors() {
    els.error.hidden = true;
    els.error.textContent = "";
    [els.name, els.category, els.price].forEach(function (el) { el.classList.remove("has-error"); });
  }

  function fail(message, field) {
    els.error.textContent = message;
    els.error.hidden = false;
    field.classList.add("has-error");
    field.focus();
    return null;
  }

  function read() {
    clearErrors();

    const name = els.name.value.trim();
    const category = els.category.value;
    const priceText = els.price.value.trim().replace(/,/g, "");
    const price = Number(priceText);

    if (!name) return fail("Please enter the product name.", els.name);
    if (!category) return fail("Please select a category.", els.category);
    if (priceText === "" || !isFinite(price) || price < 0) {
      return fail("Please enter a valid price, like 799 or 49.99.", els.price);
    }
    return { name: name, category: category, price: price };
  }

  return { clearErrors: clearErrors, read: read };
}

/* ------------------------- Add Product pop-up ------------------------- */
function setupAddModal() {
  const form = document.getElementById("addForm");
  const openBtn = document.getElementById("addProductBtn");

  const fields = createProductForm({
    name: document.getElementById("pName"),
    category: document.getElementById("pCategory"),
    price: document.getElementById("pPrice"),
    error: document.getElementById("addError")
  });

  const modal = createModal(document.getElementById("addModal"), document.getElementById("pName"), function () {
    form.reset();
    fields.clearErrors();
    openBtn.focus();
  });

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const data = fields.read();
    if (!data) return;
    try { await addProduct(data); } catch (error) { return fields.readError ? fields.readError(error.message) : alert(error.message); }

    // jump to the last page of "All" so the new product is visible
    showTab("all");
    currentPage = Number.MAX_SAFE_INTEGER;   // render() trims this to the last page
    render();
    modal.close();
  });

  openBtn.addEventListener("click", function () {
    fields.clearErrors();
    modal.open();
  });
  document.getElementById("discardBtn").addEventListener("click", modal.close);
}

/* ------------------------- Edit Product pop-up ------------------------- */
function setupEditModal() {
  const form = document.getElementById("editForm");
  const nameInput = document.getElementById("eName");
  const categoryInput = document.getElementById("eCategory");
  const priceInput = document.getElementById("ePrice");
  let editingId = null;

  const fields = createProductForm({
    name: nameInput,
    category: categoryInput,
    price: priceInput,
    error: document.getElementById("editError")
  });

  const modal = createModal(document.getElementById("editModal"), nameInput, function () {
    form.reset();
    fields.clearErrors();

    // hand focus back to the pencil that opened it
    const pencil = document.querySelector('.edit-btn[data-id="' + editingId + '"]');
    if (pencil) pencil.focus();
    editingId = null;
  });

  function openFor(id) {
    const product = getProducts().find(function (p) { return p.id === id; });
    if (!product) return;

    editingId = id;
    fields.clearErrors();

    nameInput.value = product.name || "";
    priceInput.value = product.price != null ? String(product.price) : "";

    // pick the product's category; if it isn't in the list yet, add it so nothing is lost
    const wanted = String(product.category || "");
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
    } else {
      categoryInput.value = "";
    }

    modal.open();
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const data = fields.read();
    if (!data) return;
    try {
      await updateProduct(editingId, data);
      render();
      modal.close();
    } catch (error) { alert(error.message); }
  });

  document.getElementById("editDiscardBtn").addEventListener("click", modal.close);

  // one listener for every pencil (rows are rebuilt on each render)
  document.getElementById("rows").addEventListener("click", async function (e) {
    const btn = e.target.closest(".edit-btn");
    if (!btn || !btn.dataset.id) return;
    if (btn.classList.contains("delete-btn")) {
      const product = getProducts().find(p => p.id === btn.dataset.id);
      if (!product || !confirm(`Delete ${product.name}? This cannot be undone.`)) return;
      try {
        await InventoryAPI.deleteProduct(btn.dataset.id);
        render();
      } catch (error) { alert(error.message); }
      return;
    }
    openFor(btn.dataset.id);
  });
}

/* ------------------------------ Start ------------------------------ */
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("tabs").addEventListener("click", function (e) {
    const tab = e.target.closest(".tab");
    if (!tab) return;
    showTab(tab.dataset.filter);
    currentPage = 1;
    render();
  });

  document.getElementById("prevBtn").addEventListener("click", function () { currentPage--; render(); });
  document.getElementById("nextBtn").addEventListener("click", function () { currentPage++; render(); });

  setupAddModal();
  setupEditModal();

  // Filters gets its pop-up in the next step.
  InventoryAPI.refreshProducts().then(render).catch(error => alert("Could not load inventory: " + error.message));
});