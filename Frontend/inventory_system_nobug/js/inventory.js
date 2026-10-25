// ===== Inventory: table, tabs, pagination, Add Product pop-up =====
// Each product looks like:
//   { id: "123456", name: "Samsung S26", image: "https://.../s26.jpg", price: 799, stock: 12, category: "phone", status: "In Stock" }
// "image" and "status" are optional. Status is worked out from stock if it's missing.

const PAGE_SIZE = 13;
let currentFilter = "all";
let currentPage = 1;

/* ------------------------------------------------------------------
   DATA LAYER: the ONLY place the backend needs to connect.
   For now products are kept in this browser's localStorage so you can
   test the pop-up. When the backend is ready, replace these two
   functions with calls to the server (GET all products, POST a new one).
------------------------------------------------------------------ */
const STORE_KEY = "inventory_products";

function getProducts() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function addProduct(data) {
  const list = getProducts();

  // the backend will generate the real ID; this makes a unique 6-digit one for now
  let id;
  do {
    id = String(Math.floor(100000 + Math.random() * 900000));
  } while (list.some(function (p) { return p.id === id; }));

  const product = {
    id: id,
    name: data.name,
    category: data.category,
    price: data.price,
    stock: 0,            // stock goes up later through Transactions
    image: data.image || ""
  };

  list.push(product);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) {}
  return product;
}

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
  const b = document.createElement("button");
  b.type = "button";
  b.className = "edit-btn";
  b.setAttribute("aria-label", "Edit product");
  if (id != null) b.dataset.id = id;
  b.innerHTML = PENCIL;
  s.appendChild(b);
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

/* ------------------------- Add Product pop-up ------------------------- */
function setupAddModal() {
  const modal = document.getElementById("addModal");
  const form = document.getElementById("addForm");
  const openBtn = document.getElementById("addProductBtn");
  const discardBtn = document.getElementById("discardBtn");
  const nameInput = document.getElementById("pName");
  const categoryInput = document.getElementById("pCategory");
  const priceInput = document.getElementById("pPrice");
  const errorBox = document.getElementById("addError");

  const CLOSE_MS = 200;          // must match the closing animation time in components.css
  let closeTimer = null;

  function clearErrors() {
    errorBox.hidden = true;
    errorBox.textContent = "";
    [nameInput, categoryInput, priceInput].forEach(function (el) { el.classList.remove("has-error"); });
  }

  function fail(message, field) {
    errorBox.textContent = message;
    errorBox.hidden = false;
    field.classList.add("has-error");
    field.focus();
  }

  function openModal() {
    clearTimeout(closeTimer);
    clearErrors();
    modal.classList.remove("is-closing");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");

    // restart the opening animation every time
    modal.classList.remove("is-opening");
    void modal.offsetWidth;
    modal.classList.add("is-opening");

    nameInput.focus();
  }

  // Discard is the ONLY way to leave without adding (like the dashboard pop-up).
  function closeModal() {
    if (modal.hidden || modal.classList.contains("is-closing")) return;

    modal.classList.remove("is-opening");
    modal.classList.add("is-closing");

    closeTimer = setTimeout(function () {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-closing");
      form.reset();
      clearErrors();
      openBtn.focus();
    }, CLOSE_MS);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();

    const name = nameInput.value.trim();
    const category = categoryInput.value;
    const priceText = priceInput.value.trim().replace(/,/g, "");
    const price = Number(priceText);

    if (!name) return fail("Please enter the product name.", nameInput);
    if (!category) return fail("Please select a category.", categoryInput);
    if (priceText === "" || !isFinite(price) || price < 0) {
      return fail("Please enter a valid price, like 799 or 49.99.", priceInput);
    }

    addProduct({ name: name, category: category, price: price });

    // jump to the last page of "All" so the new product is visible
    showTab("all");
    currentPage = Number.MAX_SAFE_INTEGER;   // render() trims this to the last page
    render();
    closeModal();
  });

  openBtn.addEventListener("click", openModal);
  discardBtn.addEventListener("click", closeModal);
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

  // Edit pencils and Filters get their pop-ups in the next steps.
  render();
});