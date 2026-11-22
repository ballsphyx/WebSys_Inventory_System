// ===== Low Stock Items list =====
// Each item the backend sends will look like:
//   { name: "Sony WH-1000XM4", left: 2, image: "https://.../sony.jpg" }
// "image" is optional. With no image (or a broken link) the grey box stays.
let dashboardData = null;
function getLowStock() { return (dashboardData?.lowStockItems || []).map(p => ({ name: p.name, left: p.stock, image: p.image })); }

function makeThumb(image, name) {
  const thumb = document.createElement("div");
  thumb.className = "thumb";

  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = name || "";
    img.loading = "lazy";
    img.addEventListener("error", function () {
      img.remove();                    // broken link: fall back to the grey box
    });
    thumb.appendChild(img);
  }
  return thumb;
}

function renderLowStock() {
  const list = document.getElementById("lowStockList");
  const items = getLowStock();
  if (!list || !items.length) return;  // nothing to show yet: keep the placeholders

  list.innerHTML = "";
  items.forEach(function (item) {
    const li = document.createElement("li");

    const text = document.createElement("div");
    text.className = "stock-text";

    const name = document.createElement("strong");
    name.textContent = item.name || "";

    const left = document.createElement("small");
    left.className = item.left <= 2 ? "" : "warn";   // red for 0-2 left, yellow for more
    left.textContent = "Only " + item.left + " left in stock";

    text.append(name, left);
    li.append(makeThumb(item.image, item.name), text);
    list.appendChild(li);
  });
}

// ===== Recent Activity "View all" pop-up =====
document.addEventListener("DOMContentLoaded", function () {
  InventoryAPI.request("/api/dashboard").then(data => {
    dashboardData = data;
    renderLowStock();
    const values = { statProducts: data.totalProducts, statStocks: data.totalStocks, statLow: data.lowStocks, statOut: data.outOfStocks };
    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Number(value).toLocaleString();
    });
    const activityList = document.getElementById("activityList");
    if (activityList) {
      activityList.innerHTML = "";
      data.recentTransactions.slice(0, 4).forEach(t => {
        const li = document.createElement("li");
        const dot = document.createElement("i"); dot.className = "adot adot-" + (t.type === "In" ? "green" : t.type === "Out" ? "red" : "blue");
        const text = document.createElement("span"); text.className = "a-text"; text.textContent = `${t.type === "In" ? "Stock In" : t.type === "Out" ? "Stock Out" : "Adjustment"} · ${t.product}`;
        const time = document.createElement("span"); time.className = "a-time"; time.textContent = new Date(t.date).toLocaleDateString();
        li.append(dot, text, time); activityList.appendChild(li);
      });
    }
  }).catch(error => console.error("Dashboard API error:", error));

  const modal = document.getElementById("activityModal");
  const list = document.getElementById("activityModalList");
  const viewAll = document.getElementById("viewAllLink");
  const backBtn = document.getElementById("modalBack");

  if (!modal || !list || !viewAll) return;

  const COLORS = ["green", "yellow", "blue", "red"];
  const CLOSE_MS = 200;          // must match the closing animation time in the CSS
  let closeTimer = null;

  // Later this will come from data.js (and then the backend).
  // For now it returns nothing, so the pop-up shows empty placeholder rows like your design.
  function getActivity() {
    return (dashboardData?.recentTransactions || []).map(t => ({
      text: `${t.type === "In" ? "Stock received" : t.type === "Out" ? "Stock removed" : "Stock adjusted"} · ${t.product} (${t.quantity})`,
      time: new Date(t.date).toLocaleString(), color: t.type === "In" ? "green" : t.type === "Out" ? "red" : "blue"
    }));
  }

  function renderRows() {
    const items = getActivity();
    const rows = items.length ? items : Array.from({ length: 20 }, () => ({}));

    list.innerHTML = "";
    rows.forEach(function (item, i) {
      const li = document.createElement("li");
      li.style.setProperty("--i", i);   // used to stagger the row animation

      const dot = document.createElement("i");
      dot.className = "adot adot-" + (item.color || COLORS[i % COLORS.length]);

      const text = document.createElement("span");
      text.className = "a-text";
      text.textContent = item.text || "";

      const time = document.createElement("span");
      time.className = "a-time";
      time.textContent = item.time || "";

      li.append(dot, text, time);
      list.appendChild(li);
    });
  }

  function openModal() {
    clearTimeout(closeTimer);
    renderRows();
    modal.classList.remove("is-closing");
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");

    // restart the opening animation every time
    modal.classList.remove("is-opening");
    void modal.offsetWidth;
    modal.classList.add("is-opening");

    if (backBtn) backBtn.focus();   // keyboard users land on the back button
  }

  function closeModal() {
    if (modal.hidden || modal.classList.contains("is-closing")) return;

    modal.classList.remove("is-opening");
    modal.classList.add("is-closing");

    // hide it for real once the closing animation has finished
    closeTimer = setTimeout(function () {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-closing");
      viewAll.focus();              // hand focus back to "View all"
    }, CLOSE_MS);
  }

  viewAll.addEventListener("click", function (e) {
    e.preventDefault();          // stay on the dashboard and open the pop-up
    openModal();
  });

  // The back arrow is the ONLY way to close the pop-up.
  if (backBtn) backBtn.addEventListener("click", closeModal);
});