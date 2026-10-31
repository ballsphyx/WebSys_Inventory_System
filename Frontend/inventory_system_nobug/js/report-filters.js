// ===== Reports: the Filters pop-up =====
// Each report tab gets its own filter choices. The chosen filters are kept in
// reportFilters[kind] (defined in reports.js) and applied there by applyFilters().
(function () {
  const CLOSE_MS = 200;                       // must match the closing animation in components.css
  const $ = function (id) { return document.getElementById(id); };

  const STOCK_STATUSES = [["In Stock", "In Stock"], ["Low Stock", "Low Stock"], ["Out of Stock", "Out of Stock"]];

  // options come from what exists on your Inventory / Transactions pages (readList etc. live in reports.js)
  function categoryOptions() {
    const seen = {};
    readList("inventory_products").concat(readList("inventory_transactions")).forEach(function (p) {
      const k = String(p.category || "").trim().toLowerCase();
      if (k && !seen[k]) seen[k] = capitalize(p.category);
    });
    return Object.keys(seen).sort().map(function (k) { return [k, seen[k]]; });
  }

  function userOptions() {
    const seen = {};
    buildMovements().forEach(function (m) { if (m.user) seen[m.user] = true; });
    return Object.keys(seen).sort().map(function (u) { return [u, u]; });
  }

  const DATES = [
    { key: "from", label: "From", type: "date" },
    { key: "to", label: "To", type: "date" }
  ];

  const SPECS = {
    period: function () {
      return DATES.concat([{ key: "minRevenue", label: "Min Revenue", type: "text", placeholder: "Enter amount" }]);
    },
    product: function () {
      return [
        { key: "category", label: "Category", type: "select", options: categoryOptions(), all: "All categories" },
        { key: "status", label: "Status", type: "select", options: STOCK_STATUSES, all: "All statuses" }
      ];
    },
    category: function () {
      return [{ key: "category", label: "Category", type: "select", options: categoryOptions(), all: "All categories" }];
    },
    top: function () {
      return [
        { key: "category", label: "Category", type: "select", options: categoryOptions(), all: "All categories" },
        { key: "limit", label: "Show", type: "select", options: [["5", "Top 5"], ["10", "Top 10"], ["20", "Top 20"]], all: "All products" }
      ];
    },
    movement: function () {
      return DATES.concat([
        { key: "product", label: "Product", type: "text", placeholder: "Enter product name" },
        { key: "user", label: "User", type: "select", options: userOptions(), all: "All users" }
      ]);
    }
  };
  SPECS.revenue = SPECS.period;

  /* ---- the pop-up ---- */
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML =
    '<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="rfTitle">' +
      '<h2 class="dialog-title" id="rfTitle"></h2>' +
      '<p class="dialog-sub">Choose what you want to see in this report</p>' +
      '<form id="rfForm" novalidate><div id="rfFields"></div>' +
        '<button type="button" class="f-clear" id="rfClear">Clear filters</button>' +
        '<p class="form-error" id="rfError" role="alert"></p>' +
        '<div class="dialog-actions">' +
          '<button type="button" class="btn-discard" id="rfDiscard">Discard</button>' +
          '<button type="submit" class="btn-submit">Apply Filters</button>' +
        '</div></form></section>';
  document.body.appendChild(overlay);

  let timer = null, kind = "daily";

  function syncEmpty(el) {
    if (el.tagName === "SELECT" || el.type === "date") el.classList.toggle("is-empty", !el.value);
  }

  function inputs() { return Array.from($("rfFields").querySelectorAll("[data-key]")); }

  function clearErrors() {
    $("rfError").textContent = "";
    inputs().forEach(function (el) { el.classList.remove("has-error"); });
  }

  function fail(message, el) {
    $("rfError").textContent = message;
    el.classList.add("has-error");
    el.focus();
  }

  function build() {
    const cfg = KINDS[kind];
    const saved = reportFilters[kind] || {};
    const box = $("rfFields");
    box.innerHTML = "";

    SPECS[cfg.type]().forEach(function (s, i) {
      const row = document.createElement("div");
      row.className = "f-row";
      const label = document.createElement("label");
      label.textContent = s.label;
      label.htmlFor = "rf" + i;

      let input;
      if (s.type === "select") {
        input = document.createElement("select");
        const all = document.createElement("option");
        all.value = "";
        all.textContent = s.all || "All";
        input.appendChild(all);
        s.options.forEach(function (o) {
          const opt = document.createElement("option");
          opt.value = o[0];
          opt.textContent = o[1];
          input.appendChild(opt);
        });
      } else {
        input = document.createElement("input");
        input.type = s.type;
        if (s.placeholder) input.placeholder = s.placeholder;
        input.autocomplete = "off";
        if (s.key === "minRevenue") input.inputMode = "decimal";
      }

      input.id = "rf" + i;
      input.dataset.key = s.key;
      input.value = saved[s.key] != null ? String(saved[s.key]) : "";
      syncEmpty(input);
      input.addEventListener("input", function () { syncEmpty(input); });
      input.addEventListener("change", function () { syncEmpty(input); });

      row.append(label, input);
      box.appendChild(row);
    });
  }

  function open() {
    kind = reportKind;                                   // the tab that is showing right now
    $("rfTitle").textContent = "Filter " + KINDS[kind].title.replace(/ Report$/, "");
    build();
    clearErrors();

    clearTimeout(timer);
    overlay.classList.remove("is-closing");
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    overlay.classList.remove("is-opening");
    void overlay.offsetWidth;                            // restart the opening animation
    overlay.classList.add("is-opening");
    (inputs()[0] || $("rfDiscard")).focus();
  }

  // Discard is the ONLY way out without applying, like the other pop-ups
  function close() {
    if (overlay.hidden || overlay.classList.contains("is-closing")) return;
    overlay.classList.remove("is-opening");
    overlay.classList.add("is-closing");
    timer = setTimeout(function () {
      overlay.hidden = true;
      overlay.setAttribute("aria-hidden", "true");
      overlay.classList.remove("is-closing");
      $("filtersBtn").focus();
    }, CLOSE_MS);
  }

  $("rfForm").addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();

    const values = {};
    const byKey = {};
    inputs().forEach(function (el) {
      byKey[el.dataset.key] = el;
      const v = el.value.trim();
      if (v !== "") values[el.dataset.key] = v;
    });

    if (values.from && values.to && values.from > values.to) {
      return fail("The start date must be before the end date.", byKey.to);
    }
    if (values.minRevenue !== undefined) {
      const n = Number(String(values.minRevenue).replace(/,/g, ""));
      if (!isFinite(n) || n < 0) return fail("Please enter a valid amount, like 500.", byKey.minRevenue);
      values.minRevenue = n;
    }

    reportFilters[kind] = values;
    reportPage = 1;
    renderReport();
    close();
  });

  $("rfClear").addEventListener("click", function () {
    inputs().forEach(function (el) { el.value = ""; syncEmpty(el); });
    clearErrors();
  });
  $("rfDiscard").addEventListener("click", close);

  document.addEventListener("DOMContentLoaded", function () {
    $("filtersBtn").addEventListener("click", open);
  });
})();