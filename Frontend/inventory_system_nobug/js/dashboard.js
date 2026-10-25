// ===== Low Stock Items list =====
// Each item the backend sends will look like:
//   { name: "Sony WH-1000XM4", left: 2, image: "https://.../sony.jpg" }
// "image" is optional. With no image (or a broken link) the grey box stays.
function getLowStock() {
  // Later this will come from data.js (and then the backend).
  // While it returns nothing, the page keeps the grey placeholder rows from your design.
  return [];
}

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
  renderLowStock();

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
    return [];   // each item will look like: { text: "Added to stock", time: "2 hrs ago", color: "green" }
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