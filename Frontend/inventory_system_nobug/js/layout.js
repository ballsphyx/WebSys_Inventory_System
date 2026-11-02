// ONE copy of the top bar + sidebar for every page.
// Each page needs:  <body data-page="inventory">  <header id="topbar"></header>  <aside id="sidebar"></aside>

// Later this comes from the logged-in user (backend).
const USER = { firstName: "Zaheed", fullName: "Zaheed Abubakar", role: "PRODUCT DESIGNER" };

const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
const ICON = {
  search: `<svg viewBox="0 0 24 24" ${S} stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`,
  user: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.8"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 21c0-4.2 3.3-6.8 7.5-6.8s7.5 2.6 7.5 6.8"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.6"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.6"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" ${S} stroke-width="1.6"><path d="M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M3 7l12-4v4"/><circle cx="16.5" cy="13.5" r="1"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" ${S} stroke-width="2"><rect x="3" y="3" width="11" height="18" rx="2" fill="currentColor"/><path d="M14 12h8M18.5 8l3.5 4-3.5 4"/></svg>`
};

const PAGES = [
  { id: "dashboard",    label: "Dashboard",    href: "dashboard.html",    icon: ICON.dashboard },
  { id: "inventory",    label: "Inventory",    href: "inventory.html",    icon: ICON.layers },
  { id: "transactions", label: "Transactions", href: "transactions.html", icon: ICON.wallet },
  { id: "reports",      label: "Reports",      href: "reports.html",      icon: ICON.layers }
];

(function renderLayout() {
  const active = document.body.dataset.page;

  document.getElementById("topbar").innerHTML = `
    <div class="brand">
      <img src="../images/logo_4k.png" alt="Inventory System logo" />
      <h1>Welcome <span id="welcomeName">${USER.firstName}</span>!</h1>
    </div>
    <label class="search">
      ${ICON.search}
      <input type="text" id="searchInput" placeholder="Search" />
    </label>`;

  document.getElementById("sidebar").innerHTML = `
    <div class="profile">
      <div class="avatar">${ICON.user}</div>
      <small id="profileRole">${USER.role}</small>
      <strong id="profileName">${USER.fullName}</strong>
    </div>
    <p class="nav-label">MAIN</p>
    <nav class="nav">
      ${PAGES.map(p => `<a href="${p.href}" class="${p.id === active ? "active" : ""}">${p.icon}${p.label}</a>`).join("")}
    </nav>
    <a href="../index.html" class="logout" id="logout">${ICON.logout}Logout</a>`;
})();

// ===== Search: recent searches =====
// Click the search bar to see your recent searches. Click one to use it again, click the x to
// remove just that one, or "Clear history" to remove them all. Press Enter to save what you typed.
// The search bar doesn't filter any page yet. When you press Enter, or pick a recent search, it
// sends an "app-search" event with the text, so any page can listen for it later:
//   document.addEventListener("app-search", function (e) { console.log(e.detail.term); });
;(function () {
  const input = document.getElementById("searchInput");
  if (!input) return;
  const field = input.closest(".search") || input;

  /* ------------------------------------------------------------------
     DATA LAYER: the ONLY place the backend needs to connect.
     For now the recent searches are kept in this browser's localStorage.
     With a backend, getRecent() / saveRecent() would read and write the logged-in
     user's search history on the server instead.
  ------------------------------------------------------------------ */
  const KEY = "recent_searches";
  const MAX = 8;                                  // how many recent searches are kept

  function getRecent() {
    try {
      const list = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(list) ? list.filter(function (t) { return typeof t === "string" && t; }) : [];
    } catch (e) {
      return [];
    }
  }
  function saveRecent(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  // newest first, no duplicates (ignoring capital letters)
  function remember(term) {
    const t = term.trim();
    if (!t) return;
    const rest = getRecent().filter(function (x) { return x.toLowerCase() !== t.toLowerCase(); });
    saveRecent([t].concat(rest).slice(0, MAX));
  }

  /* ---- styles: sized in rem, so it scales with the page when you zoom ---- */
  const style = document.createElement("style");
  style.textContent = `
    .rs {
      position: fixed; z-index: 90; padding: 1.2rem 0.6rem 0.6rem;
      background: #ffffff; color: #222222; font-family: 'Inter', Arial, Helvetica, sans-serif;
      border: 0.1rem solid #e3e3e3; border-radius: 1.4rem;
      box-shadow: 0 0.4rem 1.6rem rgba(0, 0, 0, 0.25);
    }
    .rs[hidden] { display: none; }
    .rs-head { display: flex; justify-content: space-between; align-items: center; padding: 0 1.3rem 0.6rem; }
    .rs-head span { font-size: 0.95rem; color: #888888; }
    .rs-clear {
      padding: 0; border: none; background: none; color: #2a5c47;
      font-family: inherit; font-size: 0.95rem; text-decoration: underline; cursor: pointer;
    }
    .rs-clear:hover { color: #1b3f31; }
    .rs-list { list-style: none; max-height: min(26rem, calc(100vh - 150px)); overflow-y: auto; scrollbar-width: thin; }
    .rs-row { display: flex; align-items: center; border-radius: 0.8rem; }
    .rs-row:hover, .rs-row.active { background: #eef5f1; }
    .rs-item {
      flex: 1; min-width: 0; display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1.3rem;
      border: none; background: none; text-align: left; cursor: pointer;
      font-family: inherit; font-size: 1.1rem; color: #222222;
    }
    .rs-item svg { flex: none; width: 1.2rem; height: 1.2rem; color: #9a9a9a; }
    .rs-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rs-x {
      flex: none; width: 2.4rem; height: 2.4rem; margin-right: 0.8rem; padding: 0;
      border: none; border-radius: 50%; background: none; color: #999999;
      font-family: inherit; font-size: 1.4rem; line-height: 1; cursor: pointer;
    }
    .rs-x:hover { background: #dfeae4; color: #333333; }
    .rs-empty { padding: 0.8rem 1.3rem 1rem; font-size: 1.05rem; color: #888888; }
    .rs button:focus-visible { outline: 0.125rem solid #2563eb; outline-offset: 0.1rem; }`;
  document.head.appendChild(style);

  /* ---- the dropdown ---- */
  const box = document.createElement("div");
  box.className = "rs";
  box.hidden = true;
  document.body.appendChild(box);

  const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  let active = -1;                                // the row picked with the arrow keys

  function place() {
    if (box.hidden) return;
    const r = field.getBoundingClientRect();
    box.style.left = r.left + "px";
    box.style.top = r.bottom + 6 + "px";
    box.style.width = r.width + "px";
  }

  // build the dropdown; returns false when there is nothing to show
  function render() {
    const all = getRecent();
    const q = input.value.trim().toLowerCase();
    const list = q ? all.filter(function (t) { return t.toLowerCase().indexOf(q) !== -1; }) : all;
    if (q && !list.length) return false;          // typing something that matches no recent search

    box.innerHTML = "";

    const head = document.createElement("div");
    head.className = "rs-head";
    const title = document.createElement("span");
    title.textContent = "Recent searches";
    head.appendChild(title);

    if (all.length) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "rs-clear";
      clear.textContent = "Clear history";
      clear.addEventListener("click", function () {
        saveRecent([]);
        active = -1;
        render();
        input.focus();
      });
      head.appendChild(clear);
    }
    box.appendChild(head);

    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "rs-empty";
      empty.textContent = "No recent searches yet";
      box.appendChild(empty);
      return true;
    }

    const ul = document.createElement("ul");
    ul.className = "rs-list";
    list.forEach(function (term, i) {
      const li = document.createElement("li");
      li.className = "rs-row" + (i === active ? " active" : "");

      const pick = document.createElement("button");
      pick.type = "button";
      pick.className = "rs-item";
      pick.innerHTML = CLOCK;
      const text = document.createElement("span");
      text.textContent = term;                    // text, never HTML, so nothing typed can run as code
      pick.appendChild(text);
      pick.addEventListener("click", function () { choose(term); });

      const x = document.createElement("button");
      x.type = "button";
      x.className = "rs-x";
      x.setAttribute("aria-label", "Remove " + term + " from recent searches");
      x.textContent = "\u00D7";
      x.addEventListener("click", function () {
        saveRecent(getRecent().filter(function (t) { return t !== term; }));
        active = -1;
        render();
        place();
        input.focus();
      });

      li.append(pick, x);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    return true;
  }

  function open() {
    active = -1;
    if (!render()) { close(); return; }
    box.hidden = false;
    place();
  }

  function close() {
    box.hidden = true;
    active = -1;
  }

  function announce(term) {
    document.dispatchEvent(new CustomEvent("app-search", { detail: { term: term } }));
  }

  function choose(term) {
    input.value = term;
    remember(term);
    close();
    input.focus();
    announce(term);
  }

  input.addEventListener("focus", open);
  input.addEventListener("click", function () { if (box.hidden) open(); });
  input.addEventListener("input", open);          // while typing, only matching recent searches show

  input.addEventListener("keydown", function (e) {
    const rows = box.hidden ? [] : Array.from(box.querySelectorAll(".rs-row"));

    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (box.hidden) { open(); return; }
      if (!rows.length) return;
      e.preventDefault();
      active = e.key === "ArrowDown" ? (active + 1) % rows.length : (active - 1 + rows.length) % rows.length;
      rows.forEach(function (row, i) { row.classList.toggle("active", i === active); });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && rows[active]) {
        choose(rows[active].querySelector(".rs-item span").textContent);
      } else if (input.value.trim()) {
        remember(input.value);
        close();
        announce(input.value.trim());
      }
    }
  });

  // clicking anywhere else (or tabbing away) closes the list
  function outside(target) { return !box.contains(target) && !field.contains(target); }
  document.addEventListener("mousedown", function (e) { if (!box.hidden && outside(e.target)) close(); });
  document.addEventListener("focusin", function (e) { if (!box.hidden && outside(e.target)) close(); });

  // zooming or resizing changes the sizes: keep the list under the search bar
  window.addEventListener("resize", place);
})();

// ===== Date fields =====
// The browser draws its own text, icon AND calendar popup for <input type="date">, and none of
// those follow the zoom-proof sizing used everywhere else (they got huge or tiny when you zoomed).
// So every date input gets OUR text, calendar icon and calendar popup, all sized with the same
// units as the other fields (--u inside the pop-ups). The real input stays underneath, invisible,
// so the page's code still reads a value like "2026-10-31" from it.
// The calendar floats above the whole page and is placed where it fits inside the window
// (below the field, else above it, else kept on screen), so Clear / Today are never cut off.
// It works for every date input on every page, including ones created later.
;(function () {
  const u = function (n) { return "calc(" + n + " * var(--u, 1rem))"; };   // "n units", zoom-proof

  const css = `
    .date-field { position: relative; width: 100%; }
    .date-field input[type="date"] {
      position: relative; display: block; width: 100%;
      color: transparent !important;
      -webkit-text-fill-color: transparent;
      caret-color: transparent;
      cursor: pointer;
    }
    .date-field input[type="date"]::-webkit-datetime-edit { opacity: 0; }
    .date-field input[type="date"]::-webkit-inner-spin-button { display: none; }
    .date-field input[type="date"]::-webkit-calendar-picker-indicator { display: none; }
    .date-field .date-view {
      position: absolute; top: 0; bottom: 0;
      left: ${u(1.1)}; right: ${u(3.6)};
      display: flex; align-items: center;
      font-family: inherit; font-size: ${u(1.15)};
      color: #222222; white-space: nowrap; pointer-events: none;
    }
    .date-field.is-empty .date-view { color: #9a9a9a; }
    .date-field .date-icon {
      position: absolute; top: 50%; right: ${u(1)};
      width: ${u(1.5)}; height: ${u(1.5)};
      transform: translateY(-50%); color: #9a9a9a; pointer-events: none;
    }

    /* our own calendar popup: it lives on <body>, above everything, and is placed by the script */
    .cal {
      position: fixed; z-index: 300;
      width: ${u(28)}; max-height: calc(100vh - 16px); overflow-y: auto;
      padding: ${u(1.2)} ${u(1.4)} ${u(0.8)};
      background: #ffffff; color: #222222; font-family: 'Inter', Arial, Helvetica, sans-serif;
      border: ${u(0.1)} solid #e1e1e1; border-radius: ${u(0.8)};
      box-shadow: 0 ${u(0.4)} ${u(1.6)} rgba(0, 0, 0, 0.25);
    }
    .cal[hidden] { display: none; }
    .cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: ${u(0.8)}; }
    .cal-title { flex: 1; text-align: center; font-size: ${u(1.2)}; font-weight: 500; }
    .cal-nav {
      width: ${u(2.4)}; height: ${u(2.4)}; padding: 0; border: none; border-radius: 50%;
      background: none; color: #555555; font-family: inherit; font-size: ${u(1.5)}; line-height: 1; cursor: pointer;
    }
    .cal-nav:hover { background: #eef5f1; color: #1b3f31; }
    .cal-week, .cal-days { display: grid; grid-template-columns: repeat(7, 1fr); }
    .cal-week span { padding: ${u(0.3)} 0 ${u(0.4)}; text-align: center; font-size: ${u(0.95)}; color: #888888; }
    .cal-days button {
      height: ${u(3)}; margin: ${u(0.1)}; padding: 0;
      border: ${u(0.1)} solid transparent; border-radius: ${u(0.6)};
      background: none; color: #222222; font-family: inherit; font-size: ${u(1.1)}; cursor: pointer;
    }
    .cal-days button:hover { background: #eef5f1; }
    .cal-days button.other { color: #b5b5b5; }
    .cal-days button.today { border-color: #2a5c47; }
    .cal-days button.sel { background: #2a5c47; border-color: #2a5c47; color: #ffffff; }
    .cal-foot {
      display: flex; justify-content: space-between;
      margin-top: ${u(0.6)}; padding-top: ${u(0.6)}; border-top: ${u(0.1)} solid #eeeeee;
    }
    .cal-foot button {
      height: ${u(2.2)}; padding: 0 ${u(0.4)}; border: none; background: none;
      color: #2a5c47; font-family: inherit; font-size: ${u(1.05)};
      text-decoration: underline; cursor: pointer;
    }
    .cal-foot button:hover { color: #1b3f31; }
    .cal button:focus-visible { outline: ${u(0.125)} solid #2563eb; outline-offset: ${u(0.1)}; }`;

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const ICON_HTML =
    '<svg class="date-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const pad = function (n) { return String(n).padStart(2, "0"); };
  const toISO = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const parse = function (iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };

  const valueProp = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  let openCal = null;                       // only one calendar is open at a time

  function enhance(input) {
    if (input.dataset.dateField) return;
    input.dataset.dateField = "1";

    const hadFocus = document.activeElement === input;
    input.readOnly = true;                  // the calendar is the way to pick; no typing into hidden segments

    const wrap = document.createElement("div");
    wrap.className = "date-field";
    const view = document.createElement("span");
    view.className = "date-view";
    view.setAttribute("aria-hidden", "true");

    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    wrap.appendChild(view);
    wrap.insertAdjacentHTML("beforeend", ICON_HTML);

    const cal = document.createElement("div");   // added to <body> only while it is open
    cal.className = "cal";
    cal.hidden = true;

    let viewY = 0, viewM = 0;
    const api = { close: close, reposition: place };

    // the text on top of the input: mm/dd/yyyy, or the grey placeholder when it is empty
    function update() {
      const d = parse(valueProp.get.call(input));
      view.textContent = d ? pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + "/" + d.getFullYear() : "mm/dd/yyyy";
      wrap.classList.toggle("is-empty", !d);
      if (!cal.hidden) render();
    }

    // when the page sets the value in code (input.value = ""), the text on top follows
    Object.defineProperty(input, "value", {
      configurable: true,
      get: function () { return valueProp.get.call(this); },
      set: function (v) { valueProp.set.call(this, v); update(); }
    });

    input.addEventListener("input", update);
    input.addEventListener("change", update);
    if (input.form) input.form.addEventListener("reset", function () { setTimeout(update, 0); });

    function setValue(iso) {
      valueProp.set.call(input, iso);
      update();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function render() {
      const selected = valueProp.get.call(input);
      const today = toISO(new Date());
      const offset = new Date(viewY, viewM, 1).getDay();          // blank days before the 1st

      let days = "";
      for (let i = 0; i < 42; i++) {                              // 6 weeks, so the height never changes
        const d = new Date(viewY, viewM, 1 - offset + i);
        const iso = toISO(d);
        const cls = (d.getMonth() !== viewM ? " other" : "") + (iso === today ? " today" : "") + (iso === selected ? " sel" : "");
        days += '<button type="button" class="' + cls.trim() + '" data-date="' + iso + '">' + d.getDate() + "</button>";
      }

      cal.innerHTML =
        '<div class="cal-head">' +
          '<button type="button" class="cal-nav" data-nav="-12" aria-label="Previous year">\u00AB</button>' +
          '<button type="button" class="cal-nav" data-nav="-1" aria-label="Previous month">\u2039</button>' +
          '<span class="cal-title">' + MONTH_NAMES[viewM] + " " + viewY + "</span>" +
          '<button type="button" class="cal-nav" data-nav="1" aria-label="Next month">\u203A</button>' +
          '<button type="button" class="cal-nav" data-nav="12" aria-label="Next year">\u00BB</button>' +
        "</div>" +
        '<div class="cal-week">' + WEEKDAYS.map(function (w) { return "<span>" + w + "</span>"; }).join("") + "</div>" +
        '<div class="cal-days">' + days + "</div>" +
        '<div class="cal-foot">' +
          '<button type="button" data-act="clear">Clear</button>' +
          '<button type="button" data-act="today">Today</button>' +
        "</div>";
    }

    // Puts the calendar where it fits: below the field, else above it, else kept fully on screen.
    function place() {
      if (cal.hidden) return;
      const PAD = 8, GAP = 6;
      const r = wrap.getBoundingClientRect();
      const w = cal.offsetWidth, h = cal.offsetHeight;
      const vw = window.innerWidth, vh = window.innerHeight;

      let top;
      if (r.bottom + GAP + h <= vh - PAD) top = r.bottom + GAP;          // fits below
      else if (r.top - GAP - h >= PAD) top = r.top - GAP - h;            // fits above
      else top = Math.max(PAD, vh - PAD - h);                            // neither: stay fully on screen

      const left = Math.min(Math.max(PAD, r.right - w), Math.max(PAD, vw - w - PAD));
      cal.style.top = top + "px";
      cal.style.left = left + "px";
    }

    function open(byKeyboard) {
      if (openCal && openCal !== api) openCal.close();
      const start = parse(valueProp.get.call(input)) || new Date();
      viewY = start.getFullYear();
      viewM = start.getMonth();

      // the calendar is outside the pop-up, so it needs the pop-up's size unit copied over
      const unit = getComputedStyle(wrap).getPropertyValue("--u").trim();
      if (unit) cal.style.setProperty("--u", unit); else cal.style.removeProperty("--u");

      cal.hidden = false;
      document.body.appendChild(cal);
      render();
      place();

      openCal = api;
      if (byKeyboard) {
        const first = cal.querySelector(".sel") || cal.querySelector(".today") || cal.querySelector(".cal-days button");
        if (first) first.focus();
      }
    }

    function close() {
      cal.hidden = true;
      cal.remove();
      if (openCal === api) openCal = null;
    }

    // clicking the field toggles our calendar (the browser's own popup is blocked)
    input.addEventListener("mousedown", function (e) {
      e.preventDefault();
      input.focus();
    });
    input.addEventListener("click", function () {
      if (cal.hidden) open(false); else close();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        open(true);
      }
    });

    cal.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        input.focus();
      }
    });

    cal.addEventListener("click", function (e) {
      const nav = e.target.closest("[data-nav]");
      const day = e.target.closest("[data-date]");
      const act = e.target.closest("[data-act]");

      if (nav) {
        const d = new Date(viewY, viewM + Number(nav.dataset.nav), 1);
        viewY = d.getFullYear();
        viewM = d.getMonth();
        render();
        const again = cal.querySelector('[data-nav="' + nav.dataset.nav + '"]');
        if (again && e.detail === 0) again.focus();          // keep the keyboard on the same arrow
      } else if (day) {
        setValue(day.dataset.date);
        close();
        input.focus();
      } else if (act) {
        setValue(act.dataset.act === "today" ? toISO(new Date()) : "");
        close();
        input.focus();
      }
    });

    update();
    if (hadFocus) input.focus();         // moving the input into its wrapper would otherwise drop focus
  }

  // clicking, or tabbing, anywhere outside an open calendar (and its field) closes it
  function outside(target) { return !target.closest(".date-field") && !target.closest(".cal"); }
  document.addEventListener("mousedown", function (e) { if (openCal && outside(e.target)) openCal.close(); });
  document.addEventListener("focusin", function (e) { if (openCal && outside(e.target)) openCal.close(); });

  // zooming or resizing the window changes the sizes: re-place the open calendar
  window.addEventListener("resize", function () { if (openCal) openCal.reposition(); });

  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches('input[type="date"]')) enhance(node);
    node.querySelectorAll('input[type="date"]').forEach(enhance);
  }

  scan(document.body);

  // pop-ups that build their fields later (like the Reports Filters) are picked up here
  new MutationObserver(function (records) {
    records.forEach(function (r) { r.addedNodes.forEach(scan); });
  }).observe(document.body, { childList: true, subtree: true });
})();